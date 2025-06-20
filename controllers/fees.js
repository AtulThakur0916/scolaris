const models = require('../models');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');

module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

    /**
     * Render view for managing fees
     */
    app.get('/fees/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }
console.log("role name:",req.user.role.name);
        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            let whereCondition = {};
            if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                whereCondition.school_id = req.user.school_id;
            }

            const fees = await models.Fees.findAll({
                attributes: ['id', 'custom_fee_name', 'amount', 'frequency', 'status'],
                include: [
                    { model: models.Classes, as: 'class', attributes: ['name'] },
                    { model: models.Schools, as: 'school', attributes: ['name'] },
                    { model: models.FeesTypes, as: 'feesType', attributes: ['name'] },
                ],
                where: whereCondition,
                order: [['created_at', 'DESC']],
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
     * Create or edit fee
     */
    app.get('/fees/create', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const { fee_id } = req.params;
            let feeData = null;

            // Fetch classes (only active ones)
            const classes = await models.Classes.findAll({
                attributes: ['id', 'name'],
                where: { status: '1' },
                raw: true
            });
            const fees_type = await models.FeesTypes.findAll({
                attributes: ['id', 'name'],
                where: { status: 'Active' },
                raw: true
            });

            // School filter based on user role
            const schoolCondition = { status: 'Approve' };
            if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                schoolCondition.id = req.user.school_id;
            }

            // Fetch schools with condition
            const schools = await models.Schools.findAll({
                attributes: ['id', 'name'],
                where: schoolCondition,
                raw: true
            });

            // Fetch fee data if fee_id is provided
            if (fee_id) {
                feeData = await models.Fees.findOne({ where: { id: fee_id }, raw: true });
            }

            res.render('fees/create', { feeData, classes, schools, fees_type });
        } catch (error) {
            console.error('Error in /fees/create:', error);
            req.flash('error', 'Failed to load fee data.');
            res.redirect('/fees/index');
        }
    });


    /**
     * Create fee with validation
     */
    app.post('/fees/create', [
        body('fees_type_id').notEmpty().withMessage('Fee type is required'),
        body('school_sessions_id').notEmpty().withMessage('School session is required'),
        body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
        body('frequency').notEmpty().withMessage('Frequency is required'),
        body('school_id').notEmpty().withMessage('School is required'),
        body('status').isIn(['0', '1']).withMessage('Invalid status'),
    ], async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/login');
        }
        console.log(req.body);
        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        const errors = validationResult(req);
        const { fees_type_id, school_sessions_id, custom_fee_name, amount, frequency, description, school_id, class_id, status } = req.body;

        if (!errors.isEmpty()) {
            try {
                // Fetch classes and apply school condition based on role
                const classes = await models.Classes.findAll({
                    attributes: ['id', 'name'],
                    where: { status: '1' },
                    raw: true
                });

                const schoolCondition = { status: 'Approve' };
                if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                    schoolCondition.id = req.user.school_id;
                }

                const schools = await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: schoolCondition,
                    raw: true
                });

                // Render form with errors and existing input
                return res.render('fees/create', {
                    feeData: req.body,
                    errors: errors.mapped(),
                    classes,
                    schools
                });

            } catch (fetchError) {
                console.error('Error fetching classes or schools:', fetchError);
                req.flash('error', 'Failed to load form data.');
                return res.redirect('/fees/index');
            }
        }

        try {
            const existingFee = await models.Fees.findOne({
                where: {
                    school_id,
                    fees_type_id,
                    school_sessions_id,
                    frequency,
                    class_id
                }
            });

            if (existingFee) {
                req.flash('error', 'Fee with the same School, Session, Frequency and Class already exists.');
                return res.redirect('/fees/index');
            }
            // Create the fee record
            await models.Fees.create({
                fees_type_id,
                school_sessions_id,
                custom_fee_name,
                amount,
                frequency,
                description,
                school_id,
                class_id,
                status
            });

            req.flash('success', 'Fee created successfully.');
            res.redirect('/fees/index');
        } catch (error) {
            console.error('Error creating fee:', error);
            req.flash('error', 'Error creating fee. Please try again.');
            res.redirect('/fees/create');
        }
    });

    app.get('/fees/edit/:fee_id?', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const { fee_id } = req.params;
            console.log('fee_id:', fee_id);

            // School condition based on role
            const schoolCondition = { status: 'Approve' };
            if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                schoolCondition.id = req.user.school_id;
            }
            const fees_type = await models.FeesTypes.findAll({
                attributes: ['id', 'name'],
                where: { status: 'Active' },
                raw: true
            });
            // Fetch schools
            const schools = await models.Schools.findAll({
                attributes: ['id', 'name'],
                where: schoolCondition,
                raw: true
            });

            // Fetch fee data
            let feeData = await models.Fees.findOne({
                where: { id: fee_id },
                include: [
                    { model: models.Classes, as: 'class', attributes: ['id', 'name'] },
                    { model: models.Schools, as: 'school', attributes: ['id', 'name'] }
                ],
                nest: true
            });

            if (feeData) {
                feeData = feeData.get({ plain: true });
            }

            // Fetch sessions if feeData exists
            const sessions = feeData
                ? await models.SchoolSessions.findAll({
                    where: { school_id: feeData.school_id },
                    attributes: ['id', 'start_date', 'end_date'],
                    raw: true
                })
                : [];

            // Format session dates
            const monthNames = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];

            const formattedSessions = sessions.map(session => {
                const startDate = new Date(session.start_date);
                const endDate = new Date(session.end_date);
                const formattedStart = `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;
                const formattedEnd = `${monthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;

                return {
                    ...session,
                    start_date: formattedStart,
                    end_date: formattedEnd
                };
            });

            // Fetch classes if feeData exists
            const classes = feeData
                ? await models.Classes.findAll({
                    where: {
                        school_id: feeData.school_id,
                        school_sessions_id: feeData.school_sessions_id,
                        status: '1'
                    },
                    attributes: ['id', 'name'],
                    raw: true
                })
                : [];

            // Preserve input data after validation errors
            const storedFeeData = req.flash('feeData')[0] || {};
            storedFeeData.id = storedFeeData.id || fee_id;

            res.render('fees/edit', {
                feeData: storedFeeData.name ? storedFeeData : feeData,
                errors: req.flash('errors')[0] || {},
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                },
                classes,
                schools,
                fees_type,
                formattedSessions,
                debug: {
                    hasFee: !!feeData,
                    feeId: fee_id,
                }
            });
        } catch (error) {
            console.error('Error loading fee edit page:', error);
            req.flash('error', 'Error loading fee data.');
            res.redirect('/fees/index');
        }
    });



    /**
     * Update fee with validation
     */
    app.post('/fees/update/:fee_id', [
        body('fees_type_id').notEmpty().withMessage('Fee type is required'),
        body('school_sessions_id').notEmpty().withMessage('School session is required'),
        body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
        body('frequency').notEmpty().withMessage('Frequency is required'),
        body('school_id').notEmpty().withMessage('School is required'),
        body('status').isIn(['1', '0']).withMessage('Status must be Active (1) or Inactive (0)')
    ], async (req, res) => {
        const { fee_id } = req.params;

        // Authentication check
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/login');
        }

        // Authorization check
        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', "You are not authorized to access this page.");
            return res.redirect('/fees/index');
        }

        // Validate inputs
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('feeData', { ...req.body, id: fee_id });
            return res.redirect(`/fees/edit/${fee_id}`);
        }

        try {
            const {
                fees_type_id,
                school_sessions_id,
                custom_fee_name,
                amount,
                frequency,
                description,
                school_id,
                class_id,
                status
            } = req.body;
            const existingFee = await models.Fees.findOne({
                where: {
                    school_id,
                    fees_type_id,
                    school_sessions_id,
                    frequency,
                    class_id,
                    id: { [Op.ne]: fee_id } // Exclude current fee from check
                }
            });

            if (existingFee) {
                req.flash('error', 'Fee with the same School, Session, Frequency and Class already exists.');
                return res.redirect('/fees/index');
            }
            // Check if fee exists
            const fee = await models.Fees.findByPk(fee_id);
            if (!fee) {
                req.flash('error', 'Fee not found.');
                return res.redirect('/fees/index');
            }

            // Restrict School users from updating other schools' fees
            if ((req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") && fee.school_id !== req.user.school_id) {
                req.flash('error', "You don't have permission to update this fee.");
                return res.redirect('/fees/index');
            }

            // Update fee
            const [rowsUpdated] = await models.Fees.update(
                {
                    fees_type_id,
                    school_sessions_id,
                    custom_fee_name,
                    amount,
                    frequency,
                    description,
                    school_id,
                    class_id,
                    status
                },
                { where: { id: fee_id } }
            );

            if (rowsUpdated > 0) {
                req.flash('success', 'Fee updated successfully.');
            } else {
                req.flash('info', 'No changes made.');
            }

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
            // Authentication check
            if (!req.isAuthenticated()) {
                return res.status(401).json({ success: false, message: 'Please login to continue.' });
            }

            // Authorization check
            if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
                return res.status(403).json({ success: false, message: 'You are not authorised to access this page.' });
            }

            const { id } = req.params;

            // Check if the fee exists
            const feeData = await models.Fees.findOne({ where: { id } });
            if (!feeData) {
                return res.status(404).json({ success: false, message: 'Fee not found.' });
            }

            // School users can only delete fees related to their school
            if ((req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") && feeData.school_id !== req.user.school_id) {
                return res.status(403).json({ success: false, message: "You don't have permission to delete this fee." });
            }

            // Delete the fee
            await models.Fees.destroy({ where: { id } });
            return res.json({ success: true, message: 'Fee deleted successfully.' });

        } catch (error) {
            console.error('Error deleting fee:', error);
            return res.status(500).json({ success: false, message: 'Error deleting fee. Please try again.' });
        }
    });




};
