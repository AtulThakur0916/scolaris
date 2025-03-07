const models = require('../models');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');

module.exports = function (app) {

    /**
     * Render view for managing fees
     */
    app.get('/fees/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const fees = await models.Fees.findAll({
                attributes: ['id', 'fee_type', 'custom_fee_name', 'amount', 'frequency', 'status'],
                include: [
                    { model: models.Classes, as: 'class', attributes: ['name'] },
                    { model: models.Schools, as: 'school', attributes: ['name'] }
                ],
                order: [['fee_type', 'ASC']],
                nest: true
            });

            // Convert Sequelize instances to plain objects
            const plainFees = fees.map(fee => fee.get({ plain: true }));
            console.log(req.flash());
            res.render('fees/index', {
                fees: plainFees,
                success: res.locals.success,
                error: res.locals.error
            });
        } catch (error) {
            console.error("Error fetching fees:", error);
            req.flash('error', 'Failed to load fees.');
            res.redirect('/');
        }
    });


    /**
     * View fee details
     */
    app.get('/fees/view/:fee_id', async (req, res) => {
        const { fee_id } = req.params;

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        const feeData = await models.Fees.findOne({
            where: { id: fee_id },
            include: [
                { model: models.Classes, as: 'class', attributes: ['name'] },
                { model: models.Schools, as: 'school', attributes: ['name'] }
            ]
        });

        if (!feeData) {
            req.flash('error', 'Fee not found');
            return res.redirect('/fees/index');
        }

        res.render('fees/view', { feeData });
    });

    /**
     * Create or edit fee
     */
    app.get('/fees/create/:fee_id?', async (req, res) => {
        try {
            const { fee_id } = req.params;
            let feeData = null;
            const classes = await models.Classes.findAll({ attributes: ['id', 'name'], raw: true });
            const schools = await models.Schools.findAll({ attributes: ['id', 'name'], raw: true });

            if (fee_id) {
                feeData = await models.Fees.findOne({ where: { id: fee_id }, raw: true });
            }

            res.render('fees/create', { feeData, classes, schools });
        } catch (error) {
            console.error('Error in /fees/create:', error);
            res.status(500).send('Error loading fee data');
        }
    });

    /**
     * Create fee with validation
     */
    app.post('/fees/create', [
        body('fee_type').notEmpty().withMessage('Fee type is required'),
        body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
        body('frequency').notEmpty().withMessage('Frequency is required'),
        body('school_id').notEmpty().withMessage('School is required'),
        body('status').isIn(['0', '1']).withMessage('Invalid status'),
    ], async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', "You are not authorised to access this page.");
            return res.redirect('/fees/index');
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('fees/create', {
                feeData: req.body,
                errors: errors.mapped(),
                classes: await models.Classes.findAll({ attributes: ['id', 'name'], raw: true }),
                schools: await models.Schools.findAll({ attributes: ['id', 'name'], raw: true })
            });
        }

        const { fee_type, custom_fee_name, amount, frequency, description, school_id, class_id, status } = req.body;

        try {
            await models.Fees.create({ fee_type, custom_fee_name, amount, frequency, description, school_id, class_id, status });

            req.flash('success', 'Fee created successfully.');
            res.redirect('/fees/index');
        } catch (error) {
            console.error('Error creating fee:', error);
            req.flash('error', 'Error creating fee. Please try again.');
            res.redirect('/fees/create');
        }
    });
    app.get('/fees/edit/:fee_id?', async (req, res) => {
        try {
            console.log('fee_id:', req.params.fee_id);
            const { fee_id } = req.params;

            // Fetch all schools
            const schools = await models.Schools.findAll({ attributes: ['id', 'name'], raw: true });

            // Fetch fee details with related class & school
            let feeData = await models.Fees.findOne({
                where: { id: fee_id },
                include: [
                    { model: models.Classes, as: 'class', attributes: ['id', 'name'] },
                    { model: models.Schools, as: 'school', attributes: ['id', 'name'] }
                ],
                nest: true
            });

            // Ensure feeData is converted into a plain object
            if (feeData) {
                feeData = feeData.get({ plain: true });
            }

            // Fetch classes for the selected school
            const classes = feeData
                ? await models.Classes.findAll({ where: { school_id: feeData.school_id }, attributes: ['id', 'name'], raw: true })
                : [];

            // Preserve input data after validation errors
            const storedFeeData = req.flash('feeData')[0] || {};
            storedFeeData.id = storedFeeData.id || fee_id; // Ensure ID is preserved

            res.render('fees/edit', {
                feeData: storedFeeData.name ? storedFeeData : feeData,
                errors: req.flash('errors')[0] || {},
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                },
                classes,
                schools,
                debug: {
                    hasFee: !!feeData,
                    feeId: fee_id,
                }
            });
        } catch (error) {
            console.error('Error loading fee edit page:', error);
            res.status(500).send('Error loading fee data');
        }
    });
    /**
     * Update fee with validation
     */
    app.post('/fees/update/:fee_id', [
        body('fee_type').notEmpty().withMessage('Fee type is required'),
        body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
        body('frequency').notEmpty().withMessage('Frequency is required'),
        body('school_id').notEmpty().withMessage('School is required'),
        body('status').isIn(['1', '0']).withMessage('Status must be Active (1) or Inactive (0)')
    ], async (req, res) => {
        const { fee_id } = req.params;

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', "You are not authorized to access this page.");
            return res.redirect('/fees/index');
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('feeData', { ...req.body, id: fee_id });
            return res.redirect(`/fees/edit/${fee_id}`);
        }

        try {
            const { fee_type, custom_fee_name, amount, frequency, description, school_id, class_id, status } = req.body;
            const [rowsUpdated] = await models.Fees.update(
                { fee_type, custom_fee_name, amount, frequency, description, school_id, class_id, status },
                { where: { id: fee_id } }
            );

            if (rowsUpdated > 0) {
                req.flash('success', 'Fee updated successfully.');
            } else {
                req.flash('error', 'No changes were made or fee not found.');
            }
            // console.log("Flash messages:", req.flash());

            res.redirect('/fees/index');
        } catch (error) {
            console.error('Error updating fee:', error);
            req.flash('error', 'Error updating fee. Please try again.');
            res.redirect(`/fees/edit/${fee_id}`);
        }
    });

    /**
     * Delete fee
     */
    app.delete('/fees/delete/:id', async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                return res.json({ success: false, message: 'Please login to continue' });
            }

            if (req.user.role.name !== "SuperAdmin") {
                return res.json({ success: false, message: 'You are not authorised to access this page.' });
            }

            const { id } = req.params;
            const feeData = await models.Fees.findOne({ where: { id } });

            if (!feeData) {
                return res.json({ success: false, message: 'Fee not found.' });
            }

            await models.Fees.destroy({ where: { id } });
            return res.json({ success: true, message: 'Fee deleted successfully.' });
        } catch (error) {
            return res.json({ success: false, message: error.message });
        }
    });



};
