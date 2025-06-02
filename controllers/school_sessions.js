const models = require('../models');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const xlsx = require('xlsx');
const { Op } = require('sequelize');
const moment = require('moment');

module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

    /**
     * List all school sessions
     */

    // Define this helper at the top
    function formatDate(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');         // 2-digit day
        const month = String(d.getMonth() + 1).padStart(2, '0');  // 2-digit month
        const year = String(d.getFullYear()).slice(-2);           // last 2 digits of year
        return `${year}-${month}-${day}`;
    }



    app.get('/sessions/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            let whereCondition = {};

            // Filter by school_id if provided in query
            if (req.query.school_id) {
                whereCondition.school_id = req.query.school_id;
            } else if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                whereCondition.school_id = req.user.school_id;
            }

            // Fetch sessions
            const sessions = await models.SchoolSessions.findAll({
                where: whereCondition,
                attributes: ['id', 'start_date', 'end_date', 'status'],
                include: [{
                    model: models.Schools,
                    as: 'school',
                    attributes: ['id', 'name']
                }],
                order: [['created_at', 'DESC']],
                raw: true,
                nest: true
            });

            // Format dates
            const formattedSessions = sessions.map(session => {
                const formattedStart = formatDate(session.start_date);
                const formattedEnd = formatDate(session.end_date);
                return {
                    ...session,
                    formattedStart,
                    formattedEnd,
                    formattedDateRange: `${formattedStart} - ${formattedEnd}`
                };
            });

            // Get all schools for filter dropdown (only for SuperAdmin)
            let schools = [];
            if (req.user.role.name === "SuperAdmin") {
                schools = await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: { status: 'Approve' },
                    raw: true
                });
            }

            // Render the view
            res.render('sessions/index', {
                sessions: formattedSessions,
                schools,
                selectedSchool: req.query.school_id,
                success: res.locals.success,
                error: res.locals.error
            });

        } catch (error) {
            console.error("Error fetching sessions:", error);
            req.flash('error', 'Failed to load school sessions.');
            res.redirect('/');
        }
    });



    /**
     * Create or edit session
     */
    app.get('/sessions/create/:session_id?', async (req, res) => {
        try {
            const { session_id } = req.params;
            let sessionData = null;

            // Check if the user is authorized
            if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
                req.flash('error', 'You are not authorised to access this page.');
                return res.redirect('/');
            }

            let schools;
            if (req.user.role.name === "School (Sub-Admin" || req.user.role.name === "Administrator") {
                // For School and Administrator roles, only show the assigned school
                schools = await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: {
                        status: 'Approve',
                        id: req.user.school_id
                    },
                    raw: true
                });
            } else {
                // SuperAdmin can see all approved schools
                schools = await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: {
                        status: 'Approve'
                    },
                    raw: true
                });
            }

            if (session_id) {
                sessionData = await models.SchoolSessions.findOne({ where: { id: session_id }, raw: true });
            }

            res.render('sessions/create', { sessionData, schools });
        } catch (error) {
            console.error('Error in /sessions/create:', error);
            res.status(500).send('Error loading session data');
        }
    });


    /**
     * Create session with validation
     */

    app.post('/sessions/create', [
        body('school_id')
            .notEmpty().withMessage('School is required')
            .isUUID().withMessage('Invalid school ID format')
            .custom(async (value, { req }) => {
                const startYear = new Date(req.body.start_date).getFullYear();
                const existingSession = await models.SchoolSessions.findOne({
                    where: {
                        school_id: value,
                        [models.Sequelize.Op.and]: [
                            models.Sequelize.where(
                                models.Sequelize.fn('EXTRACT', models.Sequelize.literal('YEAR FROM "start_date"')),
                                startYear
                            )
                        ]
                    }
                });

                if (existingSession) {
                    throw new Error(`School session already exists for the year ${startYear}.`);
                }
            }),
        body('start_date').notEmpty().withMessage('Start date is required').isDate().withMessage('Invalid date format'),
        body('end_date').notEmpty().withMessage('End date is required').isDate().withMessage('Invalid date format'),
        body('status').isIn(['Active', 'Completed', 'Inactive']).withMessage('Invalid status')
    ], async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        let schools;
        if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
            schools = await models.Schools.findAll({
                attributes: ['id', 'name'],
                where: {
                    status: 'Approve',
                    id: req.user.school_id
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

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('sessions/create', {
                sessionData: req.body,
                errors: errors.mapped(),
                schools: schools
            });
        }

        const { school_id, start_date, end_date, status } = req.body;

        try {
            await models.SchoolSessions.create({ school_id, start_date, end_date, status });

            req.flash('success', 'School session created successfully.');
            res.redirect('/sessions/index');
        } catch (error) {
            console.error('Error creating session:', error);
            req.flash('error', 'Error creating session. Please try again.');
            res.redirect('/sessions/create');
        }
    });





    app.get('/sessions/edit/:session_id?', async (req, res) => {
        try {
            const { session_id } = req.params;
            let sessionData = null;

            // Check if the user is authorized (SuperAdmin, School, or Administrator)
            if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
                req.flash('error', 'You are not authorised to access this page.');
                return res.redirect('/');
            }

            let schools;
            if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                // For School and Administrator, only show the assigned school
                schools = await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: {
                        status: 'Approve',
                        id: req.user.school_id
                    },
                    raw: true
                });
            } else {
                // SuperAdmin can see all approved schools
                schools = await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: {
                        status: 'Approve'
                    },
                    raw: true
                });
            }

            if (session_id) {
                let session = await models.SchoolSessions.findOne({ where: { id: session_id }, raw: true });

                if (session) {
                    session.start_date = moment(session.start_date).format('YYYY-MM-DD');
                    session.end_date = moment(session.end_date).format('YYYY-MM-DD');
                    sessionData = session;
                }
            }

            // Retrieve flash messages
            const errors = req.flash('errors')[0] || {};
            res.render('sessions/edit', {
                sessionData, schools, errors, messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });
        } catch (error) {
            console.error('Error in /sessions/edit:', error);
            res.status(500).send('Error loading session data');
        }
    });


    /**
     * Update session with validation
     */
    app.post('/sessions/update/:session_id', [
        body('start_date')
            .notEmpty().withMessage('Start date is required')
            .isDate().withMessage('Invalid date format'),
        body('end_date')
            .notEmpty().withMessage('End date is required')
            .isDate().withMessage('Invalid date format'),
        body('status')
            .isIn(['Active', 'Completed', 'Inactive']).withMessage('Invalid status'),
        body('school_id')
            .notEmpty().withMessage('School is required')
            .custom(async (value, { req }) => {
                const startYear = new Date(req.body.start_date).getFullYear();
                const existingSession = await models.SchoolSessions.findOne({
                    where: {
                        school_id: value,
                        id: { [models.Sequelize.Op.ne]: req.params.session_id },
                        [models.Sequelize.Op.and]: [
                            models.Sequelize.where(
                                models.Sequelize.fn('EXTRACT', models.Sequelize.literal('YEAR FROM "start_date"')),
                                startYear
                            )
                        ]
                    }
                });

                if (existingSession) {
                    throw new Error(`School session already exists for the year ${startYear}.`);
                }
                return true;
            })
    ], async (req, res) => {
        const { session_id } = req.params;

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
            req.flash('error', "You are not authorised to access this page.");
            return res.redirect('/sessions/index');
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('sessionData', { ...req.body, id: session_id });
            return res.redirect(`/sessions/edit/${session_id}`);
        }

        try {
            const { school_id, start_date, end_date, status } = req.body;

            // Restrict "School" and "Administrator" roles to updating only their own sessions
            let whereCondition = { id: session_id };
            if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
                whereCondition.school_id = req.user.school_id;
            }

            const [rowsUpdated] = await models.SchoolSessions.update(
                { school_id, start_date, end_date, status },
                { where: whereCondition }
            );

            if (rowsUpdated > 0) {
                req.flash('success', 'School session updated successfully.');
            } else {
                req.flash('error', 'No changes were made or session not found.');
            }

            res.redirect('/sessions/index');
        } catch (error) {
            console.error('Error updating session:', error);
            req.flash('error', 'Error updating session. Please try again.');
            res.redirect(`/sessions/edit/${session_id}`);
        }
    });



    /**
     * Delete session
     */
    app.delete('/sessions/delete/:id', async (req, res) => {
        try {
            // Authentication check
            if (!req.isAuthenticated()) {
                return res.json({ success: false, message: 'Please login to continue' });
            }
            if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)") {
                return res.json({ success: false, message: 'You are not authorised to access this page.' });
            }

            const { id } = req.params;

            const sessionData = await models.SchoolSessions.findOne({ where: { id } });

            if (!sessionData) {
                return res.json({ success: false, message: 'School session not found.' });
            }
            if (req.user.role.name === "School (Sub-Admin)" && sessionData.school_id !== req.user.school_id) {
                return res.json({ success: false, message: 'You can only delete your own school sessions.' });
            }
            await models.SchoolSessions.destroy({ where: { id } });
            return res.json({ success: true, message: 'School session deleted successfully.' });

        } catch (error) {
            console.error('Error deleting session:', error);
            return res.json({ success: false, message: 'Failed to delete session. Please try again.' });
        }
    });

    app.post('/sessions/status/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { status } = req.body;

            console.log("Received sessionId:", sessionId);
            console.log("Received status:", status);

            // Validate input
            if (!["Active", "Completed", "Inactive"].includes(status)) {
                console.log("Invalid status received.");
                return res.status(400).json({ message: "Invalid status value." });
            }

            // Check if session exists using correct model name
            const session = await models.SchoolSessions.findByPk(sessionId);
            if (!session) {
                console.log("Session not found.");
                return res.status(404).json({ message: "Session not found." });
            }

            // Update status
            try {
                await session.update({ status });
                console.log("Session status updated successfully.");
                return res.status(200).json({ message: "Session status updated successfully." });
            } catch (updateError) {
                console.error("Error updating session:", updateError);
                return res.status(500).json({ message: "Database update failed." });
            }
        } catch (error) {
            console.error("Internal Server Error:", error);
            return res.status(500).json({ message: "Internal Server Error." });
        }
    });
    app.post('/sessions/import', async (req, res) => {
        if (!req.isAuthenticated()) {
            return res.status(403).json({ message: 'Unauthorized. Please log in.' });
        }

        if (req.user.role.name !== "SuperAdmin") {
            return res.status(403).json({ message: 'Permission denied.' });
        }

        if (!req.files || !req.files.excelFile) {
            req.flash('error', 'No file uploaded. Please upload an Excel file.');
            return res.redirect('/sessions/index');
        }

        const excelFile = req.files.excelFile;
        const ext = path.extname(excelFile.name).toLowerCase();
        const allowedExtensions = ['.xlsx', '.xls'];

        if (!allowedExtensions.includes(ext)) {
            req.flash('error', 'Only Excel files (.xlsx, .xls) are allowed.');
            return res.redirect('/sessions/index');
        }

        const uploadDir = path.join(__dirname, '../uploads/');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, `sessions-import-${Date.now()}${ext}`);
        await excelFile.mv(filePath);

        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (sheetData.length === 0) {
            req.flash('error', 'Excel file is empty.');
            return res.redirect('/sessions/index');
        }

        let skippedRecords = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            const parseDate = (date) => {
                if (typeof date === 'number') {
                    // Excel date number to JS Date
                    return new Date((date - 25569) * 86400 * 1000);
                } else if (date instanceof Date) {
                    return date;
                } else if (typeof date === 'string') {
                    const [day, month, year] = date.split('-');
                    return new Date(`${year}-${month}-${day}`);
                }
                return NaN;
            };

            for (const row of sheetData) {
                const { 'School Name': schoolName, 'Start Date': start_date, 'End Date': end_date } = row;
                console.log('School Name:', schoolName, 'Start Date:', start_date, 'End Date:', end_date);

                const school = await models.Schools.findOne({
                    where: models.sequelize.where(models.sequelize.fn('LOWER', models.sequelize.col('name')), '=', schoolName.toLowerCase())
                });

                if (!school) {
                    skippedRecords++;
                    continue;
                }

                const startDate = parseDate(start_date);
                const endDate = parseDate(end_date);
                console.log('Parsed Start Date:', startDate, 'Parsed End Date:', endDate);

                // Remove the past date validation since we want to allow past dates
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
                    console.log('Invalid date format or end date is before start date');
                    skippedRecords++;
                    continue;
                }

                const startYear = startDate.getFullYear();
                const existingSession = await models.SchoolSessions.findOne({
                    where: {
                        school_id: school.id,
                        [models.Sequelize.Op.and]: [
                            models.Sequelize.where(
                                models.Sequelize.fn('EXTRACT', models.Sequelize.literal('YEAR FROM "start_date"')),
                                startYear
                            )
                        ]
                    }
                });

                if (existingSession) {
                    console.log('Session already exists for the year:', startYear);
                    skippedRecords++;
                    continue;
                }

                await models.SchoolSessions.create({
                    school_id: school.id,
                    start_date: startDate,
                    end_date: endDate,
                    status: 'Active'
                });
            }

            req.flash('success', `Sessions imported successfully. Skipped ${skippedRecords} duplicate records, invalid schools, or invalid dates.`);
            res.redirect('/sessions/index');
        } catch (error) {
            console.error('Error importing sessions:', error);
            req.flash('error', 'Error importing sessions. Please check the file format.');
            res.redirect('/sessions/index');
        } finally {
            fs.unlinkSync(filePath);
        }
    });
    // Route to download session format
    app.get('/sessions/download-format', (req, res) => {
        const filePath = path.join(__dirname, '../public/uploads/session.xlsx');
        res.download(filePath, 'session-format.xlsx', (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).send('Could not download file.');
            }
        });
    });
    app.get('/class/download-format', (req, res) => {
        const filePath = path.join(__dirname, '../public/uploads/class.xlsx');
        res.download(filePath, 'class-format.xlsx', (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).send('Could not download file.');
            }
        });
    });


};
