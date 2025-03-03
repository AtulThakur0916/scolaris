const models = require('../models');
// const { body, validationResult } = require('express-validator');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');

module.exports = function (app) {

    /**
     * Render view for managing students
     */
    app.get('/students/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const students = await models.Students.findAll({
                attributes: ['id', 'name', 'email', 'class_id', 'school_id', 'status'],
                include: [
                    { model: models.Classes, as: 'class', attributes: ['name'] },
                    { model: models.Schools, as: 'school', attributes: ['name'] }
                ],
                raw: true,
                order: [['name', 'ASC']]
            });

            res.render('students/index', {
                students,
                success: req.flash('success'),
                error: req.flash('error')
            });
        } catch (error) {
            console.error("Error fetching students:", error);
            req.flash('error', 'Failed to load students.');
            res.redirect('/');
        }
    });

    /**
     * View student details
     */
    app.get('/students/view/:student_id', async (req, res) => {
        const { student_id } = req.params;

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        const studentData = await models.Students.findOne({
            where: { id: student_id },
            include: [
                { model: models.Classes, as: 'class', attributes: ['name'] },
                { model: models.Schools, as: 'school', attributes: ['name'] }
            ]
        });

        if (!studentData) {
            req.flash('error', 'Student not found');
            return res.redirect('/students/index');
        }

        res.render('students/view', { studentData });
    });

    /**
     * Create or edit student
     */
    app.get('/students/create/:student_id?', async (req, res) => {
        try {
            const { student_id } = req.params;
            let studentData = null;
            const classes = await models.Classes.findAll({ attributes: ['id', 'name'], raw: true });
            const schools = await models.Schools.findAll({ attributes: ['id', 'name'], raw: true });

            if (student_id) {
                studentData = await models.Students.findOne({ where: { id: student_id }, raw: true });
            }

            res.render('students/create', { studentData, classes, schools });
        } catch (error) {
            console.error('Error in /students/create:', error);
            res.status(500).send('Error loading student data');
        }
    });
    app.get('/students/edit/:student_id?', async (req, res) => {
        try {
            const { student_id } = req.params;
            // let studentData = null;
            const classes = await models.Classes.findAll({ attributes: ['id', 'name'], raw: true });
            const schools = await models.Schools.findAll({ attributes: ['id', 'name'], raw: true });
            const studentData = await models.Students.findOne({ where: { id: student_id }, raw: true });


            res.render('students/edit', { studentData, classes, schools });
        } catch (error) {
            console.error('Error in /students/create:', error);
            res.status(500).send('Error loading student data');
        }
    });

    /**
     * Create student with validation
     */



    app.post('/students/create', [
        body('name').notEmpty().withMessage('Name is required'),
        body('email')
            .isEmail().withMessage('Invalid email address')
            .custom(async (value) => {
                const existingStudent = await models.Students.findOne({ where: { email: value } });
                if (existingStudent) {
                    throw new Error('Email already exists');
                }
                return true;
            }),
        body('age').isInt({ min: 5, max: 100 }).withMessage('Age must be between 5 and 100'),
        body('class_id').notEmpty().withMessage('Class is required'),
        body('school_id').notEmpty().withMessage('School is required'),
        body('status').isIn(['0', '1']).withMessage('Invalid status'),
    ], async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', "You are not authorised to access this page.");
            return res.redirect('/students/index');
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('students/create', {
                studentData: req.body,
                errors: errors.mapped(),
                classes: await models.Classes.findAll({ attributes: ['id', 'name'], raw: true }),
                schools: await models.Schools.findAll({ attributes: ['id', 'name'], raw: true })
            });
        }

        const { name, email, age, class_id, school_id, status } = req.body;

        try {
            await models.Students.create({ name, email, age, class_id, school_id, status });

            req.flash('success', 'Student created successfully.');
            res.redirect('/students/index');
        } catch (error) {
            console.error('Error creating student:', error);
            req.flash('error', 'Error creating student. Please try again.');
            res.redirect('/students/create');
        }
    });



    /**
     * Update student with validation
     */


    app.post('/students/update/:student_id', [
        body('name').notEmpty().withMessage('Name is required'),
        body('email')
            .isEmail().withMessage('Invalid email format')
            .custom(async (value, { req }) => {
                const studentId = req.params.student_id; // Ensure student_id is correctly retrieved
                if (!studentId) {
                    throw new Error("Invalid student ID");
                }

                const existingStudent = await models.Students.findOne({
                    where: {
                        email: value,
                        id: { [Op.ne]: studentId } // Ensure proper exclusion
                    }
                });

                if (existingStudent) {
                    throw new Error('Email already exists');
                }
                return true;
            }),


        body('age').isInt({ min: 5 }).withMessage('Age must be at least 5'),
        // body('phone').isMobilePhone().withMessage('Invalid phone number'),
        body('class_id').notEmpty().withMessage('Class is required'),
        body('school_id').notEmpty().withMessage('School is required'),
        body('status').isIn(['1', '0']).withMessage('Status must be Active (1) or Inactive (0)'),
    ], async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', "You are not authorised to access this page.");
            return res.redirect('/students/index');
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('students/edit', {
                studentData: req.body,
                errors: errors.mapped(),
                classes: await models.Classes.findAll({ attributes: ['id', 'name'], raw: true }),
                schools: await models.Schools.findAll({ attributes: ['id', 'name'], raw: true })
            });
        }

        const { student_id } = req.params;
        const { name, email, age, class_id, school_id, status } = req.body;

        try {
            const [rowsUpdated] = await models.Students.update(
                { name, email, age, class_id, school_id, status },
                { where: { id: student_id } }
            );

            if (rowsUpdated > 0) {
                req.flash('success', 'Student updated successfully.');
            } else {
                req.flash('error', 'No changes were made or student not found.');
            }

            res.redirect('/students/index');
        } catch (error) {
            console.error('Error updating student:', error);
            req.flash('error', 'Error updating student. Please try again.');
            res.redirect(`/students/edit/${student_id}`);
        }
    });



    /**
     * Delete student
     */
    app.delete('/students/delete/:id', async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                return res.json({ success: false, message: 'Please login to continue' });
            }

            if (req.user.role.name !== "SuperAdmin") {
                return res.json({ success: false, message: 'You are not authorised to access this page.' });
            }

            const { id } = req.params;
            const studentData = await models.Students.findOne({ where: { id } });

            if (!studentData) {
                return res.json({ success: false, message: 'Student not found.' });
            }

            await models.Students.destroy({ where: { id } });
            return res.json({ success: true, message: 'Student deleted successfully.' });
        } catch (error) {
            return res.json({ success: false, message: error.message });
        }
    });
};
