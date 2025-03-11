const models = require('../models');
const waterfall = require('async-waterfall');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');

module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

    /**
     * Render view for managing classes
     */
    app.get('/classes/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const classes = await models.Classes.findAll({
                attributes: ['id', 'name', 'school_id', 'status'],
                include: [{ model: models.Schools, as: 'school', attributes: ['name'] }],
                raw: true,
                order: [['name', 'ASC']],
                nest: true
            });


            res.render('classes/index', {
                classes,
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
     * View class details
     */
    app.get('/classes/view/:class_id', async (req, res) => {
        const { class_id } = req.params;

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        const classData = await models.Classes.findOne({
            where: { id: class_id },
            include: [{ model: models.Schools, as: 'school', attributes: ['name'] }]
        });

        if (!classData) {
            req.flash('error', 'Class not found');
            return res.redirect('/classes/index');
        }

        res.render('classes/view', { classData });
    });

    /**
     * Create or edit class
     */
    app.get('/classes/create/:class_id?', async (req, res) => {
        try {
            const { class_id } = req.params;
            let classData = null;
            const schools = await models.Schools.findAll({ attributes: ['id', 'name'], raw: true });

            if (class_id) {
                classData = await models.Classes.findOne({ where: { id: class_id }, raw: true });
            }

            res.render('classes/create', {
                classData, schools, success: res.locals.success,
                error: res.locals.error,

            });
        } catch (error) {
            console.error('Error in /classes/create:', error);
            res.status(500).send('Error loading class data');
        }
    });


    app.post('/classes/create', [
        body('name').notEmpty().withMessage('Class name is required'),
        body('school_id').notEmpty().withMessage('Please select a school'),
        body('status').isIn(['0', '1']).withMessage('Invalid status')
    ], async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                req.flash('error', 'Please login to continue');
                return res.redirect('/login');
            }

            if (req.user.role.name !== "SuperAdmin") {
                req.flash('error', "You are not authorised to access this page.");
                return res.redirect('/classes/index');
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const errorMessages = errors.array().map(error => error.msg);
                req.flash('error', errorMessages);
                return res.render('classes/create', {
                    error: errorMessages,
                    classData: req.body, // Store old input values
                    schools: await models.Schools.findAll({ attributes: ['id', 'name'], raw: true })
                });
            }

            const { name, school_id, status } = req.body;

            // Check for duplicate class name in the same school
            const existingClass = await models.Classes.findOne({ where: { name, school_id } });
            if (existingClass) {
                req.flash('error', ['A class with this name already exists for the selected school.']);
                return res.render('classes/create', {
                    error: ['A class with this name already exists for the selected school.'],
                    classData: req.body, // Retain old input values
                    schools: await models.Schools.findAll({ attributes: ['id', 'name'], raw: true })
                });
            }

            // Create new class
            await models.Classes.create({ name, school_id, status });
            req.flash('success', 'Class created successfully.');
            return res.redirect('/classes/index');

        } catch (error) {
            console.error('Error creating class:', error);
            req.flash('error', ['Class not created due to an error.']);
            res.redirect('/classes/create');
        }
    });


    app.get('/classes/edit/:class_id?', async (req, res) => {
        try {
            const { class_id } = req.params;
            let classData = null;
            const schools = await models.Schools.findAll({ attributes: ['id', 'name'], raw: true });

            if (class_id) {
                classData = await models.Classes.findOne({ where: { id: class_id }, raw: true });
            }

            // Retrieve old input and errors from flash messages
            const oldData = req.flash('oldData')[0] || {};
            const errors = req.flash('errors')[0] || [];

            res.render('classes/edit', {
                classData: { ...classData, ...oldData }, // Merge old input with class data
                schools,
                errors,
                messages: {
                    success: res.locals.success,
                    error: res.locals.error
                }
            });

        } catch (error) {
            console.error('Error loading class edit page:', error);
            res.status(500).send('Error loading class data');
        }
    });


    /**
     * Update class details
     */


    app.post('/classes/update/:class_id', [
        body('name').notEmpty().withMessage('Class name is required'),
        body('school_id').notEmpty().withMessage('Please select a school')
    ], async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                req.flash('error', 'Please login to continue');
                return res.redirect('/login');
            }

            if (req.user.role.name !== "SuperAdmin") {
                req.flash('error', "You are not authorised to access this page.");
                return res.redirect('/classes/index');
            }

            const { class_id } = req.params;
            const { name, school_id, status } = req.body;

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const errorMessages = errors.array().map(error => error.msg);
                req.flash('errors', errorMessages);
                req.flash('oldData', { name, school_id, status });

                return res.redirect(`/classes/edit/${class_id}`);
            }

            // Check if class name already exists in the same school, excluding the current class
            const existingClass = await models.Classes.findOne({
                where: { name, school_id, id: { [models.Sequelize.Op.ne]: class_id } }
            });

            if (existingClass) {
                req.flash('error', 'A class with this name already exists for the selected school.');
                req.flash('oldData', { name, school_id, status });

                return res.redirect(`/classes/edit/${class_id}`);
            }

            // Update the class
            const [rowsUpdated] = await models.Classes.update({ name, school_id, status }, { where: { id: class_id } });

            if (rowsUpdated) {
                req.flash('success', 'Class updated successfully.');
            } else {
                req.flash('error', 'No changes were made.');
            }

            return res.redirect('/classes/index');

        } catch (error) {
            console.error('Error updating class:', error);
            req.flash('error', 'Error updating class.');
            return res.redirect(`/classes/edit/${class_id}`);
        }
    });




    /**
     * Delete class
     */
    app.delete('/classes/delete/:id', async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                return res.json({ success: false, message: 'Please login to continue' });
            }

            if (req.user.role.name !== "SuperAdmin") {
                return res.json({ success: false, message: 'You are not authorised to access this page.' });
            }

            const { id } = req.params;
            const classData = await models.Classes.findOne({ where: { id } });

            if (!classData) {
                return res.json({ success: false, message: 'Class not found.' });
            }

            await models.Classes.destroy({ where: { id } });
            return res.json({ success: true, message: 'Class deleted successfully.' });
        } catch (error) {
            return res.json({ success: false, message: error.message });
        }
    });

    /**
     * Update class status
     */
    app.patch('/classes/status/:class_id', async (req, res) => {
        const { class_id } = req.params;
        const { status } = req.body;

        if (!req.isAuthenticated()) {
            return res.status(403).json({ message: 'Unauthorized. Please log in.' });
        }

        if (req.user.role.name !== "SuperAdmin") {
            return res.status(403).json({ message: 'Permission denied.' });
        }

        try {
            const classData = await models.Classes.findOne({ where: { id: class_id } });

            if (!classData) {
                return res.status(404).json({ message: 'Class not found.' });
            }

            await classData.update({ status });

            return res.json({ message: 'Status updated successfully.' });
        } catch (error) {
            console.error('Error updating status:', error);
            return res.status(500).json({ message: 'Internal server error.' });
        }
    });

};
