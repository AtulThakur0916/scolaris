const models = require('../models');
const { body, validationResult } = require('express-validator');

module.exports.controller = function (app) {
    /**
     * Render Fees Types Index Page
     */
    app.get('/fee-type/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please log in to continue.');
            return res.redirect('/login');
        }
        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorized to access this page.');
            return res.redirect('/');
        }
        try {
            const feesTypes = await models.FeesTypes.findAll({
                order: [['created_at', 'DESC']],
                raw: true
            });
            // console.log(feesTypes);
            res.render('fees-type/index', {
                feesTypes,
                success: res.locals.success,
                error: res.locals.error
            });
        } catch (error) {
            console.error('Error fetching Fees Types:', error);
            req.flash('error', 'Failed to load Fees Types.');
            res.redirect('/');
        }
    });

    /**
     * Render Create Fees Types Page
     */
    app.get('/fee-type/create', (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please log in to continue.');
            return res.redirect('/login');
        }
        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorized to access this page.');
            return res.redirect('/');
        }
        const errors = req.flash('errors')[0] || {};
        const formData = req.flash('fees_type')[0] || {};

        res.render('fees-type/create', { fees_type: formData, errors });
    });

    /**
     * Handle Create Fees Type
     */

    app.post('/fee-type/create', [
        body('name')
            .notEmpty().withMessage('Name is required.')
            .custom(async (value) => {
                const existingType = await models.FeesTypes.findOne({ where: { name: value } });
                if (existingType) {
                    throw new Error('Fees Type name must be unique.');
                }
                return true;
            }),
        body('description').notEmpty().withMessage('Description is required.'),
        body('status').notEmpty().withMessage('Status is required.')
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('fees_type', req.body);
            return res.redirect('/fee-type/create');
        }

        try {
            await models.FeesTypes.create(req.body);
            req.flash('success', 'Fees Type created successfully.');
            res.redirect('/fee-type/index');
        } catch (error) {
            console.error('Error creating Fees Type:', error);
            req.flash('error', 'Failed to create Fees Type.');
            res.redirect('/fee-type/create');
        }
    });


    /**
     * Render Edit Fees Type Page
     */
    app.get('/fee-type/edit/:fees_type_id', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please log in to continue.');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorized to access this page.');
            return res.redirect('/');
        }

        try {
            const { fees_type_id } = req.params;
            const feesType = await models.FeesTypes.findByPk(fees_type_id);
            if (!feesType) {
                req.flash('error', 'Fees Type not found.');
                return res.redirect('/fee-type/index');
            }

            const errors = req.flash('errors')[0] || {};
            const formData = req.flash('fees_type')[0] || {};
            const feesTypeData = { ...feesType.get(), ...formData };

            res.render('fees-type/edit', {
                fees_type: feesTypeData,
                errors,
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });
        } catch (error) {
            console.error('Error loading Fees Type edit page:', error);
            req.flash('error', 'Error loading Fees Type data.');
            res.redirect('/fee-type/index');
        }
    });

    /**
     * Handle Update Fees Type
     */
    app.post('/fee-type/update/:fees_type_id', [
        body('name')
            .notEmpty().withMessage('Name is required.')
            .custom(async (value, { req }) => {
                const existingType = await models.FeesTypes.findOne({
                    where: { name: value, id: { [models.Sequelize.Op.ne]: req.params.fees_type_id } }
                });
                if (existingType) {
                    throw new Error('Fees Type name must be unique.');
                }
                return true;
            }),
        body('description').notEmpty().withMessage('Description is required.'),
        body('status').notEmpty().withMessage('Status is required.')
    ], async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please log in to continue.');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorized to access this page.');
            return res.redirect('/');
        }

        const { fees_type_id } = req.params;
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('fees_type', req.body);
            return res.redirect(`/fee-type/edit/${fees_type_id}`);
        }

        try {
            const feesType = await models.FeesTypes.findByPk(fees_type_id);

            if (!feesType) {
                req.flash('error', 'Fees Type not found.');
                return res.redirect('/fee-type/index');
            }

            await feesType.update(req.body);
            req.flash('success', 'Fees Type updated successfully.');
            res.redirect('/fee-type/index');
        } catch (error) {
            console.error('Error updating Fees Type:', error);
            req.flash('error', 'Error updating Fees Type.');
            res.redirect(`/fees-type/edit/${fees_type_id}`);
        }
    });

    /**
     * Handle Delete Fees Type
     */
    app.delete('/fee-type/delete/:fees_type_id', async (req, res) => {
        if (!req.isAuthenticated()) {
            return res.status(403).json({ success: false, message: 'Unauthorized. Please log in.' });
        }

        try {
            const feesType = await models.FeesTypes.findByPk(req.params.fees_type_id);
            if (!feesType) {
                return res.status(404).json({ success: false, message: 'Fees Type not found.' });
            }

            await feesType.destroy();
            res.json({ success: true, message: 'Fees Type deleted successfully.' });
        } catch (error) {
            console.error('Error deleting Fees Type:', error);
            res.status(500).json({ success: false, message: 'Failed to delete Fees Type.' });
        }
    });
};
