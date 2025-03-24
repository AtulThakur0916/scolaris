const models = require('../models');
const dd = require('../helpers/dd');
const { body, validationResult } = require('express-validator');
const { countries } = require('countries-list');


module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

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
                order: [['name', 'ASC']],
                nest: true
            });



            res.render('students/index', {
                students, success: res.locals.success,
                error: res.locals.error
            });

        } catch (error) {
            console.error("Error fetching students:", error);
            req.flash('error', 'Failed to load students.');
            res.redirect('/');
        }
    });


    /**
     * Create or edit student
     */
    app.get('/students/create', async (req, res) => {
        try {
            const { student_id } = req.params;
            let studentData = null;
            const classes = await models.Classes.findAll({
                attributes: ['id', 'name'], where: {
                    status: '1'
                }, raw: true
            });
            const schools = await models.Schools.findAll({
                attributes: ['id', 'name'], where: {
                    status: 'Approve'
                }, raw: true
            });

            const countryList = Object.entries(countries).map(([code, country]) => ({
                code,
                name: country.name,
                flag: `https://flagcdn.com/w40/${code.toLowerCase()}.png`
            }));
            // countryList.forEach(country => console.log(country.flag));

            if (student_id) {
                studentData = await models.Students.findOne({ where: { id: student_id }, raw: true });
            }

            res.render('students/create', { studentData, classes, schools, countries: countryList });
        } catch (error) {
            console.error('Error in /students/create:', error);
            res.status(500).send('Error loading student data');
        }
    });


    app.get('/students/edit/:student_id?', async (req, res) => {
        try {

            const { student_id } = req.params;


            const schools = await models.Schools.findAll({
                attributes: ['id', 'name'], where: {
                    status: 'Approve'
                }, raw: true
            });
            let studentData = await models.Students.findOne({ where: { id: student_id }, raw: true });
            const classes = await models.Classes.findAll({ where: { school_id: studentData.school_id }, attributes: ['id', 'name'], raw: true });
            const monthNames = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];

            // Fetch sessions
            const schoolSessions = await models.SchoolSessions.findAll({
                where: { school_id: studentData.school_id },
                attributes: ['id', 'start_date', 'end_date'],
                raw: true
            });

            // Format dates
            const formattedSessions = schoolSessions.map(session => {
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
            // ✅ Preserve student ID even after validation errors
            const storedStudentData = req.flash('studentData')[0] || {};
            storedStudentData.id = storedStudentData.id || student_id; // ✅ Ensure ID is set
            const countryList = Object.entries(countries).map(([code, country]) => ({
                code,
                name: country.name,
                flag: `https://flagcdn.com/w40/${code.toLowerCase()}.png`
            }));
            res.render('students/edit', {
                studentData: storedStudentData.name ? storedStudentData : studentData,
                errors: req.flash('errors')[0] || {},
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                },
                classes,
                schools,
                countries: countryList,
                schoolSessions,
                formattedSessions,
                debug: {
                    hasStudent: !!studentData,
                    studentId: student_id,
                }
            });
        } catch (error) {
            console.error('Error loading student edit page:', error);
            res.status(500).send('Error loading student data');
        }
    });

    /**
     * Create student with validation
     */

    app.post('/students/create', [
        // Name validation
        body('name')
            .notEmpty().withMessage('Name is required')
            .matches(/^[A-Za-z\s]+$/).withMessage('Name should contain only alphabets and spaces'),

        // Email validation (optional, must be unique if provided)
        body('email')
            .optional({ checkFalsy: true })
            .isEmail().withMessage('Invalid email address')
            .custom(async (value) => {
                const existingStudent = await models.Students.findOne({ where: { email: value } });
                if (existingStudent) {
                    throw new Error('Email already exists');
                }
                return true;
            }),

        // Age validation (optional, must be integer and at least 5)
        body('age')
            .optional({ checkFalsy: true })
            .isInt({ min: 5 }).withMessage('Age must be an integer and at least 5'),

        // Roll number validation (unique for class, school, and session)
        body('roll_number')
            .optional({ checkFalsy: true })
            .custom(async (value, { req }) => {
                const { class_id, school_id, school_sessions_id } = req.body;
                const existingRollNumber = await models.Students.findOne({
                    where: {
                        roll_number: value,
                        class_id,
                        school_id,
                        school_sessions_id
                    }
                });

                if (existingRollNumber) {
                    throw new Error('Roll number must be unique for the selected class, school, and session');
                }
                return true;
            }),

        // Class validation
        body('class_id')
            .notEmpty().withMessage('Class is required'),

        // School validation
        body('school_id')
            .notEmpty().withMessage('School is required'),

        // School Session validation
        body('school_sessions_id')
            .notEmpty().withMessage('School session is required'),

        // Country validation
        body('country')
            .notEmpty().withMessage('Country is required'),

        // State validation
        body('state')
            .notEmpty().withMessage('State is required'),

        // City validation
        body('city')
            .notEmpty().withMessage('City is required'),

        // Address validation
        body('address')
            .notEmpty().withMessage('Address is required')
            .isLength({ min: 5 }).withMessage('Address must be at least 5 characters long'),

        // Status validation (1 = Active, 0 = Inactive)
        // body('status')
        //     .isIn(['1', '0']).withMessage('Status must be Active (1) or Inactive (0)')

    ], async (req, res) => {
        console.log(req.body);

        // Authentication check
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        // Authorization check
        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', "You are not authorized to access this page.");
            return res.redirect('/students/index');
        }

        // Handle validation errors
        const errors = validationResult(req);
        const countryList = Object.entries(countries).map(([code, country]) => ({
            code,
            name: country.name,
            flag: `https://flagcdn.com/w40/${code.toLowerCase()}.png`
        }));

        if (!errors.isEmpty()) {
            console.log(errors);
            return res.render('students/create', {
                studentData: req.body,
                countries: countryList,
                errors: errors.mapped(),
                classes: await models.Classes.findAll({ attributes: ['id', 'name'], raw: true }),
                schools: await models.Schools.findAll({ attributes: ['id', 'name'], raw: true })
            });
        }

        const {
            name, email, age, class_id, school_id, roll_number,
            state, address, city, country, status, school_sessions_id
        } = req.body;

        try {
            await models.Students.create({
                name,
                email,
                age,
                class_id,
                school_id,
                country,
                city,
                address,
                state,
                roll_number,
                school_sessions_id,
                status: true
            });

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
        body('name')
            .notEmpty().withMessage('Name is required')
            .matches(/^[A-Za-z\s]+$/).withMessage('Name should contain only alphabets and spaces'),
        body('email')
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email format')
            .custom(async (value, { req }) => {
                const studentId = req.params.student_id;
                const existingStudent = await models.Students.findOne({
                    where: {
                        email: value,
                        id: { [Op.ne]: studentId }
                    }
                });

                if (existingStudent) {
                    throw new Error('Email already exists');
                }
                return true;
            }),
        body('age')
            .notEmpty().withMessage('Age is required')
            .isInt({ min: 5 }).withMessage('Age must be at least 5'),
        body('roll_number')
            .notEmpty().withMessage('Roll number is required')
            .custom(async (value, { req }) => {
                const { student_id } = req.params;
                const { class_id, school_id, school_sessions_id } = req.body;

                const existingRollNumber = await models.Students.findOne({
                    where: {
                        roll_number: value,
                        class_id,
                        school_id,
                        school_sessions_id,
                        id: { [Op.ne]: student_id }
                    }
                });

                if (existingRollNumber) {
                    throw new Error('Roll number must be unique for the selected class, school, and session');
                }
                return true;
            }),
        body('class_id')
            .notEmpty().withMessage('Class is required'),
        body('school_id')
            .notEmpty().withMessage('School is required'),
        body('school_sessions_id')
            .notEmpty().withMessage('School session is required'),
        body('country')
            .notEmpty().withMessage('Country is required'),
        body('state')
            .notEmpty().withMessage('State is required'),
        body('city')
            .notEmpty().withMessage('City is required'),
        body('address')
            .notEmpty().withMessage('Address is required')
            .isLength({ min: 5 }).withMessage('Address must be at least 5 characters long'),
        body('status')
            .isIn(['1', '0']).withMessage('Status must be Active (1) or Inactive (0)')
    ], async (req, res) => {
        const { student_id } = req.params;

        // Authentication check
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        // Authorization check
        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', "You are not authorized to access this page.");
            return res.redirect('/students/index');
        }

        // Validation result check
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('studentData', { ...req.body, id: student_id });
            return res.redirect(`/students/edit/${student_id}`);
        }

        // If no errors, update the student
        try {
            const {
                name, email, age, roll_number, class_id,
                school_id, school_sessions_id, country, state,
                city, address, status
            } = req.body;

            const [rowsUpdated] = await models.Students.update(
                {
                    name, email, age, roll_number, class_id,
                    school_id, school_sessions_id, country, state,
                    city, address, status
                },
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

    app.get('/school/class/:school_sessions_id', async (req, res) => {
        try {
            const { school_sessions_id } = req.params;

            if (!school_sessions_id) {
                return res.status(400).json({ error: "School ID is required" });
            }
            const classes = await models.Classes.findAll({
                where: { school_sessions_id, status: '1' },
                attributes: ['id', 'name'],
                raw: true
            });

            if (classes.length === 0) {
                return res.status(404).json({ error: "No classes found for this Session" });
            }

            res.json({ classes });
        } catch (error) {
            console.error("Error fetching classes:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });
    app.get('/school/session/:school_id', async (req, res) => {
        try {
            const { school_id } = req.params;

            if (!school_id) {
                return res.status(400).json({ error: "School ID is required" });
            }
            const session = await models.SchoolSessions.findAll({
                where: { school_id, status: 'Active' },
                attributes: ['id', 'start_date', 'end_date'],
                raw: true
            });

            if (session.length === 0) {
                return res.status(404).json({ error: "No session found for this school" });
            }

            res.json({ session });
        } catch (error) {
            console.error("Error fetching session:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

};
