const models = require('../../../models');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ParentSchools, Parents, Schools, FAQ, ParentStudents, Students, CMSPage, Classes } = require('../../../models');
const configPath = path.join(__dirname, '../../../config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const { Op } = require('sequelize');

module.exports.controller = function (app, verifyJwt, sendEmail, Op, config, sequelize) {

    /**
     * API Status
     */
    app.get('/api/v1/status', async (req, res) => {

        // console.log('isRevoked', req.path);
        return res.status(201).send({ success: true, message: 'All APIs are up.' });
    });

    // Register parent

    app.post(
        '/api/v1/auth/register',
        [
            body('name').notEmpty().withMessage('Name is required'),
            body('mobile')
                .notEmpty().withMessage('Mobile number is required')
                .isMobilePhone().withMessage('Invalid mobile number'),
            body('password')
                .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
            body('confirm_password')
                .notEmpty().withMessage('Confirm password is required')
                .custom((value, { req }) => value === req.body.password)
                .withMessage('Passwords do not match'),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg }); // 🔹 Return only the first error message
                }

                const { name, mobile, password } = req.body;

                const existingParent = await Parents.findOne({ where: { mobile } });
                if (existingParent) {
                    return res.status(400).json({ success: false, error: 'Mobile number already in use' });
                }

                const hashedPassword = await bcrypt.hash(password, 10);

                const otp = Math.floor(100000 + Math.random() * 900000).toString();

                const parent = await Parents.create({
                    name,
                    mobile,
                    password: hashedPassword,
                    otp,
                    otp_verified: false,
                });

                if (parent) {
                    return res.status(201).json({
                        success: true,
                        message: 'Registration successful. Please verify OTP.',
                        otp: parent.otp
                    });
                } else {
                    throw new Error('Parent creation failed.');
                }

            } catch (error) {
                console.error('Registration Error:', error);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );
    app.post(
        '/api/v1/auth/resend-otp',
        [
            body('mobile')
                .notEmpty().withMessage('Mobile number is required')
                .isMobilePhone().withMessage('Invalid mobile number'),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg }); // 🔹 Return only the first error message
                }

                const { mobile } = req.body;
                const parent = await Parents.findOne({ where: { mobile } });

                if (!parent) {
                    return res.status(400).json({ success: false, error: 'Mobile number not found' });
                }

                const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

                await parent.update({ otp: newOtp, otp_verified: false });

                //  Send OTP 
                // await sendOtp(mobile, newOtp); // Uncomment if you have an SMS service

                return res.status(200).json({
                    success: true,
                    message: 'New OTP has been sent to your mobile number.',
                    otp: newOtp
                });

            } catch (error) {
                console.error('Resend OTP Error:', error);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );



    app.post(
        '/api/v1/auth/verify-otp',
        [
            body('mobile')
                .notEmpty().withMessage('Mobile number is required')
                .isMobilePhone().withMessage('Invalid mobile number'),
            body('otp')
                .notEmpty().withMessage('OTP is required')
                .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg }); // 🔹 Return only the first error message
                }

                const { mobile, otp } = req.body;
                const parent = await Parents.findOne({ where: { mobile } });

                if (!parent) {
                    return res.status(400).json({ success: false, error: 'Mobile number not found' });
                }

                if (parent.otp !== otp) {
                    return res.status(400).json({ success: false, error: 'Invalid OTP' });
                }

                await parent.update({ otp_verified: true, otp: null });

                // const token = jwt.sign(
                //     { id: parent.id, mobile: parent.mobile },
                //     config.jwt_secret,
                //     { algorithm: 'HS256', expiresIn: '1h' }
                // );
                const token = jwt.sign(
                    { id: parent.id, mobile: parent.mobile },
                    config.jwt_secret,
                    { algorithm: 'HS256' }
                );

                return res.status(200).json({
                    success: true,
                    message: 'OTP verified successfully. Your account is now active.',
                    token,
                });

            } catch (error) {
                console.error('OTP Verification Error:', error);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );

    /**
     * Post Login API
     */

    app.post(
        '/api/v1/auth/login',
        [
            body('mobile')
                .notEmpty().withMessage('Mobile number is required')
                .isMobilePhone().withMessage('Invalid mobile number'),
            body('password')
                .notEmpty().withMessage('Password is required')
                .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg }); // 🔹 Return only the first error message
                }

                const { mobile, password } = req.body;

                const parent = await Parents.findOne({ where: { mobile } });

                if (!parent) {
                    return res.status(400).json({ success: false, error: 'Mobile number not found' });
                }

                const isMatch = await bcrypt.compare(password, parent.password);
                if (!isMatch) {
                    return res.status(401).json({ success: false, error: 'Invalid mobile number or password' });
                }

                const otp = Math.floor(100000 + Math.random() * 900000).toString();

                await parent.update({ otp });

                // Send OTP 
                // await sendOtp(mobile, otp); // Uncomment if you have an SMS service

                return res.status(200).json({
                    success: true,
                    message: 'OTP sent for verification. Please verify to continue.',
                    otp
                });

            } catch (error) {
                console.error('Login Error:', error);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );



    app.post('/api/v1/schools/search', verifyJwt(), async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
            }


            const { name, location, id } = req.body;
            let whereCondition = {};

            if (name || location) {
                whereCondition = {
                    [Op.and]: []
                };

                if (name) {
                    whereCondition[Op.and].push({ name: { [Op.iLike]: `%${name}%` } }); // ✅ Case-insensitive name search
                }

                if (location) {
                    whereCondition[Op.and].push({ location: { [Op.iLike]: `%${location}%` } }); // ✅ Case-insensitive location search
                }
            }

            if (id) {
                whereCondition.id = id;
            }

            if (!name && !location) {
                whereCondition = {};
            }

            const schools = await Schools.findAll({ where: whereCondition });

            return res.status(200).json({ success: true, schools });

        } catch (err) {
            console.error("Search Error:", err.message);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });

    app.post('/api/v1/parents/add-school', verifyJwt(), async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
            }

            const parentId = req.user.id;
            const { school_id } = req.body;

            if (!school_id) {
                return res.status(400).json({ success: false, message: "School ID is required" });
            }

            const school = await Schools.findByPk(school_id);
            if (!school) {
                return res.status(404).json({ success: false, message: "School not found" });
            }

            const existingEntry = await ParentSchools.findOne({ where: { parent_id: parentId, school_id } });
            if (existingEntry) {
                return res.status(400).json({ success: false, message: "Parent is already linked to this school" });
            }

            await ParentSchools.create({ parent_id: parentId, school_id });

            return res.status(201).json({ success: true, message: "School added successfully" });

        } catch (err) {
            console.error("Add School Error:", err.message);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });


    app.post('/api/v1/parents/add-student', [
        body('name')
            .notEmpty().withMessage('Name is required'),
        body('relations')
            .notEmpty().withMessage('Relation is required'),
        body('school_id')
            .notEmpty().withMessage('School ID is required')
            .isUUID().withMessage('Invalid School ID format'),
        body('class_id')
            .notEmpty().withMessage('Class ID is required')
            .isUUID().withMessage('Invalid Class ID format'),

        body('roll_number')
            .notEmpty().withMessage('Roll number is required')
            .isAlphanumeric().withMessage('Roll number must be alphanumeric')
            .isLength({ min: 1, max: 10 }).withMessage('Roll number must be between 1 and 10 characters long'),
    ], verifyJwt(), async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg }); // 🔹 Return only the first error message
            }

            const parentId = req.user.id;
            const { school_id, name, relations, class_id, roll_number } = req.body;

            if (!school_id || !name || !relations || !class_id || !roll_number) {
                return res.status(400).json({ success: false, message: "All fields are required (school_id, name, relation, class_id, roll_number)" });
            }

            let student = await Students.findOne({
                where: {
                    school_id,
                    class_id,
                    roll_number
                }
            });

            if (!student) {
                student = await Students.create({ school_id, name, class_id, roll_number });
            }

            const existingEntry = await ParentStudents.findOne({
                where: { parent_id: parentId, student_id: student.id }
            });

            if (existingEntry) {
                return res.status(400).json({ success: false, message: "Parent is already linked to this student" });
            }

            await ParentStudents.create({ parent_id: parentId, student_id: student.id, relations });

            return res.status(201).json({ success: true, message: "Student added successfully", student });

        } catch (err) {
            console.error("Add Student Error:", err.message);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });
    app.get('/api/v1/parents/students', verifyJwt(), async (req, res) => {
        try {
            const parentId = req.user.id;

            const parentStudents = await ParentStudents.findAll({
                where: { parent_id: parentId },
                include: [
                    {
                        model: Students,
                        as: 'Student',
                        attributes: ['id', 'name', 'roll_number', 'status'],
                        include: [
                            {
                                model: Schools,
                                as: 'school',  // ✅ Fixed alias
                                attributes: ['name']
                            },
                            {
                                model: Classes,
                                as: 'class',  // ✅ Fixed alias
                                attributes: ['name']
                            }
                        ]
                    }
                ]
            });



            if (!parentStudents.length) {
                return res.status(404).json({
                    success: false,
                    message: "No students found for this parent",
                    data: []
                });
            }

            const students = parentStudents.map(entry => ({
                id: entry.Student.id,
                name: entry.Student.name,
                roll_number: entry.Student.roll_number,
                status: entry.Student.status,
                school_name: entry.Student.school ? entry.Student.school.name : null,
                class_name: entry.Student.class ? entry.Student.class.name : null
            }));


            res.json({
                success: true,
                message: "Students fetched successfully",
                data: students
            });

        } catch (err) {
            console.error("Fetch Students Error:", err.message);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });

    app.post('/api/v1/parents/edit-student', [
        body('student_id')
            .notEmpty().withMessage('Student ID is required')
            .isUUID().withMessage('Invalid Student ID format'),
        body('name').optional().notEmpty().withMessage('Name cannot be empty'),
        body('relations').optional().notEmpty().withMessage('Relation cannot be empty'),
        body('school_id').optional().isUUID().withMessage('Invalid School ID format'),
        body('class_id').optional().isUUID().withMessage('Invalid Class ID format'),
        body('roll_number').optional().notEmpty().isAlphanumeric().withMessage('Roll number must be alphanumeric')
            .isLength({ min: 1, max: 10 }).withMessage('Roll number must be between 1 and 10 characters long'),
    ], verifyJwt(), async (req, res) => {
        try {
            // ✅ Validation Check
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg });
            }

            const parentId = req.user.id;
            const { student_id, name, relations, school_id, class_id, roll_number } = req.body;

            const parentStudent = await ParentStudents.findOne({
                where: { parent_id: parentId, student_id: student_id }
            });

            if (!parentStudent) {
                return res.status(403).json({ success: false, message: 'You are not authorized to edit this student' });
            }

            const student = await Students.findByPk(student_id);
            if (!student) {
                return res.status(404).json({ success: false, message: 'Student not found' });
            }

            if (roll_number && class_id && school_id) {
                const existingStudent = await Students.findOne({
                    where: {
                        school_id,
                        class_id,
                        roll_number,
                        id: { [Op.ne]: student_id }  // Exclude the current student
                    }
                });

                if (existingStudent) {
                    return res.status(400).json({
                        success: false,
                        message: 'Another student with the same roll number, class, and school already exists'
                    });
                }
            }

            // ✅ Update only fields that exist in the request body
            const updatedFields = {};
            if (name) updatedFields.name = name;
            if (school_id) updatedFields.school_id = school_id;
            if (class_id) updatedFields.class_id = class_id;
            if (roll_number) updatedFields.roll_number = roll_number;

            // ✅ Perform the update
            if (Object.keys(updatedFields).length > 0) {
                await student.update(updatedFields);
            }

            // ✅ Update relations if provided
            if (relations) {
                await parentStudent.update({ relations });
            }

            res.json({ success: true, message: 'Student information updated successfully', student });

        } catch (err) {
            console.error('Edit Student Error:', err);
            if (err.name === 'SequelizeValidationError') {
                res.status(400).json({ success: false, message: err.errors[0].message });
            } else {
                res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
        }
    });




    app.post('/api/v1/classes/list',
        [
            body('school_id')
                .notEmpty().withMessage('School ID is required')
                .isUUID().withMessage('Invalid School ID format'),
        ], verifyJwt(),
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg }); // 🔹 Return only the first error message
                }

                const { school_id } = req.body;
                const school = await Schools.findByPk(school_id);
                if (!school) {
                    return res.status(404).json({ success: false, message: "School not found" });
                }

                const classes = await Classes.findAll({
                    where: { school_id, status: 1 },
                    attributes: ['id', 'name', 'created_at'],
                    order: [['created_at', 'DESC']]
                });

                return res.status(200).json({
                    success: true,
                    message: "Classes retrieved successfully",
                    classes
                });

            } catch (err) {
                console.error("Get Classes Error:", err);
                res.status(500).json({ success: false, message: "Internal Server Error" });
            }
        }
    );
    app.get('/api/v1/parents/my-schools', verifyJwt(), async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
            }
            const parentId = req.user.id;
            const baseUrl = req.protocol + '://' + req.get('host');
            const parentSchools = await ParentSchools.findAll({
                where: { parent_id: parentId },
                include: [{
                    model: Schools,
                    as: 'School',
                    attributes: ['id', 'name', 'location', 'email', 'logo', 'created_at']
                }]
            });

            parentSchools.forEach(entry => {
                if (entry.School && entry.School.logo) {
                    entry.School.logo = `${baseUrl}${entry.School.logo}`;
                }
            });

            if (parentSchools.length === 0) {
                return res.status(404).json({ success: false, message: "No schools found for this parent" });
            }

            return res.status(200).json({
                success: true,
                message: "Schools retrieved successfully",
                schools: parentSchools.map(entry => entry.School)
            });

        } catch (err) {
            console.error("Get Parent Schools Error:", err);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });

    app.delete('/api/v1/parents/remove-school', [
        body('school_id')
            .notEmpty().withMessage('School ID is required')
            .isUUID().withMessage('Invalid School ID format'),
    ], verifyJwt(), async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
            }
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg }); // 🔹 Return only the first error message
            }
            const parentId = req.user.id;
            const { school_id } = req.body;

            if (!school_id) {
                return res.status(400).json({ success: false, message: "School ID is required" });
            }
            const parentSchool = await ParentSchools.findOne({
                where: { parent_id: parentId, school_id }
            });

            if (!parentSchool) {
                return res.status(404).json({ success: false, message: "Parent is not linked to this school" });
            }
            await ParentSchools.destroy({
                where: { parent_id: parentId, school_id }
            });

            return res.status(200).json({ success: true, message: "School removed successfully" });

        } catch (err) {
            console.error("Remove Parent School Error:", err);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });
    app.delete('/api/v1/parents/remove-student', [
        body('student_id')
            .notEmpty().withMessage('Student ID is required')
            .isUUID().withMessage('Invalid Student ID format'),
    ], verifyJwt(), async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg }); // Return only the first validation error message
            }

            const parentId = req.user.id;
            const { student_id } = req.body;
            const parentStudent = await ParentStudents.findOne({
                where: { parent_id: parentId, student_id }
            });

            if (!parentStudent) {
                return res.status(404).json({ success: false, message: "Parent is not linked to this student" });
            }
            await ParentStudents.destroy({
                where: { parent_id: parentId, student_id }
            });

            return res.status(200).json({ success: true, message: "Student removed successfully" });

        } catch (err) {
            console.error("Remove Parent Student Error:", err);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });

    //cms
    app.get('/api/v1/cms/:slug', async (req, res) => {
        try {
            const page = await CMSPage.findOne({
                where: { slug: req.params.slug, status: '1' },
                attributes: ['id', 'title', 'content']
            });
            if (!page) return res.status(404).json({ error: 'Page not found' });
            res.json({
                status: true,
                msg: 'Page fetched successfully',
                data: page
            });
        } catch (error) {
            res.status(500).json({
                status: false,
                msg: 'Internal server error',
                data: null
            });
        }
    });
    app.get('/api/v1/faqs', async (req, res) => {
        try {
            const activeFaqs = await FAQ.findAll({
                where: { status: '1' },
                attributes: ['id', 'question', 'answer'],
                order: [['created_at', 'DESC']],
            });

            res.json({
                status: true,
                msg: 'FAQs fetched successfully',
                data: activeFaqs
            });
        } catch (error) {
            res.status(500).json({
                status: false,
                msg: 'Internal server error',
                data: null
            });
        }
    });
    /**
     * Post view count API
     */
    app.post('/api/v1/news-views', verifyJwt(), async (req, res) => {

        const user_id = req.user.id;
        let { mode } = req.body;

        return res.status(201).send({ success: true, message: "API code with authentication token" });
    });
};
