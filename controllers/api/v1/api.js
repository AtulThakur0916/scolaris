const models = require('../../../models');
const path = require('path');
const fs = require('fs');
const { body, param, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const paystack = require('../../../helpers/payment');
const { Op, Sequelize } = require('sequelize'); // Ensure Sequelize is imported

const { ParentSchools, FeesTypes, Feedback, StudentFee, Parents, BankingDetails, Activity, SchoolSessions, Payments, Fees, Schools, FAQ, ParentStudents, Students, CMSPage, Classes, SchoolSubscriptions } = require('../../../models');
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
                    return res.status(200).json({ success: false, message: errors.array()[0].msg });
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
                    return res.status(200).json({ success: false, message: errors.array()[0].msg });
                }

                const { identifier } = req.body;
                let whereClause = /^\d+$/.test(identifier) ? { mobile: identifier } : { email: identifier };

                const parent = await Parents.findOne({ where: whereClause });

                if (!parent) {
                    return res.status(200).json({ success: false, error: 'Invalid mobile number or email' });
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
                // await sendEmail(parent.email, subject, message);
                console.log(`OTP sent to email: ${parent.email} - OTP: ${newOtp}`);

                return res.status(200).json({
                    success: true,
                    message: 'New OTP has been sent to your mobile and email.',
                    otp: newOtp,
                });

            } catch (error) {
                console.error('Resend OTP Error:', JSON.stringify(error, null, 2));

                console.error('Resend OTP Error:', error);
                res.status(200).json({ success: false, error: 'Server error' });
            }
        }
    );
    //social login
    app.post(
        '/api/v1/auth/social-login',
        [
            body('name').notEmpty().withMessage('Name is required'),
            body('email')
                .isEmail().withMessage('Invalid email address'),
            body('provider').notEmpty().withMessage('Provider is required'),
            body('provider_id').notEmpty().withMessage('Provider ID is required'),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(200).json({ success: false, message: errors.array()[0].msg });
                }

                console.log('Incoming Request Body:', req.body);

                const { name, email, provider, provider_id } = req.body;

                let parent = await Parents.findOne({
                    where: { provider, provider_id }
                });

                if (parent) {
                    const token = jwt.sign(
                        { id: parent.id },
                        config.jwt_secret,
                        { algorithm: 'HS256' }
                    );
                    return res.status(200).json({
                        success: true,
                        message: 'Login successful',
                        token,
                    });
                } else {
                    parent = await Parents.create({
                        name,
                        email,
                        provider,
                        provider_id,
                    });

                    const token = jwt.sign(
                        { id: parent.id }, // Removed 'mobile' from token payload
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
                res.status(200).json({ success: false, error: 'Server error' });
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
                    return res.status(200).json({ success: false, message: errors.array()[0].msg });
                }

                const { identifier, otp, fcm_token } = req.body;
                let whereClause = /^\d+$/.test(identifier) ? { mobile: identifier } : { email: identifier };

                const parent = await Parents.findOne({ where: whereClause });

                if (!parent) {
                    return res.status(200).json({ success: false, error: 'Invalid mobile number or email' });
                }

                if (parent.otp !== otp) {
                    return res.status(200).json({ success: false, error: 'Invalid OTP' });
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
                    name: parent.name,
                    token,
                });

            } catch (error) {
                console.error('OTP Verification Error:', error);
                res.status(200).json({ success: false, error: 'Server error' });
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
                    return res.status(200).json({ success: false, message: errors.array()[0].msg });
                }

                const { identifier, password } = req.body;
                let whereClause = /^\d+$/.test(identifier) ? { mobile: identifier } : { email: identifier };

                const parent = await Parents.findOne({ where: whereClause });

                if (!parent) {
                    return res.status(200).json({ success: false, error: 'Invalid mobile number or email' });
                }

                const isMatch = await bcrypt.compare(password, parent.password);
                if (!isMatch) {
                    return res.status(200).json({ success: false, error: 'Invalid password' });
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
                res.status(200).json({ success: false, error: 'Server error' });
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
                    return res.status(200).json({ success: false, message: errors.array()[0].msg });
                }

                const { identifier } = req.body;

                const isMobile = /^\d+$/.test(identifier);
                const whereClause = isMobile ? { mobile: identifier } : { email: identifier };

                const parent = await Parents.findOne({ where: whereClause });

                if (!parent) {
                    return res.status(200).json({ success: false, message: 'Account not found' });
                }

                const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

                await parent.update({ otp: newOtp, otp_verified: false });

                if (isMobile) {
                    // Send OTP via SMS
                    console.log(`OTP sent to mobile: ${parent.mobile} - OTP: ${newOtp}`);
                    // await sendOtp(parent.mobile, newOtp);
                } else {
                    // Send OTP via Email
                    const subject = 'Forgot Password - OTP Verification';
                    const message = `Hello ${parent.name},\n\nYour OTP is: ${newOtp}\n\nThank you.`;
                    await sendEmail(parent.email, subject, message);
                    console.log(`OTP sent to email: ${parent.email} - OTP: ${newOtp}`);
                }

                return res.status(200).json({
                    success: true,
                    message: `OTP has been sent to your registered ${isMobile ? 'mobile' : 'email'}.`,
                    otp: newOtp, // ⚠️ Include OTP only if required (for testing purposes)
                });
            } catch (error) {
                console.error('Forgot Password Error:', error);
                res.status(200).json({ success: false, error: 'Server error' });
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
                    return res.status(200).json({ success: false, message: errors.array()[0].msg });
                }

                const { identifier, otp } = req.body;

                // Identify if it's mobile or email
                const whereClause = /^\d+$/.test(identifier) ? { mobile: identifier } : { email: identifier };

                // Find parent by mobile or email
                const parent = await Parents.findOne({ where: whereClause });

                if (!parent) {
                    return res.status(200).json({ success: false, error: 'Account not found' });
                }

                if (parent.otp !== otp) {
                    return res.status(200).json({ success: false, error: 'Invalid OTP' });
                }

                // Update verification status and clear OTP
                await parent.update({ otp_verified: true, otp: null });

                return res.status(200).json({
                    success: true,
                    message: 'OTP verified successfully. Please add a new password.',
                });

            } catch (error) {
                console.error('OTP Verification Error:', error);
                res.status(200).json({ success: false, error: 'Server error' });
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
                    return res.status(200).json({ success: false, message: errors.array()[0].msg }); // 🔹 Return only the first error message
                }

                const { mobile, password } = req.body;
                const parent = await Parents.findOne({ where: { mobile } });

                if (!parent) {
                    return res.status(200).json({ success: false, error: 'Mobile number not found' });
                }
                const hashedPassword = await bcrypt.hash(password, 10);
                await parent.update({ password: hashedPassword });


                return res.status(200).json({
                    success: true,
                    message: 'your password change successfully',
                });

            } catch (error) {
                res.status(200).json({ success: false, error: 'Server error' });
            }
        }
    );
    //search school
    app.post('/api/v1/schools/search', verifyJwt(), async (req, res) => {
        try {
            if (!req.user) {
                return res.status(200).json({ success: false, message: "Unauthorized: Invalid token" });
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
            res.status(200).json({ success: false, message: "Internal Server Error" });
        }
    });
    //add school
    app.post('/api/v1/parents/add-school', verifyJwt(), async (req, res) => {
        try {
            if (!req.user) {
                return res.status(200).json({ success: false, message: "Unauthorized: Invalid token" });
            }
            // console.log(req.user.id);
            const parentId = req.user.id;
            const { school_id } = req.body;

            if (!school_id) {
                return res.status(200).json({ success: false, message: "School ID is required" });
            }
            const parentExists = await Parents.findByPk(parentId);
            if (!parentExists) {
                return res.status(200).json({ success: false, message: "Parent not found in DB" });
            }
            const school = await Schools.findOne({
                where: {
                    id: school_id,
                    status: 'Approve'
                }
            });

            if (!school) {
                return res.status(200).json({ success: false, message: "School not found" });
            }

            const existingEntry = await ParentSchools.findOne({ where: { parent_id: parentId, school_id } });
            if (existingEntry) {
                return res.status(200).json({ success: false, message: "Parent is already linked to this school" });
            }

            await ParentSchools.create({ parent_id: parentId, school_id });

            return res.status(201).json({ success: true, message: "School added successfully" });

        } catch (err) {
            console.error("Add School Error:", err.message);
            res.status(200).json({ success: false, message: "Internal Server Error" });
        }
    });
    //add student
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
                return res.status(200).json({ success: false, message: errors.array()[0].msg });
            }

            const parentId = req.user.id;
            // console.log(parentId);
            const { student_id, relations } = req.body;
            // Check if parent exists
            const parent = await Parents.findByPk(parentId);
            if (!parent) {
                return res.status(200).json({ success: false, message: "Parent not found" });
            }
            const student = await Students.findByPk(student_id);
            if (!student) {
                return res.status(200).json({ success: false, message: "Student not found" });
            }
            const existingEntry = await ParentStudents.findOne({
                where: { parent_id: parentId, student_id: student.id }
            });

            if (existingEntry) {
                return res.status(200).json({ success: false, message: "Parent is already linked to this student" });
            }
            const existingStudentAnotherParent = await ParentStudents.findOne({
                where: { student_id: student.id }
            });
            if (existingStudentAnotherParent) {
                return res.status(200).json({ success: false, message: "Student is already linked to another parent" });
            }
            await ParentStudents.create({ parent_id: parentId, student_id: student.id, relations });

            return res.status(201).json({ success: true, message: "Student added successfully", student });

        } catch (err) {
            console.error("Add Student Error:", err.message);
            res.status(200).json({ success: false, message: "Internal Server Error" });
        }
    });

    app.post('/api/v1/students/create', [
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
            .isInt({ min: 5 }).withMessage('Age must be at least 5'),

        body('roll_number')
            .optional({ checkFalsy: true })
            .custom(async (value, { req }) => {
                const { class_id, school_id, school_sessions_id } = req.body;
                const existing = await models.Students.findOne({
                    where: { roll_number: value, class_id, school_id, school_sessions_id }
                });
                if (existing) {
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

        body('relations').notEmpty().withMessage('Relation is required')  // New validation
    ], verifyJwt(), async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(200).json({ success: false, message: errors.array()[0].msg });
            }

            const {
                name, email, age, class_id, school_id, roll_number,
                state, address, city, country, school_sessions_id, relations
            } = req.body;

            const parentId = req.user.id;

            let profilePicPath = null;

            if (req.files && req.files.profile_pic) {
                const file = req.files.profile_pic;
                const ext = path.extname(file.name).toLowerCase();
                const baseName = path.basename(file.name, ext);
                const imageName = `${baseName}-${Date.now()}${ext}`;
                const uploadDir = path.join(__dirname, '../public/uploads/students/');
                const uploadPath = path.join(uploadDir, imageName);

                const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];

                if (!allowedExtensions.includes(ext)) {
                    return res.status(400).json({ error: 'Only PNG, JPG, JPEG, and GIF files are allowed.' });
                }

                if (file.size > 5 * 1024 * 1024) {
                    return res.status(400).json({ error: 'Profile picture must be under 5MB.' });
                }

                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                await file.mv(uploadPath);
                profilePicPath = `/uploads/students/${imageName}`;
            }
            // ✅ Validate School, Class, and Session IDs
            const [school, schoolClass, session] = await Promise.all([
                models.Schools.findByPk(school_id),
                models.Classes.findByPk(class_id),
                models.SchoolSessions.findByPk(school_sessions_id)
            ]);

            if (!school) {
                return res.status(400).json({ success: false, message: 'Invalid school ID' });
            }
            if (!schoolClass) {
                return res.status(400).json({ success: false, message: 'Invalid class ID' });
            }
            if (!session) {
                return res.status(400).json({ success: false, message: 'Invalid school session ID' });
            }
            // Create student
            const student = await models.Students.create({
                name,
                email,
                age,
                class_id,
                school_id,
                school_sessions_id,
                country,
                city,
                state,
                address,
                roll_number,
                profile_pic: profilePicPath,
                status: true
            });

            // Check parent existence
            const parent = await models.Parents.findByPk(parentId);
            if (!parent) {
                return res.status(404).json({ success: false, message: 'Parent not found' });
            }

            // Check if student already linked
            const existingLink = await models.ParentStudents.findOne({
                where: { student_id: student.id }
            });
            if (existingLink) {
                return res.status(400).json({ success: false, message: 'Student already linked to a parent' });
            }

            // Link parent and student
            await models.ParentStudents.create({
                parent_id: parentId,
                student_id: student.id,
                relations
            });

            return res.status(201).json({
                success: true,
                message: 'Student created and linked successfully',
                student
            });

        } catch (err) {
            console.error('Student creation error:', err.message);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    });



    app.get('/api/v1/parents/students', verifyJwt(), async (req, res) => {
        try {
            const parentId = req.user.id;
            console.log(req.protocol);
            const baseUrl = `https://${req.get('host')}`;
            const parentStudents = await ParentStudents.findAll({
                where: { parent_id: parentId },
                attributes: ['relations'], // Include relation field
                include: [
                    {
                        model: Students,
                        as: 'Student',
                        attributes: [
                            'id', 'name', 'roll_number', 'status',
                            'school_id', 'class_id', 'profile_pic', 'school_sessions_id'
                        ],
                        include: [
                            {
                                model: Schools,
                                as: 'school',
                                attributes: ['name', 'logo']
                            },
                            {
                                model: Classes,
                                as: 'class',
                                attributes: ['name']
                            },
                            {
                                model: SchoolSessions,
                                as: 'session',
                                attributes: ['start_date', 'end_date']
                            }
                        ]
                    }
                ]
            });

            if (!parentStudents.length) {
                return res.status(200).json({
                    success: false,
                    message: "No students found for this parent",
                    data: []
                });
            }

            const students = parentStudents.map(entry => {
                const session = entry.Student.session;

                const sessionName = session
                    ? `${new Date(session.start_date).toLocaleString('en-US', { month: 'short', year: 'numeric' })} - ${new Date(session.end_date).toLocaleString('en-US', { month: 'short', year: 'numeric' })}`
                    : null;

                return {
                    id: entry.Student.id,
                    name: entry.Student.name,
                    roll_number: entry.Student.roll_number,
                    status: entry.Student.status,
                    school_id: entry.Student.school_id,
                    session_id: entry.Student.school_sessions_id,
                    class_id: entry.Student.class_id,
                    school_name: entry.Student.school ? entry.Student.school.name : null,
                    class_name: entry.Student.class ? entry.Student.class.name : null,
                    session_name: sessionName,
                    profile_pic: entry.Student.profile_pic ? `${baseUrl}${entry.Student.profile_pic}` : `${baseUrl}/uploads/schools/default-placeholder.png`,
                    logo: entry.Student.school.logo ? `${baseUrl}${entry.Student.school.logo}` : `${baseUrl}/uploads/schools/default-placeholder.png`,
                    relation: entry.relations || null
                };
            });


            return res.status(200).json({
                success: true,
                message: "Students fetched successfully",
                data: students
            });

        } catch (err) {
            console.error("Fetch Students Error:", err.message);
            return res.status(500).json({
                success: false,
                message: "Something went wrong while fetching students",
                error: err.message
            });
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
                return res.status(200).json({ success: false, message: errors.array()[0].msg });
            }

            const parentId = req.user.id;
            const { student_id, name, relations, school_id, class_id, roll_number } = req.body;

            const parentStudent = await ParentStudents.findOne({
                where: { parent_id: parentId, student_id: student_id }
            });

            if (!parentStudent) {
                return res.status(200).json({ success: false, message: 'You are not authorized to edit this student' });
            }

            const student = await Students.findByPk(student_id);
            if (!student) {
                return res.status(200).json({ success: false, message: 'Student not found' });
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
                    return res.status(200).json({
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
                res.status(200).json({ success: false, message: err.errors[0].message });
            } else {
                res.status(200).json({ success: false, message: 'Internal Server Error' });
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
                    return res.status(200).json({ success: false, message: errors.array()[0].msg });
                }

                const { school_id } = req.body;
                const school = await Schools.findByPk(school_id);
                if (!school) {
                    return res.status(200).json({ success: false, message: "School not found" });
                }

                const sessions = await SchoolSessions.findAll({
                    where: { school_id, status: 'Active' },
                    attributes: ['id', 'start_date', 'end_date', 'status'],
                    order: [['start_date', 'DESC']]
                });

                if (sessions.length === 0) {
                    return res.status(200).json({ success: false, message: "No active sessions found for this school" });
                }

                return res.status(200).json({
                    success: true,
                    message: "Sessions retrieved successfully",
                    data: sessions
                });

            } catch (err) {
                console.error("Get Sessions Error:", err);
                res.status(200).json({ success: false, message: "Internal Server Error" });
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
                    return res.status(200).json({ success: false, message: errors.array()[0].msg });
                }

                const { school_id, school_sessions_id } = req.body;
                const school = await Schools.findByPk(school_id);
                if (!school) {
                    return res.status(200).json({ success: false, message: "School not found" });
                }
                const session = await SchoolSessions.findOne({
                    where: { id: school_sessions_id, school_id }
                });
                if (!session) {
                    return res.status(200).json({ success: false, message: "Session not found for the provided school" });
                }
                const classes = await Classes.findAll({
                    where: { school_id, school_sessions_id, status: 1 },
                    attributes: ['id', 'name', 'created_at'],
                    order: [['created_at', 'DESC']]
                });

                if (classes.length === 0) {
                    return res.status(200).json({ success: false, message: "No classes found for this session and school" });
                }

                return res.status(200).json({
                    success: true,
                    message: "Classes retrieved successfully",
                    data: classes
                });

            } catch (err) {
                console.error("Get Classes Error:", err);
                res.status(200).json({ success: false, message: "Internal Server Error" });
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
                    return res.status(200).json({
                        success: false,
                        message: errors.array()[0].msg
                    });
                }

                const { school_id, school_sessions_id, class_id } = req.body;
                const school = await Schools.findByPk(school_id);
                if (!school) {
                    return res.status(200).json({
                        success: false,
                        message: "School not found"
                    });
                }
                const session = await SchoolSessions.findOne({
                    where: { id: school_sessions_id, school_id }
                });
                if (!session) {
                    return res.status(200).json({
                        success: false,
                        message: "Session not found for the provided school"
                    });
                }
                const studentClass = await Classes.findOne({
                    where: { id: class_id, school_id, school_sessions_id: school_sessions_id }
                });
                if (!studentClass) {
                    return res.status(200).json({
                        success: false,
                        message: "Class not found for the provided school and session"
                    });
                }
                const students = await Students.findAll({
                    where: { school_id, school_sessions_id, class_id, status: true },
                    attributes: ['id', 'name', 'email', 'profile_pic', 'roll_number', 'created_at'],
                    order: [['created_at', 'DESC']]
                });

                if (students.length === 0) {
                    return res.status(200).json({
                        success: false,
                        message: "No students found for this session, school, and class"
                    });
                }
                const baseUrl = `https://${req.get('host')}`;
                const studentsWithImage = students.map(student => {
                    return {
                        ...student.toJSON(),
                        profile_pic: student.profile_pic
                            ? `${baseUrl}${student.profile_pic}`
                            : `${baseUrl}/uploads/schools/default-placeholder.png`
                    };
                });

                return res.status(200).json({
                    success: true,
                    message: "Students retrieved successfully",
                    students: studentsWithImage
                });


            } catch (err) {
                console.error("Get Students Error:", err);
                res.status(200).json({
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
                return res.status(200).json({ success: false, message: "Unauthorized: Invalid token" });
            }

            const parentId = req.user.id;
            // console.log(req.protocol);
            const baseUrl = 'https://' + req.get('host');

            const parentSchools = await ParentSchools.findAll({
                where: { parent_id: parentId },
                include: [{
                    model: Schools,
                    as: 'school',
                    attributes: [
                        'id', 'name', 'location', 'email', 'logo', 'created_at',
                        'city', 'country', 'state', 'address', 'phone_number', 'type', 'status'
                    ]
                }]
            });

            if (!parentSchools.length) {
                return res.status(200).json({ success: false, message: "No schools found for this parent" });
            }

            const schoolsData = parentSchools.map(entry => {
                const school = entry.school;
                return {
                    ...school.get({ plain: true }),
                    logo: school.logo
                        ? `${baseUrl}${school.logo}`
                        : `${baseUrl}/uploads/schools/default-placeholder.png`
                };
            });

            return res.status(200).json({
                success: true,
                message: "Schools retrieved successfully",
                data: schoolsData
            });

        } catch (err) {
            console.error("Get Parent Schools Error:", err);
            res.status(200).json({ success: false, message: "Internal Server Error" });
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
                return res.status(200).json({ success: false, message: "Unauthorized: Invalid token" });
            }
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(200).json({ success: false, message: errors.array()[0].msg });
            }
            const parentId = req.user.id;
            const { school_id } = req.body;

            if (!school_id) {
                return res.status(200).json({ success: false, message: "School ID is required" });
            }
            const parentSchool = await ParentSchools.findOne({
                where: { parent_id: parentId, school_id }
            });

            if (!parentSchool) {
                return res.status(200).json({ success: false, message: "Parent is not linked to this school" });
            }
            await ParentSchools.destroy({
                where: { parent_id: parentId, school_id }
            });

            return res.status(200).json({ success: true, message: "School removed successfully" });

        } catch (err) {
            console.error("Remove Parent School Error:", err);
            res.status(200).json({ success: false, message: "Internal Server Error" });
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
                return res.status(200).json({ success: false, message: "Unauthorized: Invalid token" });
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(200).json({ success: false, message: errors.array()[0].msg });
            }

            const parentId = req.user.id;
            const { student_id } = req.body;
            const parentStudent = await ParentStudents.findOne({
                where: { parent_id: parentId, student_id }
            });

            if (!parentStudent) {
                return res.status(200).json({ success: false, message: "Parent is not linked to this student" });
            }
            await ParentStudents.destroy({
                where: { parent_id: parentId, student_id }
            });

            return res.status(200).json({ success: true, message: "Student removed successfully" });

        } catch (err) {
            console.error("Remove Parent Student Error:", err);
            res.status(200).json({ success: false, message: "Internal Server Error" });
        }
    });
    //cms
    app.get('/api/v1/cms/:slug', async (req, res) => {
        try {
            const page = await CMSPage.findOne({
                where: { slug: req.params.slug, status: '1' },
                attributes: ['id', 'title', 'content']
            });
            if (!page) return res.status(200).json({ error: 'Page not found' });
            res.json({
                status: true,
                msg: 'Page fetched successfully',
                data: page
            });
        } catch (error) {
            res.status(200).json({
                status: false,
                msg: 'Internal server error',
                data: null
            });
        }
    });
    // Fetch FAQs grouped by type (top & other)
    app.get('/api/v1/top/questions', async (req, res) => {
        try {
            const faqs = await FAQ.findAll({
                where: { status: '1' },
                attributes: ['id', 'question', 'answer', 'type'],
                order: [['created_at', 'DESC']],
            });

            // Separate FAQs into two arrays based on type
            const topFaqs = faqs.filter(faq => faq.type === 'top');
            const otherFaqs = faqs.filter(faq => faq.type === 'other');

            res.json({
                status: true,
                msg: 'FAQs fetched successfully',
                data: {
                    top: topFaqs,
                    other: otherFaqs
                }
            });
        } catch (error) {
            res.status(200).json({
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
                return res.status(200).json({ success: false, message: "Unauthorized: Invalid token" });
            }

            const parentId = req.user.id;


            const parentSchools = await ParentSchools.findAll({
                where: { parent_id: parentId },
                attributes: ['school_id']
            });

            if (parentSchools.length === 0) {
                return res.status(200).json({ success: false, message: "No schools linked to the parent" });
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
                return res.status(200).json({ success: false, message: "No activities found for the linked schools" });
            }

            res.status(200).json({ success: true, data: activities });

        } catch (err) {
            console.error("Fetch Activities Error:", err.message);
            res.status(200).json({ success: false, message: "Internal Server Error" });
        }
    });
    //  All Top Schools API
    app.get('/api/v1/top-schools', verifyJwt(true), async (req, res) => {
        try {
            const parent_id = req.user?.id || null;
            const baseUrl = `https://${req.get('host')}`;

            const topSchools = await models.TopSchool.findAll({
                include: {
                    model: models.Schools,
                    as: 'school',
                    where: { status: 'Approve' },
                    attributes: ['id', 'name', 'phone_number', 'email', 'location', 'logo'],
                },
                order: [['createdAt', 'DESC']],
            });

            let formattedSchools = [];

            if (parent_id) {
                // Get all school IDs added by this parent
                const parentSchoolLinks = await models.ParentSchools.findAll({
                    where: { parent_id },
                    attributes: ['school_id']
                });

                const addedSchoolIds = parentSchoolLinks.map(link => link.school_id);

                formattedSchools = topSchools.map(topSchool => {
                    const school = topSchool.school;
                    const isAdded = addedSchoolIds.includes(school?.id);

                    return {
                        id: topSchool.id,
                        school_id: school?.id || null,
                        name: school?.name || 'N/A',
                        phone_number: school?.phone_number || 'N/A',
                        email: school?.email || 'N/A',
                        location: school?.location || 'N/A',
                        logo: school?.logo ? `${baseUrl}${school.logo}` : `${baseUrl}/uploads/schools/default-placeholder.png`,
                        status: isAdded ? 'true' : 'false'
                    };
                });
            } else {
                // No authenticated parent, just show default data
                formattedSchools = topSchools.map(topSchool => ({
                    id: topSchool.id,
                    school_id: topSchool.school?.id || null,
                    name: topSchool.school?.name || 'N/A',
                    phone_number: topSchool.school?.phone_number || 'N/A',
                    email: topSchool.school?.email || 'N/A',
                    location: topSchool.school?.location || 'N/A',
                    logo: topSchool.school?.logo ? `${baseUrl}${topSchool.school.logo}` : `${baseUrl}/uploads/schools/default-placeholder.png`,
                    status: 'false'
                }));
            }

            res.status(200).json({ success: true, data: formattedSchools });
        } catch (error) {
            console.error('Error fetching top schools:', error);
            res.status(200).json({ error: 'Failed to retrieve top schools.' });
        }
    });
    // Due fee list

    app.get('/api/v1/parents/students/fees', verifyJwt(), async (req, res) => {
        try {
            const parentId = req.user.id;
            const { student_id } = req.query;

            const studentFilter = student_id
                ? { parent_id: parentId, student_id }
                : { parent_id: parentId };

            const parentStudents = await ParentStudents.findAll({
                where: studentFilter,
                include: [
                    {
                        model: Students,
                        as: 'Student',
                        attributes: ['id', 'name', 'roll_number', 'school_sessions_id', 'profile_pic', 'status', 'school_id', 'class_id'],
                        include: [
                            {
                                model: Schools,
                                as: 'school',
                                attributes: ['id', 'name'],
                                include: [
                                    {
                                        model: BankingDetails,
                                        as: 'BankingDetails',
                                        attributes: [
                                            'id',
                                            'bank_name',
                                            'account_number',
                                            'account_holder',
                                            'iban_document',
                                            'business_name',
                                            'settlement_bank',
                                            'subaccount_code',
                                            'paystack_id'
                                        ]
                                    }
                                ]
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
                return res.status(200).json({
                    success: false,
                    message: "No students found for this parent",
                    data: []
                });
            }

            const allDueFees = [];

            for (const ps of parentStudents) {
                const student = ps.Student;

                const studentFees = await StudentFee.findAll({
                    where: {
                        student_id: student.id,
                        // assigned_date: { [Op.lte]: new Date() }
                    },
                    include: [
                        {
                            model: Payments,
                            as: 'payments',
                            required: false,
                            attributes: ['id'],
                            where: { status: 'completed' }
                        },
                        {
                            model: Fees,
                            as: 'fee',
                            include: [
                                {
                                    model: FeesTypes,
                                    as: 'feesType',
                                    attributes: ['name']
                                }
                            ]
                        }
                    ]
                });

                const dueFees = studentFees.filter(sf => !sf.payments || sf.payments.length === 0);
                const baseUrl = `https://${req.get('host')}`;

                dueFees.forEach(df => {
                    const originalAmount = parseFloat(df.fee?.amount || 0);
                    const customAmount = parseFloat(df.custom_amount || 0);

                    const bankingDetails = student.school?.BankingDetails?.[0] || {};

                    allDueFees.push({
                        // Fee Info
                        id: df.id,
                        student_id: df.student_id,
                        custom_amount: customAmount,
                        assigned_date: df.assigned_date,
                        last_due_date: df.due_date,
                        fee_type: df.fee?.feesType?.name || null,
                        original_amount: originalAmount,
                        frequency: df.frequency,
                        total_amount: parseFloat((originalAmount + customAmount).toFixed(2)),

                        // Student Info
                        student_name: student.name,
                        profile_pic: student.profile_pic
                            ? `${baseUrl}${student.profile_pic}`
                            : `${baseUrl}/uploads/schools/default-placeholder.png`,

                        // School Info
                        school_id: student.school?.id || null,
                        school_name: student.school?.name || null,

                        // Banking Info (flattened into the same object)
                        bank_name: bankingDetails.bank_name || null,
                        account_number: bankingDetails.account_number || null,
                        account_holder: bankingDetails.account_holder || null,
                        iban_document: bankingDetails.iban_document || null,
                        business_name: bankingDetails.business_name || null,
                        settlement_bank: bankingDetails.settlement_bank || null,
                        subaccount_code: bankingDetails.subaccount_code || null,
                        paystack_id: bankingDetails.paystack_id || null
                    });
                });


            }

            return res.json({
                success: true,
                message: "Due fees fetched successfully",
                data: allDueFees
            });

        } catch (err) {
            console.error("Fetch Due Fees Error:", err.message);
            res.status(200).json({ success: false, message: "Internal Server Error" });
        }
    });


    app.post('/api/v1/parents/students/payments', verifyJwt(), async (req, res) => {
        try {
            const parentId = req.user.id;
            const paymentsArray = req.body; // direct array

            if (!Array.isArray(paymentsArray) || paymentsArray.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Request body must be a non-empty array."
                });
            }

            for (const payment of paymentsArray) {
                const { student_fee_id, amount, student_id, reference, status } = payment;

                if (!student_fee_id || !amount || !student_id || !reference || !status) {
                    return res.status(400).json({
                        success: false,
                        message: "Each payment must have student_fee_id, amount, student_id, reference, and status."
                    });
                }

                const studentFee = await StudentFee.findOne({
                    where: { id: student_fee_id },
                    include: [{
                        model: Students,
                        as: 'student',
                        attributes: ['id', 'school_id', 'class_id', 'school_sessions_id']
                    }]
                });

                if (!studentFee) {
                    return res.status(404).json({
                        success: false,
                        message: `Student fee not found for ID ${student_fee_id}.`
                    });
                }


                await Payments.create({
                    student_fee_id,
                    student_id,
                    amount,
                    status,
                    payment_date: new Date(),
                    parent_id: parentId,
                    school_id: studentFee.student.school_id,
                    class_id: studentFee.student.class_id,
                    school_sessions_id: studentFee.student.school_sessions_id,
                    reference
                });
            }

            return res.status(200).json({
                success: true,
                message: "All payment records saved successfully."
            });

        } catch (err) {
            console.error("Payment Save Error:", err.message);
            return res.status(500).json({
                success: false,
                message: "Internal Server Error"
            });
        }
    });


    app.post(
        '/api/v1/subaccount',
        [
            body('business_name')
                .notEmpty().withMessage('Business name is required')
                .isLength({ min: 3 }).withMessage('Business name must be at least 3 characters long'),

            // body('bank_code')
            //     .notEmpty().withMessage('Bank code is required')
            //     .isLength({ min: 3 }).withMessage('Bank code must be valid'),

            body('account_number')
                .notEmpty().withMessage('Account number is required')
                .isLength({ min: 10, max: 10 }).withMessage('Account number must be 10 digits')
                .isNumeric().withMessage('Account number must be numeric'),

            body('percentage_charge')
                .notEmpty().withMessage('Percentage charge is required')
                .isFloat({ min: 0, max: 100 }).withMessage('Percentage charge must be between 0 and 100'),

            body('settlement_bank')
                .optional()
                .isLength({ min: 3 }).withMessage('Settlement bank code must be valid'),

            // body('description')
            //     .optional()
            //     .isLength({ max: 255 }).withMessage('Description must be less than 255 characters'),

            // body('primary_contact_email')
            //     .optional()
            //     .isEmail().withMessage('Must be a valid email address')
        ],
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(422).json({
                    message: 'Validation error',
                    errors: errors.array()
                });
            }

            const {
                business_name,
                // bank_code,
                account_number,
                percentage_charge,
                settlement_bank,
                // description,
                // primary_contact_email
            } = req.body;
            // console.log(paystack);
            try {
                const result = await paystack.subAccount.create({
                    business_name,
                    // bank_code,
                    account_number,
                    percentage_charge,
                    settlement_bank: settlement_bank,
                    // description,
                    // primary_contact_email
                });
                console.log('Paystack subaccount result:', result);
                res.status(200).json({
                    status: result.status,
                    message: result.message,
                    data: result.data
                });
            } catch (error) {
                console.error(error);
                const errRes = error.response?.data || error.message;
                res.status(500).json({
                    message: 'Failed to create subaccount',
                    error: errRes
                });
            }
        }
    );

    app.get('/api/v1/verify-registration-payment', async (req, res) => {
        const { reference } = req.query;

        try {
            // Verify the transaction with Paystack
            const response = await paystack.transaction.verify(reference);

            if (response.data.status === 'success') {
                const metadata = response.data.metadata;
                const school = await models.Schools.findOne({
                    where: { id: metadata.school_id }
                });

                if (!school) {
                    return res.status(404).send('School not found');
                }
                console.log("school:", school);

                // Update school payment status
                await school.update({
                    subscription: '1',
                });

                await SchoolSubscriptions.create({
                    school_id: metadata.school_id,
                    amount: response.data.amount / 100,
                    status: 'completed',
                    payment_date: new Date(),
                    reference: reference,
                    payment_type: metadata.payment_type,
                    transaction_data: response.data
                });
                // Send confirmation email with plain text
                await sendEmail(
                    school.email,
                    'Registration Payment Confirmed',
                    `Dear ${school.name},
    
    Your registration payment has been successfully processed.
    
    Payment Details:
    - Amount: ${response.data.amount / 100} CFA
    - Reference: ${reference}
    - Date: ${new Date().toLocaleDateString()}
    
    Your school registration is now complete and your account has been fully activated.
    
    If you have any questions, please contact our support team at support@scolarispay.com
    
    Best regards,
    Scolaris Pay Team`
                );
                return res.status(200).json({
                    success: false,
                    message: "Payment success",

                });
                // Redirect to success page
                // return res.redirect('/payment/success');
            } else {
                // await models.Payments.create({
                //     school_id: response.data.metadata.school_id,
                //     amount: response.data.amount / 100,
                //     status: 'failed',
                //     payment_date: new Date(),
                //     reference: reference,
                //     payment_type: response.data.metadata.payment_type,
                //     transaction_data: JSON.stringify(response.data)
                // });

                // return res.redirect('/payment/failed');
                return res.status(200).json({
                    success: false,
                    message: "Payment failed",
                });
            }
        } catch (error) {
            console.error('Payment verification error:', error);
            return res.redirect('/payment/failed');
        }
    });


    //all school
    app.get('/api/v1/all/school', verifyJwt(), async (req, res) => {
        try {
            const baseUrl = `https://${req.get('host')}`;
            const parentId = req.user.id;

            // Fetch all approved schools
            const schools = await Schools.findAll({ where: { status: 'Approve' } });

            if (!schools || schools.length === 0) {
                return res.status(200).json({ success: false, message: "No schools found", data: [] });
            }

            // Fetch all school_ids linked to this parent
            const parentSchoolLinks = await ParentSchools.findAll({
                where: { parent_id: parentId },
                attributes: ['school_id']
            });

            const linkedSchoolIds = parentSchoolLinks.map(entry => entry.school_id);

            // Format the school list
            const formattedSchools = schools.map(school => ({
                id: school.id,
                name: school.name,
                phone: school.phone_number,
                location: school.location,
                email: school.email,
                logo: school.logo ? `${baseUrl}${school.logo}` : `${baseUrl}/uploads/schools/default-placeholder.png`,
                created_at: school.created_at,
                added: linkedSchoolIds.includes(school.id)
            }));

            return res.status(200).json({
                success: true,
                message: "All schools retrieved successfully",
                data: formattedSchools
            });

        } catch (err) {
            console.error("Get All Schools Error:", err);
            return res.status(200).json({
                success: false,
                message: "Something went wrong while retrieving schools",
                error: err.message
            });
        }
    });

    //school details
    app.get(
        '/api/v1/school/:school_id',
        [
            param('school_id')
                .notEmpty().withMessage('School ID is required')
                .isUUID().withMessage('Invalid School ID format')
        ],
        verifyJwt(),
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(200).json({
                        success: false,
                        message: errors.array()[0].msg
                    });
                }

                const { school_id } = req.params;
                const parent_id = req.user.id;
                const baseUrl = `https://${req.get('host')}`;

                // Get school details
                const school = await Schools.findOne({
                    where: { id: school_id, status: 'Approve' }
                });

                if (!school) {
                    return res.status(200).json({
                        success: false,
                        message: "School not found"
                    });
                }

                // Get students linked to the parent in this school
                const parentStudentLinks = await ParentStudents.findAll({
                    where: { parent_id },
                    include: [
                        {
                            model: Students,
                            as: 'Student',
                            where: { school_id },
                            required: true,
                            include: [
                                {
                                    model: Classes,
                                    as: 'class', // match the alias used in Students model
                                    attributes: ['id', 'name']
                                }
                            ]
                        }
                    ]
                });
                const hasStudentsInSchool = parentStudentLinks.length > 0;
                const formattedSchool = {
                    ...school.get(),
                    logo: school.logo
                        ? `${baseUrl}${school.logo}`
                        : `${baseUrl}/uploads/schools/default-placeholder.png`,
                    added: hasStudentsInSchool
                };

                // const students = parentStudentLinks.map(link => link.Student);
                const students = parentStudentLinks.map(link => {
                    const student = link.Student.get({ plain: true });

                    const profilePicUrl = student.profile_pic
                        ? `${baseUrl}${student.profile_pic}`
                        : `${baseUrl}/uploads/schools/default-placeholder.png`;

                    return {
                        ...student,
                        class_name: student.class?.name || null, // pull from included class
                        profile_pic: profilePicUrl
                    };
                });



                return res.status(200).json({
                    success: true,
                    message: "School and student details retrieved successfully",
                    data: {
                        school: formattedSchool,
                        students
                    }
                });


            } catch (err) {
                console.error("Get School Error:", err);
                res.status(200).json({
                    success: false,
                    message: "Internal Server Error",
                    data: err
                });
            }
        }
    );

    //Student detail
    app.get(
        '/api/v1/student/:student_id',
        [
            param('student_id')
                .notEmpty().withMessage('Student ID is required')
                .isUUID().withMessage('Invalid Student ID format')
        ],
        verifyJwt(),
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(200).json({
                        success: false,
                        message: errors.array()[0].msg
                    });
                }

                const { student_id } = req.params;

                // Fetch student details
                const student = await Students.findOne({
                    where: { id: student_id, status: true },
                    include: [
                        {
                            model: Schools,
                            as: 'school', // Use the correct alias from your model association
                            attributes: ['id', 'name', 'location', 'email']
                        },
                        {
                            model: Classes,
                            as: 'class', // Use the correct alias
                            attributes: ['id', 'name']
                        },
                        {
                            model: SchoolSessions,
                            as: 'session', // Use the correct alias
                            attributes: ['id', 'start_date', 'end_date', 'status']
                        }
                    ]
                });

                if (!student) {
                    return res.status(200).json({
                        success: false,
                        message: "Student not found"
                    });
                }

                const baseUrl = `https://${req.get('host')}`;
                const studentJson = student.toJSON();

                studentJson.profile_pic = student.profile_pic
                    ? `${baseUrl}${student.profile_pic}`
                    : `${baseUrl}/uploads/schools/default-placeholder.png`;

                return res.status(200).json({
                    success: true,
                    message: "Student details retrieved successfully",
                    data: studentJson
                });


            } catch (err) {
                console.error("Get Student Error:", err);
                res.status(200).json({
                    success: false,
                    message: "Internal Server Error"
                });
            }
        }
    );
    //get paid fee
    // app.get('/api/v1/parents/students/paid-fees', verifyJwt(), async (req, res) => {
    //     try {
    //         const parentId = req.user.id;

    //         const paidPayments = await Payments.findAll({
    //             where: { parent_id: parentId, status: 'completed' },
    //             include: [
    //                 {
    //                     model: Students,
    //                     as: 'student',
    //                     attributes: ['id', 'name', 'roll_number', 'status', 'school_id', 'class_id', 'school_sessions_id'],
    //                     include: [
    //                         {
    //                             model: Schools,
    //                             as: 'school',
    //                             attributes: ['name']
    //                         },
    //                         {
    //                             model: Classes,
    //                             as: 'class',
    //                             attributes: ['name']
    //                         }
    //                     ]
    //                 },
    //                 {
    //                     model: StudentFee,
    //                     as: 'studentFee',
    //                     include: [
    //                         {
    //                             model: Fees,
    //                             as: 'fee',
    //                             include: [{ model: FeesTypes, as: 'feesType', attributes: ['name'] }]
    //                         }
    //                     ]
    //                 }
    //             ]
    //         });

    //         if (!paidPayments.length) {
    //             return res.status(200).json({
    //                 success: false,
    //                 message: 'No paid fees found for this parent',
    //                 data: []
    //             });
    //         }

    //         const studentPayments = {};

    //         paidPayments.forEach(payment => {
    //             const student = payment.student;
    //             if (!studentPayments[student.id]) {
    //                 studentPayments[student.id] = {
    //                     id: student.id,
    //                     name: student.name,
    //                     roll_number: student.roll_number,
    //                     status: student.status,
    //                     school_id: student.school_id,
    //                     class_id: student.class_id,
    //                     school_sessions_id: student.school_sessions_id,
    //                     school_name: student.school?.name || null,
    //                     class_name: student.class?.name || null,
    //                     fees: []
    //                 };
    //             }

    //             const studentFee = payment.studentFee;

    //             studentPayments[student.id].fees.push({
    //                 id: studentFee?.id || null,
    //                 fee_type: studentFee?.fee?.feesType?.name || null,
    //                 custom_fee_name: studentFee?.fee?.custom_fee_name || null,
    //                 amount: parseFloat(payment.amount).toFixed(2),
    //                 frequency: studentFee?.fee?.frequency || null,
    //                 description: studentFee?.fee?.description || null,
    //                 payment_date: payment.createdAt
    //             });
    //         });

    //         res.json({
    //             success: true,
    //             message: 'Paid fees fetched successfully',
    //             data: Object.values(studentPayments)
    //         });

    //     } catch (err) {
    //         console.error('Fetch Paid Fees Error:', err.message);
    //         res.status(200).json({ success: false, message: 'Internal Server Error' });
    //     }
    // });
    app.get('/api/v1/parents/students/paid-fees', verifyJwt(), async (req, res) => {
        try {
            const parentId = req.user.id;

            const paidPayments = await Payments.findAll({
                where: { parent_id: parentId, status: 'completed' },
                include: [
                    {
                        model: Students,
                        as: 'student',
                        attributes: ['name'],
                        include: [
                            {
                                model: Schools,
                                as: 'school',
                                attributes: ['name']
                            }
                        ]
                    },
                    {
                        model: StudentFee,
                        as: 'studentFee',
                        include: [
                            {
                                model: Fees,
                                as: 'fee',
                                include: [
                                    {
                                        model: FeesTypes,
                                        as: 'feesType',
                                        attributes: ['name']
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });

            if (!paidPayments.length) {
                return res.status(200).json({
                    success: false,
                    message: 'No paid fees found for this parent',
                    data: []
                });
            }

            const data = paidPayments.map(payment => ({
                student_name: payment.student?.name || null,
                fee_type: payment.studentFee?.fee?.feesType?.name || null,
                frequency: payment.studentFee?.frequency || null,
                amount: parseFloat(payment.amount).toFixed(2),
                payment_date: payment.createdAt,
                school_name: payment.student?.school?.name || null
            }));

            return res.json({
                success: true,
                message: 'Paid fees fetched successfully',
                data
            });

        } catch (err) {
            console.error('Fetch Paid Fees Error:', err.message);
            res.status(200).json({ success: false, message: 'Internal Server Error' });
        }
    });

    //post feedback
    app.post(
        '/api/v1/feedback',
        verifyJwt(),
        [
            body('loving_point')
                .notEmpty().withMessage('Loving Point is required')
                .isInt({ min: 1, max: 5 }).withMessage('Loving Point must be between 1 and 5'),
            body('experience')
                .optional()
                .isString().withMessage('Experience must be a string')
                .isLength({ max: 500 }).withMessage('Experience must be at most 500 characters')
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(200).json({
                        success: false,
                        message: errors.array()[0].msg
                    });
                }
                const parent_id = req.user?.id;

                if (!parent_id) {
                    return res.status(401).json({
                        success: false,
                        message: "Unauthorized: Parent ID not found in token"
                    });
                }

                const { loving_point, experience } = req.body;

                const parent = await Parents.findByPk(parent_id);
                if (!parent) {
                    return res.status(200).json({
                        success: false,
                        message: "Parent not found"
                    });
                }
                const feedback = await Feedback.create({
                    parent_id,
                    loving_point,
                    experience
                });

                return res.status(201).json({
                    success: true,
                    message: "Feedback submitted successfully",
                    data: feedback
                });

            } catch (err) {
                console.error("Post Feedback Error:", err);
                res.status(200).json({
                    success: false,
                    message: "Internal Server Error"
                });
            }
        }
    );
    //get all fees type
    app.get('/api/v1/fees-types', verifyJwt(), async (req, res) => {
        try {
            const feesTypes = await FeesTypes.findAll({
                attributes: ['id', 'name', 'description', 'status', 'created_at']
            });

            if (feesTypes.length === 0) {
                return res.status(200).json({ success: false, message: 'No fees types found' });
            }

            return res.status(200).json({
                success: true,
                message: 'Fees types retrieved successfully',
                data: feesTypes
            });
        } catch (error) {
            console.error('Get Fees Types Error:', error);
            res.status(200).json({ success: false, message: 'Internal Server Error' });
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
