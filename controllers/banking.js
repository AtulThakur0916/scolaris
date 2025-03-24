const models = require('../models');
const { body, validationResult } = require('express-validator');
const waterfall = require('async-waterfall');
const fs = require('fs');
const path = require('path');

module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

    /**
     * List all banking details
     */
    app.get('/banking/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorized to access this page.');
            return res.redirect('/');
        }

        try {
            const bankingDetails = await models.BankingDetails.findAll({
                attributes: ['id', 'bank_name', 'account_number', 'account_holder'],
                include: [
                    {
                        model: models.Schools,
                        as: 'school',
                        attributes: ['name']
                    }
                ],
                order: [['bank_name', 'ASC']],
                raw: true,
                nest: true
            });

            res.render('banking/index', {
                bankingDetails,
                success: res.locals.success,
                error: res.locals.error
            });
        } catch (error) {
            console.error("Error fetching banking details:", error);
            req.flash('error', 'Failed to load banking details.');
            res.redirect('/');
        }
    });



    /**
     * Create banking detail form
     */
    app.get('/banking/create/:id?', async (req, res) => {
        try {
            const { id } = req.params;
            let bankingDetail = null;
            const schools = await models.Schools.findAll({
                attributes: ['id', 'name'], where: {
                    status: 'Approve'
                }, raw: true
            });

            if (id) {
                bankingDetail = await models.BankingDetails.findOne({ where: { id }, raw: true });
            }

            res.render('banking/create', { bankingDetail, schools });
        } catch (error) {
            console.error("Error loading banking detail form:", error);
            res.status(500).send('Error loading banking detail form');
        }
    });

    /**
     * Create banking detail with validation
     */

    app.post('/banking/create', [
        body('bank_name')
            .trim()
            .notEmpty().withMessage('Bank name is required')
            .isLength({ min: 2 }).withMessage('Bank name must be at least 2 characters long'),

        body('account_number')
            .notEmpty().withMessage('Account number is required')
            .isNumeric().withMessage('Account number must be a valid number')
            .isLength({ min: 6 }).withMessage('Account number must be at least 6 digits long')
            .custom(async (value) => {
                const existingAccount = await models.BankingDetails.findOne({ where: { account_number: value } });
                if (existingAccount) {
                    throw new Error('Account number already exists.');
                }
            }),

        body('account_holder')
            .trim()
            .notEmpty().withMessage('Account holder name is required')
            .isLength({ min: 3 }).withMessage('Account holder name must be at least 3 characters long'),
        body('school_id')
            .notEmpty().withMessage('School is required')
            .isUUID().withMessage('Invalid school ID format')
            .custom(async (value) => {
                const existingSchool = await models.BankingDetails.findOne({ where: { school_id: value } });
                if (existingSchool) {
                    throw new Error('School already exists.');
                }
            }),
        body('status')
            .optional()
            .isIn(['0', '1']).withMessage('Invalid status value')
    ], async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorized to access this page.');
            return res.redirect('/banking/index');
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('banking/create', {
                bankingDetail: req.body,
                errors: errors.mapped(),
                schools: await models.Schools.findAll({ attributes: ['id', 'name'], raw: true })
            });
        }

        waterfall([
            function (done) {
                if (req.files && req.files.iban_document) {
                    let file = req.files.iban_document;
                    let ext = path.extname(file.name).toLowerCase();
                    let allowedExtensions = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif'];
                    let maxFileSize = 5 * 1024 * 1024; // 2MB

                    if (!allowedExtensions.includes(ext)) {
                        return done(new Error('Invalid file type. Only PNG, JPG, JPEG, PDF, DOC and DOCX allowed.'));
                    }
                    if (file.size > maxFileSize) {
                        return done(new Error('File size exceeds the 5MB limit.'));
                    }

                    let baseName = path.basename(file.name, ext);
                    let ibanDocumentName = `${baseName}-${Date.now()}${ext}`;
                    let uploadDir = path.join(__dirname, '../public/banking/ibanDoc/');
                    let uploadPath = path.join(uploadDir, ibanDocumentName);

                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }

                    file.mv(uploadPath, function (err) {
                        if (err) return done(err);
                        done(null, `/banking/ibanDoc/${ibanDocumentName}`);
                    });
                } else {
                    done(null, null);
                }
            },
            async function (ibanDocumentUrl, done) {
                try {
                    await models.BankingDetails.create({
                        bank_name: req.body.bank_name,
                        account_number: req.body.account_number,
                        account_holder: req.body.account_holder,
                        school_id: req.body.school_id,
                        iban_document: ibanDocumentUrl,
                        status: req.body.status || 1
                    });

                    req.flash('success', 'Banking detail added successfully.');
                    done(null);
                } catch (error) {
                    done(error);
                }
            }
        ], function (err) {
            if (err) {
                console.error("Error creating banking detail:", err);
                req.flash('error', err.message || 'Error creating banking detail. Please try again.');
                return res.redirect('/banking/create');
            }
            res.redirect('/banking/index');
        });
    });


    /**
     * Edit banking detail form
     */
    app.get('/banking/edit/:id', async (req, res) => {
        try {
            const { id } = req.params;
            let bankingDetail = await models.BankingDetails.findOne({ where: { id }, raw: true });

            if (!bankingDetail) {
                req.flash('error', 'Banking detail not found.');
                return res.redirect('/banking/index');
            }
            const errors = req.flash('errors')[0] || {};
            const formData = req.flash('school')[0] || {};
            const schools = await models.Schools.findAll({
                attributes: ['id', 'name'], where: {
                    status: 'Approve'
                }, raw: true
            });

            res.render('banking/edit', {
                bankingDetail, schools, errors,
                messages: {
                    success: req.flash('success'),
                    error: req.flash('error')
                }
            });
        } catch (error) {
            console.error("Error loading banking detail for edit:", error);
            res.status(500).send('Error loading banking detail for edit');
        }
    });

    /**
     * Update banking detail
     */


    app.post('/banking/update/:id', [
        body('bank_name').notEmpty().withMessage('Bank name is required'),

        body('account_number')
            .notEmpty().withMessage('Account number is required')
            .custom(async (value, { req }) => {
                const existing = await models.BankingDetails.findOne({
                    where: { account_number: value, id: { [models.Sequelize.Op.ne]: req.params.id } }
                });
                if (existing) {
                    throw new Error('Account number must be unique');
                }
                return true;
            }),

        body('account_holder').notEmpty().withMessage('Account holder name is required'),

        body('school_id')
            .notEmpty().withMessage('School is required')
            .custom(async (value, { req }) => {
                const existing = await models.BankingDetails.findOne({
                    where: { school_id: value, id: { [models.Sequelize.Op.ne]: req.params.id } }
                });
                if (existing) {
                    throw new Error('School must be unique');
                }
                return true;
            }),

        body('status')
            .optional()
            .isIn(['0', '1']).withMessage('Invalid status value')
    ], async (req, res) => {
        const { id } = req.params;

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorized to access this page.');
            return res.redirect('/banking/index');
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('schools', { ...req.body, id: id });
            // req.session.oldInput = req.body; // Store old input values
            // req.session.errors = errors.mapped(); // Store validation errors
            return res.redirect(`/banking/edit/${id}`);
        }

        try {
            const bankingDetail = await models.BankingDetails.findByPk(id);
            if (!bankingDetail) {
                req.flash('error', 'Banking detail not found.');
                return res.redirect('/banking/index');
            }

            let ibanDocumentUrl = bankingDetail.iban_document;

            // 🛠 Handle file upload validation
            if (req.files && req.files.iban_document) {
                const file = req.files.iban_document;
                const ext = path.extname(file.name).toLowerCase();
                const allowedExtensions = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif'];
                const maxFileSize = 5 * 1024 * 1024; // 5MB

                // if (!allowedExtensions.includes(ext)) {
                //     req.flash('error', 'Invalid file type. Only PDF, DOC, and DOCX allowed.');
                //     return res.redirect(`/banking/edit/${id}`);
                // }
                if (!allowedExtensions.includes(ext)) {
                    req.flash('errors', { iban_document: { msg: 'Invalid file type. Only PNG, JPG, JPEG, PDF, DOC and DOCX allowed.' } });
                    req.flash('schools', req.body);
                    return res.redirect(`/schools/edit/${school_id}`);
                }

                if (file.size > maxFileSize) {
                    // req.flash('error', 'File size must be under 5MB.');
                    req.flash('errors', { iban_document: { msg: 'File size must be under 5MB.' } });
                    req.flash('schools', req.body);
                    return res.redirect(`/banking/edit/${id}`);
                }

                // Generate unique filename
                const baseName = path.basename(file.name, ext);
                const ibanDocumentName = `${baseName}-${Date.now()}${ext}`;
                const uploadDir = path.join(__dirname, '../public/banking/ibanDoc/');
                const uploadPath = path.join(uploadDir, ibanDocumentName);

                // Create directory if not exists
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                // Move file using async/await
                await file.mv(uploadPath);

                // Delete old file if exists
                if (ibanDocumentUrl && fs.existsSync(path.join(__dirname, `../public${ibanDocumentUrl}`))) {
                    fs.unlinkSync(path.join(__dirname, `../public${ibanDocumentUrl}`));
                }

                ibanDocumentUrl = `/banking/ibanDoc/${ibanDocumentName}`;
            }

            // 🛠 Update banking details
            await bankingDetail.update({
                bank_name: req.body.bank_name,
                account_number: req.body.account_number,
                account_holder: req.body.account_holder,
                school_id: req.body.school_id,
                iban_document: ibanDocumentUrl,
                status: req.body.status || 1
            });

            req.flash('success', 'Banking detail updated successfully.');
            res.redirect('/banking/index');

        } catch (error) {
            console.error("Error updating banking detail:", error);
            req.flash('error', 'Error updating banking detail. Please try again.');
            res.redirect(`/banking/edit/${id}`);
        }
    });


    /**
     * Delete banking detail
     */
    app.delete('/banking/delete/:id', async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                return res.json({ success: false, message: 'Please login to continue' });
            }

            if (req.user.role.name !== "SuperAdmin") {
                return res.json({ success: false, message: 'You are not authorized to access this page.' });
            }

            const { id } = req.params;
            await models.BankingDetails.destroy({ where: { id } });

            return res.json({ success: true, message: 'Banking detail deleted successfully.' });
        } catch (error) {
            return res.json({ success: false, message: error.message });
        }
    });
};
