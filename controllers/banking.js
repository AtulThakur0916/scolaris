const models = require('../models');
const { body, validationResult } = require('express-validator');
const path = require('path');

module.exports = function (app) {

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
                attributes: ['id', 'bank_name', 'account_number', 'account_holder', 'iban_document'],
                include: [{ model: models.Schools, as: 'school', attributes: ['name'] }],
                order: [['bank_name', 'ASC']],
                nest: true
            });

            res.render('banking/index', {
                bankingDetails,
                success: req.flash('success'),
                error: req.flash('error')
            });
        } catch (error) {
            console.error("Error fetching banking details:", error);
            req.flash('error', 'Failed to load banking details.');
            res.redirect('/');
        }
    });

    /**
     * View banking detail
     */
    app.get('/banking/view/:id', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorized to access this page.');
            return res.redirect('/');
        }

        try {
            const bankingDetail = await models.BankingDetails.findOne({
                where: { id: req.params.id },
                include: [{ model: models.Schools, as: 'school', attributes: ['name'] }],
            });

            if (!bankingDetail) {
                req.flash('error', 'Banking detail not found.');
                return res.redirect('/banking/index');
            }

            res.render('banking/view', { bankingDetail });
        } catch (error) {
            console.error("Error fetching banking detail:", error);
            req.flash('error', 'Failed to load banking detail.');
            res.redirect('/banking/index');
        }
    });

    /**
     * Create banking detail form
     */
    app.get('/banking/create/:id?', async (req, res) => {
        try {
            const { id } = req.params;
            let bankingDetail = null;
            const schools = await models.Schools.findAll({ attributes: ['id', 'name'], raw: true });

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
        body('bank_name').notEmpty().withMessage('Bank name is required'),
        body('account_number').notEmpty().withMessage('Account number is required'),
        body('account_holder').notEmpty().withMessage('Account holder name is required'),
        body('school_id').notEmpty().withMessage('School is required'),
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

        let ibanDocumentUrl = null;

        if (req.files && req.files.iban_document) {
            try {
                let file = req.files.iban_document;
                let fileName = file.name.split('.').join('-' + Date.now() + '.');
                let uploadPath = path.join(__dirname, '../public/uploads/', fileName);

                await file.mv(uploadPath);
                ibanDocumentUrl = `/uploads/${fileName}`;
            } catch (err) {
                console.error("Error uploading IBAN document:", err);
                req.flash('error', 'Error uploading IBAN document. Please try again.');
                return res.redirect('/banking/create');
            }
        }

        try {
            await models.BankingDetails.create({
                ...req.body,
                iban_document: ibanDocumentUrl
            });

            req.flash('success', 'Banking detail added successfully.');
            res.redirect('/banking/index');
        } catch (error) {
            console.error("Error creating banking detail:", error);
            req.flash('error', 'Error creating banking detail. Please try again.');
            res.redirect('/banking/create');
        }
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

            const schools = await models.Schools.findAll({ attributes: ['id', 'name'], raw: true });

            res.render('banking/edit', { bankingDetail, schools });
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
        body('account_number').notEmpty().withMessage('Account number is required'),
        body('account_holder').notEmpty().withMessage('Account holder name is required'),
        body('school_id').notEmpty().withMessage('School is required'),
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
            return res.redirect(`/banking/edit/${id}`);
        }

        try {
            const [updated] = await models.BankingDetails.update(req.body, { where: { id } });

            if (updated) {
                req.flash('success', 'Banking detail updated successfully.');
            } else {
                req.flash('error', 'No changes were made.');
            }

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
