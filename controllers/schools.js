const models = require('../models');
const waterfall = require('async-waterfall');
const path = require('path');
const moment = require('moment');
const multer = require('multer');
const fs = require('fs');

const uploadPath = 'public/uploads/schools';
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Rename file with timestamp
  }
});

// File filter for image validation
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Multer upload configuration with size limits
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});


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
   * Fetch schools data
   */
  app.post('/schools/data', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        req.flash('error', 'Please login to continue');
        return res.redirect('/login');
      }

      if (req.user.role.name !== "SuperAdmin") {
        req.flash('error', 'You are not authorised to access this page.');
        return res.redirect('/');
      }

      const schools = await models.Schools.findAll({
        raw: true,
        order: [['name', 'ASC']]
      });
      res.json(schools);
    } catch (error) {
      console.error('Error in /schools/data:', error);
      res.status(500).send('Error fetching schools data');
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

  /**
   * Save school (create/update)
   */
  app.post('/schools/create', async (req, res) => {
    const { name, location, phone_number, email, type } = req.body;
    // const logo = req.file ? req.file.filename : null;

    try {
      await models.Schools.create({ name, location, phone_number, email, type });
      req.flash('success', 'School created successfully.');
      res.redirect('/schools/index');
    } catch (error) {
      console.error('Error creating school:', error);

      if (error.name === 'SequelizeValidationError' && error.errors && error.errors.length > 0) {
        req.flash('error', error.errors.map(err => err.message).join(', '));
      } else {
        req.flash('error', 'An unexpected error occurred.');
      }

      res.redirect('/schools/create');
    }
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
  // Add this new route handler
  exports.getSchoolsData = async (req, res) => {
    try {
      const draw = parseInt(req.body.draw);
      const start = parseInt(req.body.start);
      const length = parseInt(req.body.length);
      const search = req.body.search.value;
      const orderColumn = req.body.order[0].column;
      const orderDir = req.body.order[0].dir;

      // Get column name from columns array
      const columns = ['id', 'name', 'location', 'phone_number', 'email', 'type']; // adjust based on your actual column names
      const orderColumnName = columns[orderColumn];

      // Build query
      let query = {};
      if (search) {
        query = {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        };
      }

      // Get total records count
      const totalRecords = await models.Schools.countDocuments();

      // Get filtered records count
      const filteredRecords = await models.Schools.countDocuments(query);

      // Get paginated records
      const schools = await models.Schools.find(query)
        .sort({ [orderColumnName]: orderDir === 'asc' ? 1 : -1 })
        .skip(start)
        .limit(length);

      res.json({
        draw: draw,
        recordsTotal: totalRecords,
        recordsFiltered: filteredRecords,
        data: schools
      });
    } catch (error) {
      console.error('Error fetching schools:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };
};
