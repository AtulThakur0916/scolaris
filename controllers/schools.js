const models = require('../models');
const { countries } = require('countries-list');
const waterfall = require('async-waterfall');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const xlsx = require('xlsx');
const { where } = require('sequelize');
const bcrypt = require('bcryptjs');
const { schoolReject, schoolApproval } = require('../helpers/zepto');
const paystack = require('../helpers/payment');
const { Op } = require('sequelize');
module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

  /**
   * Render view for managing schools
   */
  app.get('/schools/index', async (req, res) => {
    if (!req.isAuthenticated()) {
      req.flash('error', 'Please login to continue');
      return res.redirect('/login');
    }
    console.log(req.user.role.name);
    // Check for "SuperAdmin", "School", or "SubAdmin"
    if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School (Sub-Admin)" && req.user.role.name !== "Administrator") {
      req.flash('error', 'You are not authorised to access this page.');
      return res.redirect('/');
    }

    try {
      let schools;

      // If user is "School" or "SubAdmin", only fetch the school linked to the user
      if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
        schools = await models.Schools.findOne({
          where: { id: req.user.school_id },
          attributes: ['id', 'name', 'location', 'phone_number', 'email', 'logo', 'status'],
          raw: true
        });
        schools = schools ? [schools] : [];
      } else {
        // If the user is "SuperAdmin", fetch all schools
        schools = await models.Schools.findAll({
          attributes: ['id', 'name', 'location', 'phone_number', 'email', 'logo', 'status'],
          raw: true,
          order: [['created_at', 'DESC']],
        });
      }

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
      const countryList = Object.entries(countries).map(([code, country]) => ({
        code,
        name: country.name,
        flag: `https://flagcdn.com/w40/${code.toLowerCase()}.png`
      }));
      // Merge old input with existing school data
      // const schoolData = { ...school, ...formData };
      const schoolData = { ...school, ...formData };

      res.render('schools/create', {
        school: schoolData,
        errors,
        countries: countryList,
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
    body('name')
      .notEmpty().withMessage('School name is required')
      .isLength({ max: 40 }).withMessage('School name must not exceed 40 characters'),
    body('location').notEmpty().withMessage('Address is required'),
    body('city').notEmpty().withMessage('Town is required'),
    body('country').notEmpty().withMessage('Country is required'),
    body('state').notEmpty().withMessage('Region is required'),
    body('phone_number')
      .isMobilePhone().withMessage('Invalid phone number')
      .custom(async (phone_number) => {
        const existingSchool = await models.Schools.findOne({ where: { phone_number } });
        if (existingSchool) throw new Error('A school with this phone number already exists.');
      }),
    body('email')
      .isEmail().withMessage('Invalid email address')
      .custom(async (email) => {
        const existingSchool = await models.Schools.findOne({ where: { email } });
        if (existingSchool) {
          throw new Error('A school with this email already exists.');
        }

        const existingUser = await models.Users.findOne({ where: { email } });
        if (existingUser) {
          throw new Error('A user with this email already exists.');
        }

        return true;
      }),

    body('type').notEmpty().withMessage('School type is required')
  ], async (req, res) => {
    if (!req.isAuthenticated()) {
      req.flash('error', 'Please login to continue.');
      return res.redirect('/login');
    }

    if (req.user.role.name !== 'SuperAdmin') {
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

    const { name, location, phone_number, email, type, city, state, country } = req.body;
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf'];
    waterfall([
      function (done) {
        const uploadDir = path.join(__dirname, '../public/uploads/schools/');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        let logoPath = null;
        let docPath = null;

        const handleFile = (fileKey, callback) => {
          if (req.files && req.files[fileKey]) {
            let file = req.files[fileKey];
            let ext = path.extname(file.name).toLowerCase();

            if (!allowedExtensions.includes(ext)) {
              return callback(new Error(`Invalid file type for ${fileKey}.`));
            }

            if (file.size > 5 * 1024 * 1024) {
              return callback(new Error(`${fileKey} must be under 5MB.`));
            }

            let baseName = path.basename(file.name, ext);
            let fileName = `${baseName}-${Date.now()}${ext}`;
            let filePath = path.join(uploadDir, fileName);
            file.mv(filePath, (err) => {
              if (err) return callback(err);
              callback(null, `/uploads/schools/${fileName}`);
            });
          } else {
            callback(null, null);
          }
        };

        // Upload both logo and document
        handleFile('logo', (err, logoUrl) => {
          if (err) return done(err);
          logoPath = logoUrl;

          handleFile('school_doc', (err2, docUrl) => {
            if (err2) return done(err2);
            docPath = docUrl;
            done(null, { logo: logoPath, school_doc: docPath });
          });
        });
      },

      async function (fileUploads, done) {
        try {
          const schoolData = {
            name,
            location,
            phone_number,
            email,
            type,
            city,
            state,
            country,
            logo: fileUploads.logo,
            school_doc: fileUploads.school_doc
          };

          await models.Schools.create(schoolData);
          req.flash('success', 'School created successfully.');
          done(null);
        } catch (err) {
          done(err);
        }
      }
    ], function (err) {
      if (err) {
        console.error('Error creating school:', err.message);
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
      const countryList = Object.entries(countries).map(([code, country]) => ({
        code,
        name: country.name,
        flag: `https://flagcdn.com/w40/${code.toLowerCase()}.png`
      }));
      res.render('schools/edit', {
        school: schoolData,
        errors,
        countries: countryList,
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
    body('name')
      .notEmpty().withMessage('School name is required')
      .isLength({ max: 40 }).withMessage('School name must not exceed 40 characters'),
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
        // Exclude current school from check
        const existingSchool = await models.Schools.findOne({
          where: {
            email: value,
            id: { [Op.ne]: req.params.school_id }
          }
        });
        if (existingSchool) {
          throw new Error('Email is already in use by another school.');
        }

        // Also check if email exists in Users table
        const existingUser = await models.Users.findOne({
          where: { email: value }
        });
        if (existingUser) {
          throw new Error('Email is already in use by a user account.');
        }

        return true;
      }),
    // body('email')
    //   .trim()
    //   .notEmpty().withMessage('Email is required.')
    //   .isEmail().withMessage('Invalid email format.')
    //   .custom(async (value, { req }) => {
    //     const existingSchool = await models.Schools.findOne({
    //       where: { email: value, id: { [Op.ne]: req.params.school_id } }
    //     });
    //     if (existingSchool) {
    //       throw new Error('Email is already in use.');
    //     }
    //     return true;
    //   }),
    body('location').trim().notEmpty().withMessage('Location is required.')
  ], async (req, res) => {
    if (!req.isAuthenticated()) {
      req.flash('error', 'Please login to continue.');
      return res.redirect('/login');
    }

    if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "Administrator" && req.user.role.name !== "School (Sub-Admin)") {
      req.flash('error', "You are not authorized to access this page.");
      return res.redirect('/schools/index');
    }

    console.log(req.body);
    const { school_id } = req.params;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      req.flash('errors', errors.mapped());
      req.flash('school', { ...req.body, id: school_id });
      return res.redirect(`/schools/edit/${school_id}`);
    }

    try {
      const { name, location, phone_number, email, city, state, country, type } = req.body;

      let school;
      if (req.user.role.name === "School (Sub-Admin)" || req.user.role.name === "Administrator") {
        if (req.user.school_id !== school_id) {
          req.flash('error', 'You are not authorized to update this school.');
          return res.redirect('/schools/index');
        }
        school = await models.Schools.findOne({
          where: { id: req.user.school_id },
          attributes: ['id', 'name', 'location', 'phone_number', 'email', 'logo', 'status'],
          raw: true
        });
      } else {
        school = await models.Schools.findByPk(school_id);
      }

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

      let school_docUrl = school.school_doc;

      if (req.files && req.files.school_doc) {
        const file = req.files.school_doc;
        const ext = path.extname(file.name).toLowerCase();
        const allowedExtensions = ['.png', '.jpg', '.jpeg', '.pdf'];

        if (!allowedExtensions.includes(ext)) {
          req.flash('errors', { school_doc: { msg: 'Only PNG, JPG, JPEG, and PDF files are allowed.' } });
          req.flash('school', req.body);
          return res.redirect(`/schools/edit/${school_id}`);
        }

        if (file.size > 5 * 1024 * 1024) {
          req.flash('errors', { school_doc: { msg: 'Doc size must be under 5MB.' } });
          req.flash('school', req.body);
          return res.redirect(`/schools/edit/${school_id}`);
        }

        const docName = `school-${Date.now()}${ext}`;
        const uploadDir = path.join(__dirname, '../public/uploads/schools/');
        const uploadPath = path.join(uploadDir, docName);

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        await file.mv(uploadPath);

        if (school.school_doc && school.school_doc !== '/uploads/schools/default-placeholder.png') {
          const oldDocPath = path.join(__dirname, '../public', school.school_doc);
          if (fs.existsSync(oldDocPath)) {
            fs.unlinkSync(oldDocPath);
          }
        }

        school_docUrl = `/uploads/schools/${docName}`;
      }

      await models.Schools.update(
        { name, location, city, state, country, phone_number, email, type, logo: logoUrl, school_doc: school_docUrl },
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
    const { school_id } = req.params;
    const { status } = req.body;
    const REGISTRATION_FEE = 10000; // 10000 CFA

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
      const school = await models.Schools.findOne({
        where: { id: school_id }
      });

      if (!school) {
        return res.status(404).json({ message: 'School not found.' });
      }

      await school.update({ status });

      if (status === 'Approve' && school.subscription !== '1') {
        // Generate Paystack payment link
        const paystackRes = await paystack.transaction.initialize({
          email: school.email,
          amount: REGISTRATION_FEE * 100,
          metadata: {
            school_id: school.id,
            payment_type: 'registration_fee'
          },
          callback_url: `https://spay.ralhangroup.com/api/v1/verify-registration-payment`
        });

        // Send approval email with payment link
        await schoolApproval(school.email, {
          school_name: school.name,
          registration_fee: REGISTRATION_FEE,
          payment_url: paystackRes.data.authorization_url,
          subject: 'School Registration Approved - Payment Required'
        });

        return res.json({
          message: 'Status updated successfully.',
          payment_url: paystackRes.data.authorization_url
        });
      }

      if (status === 'Reject') {
        await schoolReject(school.email, {
          school_name: school.name,
          subject: 'School Registration Status Update'
        });
      }

      return res.json({
        message: 'Status updated successfully.'
      });

    } catch (error) {
      console.error('Error updating status:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  });


  app.post('/schools/import', async (req, res) => {

    if (!req.isAuthenticated()) {
      return res.status(403).json({ message: 'Unauthorized. Please log in.' });
    }

    if (req.user.role.name !== "SuperAdmin") {
      return res.status(403).json({ message: 'Permission denied.' });
    }

    if (!req.files || !req.files.excelFile) {
      req.flash('error', 'No file uploaded. Please upload an Excel file.');
      return res.redirect('/schools/index');
    }

    const excelFile = req.files.excelFile;
    const ext = path.extname(excelFile.name).toLowerCase();
    const allowedExtensions = ['.xlsx', '.xls'];

    if (!allowedExtensions.includes(ext)) {
      req.flash('error', 'Only Excel files (.xlsx, .xls) are allowed.');
      return res.redirect('/schools/index');
    }

    // Save file temporarily
    const uploadDir = path.join(__dirname, '../uploads/');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, `schools-import-${Date.now()}${ext}`);
    await excelFile.mv(filePath);

    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (sheetData.length === 0) {
      req.flash('error', 'Excel file is empty.');
      return res.redirect('/schools/index');
    }

    let skippedRecords = 0;

    try {
      for (const row of sheetData) {
        const { 'School Name': name, 'School Type': type, 'Phone Number': phone_number, Email: email, Location: location } = row;

        // Check if the school already exists
        // const existingSchool = await models.Schools.findOne({
        //   where: { [Op.or]: [{ phone_number }, { email }, { name }] },
        // });
        const existingSchool = await models.Schools.findOne({
          where: {
            [Op.or]: [
              { phone_number: String(phone_number) }, // Convert to string
              { email },
              { name }
            ]
          },
        });


        if (existingSchool) {
          skippedRecords++;
          continue;
        }

        // Create new school
        await models.Schools.create({
          name,
          location,
          phone_number,
          email,
          type
        });
      }

      req.flash('success', `Schools imported successfully. Skipped ${skippedRecords} duplicate records.`);
      res.redirect('/schools/index');
    } catch (error) {
      console.error('Error importing schools:', error);
      req.flash('error', 'Error importing schools. Please check the file format.');
      res.redirect('/schools/index');
    } finally {
      // Clean up uploaded file
      fs.unlinkSync(filePath);
    }
  });





  //web

  /**
   * Create or edit school
   */
  app.get('/web/school/add', async (req, res) => {
    try {
      let school = null;
      const errors = req.flash('errors')[0] || {};
      const formData = req.flash('school')[0] || {};
      const countryList = Object.entries(countries).map(([code, country]) => ({
        code,
        name: country.name,
        flag: `https://flagcdn.com/w40/${code.toLowerCase()}.png`
      }));
      // Merge old input with existing school data
      // const schoolData = { ...school, ...formData };
      const schoolData = { ...formData };

      res.render('web/schoolCreate', {
        school: schoolData,
        errors,
        layout: false,
        countries: countryList,
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

  app.post('/web/school/save', [
    // School validations
    body('name')
      .notEmpty().withMessage('School name is required')
      .isLength({ max: 40 }).withMessage('School name must not exceed 40 characters'),
    body('location').notEmpty().withMessage('Address is required'),
    body('city').notEmpty().withMessage('Town is required'),
    body('country').notEmpty().withMessage('Country is required'),
    body('state').notEmpty().withMessage('Region is required'),
    body('phone_number')
      .isMobilePhone().withMessage('Invalid school phone number')
      .custom(async (phone_number) => {
        const existing = await models.Schools.findOne({ where: { phone_number } });
        if (existing) throw new Error('A school with this phone number already exists.');
      }),
    body('email')
      .isEmail().withMessage('Invalid email address')
      .custom(async (email) => {
        const existingSchool = await models.Schools.findOne({ where: { email } });
        if (existingSchool) {
          throw new Error('A school with this email already exists.');
        }

        const existingUser = await models.Users.findOne({ where: { email } });
        if (existingUser) {
          throw new Error('A user with this email already exists.');
        }

        return true;
      }),
    body('type').notEmpty().withMessage('School type is required'),

    //   // Administrator validations
    body('admin_name').notEmpty().withMessage('Administrator name is required'),
    body('admin_email')
      .isEmail().withMessage('Invalid admin email')
      .custom(async (email) => {
        const existing = await models.Users.findOne({ where: { email } });
        if (existing) throw new Error('Administrator email already exists.');
      }),
    // body('admin_contact_person').notEmpty().withMessage('Contact person is required'),
    body('admin_phone')
      .isMobilePhone().withMessage('Invalid admin phone number')
      .custom(async (phone) => {
        const existing = await models.Users.findOne({ where: { phone } });
        if (existing) throw new Error('Administrator phone already exists.');
      }),
    body('admin_password')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

    //   // Banking validations
    body('bank_name')
      .notEmpty().withMessage('Bank name is required')
      .isLength({ min: 2 }).withMessage('Bank name must be at least 2 characters'),
    body('account_number')
      .notEmpty().withMessage('Account number is required')
      .isNumeric().withMessage('Account number must be numeric')
      .isLength({ min: 6 }).withMessage('Account number must be at least 6 digits'),
    // .custom(async (val) => {
    //   const existing = await models.BankingDetails.findOne({ where: { account_number: val } });
    //   if (existing) throw new Error('Bank account number already exists.');
    // }),
    body('account_holder')
      .notEmpty().withMessage('Account holder is required')
      .isLength({ min: 3 }).withMessage('Account holder must be at least 3 characters'),], async (req, res) => {
        const errors = validationResult(req);

        const countryList = Object.entries(countries).map(([code, country]) => ({
          code,
          name: country.name,
          flag: `https://flagcdn.com/w40/${code.toLowerCase()}.png`
        }));

        if (!errors.isEmpty()) {
          console.log(errors);
          return res.render('web/schoolCreate', {
            layout: false,
            countries: countryList,
            schoolData: req.body,
            errors: errors.mapped()
          });
        }

        try {
          delete req.session.schoolData;
          const {
            name, location, phone_number, email, type, city, state, country,
            admin_name, admin_email, admin_phone, admin_password, settlement_bank,
            bank_name, account_number, account_holder
          } = req.body;
          // if (req.body.email == req.body.admin_email) {
          //   const customErrors = {
          //     admin_email: {
          //       msg: 'Administrator email must be different from school email'
          //     }
          //   };
          //   req.flash('errors', customErrors);
          //   // req.flash('school', req.body);
          //   req.flash('schoolData', req.body);
          //   return res.redirect('/web/school/add');
          // }
          if (req.body.email == req.body.admin_email) {
            const customErrors = {
              admin_email: {
                msg: 'Administrator email must be different from school email'
              }
            };
            return res.render('web/schoolCreate', {
              layout: false,
              countries: countryList,
              schoolData: req.body,
              errors: customErrors
            });
          }

          let logoUrl = null;
          if (req.files && req.files.logo) {
            const file = req.files.logo;
            const ext = path.extname(file.name).toLowerCase();
            const allowed = ['.png', '.jpg', '.jpeg', '.gif'];
            if (!allowed.includes(ext)) throw new Error('Invalid logo type.');
            if (file.size > 5 * 1024 * 1024) throw new Error('Logo must be under 5MB.');
            const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
            const dir = path.join(__dirname, '../public/uploads/schools/');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, fileName);
            await file.mv(filePath);
            logoUrl = `/uploads/schools/${fileName}`;
          }

          let admin_idUrl = null;
          if (req.files && req.files.admin_id) {
            const file = req.files.admin_id;
            const ext = path.extname(file.name).toLowerCase();
            const allowed = ['.png', '.jpg', '.jpeg', '.pdf'];
            if (!allowed.includes(ext)) throw new Error('Invalid logo type.');
            if (file.size > 5 * 1024 * 1024) throw new Error('Administrator Id must be under 5MB.');
            const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
            const dir = path.join(__dirname, '../public/uploads/schools/');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, fileName);
            await file.mv(filePath);
            admin_idUrl = `/uploads/schools/${fileName}`;
          }
          let profile = null;
          if (req.files && req.files.profile_images) {
            const file = req.files.profile_images;
            const ext = path.extname(file.name).toLowerCase();
            const allowed = ['.png', '.jpg', '.jpeg', '.pdf'];
            if (!allowed.includes(ext)) throw new Error('Invalid Profile Image type.');
            if (file.size > 5 * 1024 * 1024) throw new Error('Profile Image must be under 5MB.');
            const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
            const dir = path.join(__dirname, '../public/uploads/profile/');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, fileName);
            await file.mv(filePath);
            profile = `/uploads/profile/${fileName}`;
          }

          let school_docUrl = null;
          if (req.files && req.files.school_doc) {
            const file = req.files.school_doc;
            const ext = path.extname(file.name).toLowerCase();
            const allowed = ['.png', '.jpg', '.pdf', '.jpeg'];
            if (!allowed.includes(ext)) throw new Error('Invalid logo type.');
            if (file.size > 5 * 1024 * 1024) throw new Error('School document must be under 5MB.');
            const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
            const dir = path.join(__dirname, '../public/uploads/schools/');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, fileName);
            await file.mv(filePath);
            school_docUrl = `/uploads/schools/${fileName}`;
          }

          let ibanUrl = null;
          if (req.files && req.files.iban_document) {
            const file = req.files.iban_document;
            const ext = path.extname(file.name).toLowerCase();
            const allowed = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
            if (!allowed.includes(ext)) throw new Error('Invalid IBAN document type.');
            if (file.size > 5 * 1024 * 1024) throw new Error('IBAN file must be under 5MB.');
            const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
            const dir = path.join(__dirname, '../public/banking/ibanDoc/');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, fileName);
            await file.mv(filePath);
            ibanUrl = `/banking/ibanDoc/${fileName}`;
          }
          const generateOtp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
          // const otp = 111111;
          // ✅ Store in session for later verification
          req.session.schoolData = {
            name, location, phone_number, email, city, state, country, type, logo: logoUrl, school_doc: school_docUrl,
            admin: {
              name: admin_name,
              email: admin_email,
              phone: admin_phone,
              password: admin_password,
              profile_images: profile,
              logo: admin_idUrl
            },
            banking: {
              settlement_bank,
              bank_name,
              account_number,
              account_holder,
              iban_document: ibanUrl
            },
            otp: generateOtp,
            otp_expires_at: Date.now() + 5 * 60 * 1000 // 5 min
          };
          // Send OTP via email
          await sendEmail(
            req.body.email,
            'Verify Your School Registration - OTP Code',
            `
              Dear User,
              Thank you for registering your school with us.
              Your One-Time Password (OTP) for verification is:
              ${generateOtp}
              This OTP is valid for 5 minutes. Please do not share it with anyone.
              If you did not initiate this request, please ignore this email.
            
              Best regards,
              The Scolaris Pay Admin Team
            `
          );

          return res.redirect('/web/school/verify/page');
          // return res.render('web/verify', { layout: false }); // or with layout if needed

        } catch (err) {
          console.error(err);
          req.flash('error', err.message || 'An error occurred.');
          return res.redirect('/web/schoolCreate');
        }
      });
  app.get('/web/school/verify/page', async (req, res) => {
    return res.render('web/verify', { layout: false })
  });
  app.post('/web/school/verify/save', async (req, res) => {
    const { otp } = req.body;
    const data = req.session.schoolData;

    if (!data) {
      req.flash('error', 'Session expired or invalid.');
      return res.redirect('/web/school/add');
    }

    if (Date.now() > data.otp_expires_at) {
      req.flash('error', 'OTP has expired. Please register again.');
      return res.redirect('/web/school/add');
    }

    if (parseInt(otp) !== data.otp) {
      req.flash('error', 'Invalid OTP. Please try again.');
      return res.redirect('/web/school/verify/page');
    }

    const t = await models.sequelize.transaction();
    try {
      // 1. Save school
      const newSchool = await models.Schools.create({
        name: data.name,
        location: data.location,
        phone_number: data.phone_number,
        email: data.email,
        city: data.city,
        state: data.state,
        country: data.country,
        type: data.type,
        logo: data.logo,
        school_doc: data.school_doc
      }, { transaction: t });

      // 2. Create admin user
      const hashedPassword = bcrypt.hashSync(data.admin.password, bcrypt.genSaltSync(10));
      const adminRole = await models.Roles.findOne({ where: { name: 'Administrator' } });

      await models.Users.create({
        name: data.admin.name,
        email: data.admin.email,
        phone: data.admin.phone,
        password: hashedPassword,
        role_id: adminRole.id,
        school_id: newSchool.id,
        logo: data.admin.logo,
        profile_images: data.admin.profile_images,
        status: 1
      }, { transaction: t });

      // 3. Create Paystack subaccount
      const paystackResponse = await paystack.subAccount.create({
        business_name: newSchool.name,
        account_number: data.banking.account_number,
        percentage_charge: 90,
        settlement_bank: data.banking.settlement_bank
      });

      if (!paystackResponse.status) {
        req.flash('error', paystackResponse.message);
        return res.redirect('/web/school/add');

        // throw new Error(paystackResponse.message || 'Failed to create subaccount in Paystack.');

        // throw new Error(paystackResponse.message || 'Failed to create subaccount in Paystack.');
      }


      const { id: paystack_id, subaccount_code } = paystackResponse.data;

      // 4. Save banking details
      await models.BankingDetails.create({
        bank_name: data.banking.bank_name,
        account_number: data.banking.account_number,
        account_holder: data.banking.account_holder,
        school_id: newSchool.id,
        iban_document: data.banking.iban_document,
        status: 1,
        business_name: newSchool.name,
        settlement_bank: data.banking.settlement_bank,
        subaccount_code,
        paystack_id
      }, { transaction: t });

      // 5. Finalize
      await t.commit();
      delete req.session.schoolData;

      await sendEmail(
        data.admin.email,
        'We\'ve Received Your Submission!',
        `
            Hi ${data.admin.name},

            Thanks for completing the submission! We've sent a confirmation email to the school's Administrator with everything needed to move forward.

            Your school details:
            - School Name: ${data.name}
            - Email: ${data.email}
            - Phone: ${data.phone_number}

            You can now log in to your administrator account using:
            - Email: ${data.admin.email}
            - Password:  ${data.admin.password}
            Please log in at: https://spay.ralhangroup.com/login
            Need help or didn't receive the email? Contact us at support@scolarispay.com

            Warm regards,
            Scolaris Pay Team
            `
      );
      await Promise.all([
        // Send to school email
        sendEmail(
          data.email,
          'School Registration Successful - Scolaris Pay',
          `
          Dear ${data.name},

          Your school has been successfully registered with Scolaris Pay. 
          
          School Details:
          - Name: ${data.name}
          - Email: ${data.email}
          - Phone: ${data.phone_number}
          - Location: ${data.location}
          You can now log in to your administrator account using:
          - Email: ${data.admin.email}
          - Password: ${data.admin.password}
          Please log in at: https://spay.ralhangroup.com/login
          
          If you have any questions, please contact our support team at support@scolarispay.com
          
          Best regards,
          Scolaris Pay Team
          `
        ),
        // Send to admin email
        sendEmail(
          data.admin.email,
          'Administrator Account Created - Scolaris Pay',
          `
          Dear ${data.admin.name},

          Your administrator account for ${data.name} has been created successfully.

          Login Details:
          - Email: ${data.admin.email}
          - Password: (the one you set during registration)
          
          Please log in at: https://spay.ralhangroup.com/login
          
          For security reasons, please change your password after your first login.
          
          If you need assistance, contact us at support@scolarispay.com
          
          Best regards,
          Scolaris Pay Team
          `
        )
      ]);
      req.flash('success', 'School saved successfully after verification.');
      return res.redirect('/web/school/verify/page');

    } catch (err) {
      console.error('Verification Save Error:', err);
      await t.rollback();
      req.flash('error', err.message || 'Verification failed.');
      return res.redirect('/web/school/verify/page');
    }
  });


  app.post('/web/school/verify/resend', async (req, res) => {
    const data = req.session.schoolData;

    if (!data) {
      req.flash('error', 'Session expired. Please start registration again.');
      return res.redirect('/web/school/add');
    }

    try {
      const newOtp = Math.floor(100000 + Math.random() * 900000);
      req.session.schoolData.otp = newOtp;
      req.session.schoolData.otp_expires_at = Date.now() + 5 * 60 * 1000; // 5 minutes

      // Send the new OTP via email
      await sendEmail(
        data.email,
        'Your New OTP Code',
        `
          Hi there,
      
          Your new OTP for verifying school registration is: ${newOtp}
      
          This OTP is valid for 5 minutes. Do not share it.
      
          If you did not request this, please ignore the email.
      
          Thanks,
          The Admin Team
        `
      );


      req.flash('success', 'A new OTP has been sent to your email.');
      return res.redirect('/web/school/verify/page');

    } catch (err) {
      console.error('Resend OTP Error:', err);
      req.flash('error', 'Failed to resend OTP. Please try again later.');
      return res.render('web/verify', { layout: false });
    }
  });


  // SuperAdmin School Add
  /**
   * Create or edit school
   */

  app.get('/super/school/add', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        req.flash('error', 'Please login to continue');
        return res.redirect('/login');
      }

      if (req.user.role.name !== "SuperAdmin") {
        req.flash('error', 'You are not authorised to access this page.');
        return res.redirect('/');
      }

      const errors = req.flash('errors')[0] || {};
      const formData = req.flash('school')[0] || {};
      const schoolData = { ...formData };

      res.render('superAdmin/schoolCreate', {
        school: schoolData,
        schoolData: schoolData, // Add this to match the validation error render
        errors: errors,
        messages: {
          success: req.flash('success'),
          error: req.flash('error')
        }
      });
    } catch (error) {
      console.error('Error in school add route:', error);
      req.flash('error', 'An error occurred while loading the page');
      return res.redirect('/');
    }
  });


  app.post('/super/school/save', [
    // School validations
    body('name')
      .notEmpty().withMessage('School name is required')
      .isLength({ max: 40 }).withMessage('School name must not exceed 40 characters'),
    body('location').notEmpty().withMessage('Address is required'),
    body('city').notEmpty().withMessage('Town is required'),
    body('country').notEmpty().withMessage('Country is required'),
    body('state').notEmpty().withMessage('Region is required'),
    body('phone_number')
      .custom(async (phone_number) => {
        const existing = await models.Schools.findOne({ where: { phone_number } });
        if (existing) throw new Error('A school with this phone number already exists.');
      }),
    body('email')
      .isEmail().withMessage('Invalid email address')
      .custom(async (email) => {
        const existingSchool = await models.Schools.findOne({ where: { email } });
        if (existingSchool) {
          throw new Error('A school with this email already exists.');
        }

        const existingUser = await models.Users.findOne({ where: { email } });
        if (existingUser) {
          throw new Error('A user with this email already exists.');
        }

        return true;
      }),
    body('type').notEmpty().withMessage('School type is required'),

    //   // Administrator validations
    body('admin_name').notEmpty().withMessage('Administrator name is required'),
    body('admin_email')
      .isEmail().withMessage('Invalid admin email')
      .custom(async (email) => {
        const existing = await models.Users.findOne({ where: { email } });
        if (existing) throw new Error('Administrator email already exists.');
      }),
    // body('admin_contact_person').notEmpty().withMessage('Contact person is required'),
    body('admin_phone')
      .isMobilePhone().withMessage('Invalid admin phone number')
      .custom(async (phone) => {
        const existing = await models.Users.findOne({ where: { phone } });
        if (existing) throw new Error('Administrator phone already exists.');
      }),
    body('admin_password')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

    //   // Banking validations
    body('bank_name')
      .notEmpty().withMessage('Bank name is required')
      .isLength({ min: 2 }).withMessage('Bank name must be at least 2 characters'),
    body('account_number')
      .notEmpty().withMessage('Account number is required')
      .isNumeric().withMessage('Account number must be numeric')
      .isLength({ min: 6 }).withMessage('Account number must be at least 6 digits'),
    // .custom(async (val) => {
    //   const existing = await models.BankingDetails.findOne({ where: { account_number: val } });
    //   if (existing) throw new Error('Bank account number already exists.');
    // }),
    body('account_holder')
      .notEmpty().withMessage('Account holder is required')
      .isLength({ min: 3 }).withMessage('Account holder must be at least 3 characters'),], async (req, res) => {
        const errors = validationResult(req);



        if (!errors.isEmpty()) {
          req.flash('errors', errors.mapped());
          req.flash('school', req.body);
          return res.redirect('/super/school/add');
        }


        try {
          delete req.session.schoolData;
          const {
            name, location, phone_number, email, type, city, state, country,
            admin_name, admin_email, admin_phone, admin_password, settlement_bank,
            bank_name, account_number, account_holder
          } = req.body;
          if (req.body.email == req.body.admin_email) {
            const customErrors = {
              admin_email: {
                msg: 'Administrator email must be different from school email'
              }
            };
            req.flash('errors', customErrors);
            req.flash('school', req.body);
            return res.redirect('/super/school/add');
          }
          let logoUrl = null;
          if (req.files && req.files.logo) {
            const file = req.files.logo;
            const ext = path.extname(file.name).toLowerCase();
            const allowed = ['.png', '.jpg', '.jpeg', '.gif'];
            if (!allowed.includes(ext)) throw new Error('Invalid logo type.');
            if (file.size > 5 * 1024 * 1024) throw new Error('Logo must be under 5MB.');
            const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
            const dir = path.join(__dirname, '../public/uploads/schools/');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, fileName);
            await file.mv(filePath);
            logoUrl = `/uploads/schools/${fileName}`;
          }

          let admin_idUrl = null;
          if (req.files && req.files.admin_id) {
            const file = req.files.admin_id;
            const ext = path.extname(file.name).toLowerCase();
            const allowed = ['.png', '.jpg', '.jpeg', '.pdf'];
            if (!allowed.includes(ext)) throw new Error('Invalid logo type.');
            if (file.size > 5 * 1024 * 1024) throw new Error('Administrator Id must be under 5MB.');
            const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
            const dir = path.join(__dirname, '../public/uploads/schools/');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, fileName);
            await file.mv(filePath);
            admin_idUrl = `/uploads/schools/${fileName}`;
          }
          let profile = null;
          if (req.files && req.files.profile_images) {
            const file = req.files.profile_images;
            const ext = path.extname(file.name).toLowerCase();
            const allowed = ['.png', '.jpg', '.jpeg'];
            if (!allowed.includes(ext)) throw new Error('Invalid Profile image type.');
            if (file.size > 5 * 1024 * 1024) throw new Error('Profile image must be under 5MB.');
            const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
            const dir = path.join(__dirname, '../public/uploads/profile/');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, fileName);
            await file.mv(filePath);
            profile = `/uploads/profile/${fileName}`;
          }

          let school_docUrl = null;
          if (req.files && req.files.school_doc) {
            const file = req.files.school_doc;
            const ext = path.extname(file.name).toLowerCase();
            const allowed = ['.png', '.jpg', '.pdf', '.jpeg'];
            if (!allowed.includes(ext)) throw new Error('Invalid logo type.');
            if (file.size > 5 * 1024 * 1024) throw new Error('School document must be under 5MB.');
            const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
            const dir = path.join(__dirname, '../public/uploads/schools/');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, fileName);
            await file.mv(filePath);
            school_docUrl = `/uploads/schools/${fileName}`;
          }

          let ibanUrl = null;
          if (req.files && req.files.iban_document) {
            const file = req.files.iban_document;
            const ext = path.extname(file.name).toLowerCase();
            const allowed = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
            if (!allowed.includes(ext)) throw new Error('Invalid IBAN document type.');
            if (file.size > 5 * 1024 * 1024) throw new Error('IBAN file must be under 5MB.');
            const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
            const dir = path.join(__dirname, '../public/banking/ibanDoc/');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, fileName);
            await file.mv(filePath);
            ibanUrl = `/banking/ibanDoc/${fileName}`;
          }
          const generateOtp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
          // const otp = 111111;
          // ✅ Store in session for later verification
          req.session.schoolData = {
            name, location, phone_number, email, city, state, country, type, logo: logoUrl, school_doc: school_docUrl,
            admin: {
              name: admin_name,
              email: admin_email,
              phone: admin_phone,
              password: admin_password,
              profile_images: profile,
              logo: admin_idUrl
            },
            banking: {
              bank_name,
              settlement_bank,
              account_number,
              account_holder,
              iban_document: ibanUrl
            },
            otp: generateOtp,
            otp_expires_at: Date.now() + 5 * 60 * 1000 // 5 min
          };
          // Send OTP via email
          await sendEmail(
            req.body.email,
            'Verify Your School Registration - OTP Code',
            `
              Dear User,
              Thank you for registering your school with us.
              Your One-Time Password (OTP) for verification is:
              ${generateOtp}
              This OTP is valid for 5 minutes. Please do not share it with anyone.
              If you did not initiate this request, please ignore this email.
            
              Best regards,
              The Admin Team
            `
          );

          return res.redirect('/super/school/verify');
          // return res.render('web/verify', { layout: false }); // or with layout if needed

        } catch (err) {
          console.error(err);
          req.flash('error', err.message || 'An error occurred.');
          return res.redirect('/super/schoolCreate');
        }
      });
  app.get('/super/school/verify', async (req, res) => {
    const data = req.session.schoolData;
    return res.render('superAdmin/verify', data);
  });


  app.post('/super/school/verify/save', async (req, res) => {
    const { otp } = req.body;
    const data = req.session.schoolData;
    console.log('otp:', otp);
    console.log('data:', data);
    if (!data) {
      req.flash('error', 'Session expired or invalid.');
      return res.redirect('/super/school/add');
    }

    if (Date.now() > data.otp_expires_at) {
      req.flash('error', 'OTP has expired. Please register again.');
      return res.redirect('/super/school/add');
    }

    if (parseInt(otp) !== data.otp) {
      req.flash('error', 'Invalid OTP. Please try again.');
      return res.redirect('/super/school/verify');
    }

    const t = await models.sequelize.transaction();
    try {
      const newSchool = await models.Schools.create({
        name: data.name,
        location: data.location,
        phone_number: data.phone_number,
        email: data.email,
        city: data.city,
        state: data.state,
        country: data.country,
        type: data.type,
        logo: data.logo,
        school_doc: data.school_doc
      }, { transaction: t });

      const hashedPassword = bcrypt.hashSync(data.admin.password, bcrypt.genSaltSync(10));
      const adminRole = await models.Roles.findOne({ where: { name: 'Administrator' } });

      await models.Users.create({
        name: data.admin.name,
        email: data.admin.email,
        phone: data.admin.phone,
        password: hashedPassword,
        role_id: adminRole.id,
        school_id: newSchool.id,
        logo: data.admin.logo,
        profile_images: data.admin.profile_images,
        status: 1
      }, { transaction: t });


      // 3. Create Paystack subaccount
      const paystackResponse = await paystack.subAccount.create({
        business_name: newSchool.name,
        account_number: data.banking.account_number,
        percentage_charge: 90,
        settlement_bank: data.banking.settlement_bank
      });

      if (!paystackResponse.status) {
        req.flash('error', paystackResponse.message);
        return res.redirect('/super/school/add');
        // throw new Error(paystackResponse.message || 'Failed to create subaccount in Paystack.');
      }


      const { id: paystack_id, subaccount_code } = paystackResponse.data;

      // 4. Save banking details
      await models.BankingDetails.create({
        bank_name: data.banking.bank_name,
        account_number: data.banking.account_number,
        account_holder: data.banking.account_holder,
        school_id: newSchool.id,
        iban_document: data.banking.iban_document,
        status: 1,
        business_name: newSchool.name,
        settlement_bank: data.banking.settlement_bank,
        subaccount_code,
        paystack_id
      }, { transaction: t });


      // await models.BankingDetails.create({
      //   bank_name: data.banking.bank_name,
      //   account_number: data.banking.account_number,
      //   account_holder: data.banking.account_holder,
      //   school_id: newSchool.id,
      //   iban_document: data.banking.iban_document,
      //   status: 1
      // }, { transaction: t });


      await Promise.all([
        // Send to school email
        sendEmail(
          data.email,
          'School Registration Successful - Scolaris Pay',
          `
          Dear ${data.name},

          Your school has been successfully registered with Scolaris Pay. 
          
          School Details:
          - Name: ${data.name}
          - Email: ${data.email}
          - Phone: ${data.phone_number}
          - Location: ${data.location}
           Login Details:
          - Email: ${data.admin.email}
          - Password: ${data.admin.password}
          Please log in at: https://spay.ralhangroup.com/login
          
          If you have any questions, please contact our support team at support@scolarispay.com
          
          Best regards,
          Scolaris Pay Team
          `
        )
        // Send to admin email
        // sendEmail(
        //   data.admin.email,
        //   'Administrator Account Created - Scolaris Pay',
        //   `
        //   Dear ${data.admin.name},

        //   Your administrator account for ${data.name} has been created successfully.

        //   Login Details:
        //   - Email: ${data.admin.email}
        //   - Password: ${data.admin.password}

        //   Please log in at: https://spay.ralhangroup.com/login

        //   For security reasons, please change your password after your first login.

        //   If you need assistance, contact us at support@scolarispay.com

        //   Best regards,
        //   Scolaris Pay Team
        //   `
        // )
      ]);
      await sendEmail(
        data.admin.email,
        'We\'ve Received Your Submission!',
        `
        Hi ${data.admin.name},

        Thanks for completing the submission! We've sent a confirmation email to the school's Administrator with everything needed to move forward.

        Your school details:
        - School Name: ${data.name}
        - Email: ${data.email}
        - Phone: ${data.phone_number}

        You can now log in to your administrator account using:
        - Email: ${data.admin.email}
        - Password: ${data.admin.password}

        Please log in at: https://spay.ralhangroup.com/login
        Need help or didn't receive the email? Contact us at support@scolarispay.com

        Warm regards,
        Scolaris Pay Team
        `
      );
      req.flash('success', 'School saved successfully after verification.');
      await t.commit();
      delete req.session.schoolData;
      // return res.redirect('/web/school/list');
      return res.redirect('/schools/index');

    } catch (err) {
      console.log(err);
      await t.rollback();
      console.error('Verification Save Error:', err);
      req.flash('error', err.message || 'Verification failed.');
      return res.redirect('/super/school/verify');
    }
  });

  app.post('/super/school/verify/resend', async (req, res) => {
    const data = req.session.schoolData;

    if (!data) {
      req.flash('error', 'Session expired. Please start registration again.');
      return res.redirect('/super/school/add');
    }

    try {
      const newOtp = Math.floor(100000 + Math.random() * 900000);
      req.session.schoolData.otp = newOtp;
      req.session.schoolData.otp_expires_at = Date.now() + 5 * 60 * 1000; // 5 minutes

      // Send the new OTP via email
      await sendEmail(
        data.email,
        'Your New OTP Code',
        `
          Hi there,
      
          Your new OTP for verifying school registration is: ${newOtp}
      
          This OTP is valid for 5 minutes. Do not share it.
      
          If you did not request this, please ignore the email.
      
          Thanks,
          The Admin Team
        `
      );


      req.flash('success', 'A new OTP has been sent to your email.');
      return res.redirect('/super/school/verify');

    } catch (err) {
      console.error('Resend OTP Error:', err);
      req.flash('error', 'Failed to resend OTP. Please try again later.');
      return res.render('superAdmin/verify');
    }
  });
};
