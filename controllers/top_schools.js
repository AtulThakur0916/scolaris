const models = require('../models');
const { body, validationResult } = require('express-validator');

module.exports.controller = function (app) {
    /**
     * Render Top Schools Index Page
     */
    app.get('/top-schools/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/login');
        }

        try {
            const topSchools = await models.TopSchool.findAll({
                include: [
                    {
                        model: models.Schools,
                        as: 'school',
                        attributes: ['id', 'name', 'phone_number', 'email', 'location']
                    }
                ],
                order: [['created_at', 'DESC']]
            });

            const plainTopSchools = topSchools.map((school) => school.get({ plain: true }));

            res.render('topSchools/index', {
                topSchools: plainTopSchools,
                success: res.locals.success,
                error: res.locals.error
            });
        } catch (error) {
            console.error('Error fetching top schools:', error);
            req.flash('error', 'Failed to load top schools.');
            res.redirect('/');
        }
    });

    /**
     * Render Add Top School Page
     */
    app.get('/top-schools/create', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/login');
        }

        try {
            const schools = await models.Schools.findAll({
                attributes: ['id', 'name'],
                where: {
                    status: 'Approve'
                },
                order: [['name', 'ASC']]
            });

            const plainSchools = schools.map((school) => school.get({ plain: true }));

            const errors = req.flash('errors')[0] || {};
            const formData = req.flash('topSchool')[0] || {};

            res.render('topSchools/create', { topSchool: formData, errors, schools: plainSchools });
        } catch (error) {
            console.error('Error loading add top school page:', error);
            req.flash('error', 'Failed to load schools.');
            res.redirect('/top-schools/index');
        }
    });

    /**
     * Handle Add Top School
     */
    app.post('/top-schools/create', [
        body('school_id').notEmpty().withMessage('School ID is required.')
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('topSchool', req.body);
            return res.redirect('/top-schools/create');
        }

        const { school_id } = req.body;

        try {
            const existingTopSchool = await models.TopSchool.findOne({ where: { school_id } });
            if (existingTopSchool) {
                req.flash('error', 'This school is already in the top schools list.');
                return res.redirect('/top-schools/index');
            }

            await models.TopSchool.create({ school_id });
            req.flash('success', 'School added to top schools successfully.');
            res.redirect('/top-schools/index');
        } catch (error) {
            console.error('Error adding top school:', error);
            req.flash('error', 'Failed to add top school.');
            res.redirect('/top-schools/create');
        }
    });

    /**
     * Render Edit Top School Page
     */
    app.get('/top-schools/edit/:id', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue.');
            return res.redirect('/login');
        }

        const { id } = req.params;

        try {
            // Fetch Top School by ID
            const topSchool = await models.TopSchool.findByPk(id);
            if (!topSchool) {
                req.flash('error', 'Top School not found.');
                return res.redirect('/top-schools/index');
            }

            // Fetch all schools for dropdown
            const schools = await models.Schools.findAll({
                attributes: ['id', 'name'],
                where: {
                    status: 'Approve'
                },
                order: [['name', 'ASC']]
            });

            const plainSchools = schools.map((school) => school.get({ plain: true }));

            const errors = req.flash('errors')[0] || {};
            const formData = req.flash('topSchool')[0] || {};

            res.render('topSchools/edit', {
                topSchool: formData.id ? formData : topSchool.get({ plain: true }),
                errors,
                schools: plainSchools
            });
        } catch (error) {
            console.error('Error loading edit top school page:', error);
            req.flash('error', 'Failed to load top school.');
            res.redirect('/top-schools/index');
        }
    });

    /**
     * Handle Update Top School
     */
    app.post('/top-schools/update/:id', [
        body('school_id').notEmpty().withMessage('School ID is required.')
    ], async (req, res) => {
        const { id } = req.params;
        const { school_id } = req.body;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('errors', errors.mapped());
            req.flash('topSchool', req.body);
            return res.redirect(`/top-schools/edit/${id}`);
        }

        try {
            const topSchool = await models.TopSchool.findByPk(id);
            if (!topSchool) {
                req.flash('error', 'Top School not found.');
                return res.redirect('/top-schools/index');
            }

            // Check for duplicate school_id in top schools
            const existingTopSchool = await models.TopSchool.findOne({
                where: { school_id, id: { [models.Sequelize.Op.ne]: id } }
            });

            if (existingTopSchool) {
                req.flash('error', 'This school is already in the top schools list.');
                return res.redirect('/top-schools/index');
            }

            // Update the Top School
            await topSchool.update({ school_id });

            req.flash('success', 'Top School updated successfully.');
            res.redirect('/top-schools/index');
        } catch (error) {
            console.error('Error updating top school:', error);
            req.flash('error', 'Failed to update top school.');
            res.redirect(`/top-schools/edit/${id}`);
        }
    });


    /**
     * Handle Remove Top School
     */
    app.post('/top-schools/delete/:id', async (req, res) => {
        if (!req.isAuthenticated()) {
            return res.status(403).json({ success: false, message: 'Unauthorized. Please log in.' });
        }

        try {
            const topSchool = await models.TopSchool.findByPk(req.params.id);
            if (!topSchool) {
                return res.status(404).json({ success: false, message: 'Top School not found.' });
            }

            await topSchool.destroy();
            req.flash('success', 'School removed from top schools.');
            res.redirect('/top-schools/index');
        } catch (error) {
            console.error('Error removing top school:', error);
            req.flash('error', 'Failed to remove top school.');
            res.redirect('/top-schools/index');
        }
    });
};
