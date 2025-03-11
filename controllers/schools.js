const models = require('../models');
const async = require('async');  // ✅ Import the async module
const waterfall = require('async-waterfall');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { Op } = require("sequelize");  // Add this line at the top

module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

  /**
   * Render view for managing schools
   */
  app.get('/schools/index', async (req, res) => {
    if (!req.isAuthenticated()) {
      req.flash('error', 'Please login to continue');
      return res.redirect('/login');
    }

    if (req.user.role.name !== "SuperAdmin") {
      req.flash('error', 'You are not authorised to access this page.');
      return res.redirect('/');
    }

    try {
      const schools = await models.Schools.findAll({
        attributes: ['id', 'name', 'location', 'phone_number', 'email', 'logo', 'status'],
        raw: true,
        order: [['name', 'ASC']]
      });

      res.render('schools/index', {
        schools,
        success: res.locals.success,
        error: res.locals.error
      });
    } catch (error) {
      console.error("Error fetching schools:", error);
      req.flash('error', 'Failed to load schools.');
      res.redirect('/');
    }
  });

  /**
   * View school details
   */
  app.get('/schools/view/:school_id', async (req, res) => {
    const { school_id } = req.params;

    if (!req.isAuthenticated()) {
      req.flash('error', 'Please login to continue');
      return res.redirect('/login');
    }

    if (req.user.role.name !== "SuperAdmin") {
      req.flash('error', 'You are not authorised to access this page.');
      return res.redirect('/');
    }

    const school = await models.Schools.findOne({ where: { id: school_id } });
    if (!school) {
      req.flash('error', 'School not found');
      return res.redirect('/schools/index');
    }

    res.render('schools/view', { school });
  });

  /**
   * Create or edit school
   */
  app.get('/schools/create/:school_id?', async (req, res) => {
    try {
      const { school_id } = req.params;
      let school = null;

      if (school_id) {
        school = await models.Schools.findOne({ where: { id: school_id }, raw: true });
      }

      // res.render('schools/create', { school });
      // Retrieve flash messages
      const errors = req.flash('errors')[0] || {};
      const formData = req.flash('school')[0] || {};

      // Merge old input with existing school data
      // const schoolData = { ...school, ...formData };
      const schoolData = { ...school, ...formData };

      res.render('schools/create', {
        school: schoolData,
        errors,
        messages: {
          success: req.flash('success'),
          error: req.flash('error')
        }
      });

    } catch (error) {
      console.error('Error in /schools/create:', error);
      res.status(500).send('Error loading school data');
    }
  });




  app.post('/schools/create', [
    body('name').notEmpty().withMessage('School name is required'),
    body('location').notEmpty().withMessage('Location is required'),
    body('phone_number')
      .isMobilePhone().withMessage('Invalid phone number')
      .custom(async (phone_number) => {
        const existingSchool = await models.Schools.findOne({ where: { phone_number } });
        if (existingSchool) {
          throw new Error('A school with this phone number already exists.');
        }
      }),
    body('email')
      .isEmail().withMessage('Invalid email address')
      .custom(async (email) => {
        const existingSchool = await models.Schools.findOne({ where: { email } });
        if (existingSchool) {
          throw new Error('A school with this email already exists.');
        }
      }),
    body('type').notEmpty().withMessage('School type is required'),
  ], async (req, res) => {
    if (!req.isAuthenticated()) {
      req.flash('error', 'Please login to continue.');
      return res.redirect('/login');
    }

    if (req.user.role.name !== "SuperAdmin") {
      req.flash('error', "You are not authorised to access this page.");
      return res.redirect('/schools/index');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('schools/create', {
        schoolData: req.body,
        errors: errors.mapped()
      });
    }

    const { name, location, phone_number, email, type } = req.body;

    waterfall([
      async function (done) {
        if (req.files && req.files.logo) {
          let file = req.files.logo;
          let ext = path.extname(file.name).toLowerCase();
          let baseName = path.basename(file.name, ext);
          let logoName = `${baseName}-${Date.now()}${ext}`;
          let uploadDir = path.join(__dirname, '../public/uploads/schools/');
          let uploadPath = path.join(uploadDir, logoName);

          // Validate file type
          const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];

          if (!allowedExtensions.includes(ext)) {
            req.flash('errors', { logo: { msg: 'Only PNG, JPG, JPEG, and GIF files are allowed.' } });
            req.flash('schoolData', req.body);
            return res.redirect(`/schools/create`);
          }

          // Validate file size (max 2MB)
          if (file.size > 5 * 1024 * 1024) {
            // return done(new Error('Logo size must be less than 2MB.'));
            req.flash('errors', { logo: { msg: 'Logo size must be under 5MB.' } });
            req.flash('schoolData', req.body);
            return res.redirect(`/schools/create`);
          }

          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          file.mv(uploadPath, function (err) {
            if (err) {
              return done(err);
            }
            done(null, `/uploads/schools/${logoName}`);
          });
        } else {
          done(null, null);
        }
      },
      async function (logoUrl, done) {
        try {
          let schoolData = logoUrl
            ? { name, location, phone_number, email, type, logo: logoUrl }
            : { name, location, phone_number, email, type };

          await models.Schools.create(schoolData);
          req.flash('success', 'School created successfully.');
          done(null);
        } catch (error) {
          done(error);
        }
      }
    ], function (err) {
      if (err) {
        console.error('Error creating school:', err);
        req.flash('error', err.message || 'School not created.');
        return res.redirect('/schools/create');
      }
      res.redirect('/schools/index');
    });
  });




  /**
  * Edit school details page
  */
  app.get('/schools/edit/:school_id?', async (req, res) => {
    try {
      const { school_id } = req.params;
      let school = null;

      if (school_id) {
        school = await models.Schools.findOne({ where: { id: school_id }, raw: true });
      }

      // Retrieve flash messages
      const errors = req.flash('errors')[0] || {};
      const formData = req.flash('school')[0] || {};

      // Merge old input with existing school data
      const schoolData = { ...school, ...formData };

      res.render('schools/edit', {
        school: schoolData,
        errors,
        messages: {
          success: req.flash('success'),
          error: req.flash('error')
        }
      });
    } catch (error) {
      console.error('Error loading school edit page:', error);
      res.status(500).send('Error loading school data');
    }
  });

  /**
  * Update school details
  */
  app.post('/schools/update/:school_id', [
    body('name').trim().notEmpty().withMessage('School name is required.'),
    body('type').trim().notEmpty().withMessage('School type is required.'),
    body('phone_number')
      .isMobilePhone().withMessage('Invalid phone number')
      .custom(async (value, { req }) => {
        const existingSchool = await models.Schools.findOne({
          where: { phone_number: value, id: { [Op.ne]: req.params.school_id } }
        });
        if (existingSchool) {
          throw new Error('A school with this phone number already exists.');
        }
      }),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Invalid email format.')
      .custom(async (value, { req }) => {
        const existingSchool = await models.Schools.findOne({
          where: { email: value, id: { [Op.ne]: req.params.school_id } }
        });
        if (existingSchool) {
          throw new Error('Email is already in use.');
        }
        return true;
      }),
    body('location').trim().notEmpty().withMessage('Location is required.')
  ], async (req, res) => {
    if (!req.isAuthenticated()) {
      req.flash('error', 'Please login to continue.');
      return res.redirect('/login');
    }

    if (req.user.role.name !== "SuperAdmin") {
      req.flash('error', "You are not authorized to access this page.");
      return res.redirect('/schools/index');
    }

    const { school_id } = req.params;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      req.flash('errors', errors.mapped());
      req.flash('school', { ...req.body, id: school_id });
      return res.redirect(`/schools/edit/${school_id}`);
    }

    try {
      const { name, location, phone_number, email, type } = req.body;
      const school = await models.Schools.findByPk(school_id);

      if (!school) {
        req.flash('error', 'School not found.');
        return res.redirect('/schools/index');
      }

      let logoUrl = school.logo;

      if (req.files && req.files.logo) {
        const file = req.files.logo;
        const ext = path.extname(file.name).toLowerCase();
        const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif'];

        if (!allowedExtensions.includes(ext)) {
          req.flash('errors', { logo: { msg: 'Only PNG, JPG, JPEG, and GIF files are allowed.' } });
          req.flash('school', req.body);
          return res.redirect(`/schools/edit/${school_id}`);
        }

        if (file.size > 5 * 1024 * 1024) {
          req.flash('errors', { logo: { msg: 'Logo size must be under 5MB.' } });
          req.flash('school', req.body);
          return res.redirect(`/schools/edit/${school_id}`);
        }

        const logoName = `school-${Date.now()}${ext}`;
        const uploadDir = path.join(__dirname, '../public/uploads/schools/');
        const uploadPath = path.join(uploadDir, logoName);

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        await file.mv(uploadPath);

        if (school.logo && school.logo !== '/uploads/schools/default-placeholder.png') {
          const oldLogoPath = path.join(__dirname, '../public', school.logo);
          if (fs.existsSync(oldLogoPath)) {
            fs.unlinkSync(oldLogoPath);
          }
        }

        logoUrl = `/uploads/schools/${logoName}`;
      }

      await models.Schools.update(
        { name, location, phone_number, email, type, logo: logoUrl },
        { where: { id: school_id } }
      );

      req.flash('success', 'School updated successfully.');
      return res.redirect('/schools/index');
    } catch (error) {
      console.error('Error updating school:', error);
      req.flash('error', 'Error updating school. Please try again.');
      return res.redirect(`/schools/edit/${school_id}`);
    }
  });
  /**
   * Delete school
   */
  app.delete('/schools/delete/:id', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.json({ success: false, message: 'Please login to continue' });
      }

      if (req.user.role.name !== "SuperAdmin") {
        return res.json({ success: false, message: 'You are not authorised to access this page.' });
      }

      const { id } = req.params;
      const school = await models.Schools.findOne({ where: { id } });

      if (!school) {
        return res.json({ success: false, message: 'School not found.' });
      }

      await models.Schools.destroy({ where: { id } });
      return res.json({ success: true, message: 'School deleted successfully.' });
    } catch (error) {
      return res.json({ success: false, message: error.message });
    }
  });

  app.patch('/schools/status/:school_id', async (req, res) => {
    await console.log(req.body);
    const { school_id } = req.params;
    const { status } = req.body;

    if (!req.isAuthenticated()) {
      return res.status(403).json({ message: 'Unauthorized. Please log in.' });
    }

    if (req.user.role.name !== "SuperAdmin") {
      return res.status(403).json({ message: 'Permission denied.' });
    }

    const validStatuses = ['Approve', 'Reject', 'Pending'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    try {
      const school = await models.Schools.findOne({ where: { id: school_id } });
      console.log(school);
      if (!school) {
        return res.status(404).json({ message: 'School not found.' });
      }

      await school.update({ status });

      return res.json({ message: 'Status updated successfully.' });
    } catch (error) {
      console.error('Error updating status:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  });


};
