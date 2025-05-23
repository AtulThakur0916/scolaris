const models = require('../models');
const { body, validationResult } = require('express-validator');

module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

    /**
     * Render view for managing feedback
     */
    app.get('/feedback/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const feedbacks = await models.Feedback.findAll({
                attributes: ['id', 'experience', 'loving_point', 'created_at'],
                include: [
                    {
                        model: models.Parents,
                        as: 'parent',
                        attributes: ['name', 'email', 'mobile']
                    }
                ],
                order: [['created_at', 'DESC']],
                raw: true,
                nest: true
            });

            res.render('feedback/index', {
                feedbacks,
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });
        } catch (error) {
            console.error("Error fetching feedbacks:", error);
            req.flash('error', 'Failed to load feedbacks.');
            res.redirect('/');
        }
    });

    /**
     * Delete feedback
     */
    app.delete('/feedback/delete/:id', async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                return res.json({ success: false, message: 'Please login to continue' });
            }

            if (req.user.role.name !== "SuperAdmin") {
                req.flash('error', "You are not authorized to access this page.");
                return res.redirect('/feedback/index');
            }

            const { id } = req.params;
            const feedback = await models.Feedback.findOne({ where: { id } });

            if (!feedback) {
                return res.json({ success: false, message: 'Feedback not found.' });
            }

            await models.Feedback.destroy({ where: { id } });
            return res.json({ success: true, message: 'Feedback deleted successfully.' });
        } catch (error) {
            return res.json({ success: false, message: error.message });
        }
    });
};