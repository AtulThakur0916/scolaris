const models = require('../models');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');

module.exports.controller = function (app) {

    /**
     * Render Activities Index Page
     */
    app.get('/activities/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        const role = req.user.role.name;

        if (role !== "SuperAdmin" && role !== "School (Sub-Admin)" && role !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            let whereCondition = {};

            if (role === "School (Sub-Admin)" || role === "Administrator") {
                whereCondition.school_id = req.user.school_id;
            }

            const activityDetails = await models.Activity.findAll({
                attributes: ['id', 'title', 'description', 'status', 'school_id'],
                include: [
                    {
                        model: models.Schools,
                        as: 'school',
                        attributes: ['name']
                    }
                ],
                where: whereCondition,
                order: [['created_at', 'DESC']],
                raw: true,
                nest: true
            });

            res.render('activities/index', {
                activityDetails,
                success: req.flash('success'),
                error: req.flash('error')
            });
        } catch (error) {
            console.error('Error fetching activities:', error);
            req.flash('error', 'Failed to load activities.');
            res.redirect('/');
        }
    });

    /**
     * Render Create Activity Page
     */
    app.get('/activities/create', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/login');
        }

        const { name: role } = req.user.role;

        if (role !== "SuperAdmin" && role !== "School (Sub-Admin)" && role !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const schoolCondition = { status: 'Approve' };

            if (role === "School (Sub-Admin)" || role === "Administrator") {
                schoolCondition.id = req.user.school_id;
            }

            const schools = await models.Schools.findAll({
                attributes: ['id', 'name'],
                where: schoolCondition,
                raw: true
            });

            const errors = req.flash('errors')[0] || {};
            const formData = req.flash('activity')[0] || {};

            res.render('activities/create', {
                activity: formData,
                success: res.locals.success,
                error: res.locals.error,
                schools
            });
        } catch (error) {
            console.error('Error loading create activity page:', error);
            req.flash('error', 'Failed to load schools.');
            res.redirect('/activities/index');
        }
    });

    /**
     * Handle Create Activity
     */
    app.post('/activities/create', [
        body('school_id').notEmpty().withMessage('School ID is required.'),
        body('title').notEmpty().withMessage('Title is required.'),
        body('description').optional().trim()
    ], async (req, res) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('activity', req.body);
            return res.redirect('/activities/create');
        }

        const { school_id, title, description, status } = req.body;

        try {
            await models.Activity.create({ school_id, title, description, status });
            req.flash('success', 'Activity created successfully.');
            res.redirect('/activities/index');
        } catch (error) {
            console.error('Error creating activity:', error);
            req.flash('error', 'Failed to create activity.');
            res.redirect('/activities/create');
        }
    });

    /**
     * Render Edit Activity Page
     */
    app.get('/activities/edit/:id', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/login');
        }

        const { name: role } = req.user.role;

        if (role !== "SuperAdmin" && role !== "School (Sub-Admin)" && role !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const activity = await models.Activity.findByPk(req.params.id);

            if (!activity) {
                req.flash('error', 'Activity not found.');
                return res.redirect('/activities/index');
            }

            const schoolCondition = { status: 'Approve' };

            if (role === "School (Sub-Admin)" || role === "Administrator") {
                if (!req.user.school_id) {
                    req.flash('error', 'School ID is missing for the user.');
                    return res.redirect('/activities/index');
                }
                schoolCondition.id = req.user.school_id;
            }

            const schools = await models.Schools.findAll({
                attributes: ['id', 'name'],
                where: schoolCondition,
                order: [['name', 'ASC']],
                raw: true
            });

            const errors = req.flash('errors')[0] || {};
            const formData = req.flash('activity')[0] || {};
            const activityData = { ...activity.get(), ...formData };

            res.render('activities/edit', {
                activityDetail: activityData,
                errors,
                schools,
                messages: { success: req.flash('success'), error: req.flash('error') }
            });
        } catch (error) {
            console.error('Error loading activity edit page:', error);
            req.flash('error', 'Failed to load activity data.');
            res.redirect('/activities/index');
        }
    });

    /**
     * Handle Update Activity
     */
    app.post('/activities/update/:id', [
        body('school_id').notEmpty().withMessage('School ID is required.'),
        body('title').notEmpty().withMessage('Title is required.'),
        body('description').optional().trim()
    ], async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/login');
        }

        const { id } = req.params;
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('activity', req.body);
            return res.redirect(`/activities/edit/${id}`);
        }

        try {
            const { school_id, title, description, status } = req.body;
            const activity = await models.Activity.findByPk(id);

            if (!activity) {
                req.flash('error', 'Activity not found.');
                return res.redirect('/activities/index');
            }

            await activity.update({ school_id, title, description, status });
            req.flash('success', 'Activity updated successfully.');
            res.redirect('/activities/index');
        } catch (error) {
            console.error('Error updating activity:', error);
            req.flash('error', 'Failed to update activity.');
            res.redirect(`/activities/edit/${id}`);
        }
    });

    /**
     * Handle Delete Activity
     */
    app.delete('/activities/delete/:id', async (req, res) => {
        if (!req.isAuthenticated()) {
            return res.status(403).json({ success: false, message: 'Unauthorized. Please log in.' });
        }

        try {
            const activity = await models.Activity.findByPk(req.params.id);

            if (!activity) {
                return res.status(404).json({ success: false, message: 'Activity not found.' });
            }

            await activity.destroy();
            res.json({ success: true, message: 'Activity deleted successfully.' });
        } catch (error) {
            console.error('Error deleting activity:', error);
            res.status(500).json({ success: false, message: 'Failed to delete activity.' });
        }
    });
};
