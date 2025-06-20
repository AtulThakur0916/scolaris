const models = require('../models');
const waterfall = require('async-waterfall');
const bcrypt = require('bcryptjs');
const path = require('path');
const moment = require('moment');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const crypto = require('crypto');
const { forgotPassword } = require('../helpers/zepto');
const { Op } = require('sequelize');
module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

    /**
     * Render view for manage user
     */
    app.get('/users/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (!req.user || !req.user.role) {
            req.flash('error', 'Invalid user session. Please log in again.');
            return res.redirect('/login');
        }

        const { id, logo, role, name } = req.user;

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "Administrator" && req.user.role.name !== "School (Sub-Admin)") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        // const whereCondition = req.user.role.name === "Administrator"
        //     ? { school_id: req.user.school_id }
        //     : {};
        const whereCondition = (
            req.user.role.name === "Administrator" || req.user.role.name === "School (Sub-Admin)"
        )
            ? { school_id: req.user.school_id }
            : {};

        // Fetch users excluding SuperAdmin
        var users = await models.Users.findAll({
            raw: true,
            where: whereCondition,
            include: [{
                model: models.Roles,
                as: 'role',
                attributes: ['name'],
                where: {
                    name: { [Op.ne]: 'SuperAdmin' } // Exclude SuperAdmin
                }
            }],
            order: [['createdAt', 'DESC']], // Changed from ASC to DESC and ordering by createdAt
            nest: true
        });

        res.render('users/index', {
            users,
            success: res.locals.success,
            error: res.locals.error
        });
    });


    /**
     * Render view for manage user
     */
    app.post('/users/data', async (req, res) => {

        try {
            const { role } = req.user;

            if (!req.isAuthenticated()) {
                req.flash('error', 'Please login to continue');
                return res.redirect('/login');
            }

            if (role.name !== "SuperAdmin") {
                req.flash('error', 'You are not authorised to access this page.');
                return res.redirect('/');
            }

            var users = await models.Users.findAll({
                raw: true,
                include: [{
                    model: models.Roles,
                    as: 'role',
                    attributes: ['name']
                }],
                order: [['name', 'ASC']]
            });

            res.json(users);
        } catch (error) {
            console.error('Error in /users/data:', error);
            res.status(500).send('Error fetching users data');
        }
    });

    /*
     * Scales Report by id
     */
    app.get('/users/view/:user_id', async (req, res) => {

        const { user_id } = req.params;
        const { name, role } = req.user;
        const monthF = moment().format('MMMM-YYYY');

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        // Get user
        const user = await models.Users.findOne({
            where: {
                id: user_id
            },
            //            include: [{
            //                  model: models.Channels,
            //                  attributes: ['id', 'channel_name', 'add_language', 'image', 'stream_url'],
            //                  as: "channels",
            //                  where: {
            //                      status: true
            //                  }
            //              }]
        });

        let views = await models.Statistics.findAll({
            attributes: [
                'user_id',
                [sequelize.fn('sum', sequelize.col('views')), 'views'],
            ],
            where: {
                user_id
            },
            group: ['user_id']
        });

        const month = moment().startOf('month').format();
        let viewsThisMonth = await models.Statistics.findAll({
            attributes: [
                'user_id',
                [sequelize.fn('sum', sequelize.col('views')), 'views'],
            ],
            where: {
                user_id,
                createdAt: {
                    [Op.gt]: month
                }
            },
            group: ['user_id'],
        });

        let today = await models.Statistics.findAll({
            where: {
                user_id,
                createdAt: {
                    [Op.gt]: moment().startOf('day').format()
                }
            },
            attributes: [
                [sequelize.fn('date_trunc', 'hour', sequelize.col('created_at')), 'hour'],
                [sequelize.fn('sum', sequelize.col('views')), 'count']
            ],
            group: 'hour',
            raw: true
        });
        let weekly = await models.Statistics.count({
            where: {
                user_id,
                createdAt: {
                    [Op.gt]: moment().startOf('week').format()
                }
            },
            attributes: [
                [sequelize.fn('date_trunc', 'day', sequelize.col('created_at')), 'day'],
                [sequelize.fn('sum', sequelize.col('views')), 'count']
            ],
            group: 'day',
            raw: true
        });
        let monthly = await models.Statistics.count({
            where: {
                user_id,
                createdAt: {
                    [Op.gt]: moment().startOf('month').format()
                }
            },
            attributes: [
                [sequelize.fn('date_trunc', 'day', sequelize.col('created_at')), 'day'],
                [sequelize.fn('sum', sequelize.col('views')), 'count']
            ],
            group: 'day',
            raw: true
        });
        let yearly = await models.Statistics.count({
            where: {
                user_id,
                createdAt: {
                    [Op.gt]: moment().startOf('year').format()
                }
            },
            attributes: [
                [sequelize.fn('date_trunc', 'month', sequelize.col('created_at')), 'month'],
                [sequelize.fn('sum', sequelize.col('views')), 'count']
            ],
            group: 'month',
            raw: true
        });

        let adViews = await models.AdViews.findAll({
            attributes: [
                'user_id',
                [sequelize.fn('sum', sequelize.col('views')), 'views'],
            ],
            where: {
                user_id
            },
            group: ['user_id']
        });

        let adViewsThisMonth = await models.AdViews.findAll({
            attributes: [
                'user_id',
                [sequelize.fn('sum', sequelize.col('views')), 'views'],
            ],
            where: {
                user_id,
                createdAt: {
                    [Op.gt]: month
                }
            },
            group: ['user_id'],
        });

        let adToday = await models.AdViews.findAll({
            where: {
                user_id,
                createdAt: {
                    [Op.gt]: moment().startOf('day').format()
                }
            },
            attributes: [
                [sequelize.fn('date_trunc', 'hour', sequelize.col('created_at')), 'hour'],
                [sequelize.fn('sum', sequelize.col('views')), 'count']
            ],
            group: 'hour',
            raw: true
        });
        let adWeekly = await models.AdViews.count({
            where: {
                user_id,
                createdAt: {
                    [Op.gt]: moment().startOf('week').format()
                }
            },
            attributes: [
                [sequelize.fn('date_trunc', 'day', sequelize.col('created_at')), 'day'],
                [sequelize.fn('sum', sequelize.col('views')), 'count']
            ],
            group: 'day',
            raw: true
        });
        let adMonthly = await models.AdViews.count({
            where: {
                user_id,
                createdAt: {
                    [Op.gt]: moment().startOf('month').format()
                }
            },
            attributes: [
                [sequelize.fn('date_trunc', 'day', sequelize.col('created_at')), 'day'],
                [sequelize.fn('sum', sequelize.col('views')), 'count']
            ],
            group: 'day',
            raw: true
        });
        let adYearly = await models.AdViews.count({
            where: {
                user_id,
                createdAt: {
                    [Op.gt]: moment().startOf('year').format()
                }
            },
            attributes: [
                [sequelize.fn('date_trunc', 'month', sequelize.col('created_at')), 'month'],
                [sequelize.fn('sum', sequelize.col('views')), 'count']
            ],
            group: 'month',
            raw: true
        });

        let statistics = await models.Statistics.findAll({
            where: {
                user_id,
                //createdAt: {
                //[Op.gt]: month
                //}
            },
            raw: true
        });

        // Get Admin CPM
        var admin = await models.RevenueStats.findOne({
            attributes: ['cpi'],
            where: {
                user_id: '4c47bfca-51d2-40d3-bd61-651f02337e28',
                month: monthF
            }
        });

        let totalViews = 0;
        if (adViews.length > 0)
            totalViews = adViews[0].views;

        let monthlyViews = 0;
        if (adViewsThisMonth.length > 0)
            monthlyViews = adViewsThisMonth[0].views;

        let cpm = (user.cpi / 100) * admin.cpi;
        let totalRevenue = ((totalViews / 1000) * cpm).toFixed(2);
        let revenue = ((monthlyViews / 1000) * cpm).toFixed(2);
        let grossRevenue = ((monthlyViews / 1000) * admin.cpi).toFixed(2);

        //Realtime update views in RevenueStats
        await models.RevenueStats.update(
            { views: monthlyViews, revenue, gross_revenue: grossRevenue },
            {
                where: { user_id, month: monthF }
            }
        );

        let reviewStats = await models.RevenueStats.findAll({
            attributes: ['cpi', 'month', 'views', 'revenue', 'gross_revenue'],
            where: {
                user_id
            },
            raw: true
        });

        console.log('data', today, weekly, monthly, yearly);
        //        console.log('statistics', totalViews, monthlyViews, statistics.length, reviewStats, user);

        res.render('users/view', {
            user,
            role,
            name,
            reviewStats: JSON.stringify(reviewStats),
            statistics: JSON.stringify([today, weekly, monthly, yearly]),
            totalViews,
            revenue,
            totalRevenue
        });
    });

    /*
     * Create a new user, get
     */
    app.get('/users/create/:user_id?', async (req, res) => {
        // if (req.user.role.name !== "SuperAdmin") {
        //     req.flash('error', 'You are not authorised to access this page.');
        //     return res.redirect('/');
        // }
        // Authorization check
        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "Administrator") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }
        try {
            const { user_id } = req.params;
            let user = null;

            if (user_id) {
                // Get user data and convert to plain object
                const userData = await models.Users.findOne({
                    where: { id: user_id },
                    raw: true
                });

                if (userData) {
                    user = userData;
                }
            }
            const roles = req.user.role.name == "SuperAdmin" ? await models.Roles.findAll({
                where: {
                    name: ['School (Sub-Admin)', 'Administrator']
                },
                raw: true
            }) : await models.Roles.findAll({
                where: {
                    name: ['School (Sub-Admin)']
                },
                raw: true
            })

            const schools = req.user.role.name === "SuperAdmin"
                ? await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: { status: 'Approve' },
                    raw: true
                })
                : await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: { id: req.user.school_id },
                    raw: true
                });
            res.render('users/create', {
                user: user,
                roles: roles,
                schools: schools
            });
        } catch (error) {
            console.error('Error in /users/create:', error);
            res.status(500).send('Error loading user data');
        }
    });

    /*
     * Create a new user, post
     */
    app.post('/users/create', [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Invalid email address')
            .custom(async (email) => {
                const existingUser = await models.Users.findOne({ where: { email } });
                if (existingUser) {
                    throw new Error('A user with this email already exists');
                }
            }),
        body('contact_person').notEmpty().withMessage('Contact person is required'),
        body('phone').isMobilePhone().withMessage('Invalid phone number'),
        body('phone')
            .isMobilePhone().withMessage('Invalid phone number')
            .custom(async (phone) => {
                const existingUser = await models.Users.findOne({ where: { phone } });
                if (existingUser) {
                    throw new Error('A user with this phone number already exists.');
                }
            }),
    ], async (req, res) => {

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            try {
                const roles = req.user.role.name == "SuperAdmin" ? await models.Roles.findAll({
                    where: {
                        name: ['School (Sub-Admin)', 'Administrator']
                    },
                    raw: true
                }) : await models.Roles.findAll({
                    where: {
                        name: ['Administrator']
                    },
                    raw: true
                })

                const schools = req.user.role.name === "SuperAdmin"
                    ? await models.Schools.findAll({
                        attributes: ['id', 'name'],
                        where: { status: 'Approve' },
                        raw: true
                    })
                    : await models.Schools.findAll({
                        attributes: ['id', 'name'],
                        where: { id: req.user.school_id },
                        raw: true
                    });
                return res.render('users/create', {
                    userData: req.body,
                    errors: errors.mapped(),
                    roles,
                    schools
                });
            } catch (err) {
                req.flash('error', 'Error loading roles');
                return res.redirect('/users/create');
            }
        }
        const { name, school_id, email, contact_person, phone, status, role_id } = req.body;
        console.log(req.body);
        // Check if user with same email already exists
        const existingUser = await models.Users.findOne({
            where: { email: email }
        });

        if (existingUser) {
            req.flash('error', 'A user with this email already exists');
            return res.redirect('/users/create');
        }
        // Handle admin ID file upload
        let admin_idUrl = null;
        if (req.files && req.files.admin_id) {
            console.log(req.files.admin_id)
            const file = req.files.admin_id;
            const ext = path.extname(file.name).toLowerCase();
            const allowed = ['.png', '.jpg', '.jpeg', '.pdf'];
            if (!allowed.includes(ext)) throw new Error('Invalid Admin ID file type. Allowed types: PNG, JPG, JPEG, PDF');
            if (file.size > 5 * 1024 * 1024) throw new Error('Admin ID must be under 5MB');

            const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
            const uploadDir = path.join(__dirname, '../public/uploads/schools/');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            const filePath = path.join(uploadDir, fileName);
            await file.mv(filePath);

            admin_idUrl = `/uploads/schools/${fileName}`;
        }
        let profile = null;
        if (req.files && req.files.profile_images) {
            console.log(req.files.profile_images)
            const file = req.files.profile_images;
            const ext = path.extname(file.name).toLowerCase();
            const allowed = ['.png', '.jpg', '.jpeg'];
            if (!allowed.includes(ext)) throw new Error('Invalid Admin ID file type. Allowed types: PNG, JPG, JPEG');
            if (file.size > 5 * 1024 * 1024) throw new Error('Profile image must be under 5MB');

            const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
            const uploadDir = path.join(__dirname, '../public/uploads/profile/');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            const filePath = path.join(uploadDir, fileName);
            await file.mv(filePath);

            profile = `/uploads/profile/${fileName}`;
        }
        console.log(admin_idUrl);
        var password = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10), null);
        await models.Users.create({ name, school_id, email, contact_person, phone, status, password, role_id, logo: admin_idUrl, profile_images: profile });
        const role = await models.Roles.findOne({ where: { id: role_id } });

        if (role && role.name === 'Administrator') {
            const plainPassword = req.body.password; // only if you're not generating random passwords

            await sendEmail(
                email,
                'Your Administrator Account Details',
                `
    Dear ${name},

    Your Administrator account has been created successfully.

    Here are your login details:
    Email: ${email}
    Password: ${plainPassword}
    Contact Person: ${contact_person}
    Phone: ${phone}

    Please log in and change your password as soon as possible.

    Best regards,
    The Scolaris Pay Admin Team
    `
            );
        }
        if (role && role.name === 'School (Sub-Admin)') {
            const plainPassword = req.body.password; // only if you're not generating random passwords

            await sendEmail(
                email,
                'Your Sub-Admin Account Details',
                `
    Dear ${name},

    Your Sub Admin account has been created successfully.

    Here are your login details:
    Email: ${email}
    Password: ${plainPassword}
    Contact Person: ${contact_person}
    Phone: ${phone}

    Please log in and change your password as soon as possible.

    Best regards,
    The Scolaris Pay Admin Team
    `
            );
        }
        req.flash('success', 'User Created successfully.');


        res.redirect('/users/index');

    });
    app.get('/users/edit/:user_id?', async (req, res) => {
        try {
            const { user_id } = req.params;
            let user = null;

            if (user_id) {
                // Get user data
                const userData = await models.Users.findOne({
                    where: { id: user_id },
                    raw: true
                });

                if (userData) {
                    user = userData;
                }
            }

            const roles = req.user.role.name == "SuperAdmin" ? await models.Roles.findAll({
                where: {
                    name: ['School (Sub-Admin)', 'Administrator']
                },
                raw: true
            }) : await models.Roles.findAll({
                where: {
                    name: ['School (Sub-Admin)']
                },
                raw: true
            })

            const schools = req.user.role.name === "SuperAdmin"
                ? await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: { status: 'Approve' },
                    raw: true
                })
                : await models.Schools.findAll({
                    attributes: ['id', 'name'],
                    where: { id: req.user.school_id },
                    raw: true
                });
            // Retrieve flash messages
            const errors = req.flash('errors')[0] || {};  // Retrieve validation errors
            const formData = req.flash('formData')[0] || {}; // Retrieve old input values

            // Merge old input with existing user data
            const userDataMerged = { ...user, ...formData };

            res.render('users/edit', {
                user: userDataMerged, // Send merged data
                roles,
                schools,
                errors,
                messages: {
                    success: res.locals.success,
                    error: res.locals.error
                }
            });
        } catch (error) {
            console.error('Error loading user edit page:', error);
            res.status(500).send('Error loading user data');
        }
    });

    /**
     * Update user
     */


    app.post('/users/update/:user_id', [
        body('name').notEmpty().withMessage('Name is required'),
        body('email')
            .isEmail().withMessage('Invalid email address')
            .custom(async (email, { req }) => {
                const existingUser = await models.Users.findOne({
                    where: { email, id: { [models.Sequelize.Op.ne]: req.params.user_id } }
                });
                if (existingUser) {
                    throw new Error('Email is already in use by another user.');
                }
            }),
        body('contact_person').notEmpty().withMessage('Contact person is required'),
        body('phone').isMobilePhone().withMessage('Invalid phone number'),
        body('role_id')
            .custom(async (role_id) => {
                const role = await models.Roles.findByPk(role_id);
                if (!role) {
                    throw new Error('Selected role does not exist.');
                }
            })
    ], async (req, res) => {
        try {
            if (!req.isAuthenticated()) {
                req.flash('error', 'Please login to continue');
                return res.redirect('/login');
            }

            if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "Administrator") {
                req.flash('error', 'You are not authorised to access this page.');
                return res.redirect('/');
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                req.flash('errors', errors.mapped());  // Store errors in flash
                req.flash('formData', req.body); // Store old input values
                return res.redirect(`/users/edit/${req.params.user_id}`); // Redirect back to edit page
            }

            const { user_id } = req.params;
            const { name, school_id, email, contact_person, phone, status, role_id } = req.body;
            // let updatedFields = { name, school_id, email, contact_person, phone, status, role_id };
            let updatedFields = { name, school_id, email, contact_person, phone, status, role_id };


            // Handle file upload if provided
            let admin_idUrl = null;
            if (req.files && req.files.admin_id) {
                console.log(req.files.admin_id)
                const file = req.files.admin_id;
                const ext = path.extname(file.name).toLowerCase();
                const allowed = ['.png', '.jpg', '.jpeg', '.pdf'];
                if (!allowed.includes(ext)) throw new Error('Invalid Admin ID file type. Allowed types: PNG, JPG, JPEG, PDF');
                if (file.size > 5 * 1024 * 1024) throw new Error('Admin ID must be under 5MB');

                const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
                const uploadDir = path.join(__dirname, '../public/uploads/schools/');
                if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

                const filePath = path.join(uploadDir, fileName);
                await file.mv(filePath);

                admin_idUrl = `/uploads/schools/${fileName}`;
            }
            if (admin_idUrl) {
                updatedFields.logo = admin_idUrl;
            }
            let profile = null;
            if (req.files && req.files.profile_images) {
                console.log(req.files.profile_images)
                const file = req.files.profile_images;
                const ext = path.extname(file.name).toLowerCase();
                const allowed = ['.png', '.jpg', '.jpeg'];
                if (!allowed.includes(ext)) throw new Error('Invalid Profile Image file type. Allowed types: PNG, JPG, JPEG');
                if (file.size > 5 * 1024 * 1024) throw new Error('Profile Image must be under 5MB');

                const fileName = `${path.basename(file.name, ext)}-${Date.now()}${ext}`;
                const uploadDir = path.join(__dirname, '../public/uploads/profile/');
                if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

                const filePath = path.join(uploadDir, fileName);
                await file.mv(filePath);

                profile = `/uploads/profile/${fileName}`;
            }
            if (profile) {
                updatedFields.profile_images = profile;
            }
            // Update user data
            const rowsUpdated = await models.Users.update(updatedFields, { where: { id: user_id } });

            if (rowsUpdated > 0) {
                req.flash('success', 'User updated successfully.');
            } else {
                req.flash('error', 'No changes were made.');
            }

            return res.redirect('/users/index');
        } catch (error) {
            console.error('Error updating user:', error);
            req.flash('error', 'Something went wrong. Please try again.');
            return res.redirect(`/users/edit/${req.params.user_id}`);
        }
    });

    /**
     * Delete user
     */
    app.delete('/users/delete/:id', async (req, res) => {

        try {
            if (!req.isAuthenticated()) {
                return res.json({
                    success: false,
                    message: 'Please login to continue'
                });
            }

            const { role } = req.user;
            // if (role.name !== "SuperAdmin") {
            //     return res.json({
            //         success: false,
            //         message: 'You are not authorised to access this page.'
            //     });
            // }
            //
            const { id } = req.params;
            if (!id) {
                return res.json({
                    success: false,
                    message: 'User not found.'
                });
            }

            const user = await models.Users.findOne({
                where: { id }
            });

            if (!user) {
                return res.json({
                    success: false,
                    message: 'User not found.'
                });
            }

            await models.Users.destroy({
                where: { id }
            });

            return res.json({
                success: true,
                message: 'User deleted successfully.'
            });
        } catch (error) {
            return res.json({
                success: false,
                message: error.message
            });
        }
    });

    // Add this new route handler
    exports.getUsersData = async (req, res) => {
        try {
            const draw = parseInt(req.body.draw);
            const start = parseInt(req.body.start);
            const length = parseInt(req.body.length);
            const search = req.body.search.value;
            const orderColumn = req.body.order[0].column;
            const orderDir = req.body.order[0].dir;

            // Get column name from columns array
            const columns = ['id', 'name', 'email']; // adjust based on your actual column names
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
            const totalRecords = await models.Users.countDocuments();

            // Get filtered records count
            const filteredRecords = await models.Users.countDocuments(query);

            // Get paginated records
            const users = await models.Users.find(query)
                .sort({ [orderColumnName]: orderDir === 'asc' ? 1 : -1 })
                .skip(start)
                .limit(length);

            res.json({
                draw: draw,
                recordsTotal: totalRecords,
                recordsFiltered: filteredRecords,
                data: users
            });
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({
                error: 'Internal server error'
            });
        }
    };

    //forget

    app.get('/forgot-password', (req, res) => {
        res.render('auth/forgot-password', {
            layout: 'auth',
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            }
        });
    });

    // POST: Send reset link
    app.post('/forgot-password', async (req, res) => {
        const { email } = req.body;

        try {
            const user = await models.Users.findOne({ where: { email } });

            if (!user) {
                req.flash('error', 'No account found with that email.');
                return res.redirect('/forgot-password');
            }

            const token = crypto.randomBytes(32).toString('hex');
            const expiry = new Date(Date.now() + 3600000); // 1 hour

            await models.Users.update(
                {
                    reset_password_token: token,
                    reset_password_expires: expiry
                },
                { where: { email } }
            );

            const resetLink = `http://${req.headers.host}/reset-password/${token}`;

            // Use forgotPassword helper instead of sendEmail
            await forgotPassword(email, {
                userName: user.name,
                resetLink: resetLink,
                expiryTime: '1 hour'
            });

            return res.render('auth/forgot-password', {
                layout: 'auth',
                messages: {
                    success: 'Reset link sent. Check your email.',
                    error: null
                }
            });
        } catch (err) {
            console.error(err);
            req.flash('error', 'Something went wrong.');
            return res.redirect('/forgot-password');
        }
    });

    app.get('/reset-password/:token', async (req, res) => {
        const { token } = req.params;

        try {
            const user = await models.Users.findOne({
                where: {
                    reset_password_token: token,
                    reset_password_expires: { [Op.gt]: new Date() }
                }
            });

            if (!user) {
                req.flash('error', 'Invalid or expired token.');
                console.log("Invalid or expired token.");
                return res.redirect('/forgot-password');
            }

            res.render('auth/reset-password', { token, layout: 'auth', error: req.flash('error') });
        } catch (error) {
            console.error(error);
            req.flash('error', 'Something went wrong.');
            res.redirect('/forgot-password');
        }
    });

    app.post('/reset-password/:token', async (req, res) => {
        const { token } = req.params;
        const { password, confirm_password } = req.body;

        if (password !== confirm_password) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect(`/reset-password/${token}`);
        }

        try {
            const user = await models.Users.findOne({
                where: {
                    reset_password_token: token,
                    reset_password_expires: { [Op.gt]: new Date() }
                }
            });

            if (!user) {
                req.flash('error', 'Token invalid or expired.');
                return res.redirect('/forgot-password');
            }

            const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
            await models.Users.update(
                {
                    password: hashedPassword,
                    reset_password_token: null,
                    reset_password_expires: null
                },
                { where: { reset_password_token: token } }
            );

            req.flash('success', 'Password updated successfully.');
            res.redirect('/login');
        } catch (err) {
            console.error(err);
            req.flash('error', 'Something went wrong.');
            res.redirect(`/reset-password/${token}`);
        }
    });

};
