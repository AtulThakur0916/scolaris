const models = require('../models');
const waterfall = require('async-waterfall');
const fs = require('fs');
const path = require('path');

module.exports = function (app) {

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
                order: [['name', 'ASC']]
            });


            res.render('classes/index', {
                classes,
                success: req.flash('success'),
                error: req.flash('error')
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

            res.render('classes/create', { classData, schools });
        } catch (error) {
            console.error('Error in /classes/create:', error);
            res.status(500).send('Error loading class data');
        }
    });

    app.post('/classes/create', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', "You are not authorised to access this page.");
            return res.redirect('/classes/index');
        }

        const { name, school_id, status, } = req.body;

        try {
            await models.Classes.create({ name, school_id, status });
            req.flash('success', 'Class created successfully.');
            res.redirect('/classes/index');
        } catch (error) {
            console.error('Error creating class:', error);
            req.flash('error', 'Class not created.');
            res.redirect('/classes/create');
        }
    });

    /**
     * Update class details
     */
    app.post('/classes/update/:class_id', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', "You are not authorised to access this page.");
            return res.redirect('/classes/index');
        }

        const { class_id } = req.params;
        const { name, school_id } = req.body;

        try {
            let rowsUpdated = await models.Classes.update({ name, school_id }, { where: { id: class_id } });

            if (rowsUpdated)
                req.flash('success', 'Class updated successfully.');

            res.redirect('/classes/index');
        } catch (error) {
            console.error('Error updating class:', error);
            req.flash('error', 'Error updating class.');
            res.redirect(`/classes/update/${class_id}`);
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
