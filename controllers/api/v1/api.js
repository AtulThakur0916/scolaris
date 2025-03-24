const models = require('../../../models');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ParentSchools, Parents, Activity, SchoolSessions, Payments, Fees, Schools, FAQ, ParentStudents, Students, CMSPage, Classes } = require('../../../models');
const configPath = path.join(__dirname, '../../../config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const { sendEmail } = require('../../../helpers/zepto');


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
                .isMobilePhone().withMessage('Invalid mobile number')
                .custom(async (mobile) => {
                    const existingParent = await models.Parents.findOne({ where: { mobile } });
                    if (existingParent) {
                        throw new Error('Mobile number already exists.');
                    }
                }),
            body('email')
                .isEmail().withMessage('Invalid email address')
                .custom(async (email) => {
                    const existingParent = await models.Parents.findOne({ where: { email } });
                    if (existingParent) {
                        throw new Error('Email already exists.');
                    }
                }),
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
                    return res.status(400).json({ success: false, message: errors.array()[0].msg });
                }

                const { name, mobile, password, email, country, state, city, address } = req.body;

                const hashedPassword = await bcrypt.hash(password, 10);
                const otp = Math.floor(100000 + Math.random() * 900000).toString();

                const parent = await models.Parents.create({
                    name,
                    mobile,
                    password: hashedPassword,
                    otp,
                    email,
                    country,
                    state,
                    city,
                    address,
                    otp_verified: false,
                });

                if (parent) {
                    const subject = 'OTP Verification - Scolaris Pay';
                    const message = `Hello ${name},\n\nYour OTP for registration is: ${otp}\n\nThank you.`;
                    try {
                        await sendEmail(email, subject, message);
                        console.log('OTP sent to email:', email);
                    } catch (emailError) {
                        console.error('Failed to send OTP email:', emailError);
                    }

                    return res.status(201).json({
                        success: true,
                        message: 'Registration successful. Please verify OTP.',
                        otp: parent.otp,
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
    // Resend OTP (Mobile or Email)
    app.post(
        '/api/v1/auth/resend-otp',
        [
            body('identifier')
                .notEmpty().withMessage('Mobile number or Email is required')
                .custom(value => {
                    if (!/^\d+$/.test(value) && !/\S+@\S+\.\S+/.test(value)) {
                        throw new Error('Invalid mobile number or email');
                    }
                    return true;
                }),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg });
                }

                const { identifier } = req.body;
                let whereClause = /^\d+$/.test(identifier) ? { mobile: identifier } : { email: identifier };

                const parent = await Parents.findOne({ where: whereClause });

                if (!parent) {
                    return res.status(400).json({ success: false, error: 'Invalid mobile number or email' });
                }
                const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

                await parent.update({ otp: newOtp, otp_verified: false });

                if (whereClause.mobile) {
                    // Send via SMS (Uncomment if you have an SMS service)
                    // await sendOtp(parent.mobile, newOtp);
                    console.log(`OTP sent to mobile: ${parent.mobile} - OTP: ${newOtp}`);
                }

                const subject = 'OTP Resend - Scolaris Pay';
                const message = `Hello ${parent.name},\n\nYour new OTP is: ${newOtp}\n\nThank you.`;
                await sendEmail(parent.email, subject, message);
                console.log(`OTP sent to email: ${parent.email} - OTP: ${newOtp}`);

                return res.status(200).json({
                    success: true,
                    message: 'New OTP has been sent to your mobile and email.',
                    otp: newOtp,
                });

            } catch (error) {
                console.error('Resend OTP Error:', error);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );
    //social login
    app.post(
        '/api/v1/auth/social-login',
        [
            body('name').notEmpty().withMessage('Name is required'),
            body('mobile')
                .notEmpty().withMessage('Mobile number is required')
                .isMobilePhone().withMessage('Invalid mobile number'),
            body('provider').notEmpty().withMessage('Provider is required'),
            body('provider_id').notEmpty().withMessage('Provider ID is required'),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg });
                }

                const { name, mobile, provider, provider_id } = req.body;
                let parent = await Parents.findOne({
                    where: { provider, provider_id }
                });

                if (parent) {
                    const token = jwt.sign(
                        { id: parent.id, mobile: parent.mobile },
                        config.jwt_secret,
                        { algorithm: 'HS256' }
                    );
                    return res.status(200).json({
                        success: true,
                        message: 'Login successful',
                        token,
                    });
                } else {
                    const existingMobile = await Parents.findOne({ where: { mobile } });
                    if (existingMobile) {
                        return res.status(400).json({
                            success: false,
                            message: 'Mobile number already registered',
                        });
                    }
                    parent = await Parents.create({
                        name,
                        mobile,
                        provider,
                        provider_id,
                    });

                    const token = jwt.sign(
                        { id: parent.id, mobile: parent.mobile },
                        config.jwt_secret,
                        { algorithm: 'HS256' }
                    );

                    return res.status(201).json({
                        success: true,
                        message: 'User registered successfully',
                        token,
                    });
                }
            } catch (error) {
                console.error('Social Login Error:', error);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );
    //verify-otp
    app.post(
        '/api/v1/auth/verify-otp',
        [
            body('identifier')
                .notEmpty().withMessage('Mobile number or Email is required')
                .custom(value => {
                    if (!/^\d+$/.test(value) && !/\S+@\S+\.\S+/.test(value)) {
                        throw new Error('Invalid mobile number or email');
                    }
                    return true;
                }),
            body('otp')
                .notEmpty().withMessage('OTP is required')
                .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg });
                }

                const { identifier, otp, fcm_token } = req.body;
                let whereClause = /^\d+$/.test(identifier) ? { mobile: identifier } : { email: identifier };

                const parent = await Parents.findOne({ where: whereClause });

                if (!parent) {
                    return res.status(400).json({ success: false, error: 'Invalid mobile number or email' });
                }

                if (parent.otp !== otp) {
                    return res.status(400).json({ success: false, error: 'Invalid OTP' });
                }

                const updateData = { otp_verified: true, otp: null };
                if (fcm_token) updateData.fcm_token = fcm_token;

                await parent.update(updateData);

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
    //login
    app.post(
        '/api/v1/auth/login',
        [
            body('identifier')
                .notEmpty().withMessage('Mobile number or Email is required')
                .custom(value => {
                    if (!/^\d+$/.test(value) && !/\S+@\S+\.\S+/.test(value)) {
                        throw new Error('Invalid mobile number or email');
                    }
                    return true;
                }),
            body('password')
                .notEmpty().withMessage('Password is required')
                .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg });
                }

                const { identifier, password } = req.body;
                let whereClause = /^\d+$/.test(identifier) ? { mobile: identifier } : { email: identifier };

                const parent = await Parents.findOne({ where: whereClause });

                if (!parent) {
                    return res.status(400).json({ success: false, error: 'Invalid mobile number or email' });
                }

                const isMatch = await bcrypt.compare(password, parent.password);
                if (!isMatch) {
                    return res.status(401).json({ success: false, error: 'Invalid password' });
                }

                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                await parent.update({ otp });

                const subject = 'OTP Verification - Scolaris Pay';
                const message = `Hello ${parent.name},\n\nYour OTP for login is: ${otp}\n\nThank you.`;

                try {
                    await sendEmail(parent.email, subject, message);
                    console.log('OTP sent to email:', parent.email);
                } catch (emailError) {
                    console.error('Failed to send OTP email:', emailError);
                }

                return res.status(200).json({
                    success: true,
                    message: 'OTP sent for verification. Please check your email.',
                    otp
                });

            } catch (error) {
                console.error('Login Error:', error);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );
    // Forgot Password - Request OTP
    app.post(
        '/api/v1/auth/forgot-password',
        [
            body('identifier')
                .notEmpty().withMessage('Mobile number or Email is required')
                .custom(value => {
                    if (!/^\d+$/.test(value) && !/\S+@\S+\.\S+/.test(value)) {
                        throw new Error('Invalid mobile number or email');
                    }
                    return true;
                }),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg });
                }

                const { identifier } = req.body;

                const whereClause = /^\d+$/.test(identifier) ? { mobile: identifier } : { email: identifier };

                const parent = await Parents.findOne({ where: whereClause });

                if (!parent) {
                    return res.status(404).json({ success: false, message: 'Account not found' });
                }

                const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

                await parent.update({ otp: newOtp, otp_verified: false });

                if (whereClause.mobile) {
                    // Send via SMS (Uncomment if you have an SMS service)
                    // await sendOtp(parent.mobile, newOtp);
                    console.log(`OTP sent to mobile: ${parent.mobile} - OTP: ${newOtp}`);
                }

                // Send OTP via Email
                const subject = 'Forgot Password - OTP Verification';
                const message = `Hello ${parent.name},\n\nYour OTP is: ${newOtp}\n\nThank you.`;
                await sendEmail(parent.email, subject, message);
                console.log(`OTP sent to email: ${parent.email} - OTP: ${newOtp}`);

                return res.status(200).json({
                    success: true,
                    message: 'OTP has been sent to your registered mobile and email.',
                    otp: newOtp,
                });
            } catch (error) {
                console.error('Forgot Password Error:', error);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );
    // Forgot Password - Verify OTP
    app.post(
        '/api/v1/auth/forgot-password/verify-otp',
        [
            body('identifier')
                .notEmpty().withMessage('Mobile number or Email is required')
                .custom(value => {
                    if (!/^\d+$/.test(value) && !/\S+@\S+\.\S+/.test(value)) {
                        throw new Error('Invalid mobile number or email');
                    }
                    return true;
                }),
            body('otp')
                .notEmpty().withMessage('OTP is required')
                .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
        ],
        async (req, res) => {
            try {
                // Validate inputs
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg });
                }

                const { identifier, otp } = req.body;

                // Identify if it's mobile or email
                const whereClause = /^\d+$/.test(identifier) ? { mobile: identifier } : { email: identifier };

                // Find parent by mobile or email
                const parent = await Parents.findOne({ where: whereClause });

                if (!parent) {
                    return res.status(400).json({ success: false, error: 'Account not found' });
                }

                if (parent.otp !== otp) {
                    return res.status(400).json({ success: false, error: 'Invalid OTP' });
                }

                // Update verification status and clear OTP
                await parent.update({ otp_verified: true, otp: null });

                return res.status(200).json({
                    success: true,
                    message: 'OTP verified successfully. Please add a new password.',
                });

            } catch (error) {
                console.error('OTP Verification Error:', error);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );
    // Forgot Password - Change Password
    app.post(
        '/api/v1/auth/forgot/change-password',
        [
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

                const { mobile, password } = req.body;
                const parent = await Parents.findOne({ where: { mobile } });

                if (!parent) {
                    return res.status(400).json({ success: false, error: 'Mobile number not found' });
                }
                const hashedPassword = await bcrypt.hash(password, 10);
                await parent.update({ password: hashedPassword });


                return res.status(200).json({
                    success: true,
                    message: 'your password change successfully',
                });

            } catch (error) {
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );
    //search school
    app.post('/api/v1/schools/search', verifyJwt(), async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
            }

            const { name, location, id } = req.body;
            let whereCondition = {
                status: 'Approve'
            };

            if (name || location || id) {
                whereCondition[Op.and] = [];

                if (name) {
                    whereCondition[Op.and].push({ name: { [Op.iLike]: `%${name}%` } }); // ✅ Case-insensitive name search
                }

                if (location) {
                    whereCondition[Op.and].push({ location: { [Op.iLike]: `%${location}%` } }); // ✅ Case-insensitive location search
                }

                if (id) {
                    whereCondition[Op.and].push({ id });
                }
            }

            // const schools = await Schools.findAll({ where: whereCondition });
            const schools = await Schools.findAll({
                where: whereCondition,
                include: [
                    {
                        model: SchoolSessions,
                        as: 'sessions',
                        where: { status: 'Active' },  // You can remove this if you want all sessions, not just active ones
                        required: false,  // Ensures schools without sessions are still included
                    }
                ]
            });
            return res.status(200).json({
                success: true,
                data: schools
            });

        } catch (err) {
            console.error("Search Error:", err.message);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });
    //add school
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

            const school = await Schools.findOne({
                where: {
                    id: school_id,
                    status: 'Approve'
                }
            });

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
    //add student
    // app.post('/api/v1/parents/add-student', [
    //     body('name')
    //         .notEmpty().withMessage('Name is required'),
    //     body('relations')
    //         .notEmpty().withMessage('Relation is required'),
    //     body('school_id')
    //         .notEmpty().withMessage('School ID is required')
    //         .isUUID().withMessage('Invalid School ID format'),
    //     body('class_id')
    //         .notEmpty().withMessage('Class ID is required')
    //         .isUUID().withMessage('Invalid Class ID format'),

    //     body('roll_number')
    //         .notEmpty().withMessage('Roll number is required')
    //         .isAlphanumeric().withMessage('Roll number must be alphanumeric')
    //         .isLength({ min: 1, max: 10 }).withMessage('Roll number must be between 1 and 10 characters long'),
    // ], verifyJwt(), async (req, res) => {
    //     try {
    //         const errors = validationResult(req);
    //         if (!errors.isEmpty()) {
    //             return res.status(400).json({ success: false, message: errors.array()[0].msg }); // 🔹 Return only the first error message
    //         }

    //         const parentId = req.user.id;
    //         const { school_id, name, relations, class_id, roll_number } = req.body;

    //         if (!school_id || !name || !relations || !class_id || !roll_number) {
    //             return res.status(400).json({ success: false, message: "All fields are required (school_id, name, relation, class_id, roll_number)" });
    //         }

    //         let student = await Students.findOne({
    //             where: {
    //                 school_id,
    //                 class_id,
    //                 roll_number
    //             }
    //         });

    //         if (!student) {
    //             student = await Students.create({ school_id, name, class_id, roll_number });
    //         }

    //         const existingEntry = await ParentStudents.findOne({
    //             where: { parent_id: parentId, student_id: student.id }
    //         });

    //         if (existingEntry) {
    //             return res.status(400).json({ success: false, message: "Parent is already linked to this student" });
    //         }

    //         await ParentStudents.create({ parent_id: parentId, student_id: student.id, relations });

    //         return res.status(201).json({ success: true, message: "Student added successfully", student });

    //     } catch (err) {
    //         console.error("Add Student Error:", err.message);
    //         res.status(500).json({ success: false, message: "Internal Server Error" });
    //     }
    // });
    app.post('/api/v1/parents/add-student', [
        body('student_id')
            .notEmpty().withMessage('Student ID is required')
            .isUUID().withMessage('Invalid Student ID format'),
        body('relations')
            .notEmpty().withMessage('Relation is required'),
    ], verifyJwt(), async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg });
            }

            const parentId = req.user.id;
            console.log(parentId);
            const { student_id, relations } = req.body;
            // Check if parent exists
            const parent = await Parents.findByPk(parentId);
            if (!parent) {
                return res.status(404).json({ success: false, message: "Parent not found" });
            }
            const student = await Students.findByPk(student_id);
            if (!student) {
                return res.status(404).json({ success: false, message: "Student not found" });
            }
            const existingEntry = await ParentStudents.findOne({
                where: { parent_id: parentId, student_id: student.id }
            });

            if (existingEntry) {
                return res.status(400).json({ success: false, message: "Parent is already linked to this student" });
            }
            const existingStudentAnotherParent = await ParentStudents.findOne({
                where: { student_id: student.id }
            });
            if (existingStudentAnotherParent) {
                return res.status(400).json({ success: false, message: "Student is already linked to another parent" });
            }
            await ParentStudents.create({ parent_id: parentId, student_id: student.id, relations });

            return res.status(201).json({ success: true, message: "Student added successfully", student });

        } catch (err) {
            console.error("Add Student Error:", err.message);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });

    //student
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
                                as: 'school',
                                attributes: ['name']
                            },
                            {
                                model: Classes,
                                as: 'class',
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
    //edit student
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
                        id: { [Op.ne]: student_id }
                    }
                });

                if (existingStudent) {
                    return res.status(400).json({
                        success: false,
                        message: 'Another student with the same roll number, class, and school already exists'
                    });
                }
            }


            const updatedFields = {};
            if (name) updatedFields.name = name;
            if (school_id) updatedFields.school_id = school_id;
            if (class_id) updatedFields.class_id = class_id;
            if (roll_number) updatedFields.roll_number = roll_number;


            if (Object.keys(updatedFields).length > 0) {
                await student.update(updatedFields);
            }

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
    //session list
    app.post(
        '/api/v1/sessions/list',
        [
            body('school_id')
                .notEmpty().withMessage('School ID is required')
                .isUUID().withMessage('Invalid School ID format'),
        ],
        verifyJwt(),
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg });
                }

                const { school_id } = req.body;
                const school = await Schools.findByPk(school_id);
                if (!school) {
                    return res.status(404).json({ success: false, message: "School not found" });
                }

                const sessions = await SchoolSessions.findAll({
                    where: { school_id, status: 'Active' },
                    attributes: ['id', 'start_date', 'end_date', 'status'],
                    order: [['start_date', 'DESC']]
                });

                if (sessions.length === 0) {
                    return res.status(404).json({ success: false, message: "No active sessions found for this school" });
                }

                return res.status(200).json({
                    success: true,
                    message: "Sessions retrieved successfully",
                    data: sessions
                });

            } catch (err) {
                console.error("Get Sessions Error:", err);
                res.status(500).json({ success: false, message: "Internal Server Error" });
            }
        }
    );
    //classess list
    app.post(
        '/api/v1/classes/list',
        [
            body('school_id')
                .notEmpty().withMessage('School ID is required')
                .isUUID().withMessage('Invalid School ID format'),
            body('school_sessions_id')
                .notEmpty().withMessage('Session ID is required')
                .isUUID().withMessage('Invalid Session ID format'),
        ],
        verifyJwt(),
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ success: false, message: errors.array()[0].msg });
                }

                const { school_id, school_sessions_id } = req.body;
                const school = await Schools.findByPk(school_id);
                if (!school) {
                    return res.status(404).json({ success: false, message: "School not found" });
                }
                const session = await SchoolSessions.findOne({
                    where: { id: school_sessions_id, school_id }
                });
                if (!session) {
                    return res.status(404).json({ success: false, message: "Session not found for the provided school" });
                }
                const classes = await Classes.findAll({
                    where: { school_id, school_sessions_id, status: 1 },
                    attributes: ['id', 'name', 'created_at'],
                    order: [['created_at', 'DESC']]
                });

                if (classes.length === 0) {
                    return res.status(404).json({ success: false, message: "No classes found for this session and school" });
                }

                return res.status(200).json({
                    success: true,
                    message: "Classes retrieved successfully",
                    data: classes
                });

            } catch (err) {
                console.error("Get Classes Error:", err);
                res.status(500).json({ success: false, message: "Internal Server Error" });
            }
        }
    );
    //student list
    app.post(
        '/api/v1/students/list',
        [
            body('school_id')
                .notEmpty().withMessage('School ID is required')
                .isUUID().withMessage('Invalid School ID format'),
            body('school_sessions_id')
                .notEmpty().withMessage('Session ID is required')
                .isUUID().withMessage('Invalid Session ID format'),
            body('class_id')
                .notEmpty().withMessage('Class ID is required')
                .isUUID().withMessage('Invalid Class ID format'),
        ],
        verifyJwt(),
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({
                        success: false,
                        message: errors.array()[0].msg
                    });
                }

                const { school_id, school_sessions_id, class_id } = req.body;
                const school = await Schools.findByPk(school_id);
                if (!school) {
                    return res.status(404).json({
                        success: false,
                        message: "School not found"
                    });
                }
                const session = await SchoolSessions.findOne({
                    where: { id: school_sessions_id, school_id }
                });
                if (!session) {
                    return res.status(404).json({
                        success: false,
                        message: "Session not found for the provided school"
                    });
                }
                const studentClass = await Classes.findOne({
                    where: { id: class_id, school_id, school_sessions_id: school_sessions_id }
                });
                if (!studentClass) {
                    return res.status(404).json({
                        success: false,
                        message: "Class not found for the provided school and session"
                    });
                }
                const students = await Students.findAll({
                    where: { school_id, school_sessions_id, class_id, status: true },
                    attributes: ['id', 'name', 'email', 'roll_number', 'created_at'],
                    order: [['created_at', 'DESC']]
                });

                if (students.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "No students found for this session, school, and class"
                    });
                }
                return res.status(200).json({
                    success: true,
                    message: "Students retrieved successfully",
                    students
                });

            } catch (err) {
                console.error("Get Students Error:", err);
                res.status(500).json({
                    success: false,
                    message: "Internal Server Error"
                });
            }
        }
    );
    //my school
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
                data: parentSchools.map(entry => entry.School)
            });

        } catch (err) {
            console.error("Get Parent Schools Error:", err);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });
    //remove school
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
                return res.status(400).json({ success: false, message: errors.array()[0].msg });
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
    //remove student
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
                return res.status(400).json({ success: false, message: errors.array()[0].msg });
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
    //faq
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
    //activities
    app.get('/api/v1/schools/activities', verifyJwt(), async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
            }

            const parentId = req.user.id;


            const parentSchools = await ParentSchools.findAll({
                where: { parent_id: parentId },
                attributes: ['school_id']
            });

            if (parentSchools.length === 0) {
                return res.status(404).json({ success: false, message: "No schools linked to the parent" });
            }

            const schoolIds = parentSchools.map(ps => ps.school_id);


            const activities = await Activity.findAll({
                where: { school_id: schoolIds, status: '1' },
                include: [
                    {
                        model: Schools,
                        as: 'school',
                        attributes: ['name']
                    }
                ],
                order: [['title', 'ASC']]
            });

            if (activities.length === 0) {
                return res.status(404).json({ success: false, message: "No activities found for the linked schools" });
            }

            res.status(200).json({ success: true, data: activities });

        } catch (err) {
            console.error("Fetch Activities Error:", err.message);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });
    //  All Top Schools API
    app.get('/api/v1/top-schools', async (req, res) => {
        try {
            const baseUrl = `${req.protocol}://${req.get('host')}`;

            const topSchools = await models.TopSchool.findAll({
                include: {
                    model: models.Schools,
                    as: 'school',
                    attributes: ['id', 'name', 'phone_number', 'email', 'location', 'logo'],
                },
                order: [['createdAt', 'DESC']],
            });

            const formattedSchools = topSchools.map((topSchool) => ({
                id: topSchool.id,
                school_id: topSchool.school?.id || null,
                name: topSchool.school?.name || 'N/A',
                phone_number: topSchool.school?.phone_number || 'N/A',
                email: topSchool.school?.email || 'N/A',
                location: topSchool.school?.location || 'N/A',
                logo: topSchool.school?.logo ? `${baseUrl}${topSchool.school.logo}` : `${baseUrl}/images/default-logo.png`,
            }));

            res.status(200).json({ success: true, data: formattedSchools });
        } catch (error) {
            console.error('Error fetching top schools:', error);
            res.status(500).json({ error: 'Failed to retrieve top schools.' });
        }
    });
    // Due fee list
    app.get('/api/v1/parents/students/fees', verifyJwt(), async (req, res) => {
        try {
            const parentId = req.user.id;
            const { student_id } = req.query;

            const studentFilter = student_id ? { parent_id: parentId, student_id } : { parent_id: parentId };

            const parentStudents = await ParentStudents.findAll({
                where: studentFilter,
                include: [
                    {
                        model: Students,
                        as: 'Student',
                        attributes: ['id', 'name', 'roll_number', 'school_sessions_id', 'status', 'school_id', 'class_id'],
                        include: [
                            { model: Schools, as: 'school', attributes: ['name'] },
                            { model: Classes, as: 'class', attributes: ['name'] }
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

            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

            const studentsWithFees = await Promise.all(parentStudents.map(async (entry) => {
                const student = entry.Student;
                const fees = await Fees.findAll({
                    where: {
                        school_id: student.school_id,
                        class_id: student.class_id,
                        school_sessions_id: student.school_sessions_id,
                        status: 1
                    },
                    attributes: ['id', 'fee_type', 'custom_fee_name', 'amount', 'frequency', 'description']
                });
                // console.log(fees);
                const formattedFees = [];

                for (const fee of fees) {
                    // console.log(fee.fee_type === 'Tuition' && fee.frequency === 'Monthly');
                    if (fee.fee_type === 'Tuition' && fee.frequency === 'Monthly') {
                        const schoolSession = await SchoolSessions.findOne({
                            where: { id: student.school_sessions_id, status: 'Active' }
                        });
                        // console.log(schoolSession);

                        if (schoolSession) {
                            const startDate = new Date(schoolSession.start_date);
                            const currentDate = new Date();

                            let sessionMonth = startDate.getMonth();
                            let sessionYear = startDate.getFullYear();
                            let currentMonth = currentDate.getMonth();
                            let currentYear = currentDate.getFullYear();

                            while (sessionYear < currentYear || (sessionYear === currentYear && sessionMonth <= currentMonth)) {
                                const monthName = monthNames[sessionMonth];

                                const paymentExists = await Payments.findOne({
                                    where: {
                                        parent_id: parentId,
                                        student_id: student.id,
                                        fee_id: fee.id,
                                        description: monthName,
                                        status: 'completed'
                                    }
                                });

                                if (!paymentExists) {
                                    formattedFees.push({
                                        id: fee.id,
                                        fee_type: fee.fee_type,
                                        custom_fee_name: fee.custom_fee_name,
                                        amount: parseFloat(fee.amount).toFixed(2),
                                        frequency: fee.frequency,
                                        description: monthName
                                    });
                                }

                                if (sessionMonth === currentMonth && sessionYear === currentYear) break;
                                sessionMonth++;
                                if (sessionMonth > 11) {
                                    sessionMonth = 0;
                                    sessionYear++;
                                }
                            }
                        }
                    } else {
                        const paymentExists = await Payments.findOne({
                            where: {
                                parent_id: parentId,
                                student_id: student.id,
                                fee_id: fee.id,
                                status: 'completed'
                            }
                        });

                        if (!paymentExists) {
                            formattedFees.push(fee);
                        }
                    }
                }

                return {
                    id: student.id,
                    name: student.name,
                    roll_number: student.roll_number,
                    status: student.status,
                    school_name: student.school ? student.school.name : null,
                    class_name: student.class ? student.class.name : null,
                    fees: formattedFees
                };
            }));

            res.json({
                success: true,
                message: "Due fees fetched successfully",
                data: studentsWithFees
            });

        } catch (err) {
            console.error("Fetch Due Fees Error:", err.message);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    });
    //payment
    app.post('/api/v1/parents/students/payments',
        verifyJwt(),
        [
            body('student_id').notEmpty().withMessage('Student ID is required'),
            body('fee_id').notEmpty().withMessage('Fee ID is required'),
            body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number')
        ],
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, message: errors.array()[0].msg });
            }

            try {
                const parentId = req.user.id;
                const { student_id, fee_id, amount, description } = req.body;


                const parentStudent = await ParentStudents.findOne({
                    where: { parent_id: parentId, student_id },
                    include: [{
                        model: Students,
                        as: 'Student',
                        attributes: ['id', 'school_id', 'class_id']
                    }]
                });

                if (!parentStudent) {
                    return res.status(404).json({ success: false, message: 'Student not found for this parent' });
                }

                const student = parentStudent.Student;


                const fee = await Fees.findOne({
                    where: {
                        id: fee_id,
                        school_id: student.school_id,
                        [Op.or]: [
                            { class_id: student.class_id },
                            { class_id: null }
                        ],
                        status: 1
                    }
                });

                if (!fee) {
                    return res.status(404).json({ success: false, message: 'Fee not found for this student' });
                }


                const payment = await Payments.create({
                    parent_id: parentId,
                    student_id,
                    fee_id,
                    amount,
                    description,
                    status: 'completed'
                });

                res.status(201).json({ success: true, message: 'Payment created successfully', data: payment });
            } catch (err) {
                console.error('Create Payment Error:', err.message);
                res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
        });
    //get paid fee
    app.get('/api/v1/parents/students/paid-fees', verifyJwt(), async (req, res) => {
        try {
            const parentId = req.user.id;

            const paidPayments = await Payments.findAll({
                where: { parent_id: parentId, status: 'completed' },
                include: [
                    {
                        model: Students,
                        as: 'student',
                        attributes: ['id', 'name', 'roll_number', 'status', 'school_id', 'class_id'],
                        include: [
                            {
                                model: Schools,
                                as: 'school',
                                attributes: ['name']
                            },
                            {
                                model: Classes,
                                as: 'class',
                                attributes: ['name']
                            }
                        ]
                    },
                    {
                        model: Fees,
                        as: 'fee',
                        attributes: ['id', 'fee_type', 'custom_fee_name', 'amount', 'frequency', 'description']
                    }
                ]
            });

            if (!paidPayments.length) {
                return res.status(404).json({
                    success: false,
                    message: 'No paid fees found for this parent',
                    data: []
                });
            }

            const studentPayments = {};

            paidPayments.forEach(payment => {
                const student = payment.student;
                if (!studentPayments[student.id]) {
                    studentPayments[student.id] = {
                        id: student.id,
                        name: student.name,
                        roll_number: student.roll_number,
                        status: student.status,
                        school_name: student.school ? student.school.name : null,
                        class_name: student.class ? student.class.name : null,
                        fees: []
                    };
                }

                studentPayments[student.id].fees.push({
                    id: payment.fee.id,
                    fee_type: payment.fee.fee_type,
                    custom_fee_name: payment.fee.custom_fee_name,
                    amount: parseFloat(payment.amount).toFixed(2),
                    frequency: payment.fee.frequency,
                    description: payment.description
                });
            });

            res.json({
                success: true,
                message: 'Paid fees fetched successfully',
                data: Object.values(studentPayments)
            });
        } catch (err) {
            console.error('Fetch Paid Fees Error:', err.message);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
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
