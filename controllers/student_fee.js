const models = require('../models');
const { body, validationResult } = require('express-validator');

module.exports.controller = function (app) {

    /**
     * List all student fees
     */
    app.get('/student-fees/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }
        try {
            const condition = {};
            if (req.user.role.name === 'School (Sub-Admin)' || req.user.role.name === "Administrator") {
                condition.school_id = req.user.school_id;
            }

            const studentFees = await models.StudentFee.findAll({
                include: [
                    {
                        model: models.Students,
                        as: 'student',
                        // where: req.user.role.name === 'School (Sub-Admin)' ? { school_id: req.user.school_id } : undefined
                        where: condition,
                    },
                    {
                        model: models.Fees,
                        as: 'fee',
                        include: [
                            {
                                model: models.FeesTypes,
                                as: 'feesType',
                                attributes: ['name']
                            }
                        ]
                    }
                ],
                order: [['due_date', 'DESC']],
                raw: true,
                nest: true
            });

            studentFees.forEach(fee => {
                if (fee.due_date) {
                    const date = new Date(fee.due_date);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = date.toLocaleString('en-US', { month: 'short' }); // e.g., Mar
                    const year = date.getFullYear();
                    fee.formatted_due_date = `${day}-${month}-${year}`;
                } else {
                    fee.formatted_due_date = '';
                }
            });
            res.render('student_fee/index', {
                studentFees,
                success: res.locals.success,
                error: res.locals.error
            });
        } catch (error) {
            console.error('Error loading student fees:', error);
            req.flash('error', 'Failed to load student fees.');
            return res.redirect('/');
        }
    });

    /**
     * Render create student fee form
     */
    app.get('/student-fees/create', async (req, res) => {
        if (!req.isAuthenticated()) {
            return res.redirect('/login');
        }

        try {
            const userRole = req.user.role.name;

            // Role-based condition
            const condition = (userRole === "School (Sub-Admin)" || userRole === "Administrator")
                ? { school_id: req.user.school_id }
                : {};

            // Fetch students
            const students = await models.Students.findAll({
                where: condition,
                raw: true
            });

            // Fetch fees and types
            const fees = await models.Fees.findAll({
                where: condition,
                include: [
                    {
                        model: models.FeesTypes,
                        as: 'feesType',
                        attributes: ['id', 'name']
                    }
                ],
                raw: true,
                nest: true
            });

            // Fetch schools based on role
            const schools = (userRole === "SuperAdmin")
                ? await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: { status: 'Approve' },
                    raw: true
                })
                : await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: { id: req.user.school_id },
                    raw: true
                });

            return res.render('student_fee/create', {
                students,
                fees,
                schools,
                formData: {}, // Empty form data
                errors: {}    // Empty errors
            });

        } catch (error) {
            console.error('Error loading create form:', error);
            req.flash('error', 'Could not load form.');
            return res.redirect('/student-fees/index');
        }
    });



    app.post('/student-fees/create', [
        body('school_sessions_id').notEmpty().withMessage('School session is required'),
        body('class_id').notEmpty().withMessage('Class is required'),
        body('fee_id').notEmpty().withMessage('Fee is required'),
        body('custom_amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
        // body('assigned_date').optional().isDate().withMessage('Assigned date must be a valid date'),
        body('due_date').optional().isDate().withMessage('Due date must be a valid date'),
    ], async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        const userRole = req.user.role.name;
        const result = validationResult(req);

        if (userRole !== "SuperAdmin" && userRole !== "School (Sub-Admin)" && userRole !== "Administrator") {
            req.flash('error', 'You are not authorized to access this page.');
            return res.redirect('/');
        }

        if (!result.isEmpty()) {
            const errors = result.mapped();
            const formData = req.body;

            const fees = await models.Fees.findAll({
                where: userRole === "SuperAdmin" ? {} : { school_id: req.user.school_id },
                raw: true
            });

            return res.render('student_fee/create', {
                students: [],
                fees,
                formData,
                errors
            });
        }

        try {
            const {
                school_sessions_id,
                class_id,
                fee_id,
                custom_amount,
                assigned_date,
                due_date
            } = req.body;

            const condition = {
                school_sessions_id,
                class_id
            };

            if (userRole === "School (Sub-Admin)" || userRole === "Administrator") {
                condition.school_id = req.user.school_id;
            }

            const students = await models.Students.findAll({ where: condition });

            if (!students.length) {
                req.flash('error', 'No students found for the selected class and session.');
                return res.redirect('/student-fees/create');
            }

            const fee = await models.Fees.findByPk(fee_id);
            if (!fee) {
                req.flash('error', 'Fee not found.');
                return res.redirect('/student-fees/create');
            }

            const session = await models.SchoolSessions.findByPk(school_sessions_id);
            if (!session) {
                req.flash('error', 'Session not found.');
                return res.redirect('/student-fees/create');
            }

            const start = new Date(session.start_date);
            const end = new Date(session.end_date);
            // const assignedBase = assigned_date ? new Date(assigned_date) : new Date();
            const assignedBase = assigned_date ? new Date(assigned_date) : null;
            const dueBase = due_date ? new Date(due_date) : null;

            const generateFeeDates = (freq) => {
                const dates = [];
                const startDate = new Date(start);

                if (freq === 'Monthly') {
                    while (startDate <= end) {
                        dates.push(new Date(startDate));
                        startDate.setMonth(startDate.getMonth() + 1);
                    }
                } else if (freq === 'Quarterly') {
                    while (startDate <= end) {
                        dates.push(new Date(startDate));
                        startDate.setMonth(startDate.getMonth() + 3);
                    }
                } else if (freq === 'One-Time') {
                    dates.push(new Date(startDate));
                }

                return dates;
            };

            const feeDates = generateFeeDates(fee.frequency);
            const feeEntries = [];

            students.forEach(student => {
                feeDates.forEach(date => {
                    // const assigned = new Date(date);
                    // assigned.setDate(assignedBase.getDate()); // keep the same day as assigned_date
                    const due = dueBase ? new Date(date.setDate(dueBase.getDate())) : null;
                    const assigned = assignedBase ? new Date(date.setDate(assignedBase.getDate())) : null;
                    feeEntries.push({
                        student_id: student.id,
                        fee_id,
                        frequency: fee.frequency,
                        custom_amount: custom_amount || null,
                        assigned_date: assigned,
                        due_date: due
                    });
                });
            });

            await models.StudentFee.bulkCreate(feeEntries);


            // const feeEntries = students.map(student => ({
            //     student_id: student.id,
            //     fee_id,
            //     custom_amount: custom_amount || null,
            //     assigned_date: assigned_date ? new Date(assigned_date) : new Date(),
            //     due_date: due_date ? new Date(due_date) : null
            // }));

            // await models.StudentFee.bulkCreate(feeEntries);
            req.flash('success', 'Fees assigned to all students successfully.');
            return res.redirect('/student-fees/index');

        } catch (error) {
            console.error('Error creating student fees:', error);
            req.flash('error', 'Error saving student fees.');
            return res.redirect('/student-fees/create');
        }
    });



    /**
     * Edit student fee
     */
    app.get('/student-fees/edit/:id', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        const userRole = req.user.role.name;
        const id = req.params.id;

        // Authorization: Only SuperAdmin, School, Administrator allowed
        if (userRole !== "SuperAdmin" && userRole !== "School (Sub-Admin)" && userRole !== "Administrator") {
            req.flash('error', 'You are not authorized to access this page.');
            return res.redirect('/');
        }

        try {
            const fee = await models.StudentFee.findByPk(id);

            if (!fee) {
                req.flash('error', 'Fee not found');
                return res.redirect('/student-fees/index');
            }

            let studentCondition = {};
            let feeCondition = {};

            // If School or Administrator, limit by their school_id
            if (userRole === "School (Sub-Admin)" || userRole === "Administrator") {
                studentCondition.school_id = req.user.school_id;
                feeCondition.school_id = req.user.school_id;
            }

            const students = await models.Students.findAll({ where: studentCondition, raw: true });
            const fees = await models.Fees.findAll({
                where: feeCondition,
                include: [
                    {
                        model: models.FeesTypes,
                        as: 'feesType',
                        attributes: ['name']
                    }
                ],
                raw: true,
                nest: true
            });

            // Preselect dropdown values
            students.forEach(student => {
                student.selected = (student.id === fee.student_id);
            });

            fees.forEach(feeItem => {
                feeItem.selected = (feeItem.id === fee.fee_id);
            });

            res.render('student_fee/edit', {
                studentFee: fee.get({ plain: true }),
                students,
                fees,
                errors: {}
            });

        } catch (error) {
            console.error('Error loading edit form:', error);
            req.flash('error', 'Could not load edit form');
            return res.redirect('/student-fees/index');
        }
    });



    /**
     * Update student fee
     */
    app.post('/student-fees/update/:id', [
        body('custom_amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
        body('assigned_date').optional().isDate().withMessage('Assigned date must be a valid date'),
        body('due_date').optional().isDate().withMessage('Due date must be a valid date')
    ], async (req, res) => {
        const id = req.params.id;
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            req.flash('error', 'Validation error');
            return res.redirect(`/student-fees/edit/${id}`);
        }

        try {
            const fee = await models.StudentFee.findByPk(id);
            if (!fee) {
                req.flash('error', 'Fee not found');
                return res.redirect('/student-fees/index');
            }

            await fee.update(req.body);
            req.flash('success', 'Student fee updated successfully');
            res.redirect('/student-fees/index');
        } catch (error) {
            console.error('Error updating fee:', error);
            req.flash('error', 'Failed to update fee.');
            return res.redirect(`/student-fees/edit/${id}`);
        }
    });

    /**
     * Delete student fee
     */
    app.delete('/student-fees/delete/:id', async (req, res) => {
        const { id } = req.params;

        try {
            const fee = await models.StudentFee.findByPk(id);
            if (!fee) {
                return res.status(404).json({ success: false, message: 'Fee not found.' });
            }

            await fee.destroy();
            return res.json({ success: true, message: 'Fee deleted successfully.' });
        } catch (error) {
            console.error('Delete Error:', error);
            return res.status(500).json({ success: false, message: 'Failed to delete fee.' });
        }
    });

    // Get fees by session ID
    app.get('/school/fees/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;

            // Check authentication
            if (!req.isAuthenticated()) {
                return res.status(401).json({ error: 'Please login to continue' });
            }

            let whereCondition = { school_sessions_id: sessionId };

            // Add school condition for School and Administrator roles
            if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                whereCondition.school_id = req.user.school_id;
            }

            const fees = await models.Fees.findAll({
                where: whereCondition,
                include: [{
                    model: models.FeesTypes,
                    as: 'feesType',
                    attributes: ['name']
                }],
                attributes: ['id', 'amount', 'frequency'],
                raw: true,
                nest: true
            });

            return res.json({ success: true, fees });

        } catch (error) {
            console.error('Error fetching fees:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch fees'
            });
        }
    });



    app.post('/student-fees/delete-multiple', async (req, res) => {
        const { ids } = req.body;
    
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'No IDs provided.' });
        }
    
        try {
            await models.StudentFee.destroy({
                where: {
                    id: ids
                }
            });
            res.json({ success: true });
        } catch (error) {
            console.error('Bulk delete error:', error);
            res.status(500).json({ success: false, message: 'Server error during delete.' });
        }
    });
    
};
