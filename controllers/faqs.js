const models = require('../models');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');

module.exports.controller = function (app) {
    /**
     * Render FAQ Index Page
     */
    app.get('/faqs/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/login');
        }

        try {
            const faqs = await models.FAQ.findAll({
                order: [['created_at', 'DESC']],
                raw: true
            });

            res.render('faqs/index', {
                faqs, success: res.locals.success,
                error: res.locals.error
            });
        } catch (error) {
            console.error('Error fetching FAQs:', error);
            req.flash('error', 'Failed to load FAQs.');
            res.redirect('/');
        }
    });

    /**
     * Render Create FAQ Page
     */
    app.get('/faqs/create', (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/login');
        }

        const errors = req.flash('errors')[0] || {};
        const formData = req.flash('faq')[0] || {};

        res.render('faqs/create', { faq: formData, errors });
    });

    /**
     * Handle Create FAQ
     */
    app.post('/faqs/create', [
        body('question').notEmpty().withMessage('Question is required.'),
        body('answer').notEmpty().withMessage('Answer is required.'),
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('faq', req.body);
            return res.redirect('/faqs/create');
        }

        const { question, answer } = req.body;

        try {
            await models.FAQ.create({ question, answer });
            req.flash('success', 'FAQ created successfully.');
            res.redirect('/faqs/index');
        } catch (error) {
            console.error('Error creating FAQ:', error);
            req.flash('error', 'Failed to create FAQ.');
            res.redirect('/faqs/create');
        }
    });
    app.get('/faqs/edit/:faq_id', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const { faq_id } = req.params;
            const faq = await models.FAQ.findByPk(faq_id);
            if (!faq) {
                req.flash('error', 'FAQ not found');
                return res.redirect('/faqs');
            }

            const errors = req.flash('errors')[0] || {};
            const formData = req.flash('faq')[0] || {};
            const faqData = { ...faq.get(), ...formData };

            res.render('faqs/edit', {
                faq: faqData,
                errors,
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });
        } catch (error) {
            console.error('Error loading FAQ edit page:', error);
            req.flash('error', 'Error loading FAQ data');
            res.redirect('/faqs');
        }
    });

    /**
     * Update FAQ
     */
    app.post('/faqs/update/:faq_id', [
        body('question').trim().notEmpty().withMessage('Question is required'),
        body('answer').trim().notEmpty().withMessage('Answer is required')
    ], async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        const { faq_id } = req.params;
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('faq', req.body);
            return res.redirect(`/faqs/edit/${faq_id}`);
        }

        try {
            const { question, answer, status } = req.body;
            const faq = await models.FAQ.findByPk(faq_id);

            if (!faq) {
                req.flash('error', 'FAQ not found');
                return res.redirect('/faqs/index');
            }

            await faq.update({ question, answer, status });
            req.flash('success', 'FAQ updated successfully');
            res.redirect('/faqs/index');
        } catch (error) {
            console.error('Error updating FAQ:', error);
            req.flash('error', 'Error updating FAQ');
            res.redirect(`/faqs/edit/${faq_id}`);
        }
    });
    /**
     * Handle Delete FAQ
     */
    app.delete('/faqs/delete/:id', async (req, res) => {
        if (!req.isAuthenticated()) {
            return res.status(403).json({ success: false, message: 'Unauthorized. Please log in.' });
        }

        try {
            const faq = await models.FAQ.findByPk(req.params.id);
            if (!faq) {
                return res.status(404).json({ success: false, message: 'FAQ not found.' });
            }

            await faq.destroy();
            res.json({ success: true, message: 'FAQ deleted successfully.' });
        } catch (error) {
            console.error('Error deleting FAQ:', error);
            res.status(500).json({ success: false, message: 'Failed to delete FAQ.' });
        }
    });
};
