'use strict';
const models = require('../models');
const { body, validationResult } = require('express-validator');

module.exports.controller = function (app) {

    /**
     * List all CMS pages
     */
    app.get('/cms/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }
        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorized to access this page.');
            return res.redirect('/');
        }
        try {
            const cmsPages = await models.CMSPage.findAll({
                attributes: ['id', 'title', 'slug', 'status', 'created_at']
            });

            const cmsPagesPlain = cmsPages.map(page => page.get({ plain: true })); // Convert to plain objects

            res.render('cms/index', { cmsPages: cmsPagesPlain, success: res.locals.success, error: res.locals.error });
        } catch (error) {
            console.error('Error fetching CMS pages:', error);
            req.flash('error', 'Failed to load CMS pages.');
            res.redirect('/');
        }
    });

    /**
     * Create or edit CMS page
     */
    app.get('/cms/create', async (req, res) => {
        try {
            const { id } = req.params;
            let cmsPage = null;
            if (req.user.role.name !== "SuperAdmin") {
                req.flash('error', 'You are not authorized to access this page.');
                return res.redirect('/');
            }
            if (id) {
                cmsPage = await models.CMSPage.findOne({ where: { id }, raw: true });
            }

            res.render('cms/create', { cmsPage });
        } catch (error) {
            console.error('Error in /cms/create:', error);
            res.status(500).send('Error loading CMS page data');
        }
    });

    /**
     * Store CMS page
     */
    app.post('/cms/create', [
        body('title').notEmpty().withMessage('Title is required'),
        body('slug').notEmpty().withMessage('Slug is required')
            .custom(async (value, { req }) => {
                const existingPage = await models.CMSPage.findOne({ where: { slug: value } });
                if (existingPage) {
                    throw new Error('Slug already exists');
                }
                return true;
            }),
        body('content').notEmpty().withMessage('Content is required'),
        body('status').isIn(['0', '1']).withMessage('Invalid status')
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('cms/create', { cmsPage: req.body, errors: errors.mapped() });
        }

        try {
            await models.CMSPage.create(req.body);
            req.flash('success', 'CMS Page created successfully.');
            res.redirect('/cms/index');
        } catch (error) {
            console.error('Error creating CMS page:', error);
            req.flash('error', 'Error creating CMS page. Please try again.');
            res.redirect('/cms/create');
        }
    });
    app.get('/cms/edit/:cms_id?', async (req, res) => {
        try {
            const { cms_id } = req.params;
            let cms = null;

            if (cms_id) {
                cms = await models.CMSPage.findOne({ where: { id: cms_id }, raw: true });
            }
            if (req.user.role.name !== "SuperAdmin") {
                req.flash('error', 'You are not authorized to access this page.');
                return res.redirect('/');
            }
            // Retrieve flash messages
            const errors = req.flash('errors')[0] || {};
            const formData = req.flash('cms')[0] || {};

            // Merge old input with existing school data
            const cmsData = { ...cms, ...formData };

            res.render('cms/edit', {
                cms: cmsData,
                errors,
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });
        } catch (error) {
            console.error('Error loading cms edit page:', error);
            res.status(500).send('Error loading cms data');
        }
    });
    /**
     * Update CMS page
     */

    app.post('/cms/update/:id', [
        body('title').notEmpty().withMessage('Title is required'),
        body('slug').notEmpty().withMessage('Slug is required')
            .custom(async (value, { req }) => {
                const { id } = req.params;
                const existingPage = await models.CMSPage.findOne({
                    where: { slug: value, id: { [models.Sequelize.Op.ne]: id } }
                });
                if (existingPage) {
                    throw new Error('Slug already exists');
                }
                return true;
            }),
        body('content').notEmpty().withMessage('Content is required'),
        body('status').isIn(['0', '1']).withMessage('Invalid status')
    ], async (req, res) => {
        const { id } = req.params;
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            return res.redirect(`/cms/edit/${id}`);
        }

        try {
            await models.CMSPage.update(req.body, { where: { id } });
            req.flash('success', 'CMS Page updated successfully.');
            res.redirect('/cms/index');
        } catch (error) {
            console.error('Error updating CMS page:', error);
            req.flash('error', 'Error updating CMS page. Please try again.');
            res.redirect(`/cms/edit/${id}`);
        }
    });

    /**
     * Delete CMS page
     */
    app.delete('/cms/delete/:id', async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                return res.json({ success: false, message: 'Please login to continue' });
            }

            const { id } = req.params;
            const cmsPage = await models.CMSPage.findOne({ where: { id } });
            if (!cmsPage) {
                return res.json({ success: false, message: 'CMS Page not found.' });
            }

            await models.CMSPage.destroy({ where: { id } });
            return res.json({ success: true, message: 'CMS Page deleted successfully.' });
        } catch (error) {
            return res.json({ success: false, message: error.message });
        }
    });


    app.get('/web/cms/:slug', async (req, res) => {
        try {
            // Proper model reference
            const page = await models.CMSPage.findOne({
                where: { 
                    slug: req.params.slug, 
                    status: '1' 
                },
                attributes: ['id', 'title', 'content', 'created_at']
            });

            // Handle page not found
            if (!page) {
                return res.status(404).render('errors/404', {
                    error: 'The requested page could not be found'
                });
            }

            // Render the page with data
            return res.render('web/cms', { 
                page: page.get({ plain: true }),
                title: page.title,
                layout: false
            });

        } catch (error) {
            console.error('Error fetching CMS page:', error);
            
            // Handle server error
            return res.status(500).render('errors/500', {
                error: 'An error occurred while loading the page'
            });
        }
    });
};