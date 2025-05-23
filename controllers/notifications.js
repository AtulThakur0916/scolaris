const models = require('../models');
const { sendEmail } = require('../helpers/zepto');
const { body, param, validationResult } = require('express-validator');
module.exports.controller = function (app) {

    // List Notifications
    app.get('/notifications/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        const { role, name } = req.user;
        if (role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const notifications = await models.Notifications.findAll({
                raw: true,
                order: [['sort_value', 'ASC']]
            });
            res.render('notifications/index', {
                notifications, success: res.locals.success,
                error: res.locals.error, role, name
            });
        } catch (error) {
            console.error('Error fetching notifications:', error);
            req.flash('error', 'Failed to fetch notifications');
            res.redirect('/');
        }
    });

    app.get('/notifications/create', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        const { role, name } = req.user;
        try {
            const parents = await models.Parents.findAll({ where: { otp_verified: true }, raw: true });
            res.render('notifications/create', {
                role,
                name,
                notify: {},
                parents
            });
        } catch (error) {
            console.error('Error loading create page:', error);
            req.flash('error', 'Failed to load notification creation page.');
            res.redirect('/notifications/index');
        }
    });

    app.get('/notifications/edit/:id', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        const { id } = req.params;
        const { role, name } = req.user;

        try {
            const notification = await models.Notifications.findByPk(id, { raw: true });
            const parents = await models.Parents.findAll({ where: { otp_verified: true }, raw: true });

            // Handle parent_ids based on its type (string, array, or null)
            let parentIds = [];
            if (notification.parent_ids) {
                if (Array.isArray(notification.parent_ids)) {
                    parentIds = notification.parent_ids;
                } else if (typeof notification.parent_ids === 'string') {
                    parentIds = notification.parent_ids.split(',').map(id => id.trim());
                }
            }

            res.render('notifications/edit', { role, name, notify: notification, parents, parentIds });
        } catch (error) {
            console.error('Error loading edit page:', error);
            req.flash('error', 'Failed to load notification edit page.');
            res.redirect('/notifications/index');
        }
    });


    app.post('/notifications/create',
        [
            body('title').trim().notEmpty().withMessage('Title is required'),
            body('message').trim().notEmpty().withMessage('Message is required'),
        ], async (req, res) => {
            if (!req.isAuthenticated()) {
                req.flash('error', 'Please login to continue');
                return res.redirect('/login');
            }
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                req.flash('error', errors.array().map(err => err.msg).join(', '));
                return res.redirect('/notifications/create');
            }
            try {
                const { title, message, notify_type, notify_for, parent_ids, sort_value } = req.body;
                let parentIdsToStore = [];
                let parents = [];

                if (notify_for === 'all') {
                    parents = await models.Parents.findAll({ attributes: ['id', 'email'], raw: true });
                    parentIdsToStore = parents.map(p => p.id);
                } else {
                    parentIdsToStore = Array.isArray(parent_ids) ? parent_ids : [parent_ids];
                    parents = await models.Parents.findAll({
                        where: { id: parentIdsToStore },
                        attributes: ['email'],
                        raw: true
                    });
                }

                const sortValue = sort_value ? parseInt(sort_value) : 0;
                if (isNaN(sortValue)) {
                    req.flash('error', 'Invalid sort value.');
                    return res.redirect('/notifications/create');
                }

                // Create notification first
                const notification = await models.Notifications.create({
                    title,
                    message,
                    notify_type,
                    notify_for,
                    parent_ids: parentIdsToStore,
                    status: true,
                    sort_value: sortValue,
                });

                // Send email notifications with error handling
                const emailSubject = `New Notification: ${title}`;
                const emailErrors = [];

                for (const parent of parents) {
                    if (parent.email) {
                        try {
                            await sendEmail(parent.email, emailSubject, message);
                        } catch (emailError) {
                            console.error(`Failed to send email to ${parent.email}:`, emailError);
                            emailErrors.push(parent.email);
                        }
                    }
                }

                if (emailErrors.length > 0) {
                    req.flash('warning', `Notification created but failed to send emails to ${emailErrors.length} recipients.`);
                } else {
                    req.flash('success', 'New Notification created successfully. All emails sent.');
                }

                res.redirect('/notifications/index');
            } catch (error) {
                console.error('Error creating notification:', error);
                let errorMessage = 'Failed to create notification.';

                if (error?.error?.code === 'TM_4001') {
                    errorMessage = 'Email service authentication failed. Please check your email service credentials.';
                }

                req.flash('error', errorMessage);
                res.redirect('/notifications/create');
            }
        });

    app.post(
        '/notifications/update/:id',
        [
            param('id').isUUID().withMessage('Invalid notification ID'),
            body('title').trim().notEmpty().withMessage('Title is required'),
            body('message').trim().notEmpty().withMessage('Message is required'),
        ],
        async (req, res) => {
            if (!req.isAuthenticated()) {
                req.flash('error', 'Please login to continue');
                return res.redirect('/login');
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                req.flash('error', errors.array().map(err => err.msg).join(', '));
                return res.redirect('/notifications/update/' + req.params.id);
            }

            const { id } = req.params;
            const { title, message, notify_type, notify_for, parent_ids, status, sort_value } = req.body;

            try {
                let parentIdsToStore = [];
                let parents = [];

                if (notify_for === 'all') {
                    parents = await models.Parents.findAll({ attributes: ['id', 'email'], raw: true });
                    parentIdsToStore = parents.map(p => p.id);
                } else {
                    if (!parent_ids || (Array.isArray(parent_ids) && parent_ids.length === 0)) {
                        req.flash('error', 'Please select at least one parent.');
                        return res.redirect('/notifications/update/' + id);
                    }
                    parentIdsToStore = Array.isArray(parent_ids) ? parent_ids : [parent_ids];
                    parents = await models.Parents.findAll({
                        where: { id: parentIdsToStore },
                        attributes: ['email'],
                        raw: true
                    });
                }

                const sortValue = sort_value ? parseInt(sort_value) : 0;

                const [rowsUpdated] = await models.Notifications.update(
                    {
                        title,
                        message,
                        notify_type,
                        notify_for,
                        parent_ids: parentIdsToStore,
                        status: status === 'true',
                        sort_value: sortValue,
                    },
                    { where: { id } }
                );

                if (rowsUpdated === 0) {
                    req.flash('error', 'Notification not found.');
                    return res.redirect('/notifications/index');
                }

                const emailSubject = `New Notification: ${title}`;
                for (const parent of parents) {
                    if (parent.email) {
                        await Promise.all(parents.map(parent => sendEmail(parent.email, emailSubject, message)));

                    }
                }

                req.flash('success', 'Notification updated successfully.');
                res.redirect('/notifications/index');
            } catch (error) {
                console.error('Error updating notification:', error);
                req.flash('error', 'Failed to update notification.');
                res.redirect('/notifications/update/' + id);
            }
        }
    );



    app.delete('/notifications/delete/:id', async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                return res.json({ success: false, message: 'Please login to continue' });
            }

            if (req.user.role.name !== "SuperAdmin") {
                return res.json({ success: false, message: 'You are not authorised to access this page.' });
            }

            const { id } = req.params;
            const notificationsData = await models.Notifications.findOne({ where: { id } });

            if (!notificationsData) {
                return res.json({ success: false, message: 'Notifications not found.' });
            }

            await models.Notifications.destroy({ where: { id } });
            return res.json({ success: true, message: 'Notifications deleted successfully.' });
        } catch (error) {
            return res.json({ success: false, message: error.message });
        }
    });
};
