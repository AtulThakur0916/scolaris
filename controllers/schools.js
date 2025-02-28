const models = require('../models');
const waterfall = require('async-waterfall');
const moment = require('moment');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

module.exports.controller = function (app) {

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
        attributes: ['id', 'name', 'location', 'phone_number', 'email'],
        raw: true,
        order: [['name', 'ASC']]
      });

      res.render('schools/index', {
        schools,
        success: req.flash('success'),
        error: req.flash('error')
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

      res.render('schools/create', { school });
    } catch (error) {
      console.error('Error in /schools/create:', error);
      res.status(500).send('Error loading school data');
    }
  });

  app.post('/schools/create', async (req, res) => {
    if (!req.isAuthenticated()) {
      req.flash('error', 'Please login to continue');
      return res.redirect('/login');
    }

    const { role } = req.user;
    if (role.name !== "SuperAdmin") {
      req.flash('error', "You are not authorised to access this page.");
      return res.redirect('/schools/index');
    }

    const { name, location, phone_number, email, type } = req.body;

    waterfall([
      async function (done) {
        if (req.files && req.files.logo) {
          let file = req.files.logo;
          let ext = path.extname(file.name); // Get file extension
          let baseName = path.basename(file.name, ext); // Get filename without extension
          let logoName = `${baseName}-${Date.now()}${ext}`; // Correct timestamped filename

          let uploadDir = path.join(__dirname, '../public/uploads/schools/'); // Ensure correct path
          let uploadPath = path.join(uploadDir, logoName);

          // Check if the directory exists, if not, create it
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          file.mv(uploadPath, function (err) {
            if (err) {
              return done(err);
            }
            // done(null, `https://lms.khabriya.in/uploads/schools/${logoName}`);
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
        req.flash('error', 'School not created.');
        return res.redirect('/schools/create');
      }
      res.redirect('/schools/index');
    });
  });





  /**
   * Update school details
   */
  app.post('/schools/update/:school_id', async (req, res) => {
    if (!req.isAuthenticated()) {
      req.flash('error', 'Please login to continue');
      return res.redirect('/login');
    }

    if (req.user.role.name !== "SuperAdmin") {
      req.flash('error', 'You are not authorised to access this page.');
      return res.redirect('/');
    }

    const { school_id } = req.params;
    const { name, address, status } = req.body;

    try {
      await models.Schools.update({ name, address, status }, { where: { id: school_id } });
      req.flash('success', 'School updated successfully.');
    } catch (error) {
      req.flash('error', 'Error updating school.');
    }

    res.redirect('/schools/index');
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

};
