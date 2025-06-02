const models = require('../models');
const dd = require('../helpers/dd');
const { body, validationResult } = require('express-validator');
const { countries } = require('countries-list');
const waterfall = require('async-waterfall');
const fs = require('fs');
const path = require('path');

module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

    /**
     * Render view for managing students
     */
    app.get('/students/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            // Build query conditions
            let whereCondition = {};

            // Add class_id filter if provided
            if (req.query.class_id) {
                whereCondition.class_id = req.query.class_id;
            }

            // Add school filter for School and Administrator roles
            if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                whereCondition.school_id = req.user.school_id;
            }

            const students = await models.Students.findAll({
                attributes: ['id', 'name', 'email', 'class_id', 'profile_pic', 'school_id', 'status'],
                where: whereCondition,
                include: [
                    { model: models.Classes, as: 'class', attributes: ['name'] },
                    { model: models.Schools, as: 'school', attributes: ['name'] }
                ],
                order: [['created_at', 'DESC']],
                raw: true,
                nest: true
            });

            res.render('students/index', {
                students,
                selectedClass: req.query.class_id,
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
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
        // Authentication check
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        // Authorization check
        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            let studentData = null;
            // const whereCondition = req.user.role.name === "School" ? { school_id: req.user.school_id } : {};
            const whereCondition = (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator")
                ? { school_id: req.user.school_id }
                : {};
            // Fetch classes - restricted for School role
            const classes = await models.Classes.findAll({
                attributes: ['id', 'name'],
                where: { status: '1', ...whereCondition },
                raw: true
            });

            // Fetch schools - restricted for School role
            const schools = req.user.role.name === "SuperAdmin"
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

            // Country list with flags
            const countryList = Object.entries(countries).map(([code, country]) => ({
                code,
                name: country.name,
                flag: `https://flagcdn.com/w40/${code.toLowerCase()}.png`
            }));

            // Preserve student data if editing (optional)
            if (req.query.student_id) {
                studentData = await models.Students.findOne({
                    where: { id: req.query.student_id },
                    raw: true
                });
            }

            res.render('students/create', {
                studentData,
                classes,
                schools,
                countries: countryList
            });

        } catch (error) {
            console.error('Error in /students/create:', error);
            req.flash('error', 'Error loading student data');
            res.redirect('/');
        }
    });



    app.get('/students/edit/:student_id?', async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                req.flash('error', 'Please login to continue');
                return res.redirect('/login');
            }

            // ✅ Authorization check
            if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
                req.flash('error', 'You are not authorised to access this page.');
                return res.redirect('/');
            }

            const { student_id } = req.params;

            // ✅ Check if student exists and restrict School Admin to their school
            const studentData = await models.Students.findOne({
                where: req.user.role.name === "School" ? {
                    id: student_id,
                    school_id: req.user.school_id
                } : { id: student_id },
                raw: true
            });

            if (!studentData) {
                req.flash('error', 'Student not found or unauthorized access');
                return res.redirect('/students/index');
            }

            // ✅ Fetch Schools (SuperAdmin can see all, School Admin only sees their school)
            const schools = await models.Schools.findAll({
                attributes: ['id', 'name'],
                where: (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") ? {
                    id: req.user.school_id,
                    status: 'Approve'
                } : { status: 'Approve' },
                raw: true
            });

            // ✅ Fetch Classes (filtered by student's school)
            const classes = await models.Classes.findAll({
                where: {
                    school_id: studentData.school_id,
                    status: '1'
                },
                attributes: ['id', 'name'],
                raw: true
            });

            // ✅ Fetch School Sessions
            const schoolSessions = await models.SchoolSessions.findAll({
                where: { school_id: studentData.school_id },
                attributes: ['id', 'start_date', 'end_date'],
                raw: true
            });

            // ✅ Format session dates
            const monthNames = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            const formattedSessions = schoolSessions.map(session => {
                const startDate = new Date(session.start_date);
                const endDate = new Date(session.end_date);
                const formattedStart = `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;
                const formattedEnd = `${monthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;
                return { ...session, start_date: formattedStart, end_date: formattedEnd };
            });

            // ✅ Handle flash messages and preserve data after validation errors
            const storedStudentData = req.flash('studentData')[0] || {};
            storedStudentData.id = storedStudentData.id || student_id; // Ensure ID is set

            // ✅ Country List (for dropdown)
            const countryList = Object.entries(countries).map(([code, country]) => ({
                code,
                name: country.name,
                flag: `https://flagcdn.com/w40/${code.toLowerCase()}.png`
            }));

            // ✅ Render Edit Page
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
            req.flash('error', 'Error loading student data');
            res.redirect('/students/index');
        }
    });


    app.post('/students/create', [
        body('name')
            .notEmpty().withMessage('Name is required')
            .matches(/^[A-Za-z\s]+$/).withMessage('Name should contain only alphabets and spaces'),

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

        body('age')
            .optional({ checkFalsy: true })
            .isInt({ min: 5 }).withMessage('Age must be an integer and at least 5'),
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
        body('class_id').notEmpty().withMessage('Class is required'),
        body('school_id').notEmpty().withMessage('School is required'),
        body('school_sessions_id').notEmpty().withMessage('School session is required'),
        body('country').notEmpty().withMessage('Country is required'),
        body('state').notEmpty().withMessage('Region is required'),
        body('city').notEmpty().withMessage('Town is required'),
        body('address')
            .notEmpty().withMessage('Address is required')
            .isLength({ min: 5 }).withMessage('Address must be at least 5 characters long'),

    ], async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        const errors = validationResult(req);
        const countryList = Object.entries(countries).map(([code, country]) => ({
            code,
            name: country.name,
            flag: `https://flagcdn.com/w40/${code.toLowerCase()}.png`
        }));

        const schoolCondition = req.user.role.name === "School" ? { id: req.user.school_id } : {};
        const classesCondition = req.user.role.name === "School" ? { school_id: req.user.school_id, status: '1' } : { status: '1' };

        if (!errors.isEmpty()) {
            return res.render('students/create', {
                studentData: req.body,
                countries: countryList,
                errors: errors.mapped(),
                classes: await models.Classes.findAll({ attributes: ['id', 'name'], where: classesCondition, raw: true }),
                schools: await models.Schools.findAll({ attributes: ['id', 'name'], where: schoolCondition, raw: true })
            });
        }

        const {
            name, email, age, class_id, school_id, roll_number,
            state, address, city, country, status, school_sessions_id
        } = req.body;

        const finalSchoolId = (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") ? req.user.school_id : school_id;

        waterfall([
            function (done) {
                if (req.files && req.files.profile_pic) {
                    const file = req.files.profile_pic;
                    const ext = path.extname(file.name).toLowerCase();
                    const baseName = path.basename(file.name, ext);
                    const imageName = `${baseName}-${Date.now()}${ext}`;
                    const uploadDir = path.join(__dirname, '../public/uploads/students/');
                    const uploadPath = path.join(uploadDir, imageName);

                    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];

                    if (!allowedExtensions.includes(ext)) {
                        req.flash('errors', { profile_pic: { msg: 'Only PNG, JPG, JPEG, and GIF files are allowed.' } });
                        req.flash('studentData', req.body);
                        return res.redirect(`/students/create`);
                    }

                    if (file.size > 5 * 1024 * 1024) {
                        req.flash('errors', { profile_pic: { msg: 'Profile picture must be under 5MB.' } });
                        req.flash('studentData', req.body);
                        return res.redirect(`/students/create`);
                    }

                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }

                    file.mv(uploadPath, function (err) {
                        if (err) return done(err);
                        done(null, `/uploads/students/${imageName}`);
                    });
                } else {
                    done(null, null);
                }
            },
            function (profilePicPath, done) {
                const newStudent = {
                    name,
                    email,
                    age,
                    class_id,
                    school_id: finalSchoolId,
                    country,
                    city,
                    address,
                    state,
                    roll_number,
                    school_sessions_id,
                    status: true
                };

                if (profilePicPath) {
                    newStudent.profile_pic = profilePicPath;
                }

                models.Students.create(newStudent)
                    .then(async (student) => {
                        // Get school name and class name for the email
                        const [school, studentClass] = await Promise.all([
                            models.Schools.findOne({
                                where: { id: finalSchoolId },
                                attributes: ['name'],
                                raw: true
                            }),
                            models.Classes.findOne({
                                where: { id: class_id },
                                attributes: ['name'],
                                raw: true
                            })
                        ]);

                        // Send welcome email to student
                        if (email) {
                            try {
                                await sendEmail(
                                    email,
                                    'Welcome to Scolaris Pay - Student Account Created',
                                    `
Dear ${name},

Your student account has been created successfully in Scolaris Pay at ${school.name}.

Account Details:
- Name: ${name}
- Email: ${email}
- Roll Number: ${roll_number}
- Class: ${studentClass.name}
- School: ${school.name}


Best regards,
The Scolaris Pay Team
                                    `
                                );
                            } catch (emailError) {
                                console.error('Error sending welcome email:', emailError);
                                // Continue with student creation even if email fails
                            }
                        }

                        req.flash('success', 'Student created successfully.');
                        done(null);
                    })
                    .catch((error) => {
                        done(error);
                    });
            }
        ], function (err) {
            if (err) {
                console.error('Error creating student:', err);
                req.flash('error', 'Error creating student. Please try again.');
                return res.redirect('/students/create');
            }
            res.redirect('/students/index');
        });
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
            .notEmpty().withMessage('Region is required'),
        body('city')
            .notEmpty().withMessage('Town is required'),
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

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        // Validation result check
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log(errors);
            req.flash('errors', errors.mapped());
            req.flash('studentData', { ...req.body, id: student_id });
            return res.redirect(`/students/edit/${student_id}`);
        }

        try {
            const {
                name, email, age, roll_number, class_id,
                school_id, school_sessions_id, country, state,
                city, address, status
            } = req.body;
            console.log(req.body);
            let profilePicUrl = null; // Initialize profilePicUrl

            // Handle profile picture upload
            if (req.files && req.files.profile_pic) {
                console.log(req.files.profile_pic);
                const file = req.files.profile_pic;
                const ext = path.extname(file.name).toLowerCase();
                const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];

                // Validate file extension
                if (!allowedExtensions.includes(ext)) {
                    req.flash('errors', { profile_pic: { msg: 'Only PNG, JPG, JPEG, and GIF files are allowed.' } });
                    req.flash('studentData', req.body);
                    return res.redirect(`/students/edit/${student_id}`);
                }

                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    req.flash('errors', { profile_pic: { msg: 'Profile picture must be under 5MB.' } });
                    req.flash('studentData', req.body);
                    return res.redirect(`/students/edit/${student_id}`);
                }

                // Create the upload directory if it doesn't exist
                const uploadDir = path.join(__dirname, '../public/uploads/students/');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                // Generate unique filename for profile picture
                const profilePicName = `student-${Date.now()}${ext}`;
                const uploadPath = path.join(uploadDir, profilePicName);

                // Move the file to the upload path
                await file.mv(uploadPath);

                // Set the profile picture URL
                profilePicUrl = `/uploads/students/${profilePicName}`;
            }

            // Update the student data in the database
            const [rowsUpdated] = await models.Students.update(
                {
                    name, email, age, roll_number, class_id,
                    school_id, school_sessions_id, country, state,
                    city, address, status,
                    profile_pic: profilePicUrl // Update profile picture path if available
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

            if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
                req.flash('error', 'You are not authorised to access this page.');
                return res.redirect('/');
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
