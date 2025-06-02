const models = require('../models');
const waterfall = require('async-waterfall');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const xlsx = require('xlsx');
const moment = require('moment-timezone');
const { Op } = require('sequelize');
module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

    /**
     * Render view for managing classes
     */
    app.get('/classes/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const whereCondition = {};

            // Filter by school_sessions_id if provided
            if (req.query.school_sessions_id) {
                whereCondition.school_sessions_id = req.query.school_sessions_id;
                console.log(req.query.school_sessions_id);
            }

            // Restrict "School" and "Administrator" users to their own school's classes
            if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                whereCondition.school_id = req.user.school_id;
            }

            const classes = await models.Classes.findAll({
                attributes: ['id', 'name', 'school_id', 'status', 'school_sessions_id'],
                include: [
                    {
                        model: models.Schools,
                        as: 'school',
                        attributes: ['name']
                    }
                ],
                where: whereCondition,
                raw: true,
                order: [['created_at', 'DESC']],
                nest: true
            });

            res.render('classes/index', {
                classes,
                selectedSession: req.query.school_sessions_id,
                success: res.locals.success,
                error: res.locals.error
            });
        } catch (error) {
            console.error("Error fetching classes:", error);
            req.flash('error', 'Failed to load classes.');
            res.redirect('/');
        }
    });


    /**
     * Create or edit class
     */
    app.get('/classes/create/:class_id?', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        try {
            const { class_id } = req.params;
            let classData = null;
            let schoolCondition = { status: 'Approve' };

            // Restrict school list for School role
            if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                schoolCondition.id = req.user.school_id;
            }

            let schools;
            if (req.user.role.name == "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                schools = await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: {
                        status: 'Approve', id: req.user.school_id
                    },
                    raw: true
                });
            } else {
                schools = await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: {
                        status: 'Approve'
                    },
                    raw: true
                });
            }

            if (class_id) {
                // Restrict access to class data for School role
                const classCondition = { id: class_id };
                if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                    classCondition.school_id = req.user.school_id;
                }

                classData = await models.Classes.findOne({
                    where: classCondition,
                    raw: true
                });

                if (!classData) {
                    req.flash('error', 'Class not found or unauthorized access.');
                    return res.redirect('/classes/index');
                }
            }
            const errors = req.flash('errors')[0] || {};
            res.render('classes/create', {
                classData,
                schools,
                errors,
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });

        } catch (error) {
            console.error('Error in /classes/create:', error);
            req.flash('error', 'Error loading class data');
            res.redirect('/classes/index');
        }
    });


    app.post('/classes/create', [
        body('name').notEmpty().withMessage('Class name is required'),
        body('school_id').notEmpty().withMessage('Please select a school'),
        body('school_sessions_id').notEmpty().withMessage('School session is required'),
        body('status').isIn(['0', '1']).withMessage('Invalid status')
    ], async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/classes/index');
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('classes/create', {
                classData: req.body,
                errors: errors.mapped()
            });
        }
        try {
            const { name, school_id, school_sessions_id, status } = req.body;

            // Restrict "School" users to only their own school
            if ((req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") && req.user.school_id !== school_id) {
                req.flash('error', 'You are not authorized to add classes to this school.');
                return res.redirect('/classes/index');
            }

            // Check if the session belongs to the selected school
            const session = await models.SchoolSessions.findOne({
                where: { id: school_sessions_id, school_id }
            });

            if (!session) {
                req.flash('error', 'Selected school session does not belong to this school.');
                return res.redirect('/classes/create');
            }

            // Check for duplicate class name in the same school and session
            const existingClass = await models.Classes.findOne({
                where: { name, school_id, school_sessions_id }
            });

            if (existingClass) {
                req.flash('error', 'A class with this name already exists for the selected school and session.');
                return res.redirect('/classes/create');
            }

            // Create new class
            await models.Classes.create({ name, school_id, school_sessions_id, status });
            req.flash('success', 'Class created successfully.');
            return res.redirect('/classes/index');

        } catch (error) {
            console.error('Error creating class:', error);
            req.flash('error', 'Class not created due to an error.');
            res.redirect('/classes/create');
        }
    });


    // Define month names at the top
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    app.get('/classes/edit/:class_id', async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                req.flash('error', 'Please login to continue');
                return res.redirect('/login');
            }

            if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
                req.flash('error', 'You are not authorised to access this page.');
                return res.redirect('/classes/index');
            }

            const { class_id } = req.params;
            let schools;
            if (req.user.role.name == "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                schools = await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: {
                        status: 'Approve', id: req.user.school_id
                    },
                    raw: true
                });
            } else {
                schools = await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: {
                        status: 'Approve'
                    },
                    raw: true
                });
            }

            let classData = await models.Classes.findOne({ where: { id: class_id }, raw: true });

            if (!classData) {
                req.flash('error', 'Class not found.');
                return res.redirect('/classes/index');
            }

            // Restrict "School" users to their own school's classes
            if ((req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") && req.user.school_id !== classData.school_id) {
                req.flash('error', 'You are not authorised to access this class.');
                return res.redirect('/classes/index');
            }

            const schoolSessions = await models.SchoolSessions.findAll({
                where: { school_id: classData.school_id },
                attributes: ['id', 'start_date', 'end_date'],
                raw: true
            });

            // Format dates for display
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

            // Retrieve old input and errors from flash messages
            const oldData = req.flash('oldData')[0] || {};
            const errors = req.flash('errors')[0] || [];

            res.render('classes/edit', {
                classData: { ...classData, ...oldData },
                schools,
                errors,
                formattedSessions,
                messages: {
                    success: res.locals.success,
                    error: res.locals.error
                }
            });

        } catch (error) {
            console.error('Error loading class edit page:', error);
            req.flash('error', 'Error loading class data.');
            res.redirect('/classes/index');
        }
    });



    /**
     * Update class details
     */


    app.post('/classes/update/:class_id', [
        body('name').notEmpty().withMessage('Class name is required'),
        body('school_sessions_id').notEmpty().withMessage('School session is required'),
        body('school_id').notEmpty().withMessage('Please select a school'),
        body('status').isIn(['0', '1']).withMessage('Invalid status')
    ], async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                req.flash('error', 'Please login to continue');
                return res.redirect('/login');
            }

            if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School" && req.user.role.name !== "Administrator") {
                req.flash('error', "You are not authorised to access this page.");
                return res.redirect('/classes/index');
            }

            const { class_id } = req.params;
            const { name, school_id, status, school_sessions_id } = req.body;

            // Validate inputs
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                req.flash('errors', errors.mapped());
                req.flash('oldData', { name, school_id, status, school_sessions_id });
                return res.redirect(`/classes/edit/${class_id}`);
            }

            // Check if class exists
            const classData = await models.Classes.findOne({ where: { id: class_id } });
            if (!classData) {
                req.flash('error', 'Class not found.');
                return res.redirect('/classes/index');
            }

            // Restrict "School" role to updating classes only from their school
            if ((req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") && req.user.school_id !== classData.school_id) {
                req.flash('error', "You are not authorised to edit this class.");
                return res.redirect('/classes/index');
            }

            // Check for duplicate class name in the same school (excluding the current class)
            const existingClass = await models.Classes.findOne({
                where: {
                    name,
                    school_id,
                    school_sessions_id,
                    id: { [models.Sequelize.Op.ne]: class_id }
                }
            });

            if (existingClass) {
                req.flash('error', 'A class with this name already exists for the selected school.');
                req.flash('oldData', { name, school_id, status, school_sessions_id });
                return res.redirect(`/classes/edit/${class_id}`);
            }

            // Update the class
            const [rowsUpdated] = await models.Classes.update(
                { name, school_sessions_id, school_id, status },
                { where: { id: class_id } }
            );

            if (rowsUpdated) {
                req.flash('success', 'Class updated successfully.');
            } else {
                req.flash('error', 'No changes were made.');
            }

            return res.redirect('/classes/index');

        } catch (error) {
            console.error('Error updating class:', error);
            req.flash('error', 'Error updating class.');
            return res.redirect(`/classes/edit/${req.params.class_id}`);
        }
    });




    /**
     * Delete class
     */
    app.delete('/classes/delete/:id', async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                return res.status(401).json({ success: false, message: 'Please login to continue' });
            }

            if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
                return res.status(403).json({ success: false, message: 'You are not authorised to access this page.' });
            }

            const { id } = req.params;
            const classData = await models.Classes.findOne({ where: { id } });

            if (!classData) {
                return res.status(404).json({ success: false, message: 'Class not found.' });
            }

            // Restrict "School" role to deleting only their own classes
            if ((req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") && req.user.school_id !== classData.school_id) {
                return res.status(403).json({ success: false, message: 'You can only delete classes from your school.' });
            }

            await models.Classes.destroy({ where: { id } });

            return res.status(200).json({ success: true, message: 'Class deleted successfully.' });
        } catch (error) {
            console.error('Error deleting class:', error);
            return res.status(500).json({ success: false, message: 'Error deleting class. Please try again later.' });
        }
    });


    /**
     * Update class status
     */
    app.patch('/classes/status/:class_id', async (req, res) => {
        const { class_id } = req.params;
        const { status } = req.body;

        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            return res.status(403).json({ message: 'Permission denied.' });
        }

        // Validate status value
        if (!['0', '1'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value. Allowed values: 0, 1.' });
        }

        try {
            const classData = await models.Classes.findOne({ where: { id: class_id } });

            if (!classData) {
                return res.status(404).json({ message: 'Class not found.' });
            }

            // Restrict "School" role to updating only their own classes
            if ((req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") && req.user.school_id !== classData.school_id) {
                return res.status(403).json({ message: 'You can only update classes from your school.' });
            }

            await classData.update({ status });

            return res.status(200).json({ message: 'Status updated successfully.' });
        } catch (error) {
            console.error('Error updating status:', error);
            return res.status(500).json({ message: 'Internal server error.' });
        }
    });

    app.post('/classes/import', async (req, res) => {
        if (!req.isAuthenticated()) {
            return res.status(403).json({ message: 'Unauthorized. Please log in.' });
        }

        if (req.user.role.name !== "SuperAdmin") {
            return res.status(403).json({ message: 'Permission denied.' });
        }

        if (!req.files || !req.files.excelFile) {
            req.flash('error', 'No file uploaded. Please upload an Excel file.');
            return res.redirect('/classes/index');
        }

        const excelFile = req.files.excelFile;
        const ext = path.extname(excelFile.name).toLowerCase();
        const allowedExtensions = ['.xlsx', '.xls'];

        if (!allowedExtensions.includes(ext)) {
            req.flash('error', 'Only Excel files (.xlsx, .xls) are allowed.');
            return res.redirect('/classes/index');
        }

        const uploadDir = path.join(__dirname, '../Uploads/');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, `classes-import-${Date.now()}${ext}`);
        await excelFile.mv(filePath);

        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (sheetData.length === 0) {
            req.flash('error', 'Excel file is empty.');
            return res.redirect('/classes/index');
        }

        let skippedRecords = 0;

        try {
            for (const row of sheetData) {
                const { 'Class Name': name, 'School Name': schoolName, 'School Session': sessionRange } = row;

                if (!name || !schoolName || !sessionRange) {
                    console.log(`Skipping row: Missing name=${name}, schoolName=${schoolName}, sessionRange=${sessionRange}`);
                    skippedRecords++;
                    continue;
                }

                // Find school
                const school = await models.Schools.findOne({
                    where: { name: schoolName.trim() }
                });
                if (!school) {
                    console.log(`Skipping row: School not found for schoolName=${schoolName}`);
                    skippedRecords++;
                    continue;
                }

                // Parse sessionRange e.g., "2025-03-24 - 2026-03-24"
                const trimmedSessionRange = sessionRange.trim();
                const match = trimmedSessionRange.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
                console.log(match);
                if (!match) {
                    console.log(`Skipping row: Invalid sessionRange format=${trimmedSessionRange}`);
                    skippedRecords++;
                    continue;
                }

                const [, startDateStr, endDateStr] = match;

                // Parse dates in IST
                const startDate = moment.tz(startDateStr, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day');
                const endDate = moment.tz(endDateStr, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day');

                if (!startDate.isValid() || !endDate.isValid()) {
                    console.log(`Skipping row: Invalid date: startDate=${startDateStr}, endDate=${endDateStr}`);
                    skippedRecords++;
                    continue;
                }

                console.log(`Parsed startDate: ${startDate.format('YYYY-MM-DD HH:mm:ss Z')} (IST)`);
                console.log(`Parsed endDate: ${endDate.format('YYYY-MM-DD HH:mm:ss Z')} (IST)`);

                // Normalize dates to YYYY-MM-DD for database comparison
                const startDateFormatted = startDate.format('YYYY-MM-DD');
                const endDateFormatted = endDate.format('YYYY-MM-DD');

                console.log(`Querying DB: start_date=${startDateFormatted}, end_date=${endDateFormatted}`);

                // Find or create session (date-only comparison)
                let session = await models.SchoolSessions.findOne({
                    where: {
                        school_id: school.id,
                        [Op.and]: [
                            models.sequelize.where(
                                models.sequelize.fn('DATE', models.sequelize.col('start_date')),
                                startDateFormatted
                            ),
                            models.sequelize.where(
                                models.sequelize.fn('DATE', models.sequelize.col('end_date')),
                                endDateFormatted
                            )
                        ]
                    }
                });

                if (!session) {
                    console.log(`Creating new session: start_date=${startDateFormatted}, end_date=${endDateFormatted}`);
                    session = await models.SchoolSessions.create({
                        school_id: school.id,
                        start_date: startDate.toDate(),
                        end_date: endDate.toDate()
                    });
                    console.log(`Created session: start_date=${session.start_date.toISOString()}, end_date=${session.end_date.toISOString()}`);
                } else {
                    console.log(`Found existing session: id=${session.id}, start_date=${session.start_date.toISOString()}, end_date=${session.end_date.toISOString()}`);
                }

                // Check for existing class
                const existingClass = await models.Classes.findOne({
                    where: {
                        name,
                        school_id: school.id,
                        school_sessions_id: session.id
                    }
                });

                if (existingClass) {
                    console.log(`Skipping row: Class already exists: name=${name}, school_id=${school.id}, session_id=${session.id}`);
                    skippedRecords++;
                    continue;
                }

                // Create class
                await models.Classes.create({
                    name,
                    school_id: school.id,
                    school_sessions_id: session.id,
                    status: 1
                });
                console.log(`Created class: name=${name}, school_id=${school.id}, session_id=${session.id}`);
            }

            req.flash('success', `Classes imported successfully. Skipped ${skippedRecords} duplicate or invalid records.`);
            res.redirect('/classes/index');
        } catch (error) {
            console.error('Error importing classes:', error);
            req.flash('error', 'Error importing classes. Please check the file format.');
            res.redirect('/classes/index');
        } finally {
            fs.unlinkSync(filePath);
        }
    });

    // app.post('/classes/import', async (req, res) => {
    //     if (!req.isAuthenticated()) {
    //         return res.status(403).json({ message: 'Unauthorized. Please log in.' });
    //     }

    //     if (req.user.role.name !== "SuperAdmin") {
    //         return res.status(403).json({ message: 'Permission denied.' });
    //     }

    //     if (!req.files || !req.files.excelFile) {
    //         req.flash('error', 'No file uploaded. Please upload an Excel file.');
    //         return res.redirect('/classes/index');
    //     }

    //     const excelFile = req.files.excelFile;
    //     const ext = path.extname(excelFile.name).toLowerCase();
    //     const allowedExtensions = ['.xlsx', '.xls'];

    //     if (!allowedExtensions.includes(ext)) {
    //         req.flash('error', 'Only Excel files (.xlsx, .xls) are allowed.');
    //         return res.redirect('/classes/index');
    //     }

    //     const uploadDir = path.join(__dirname, '../uploads/');
    //     if (!fs.existsSync(uploadDir)) {
    //         fs.mkdirSync(uploadDir, { recursive: true });
    //     }

    //     const filePath = path.join(uploadDir, `classes-import-${Date.now()}${ext}`);
    //     await excelFile.mv(filePath);

    //     const workbook = xlsx.readFile(filePath);
    //     const sheetName = workbook.SheetNames[0];
    //     const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    //     if (sheetData.length === 0) {
    //         req.flash('error', 'Excel file is empty.');
    //         return res.redirect('/classes/index');
    //     }

    //     let skippedRecords = 0;

    //     try {
    //         for (const row of sheetData) {
    //             const { 'Class Name': name, 'School Name': schoolName } = row;

    //             // Find school ID (case-insensitive)
    //             const school = await models.Schools.findOne({
    //                 where: models.sequelize.where(models.sequelize.fn('LOWER', models.sequelize.col('name')), '=', schoolName.toLowerCase())
    //             });

    //             if (!school) {
    //                 skippedRecords++;
    //                 continue;
    //             }

    //             // Check if the class already exists in the same school
    //             const existingClass = await models.Classes.findOne({
    //                 where: {
    //                     name,
    //                     school_id: school.id
    //                 }
    //             });

    //             if (existingClass) {
    //                 skippedRecords++;
    //                 continue;
    //             }
    //             await models.Classes.create({
    //                 name,
    //                 school_id: school.id
    //             });


    //         }

    //         req.flash('success', `Classes imported successfully. Skipped ${skippedRecords} duplicate records or invalid schools.`);
    //         res.redirect('/classes/index');
    //     } catch (error) {
    //         console.error('Error importing classes:', error);
    //         req.flash('error', 'Error importing classes. Please check the file format.');
    //         res.redirect('/classes/index');
    //     } finally {
    //         fs.unlinkSync(filePath);
    //     }
    // });
};
