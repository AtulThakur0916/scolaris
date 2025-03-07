const models = require('../models');
const waterfall = require('async-waterfall');
const bcrypt = require('bcryptjs');
const path = require('path');
const moment = require('moment');
const { body, validationResult } = require('express-validator');

module.exports = function (app, Op, sequelize) {

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

        if (role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        // Fetch users
        var users = await models.Users.findAll({
            raw: true,
            include: [{
                model: models.Roles,
                as: 'role',
                attributes: ['name']
            }],
            order: [['name', 'ASC']],
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

            const roles = await models.Roles.findAll({
                raw: true
            });

            res.render('users/create', {
                user: user,
                roles: roles
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
                const roles = await models.Roles.findAll({ raw: true });
                return res.render('users/create', {
                    userData: req.body,
                    errors: errors.mapped(),
                    roles
                });
            } catch (err) {
                req.flash('error', 'Error loading roles');
                return res.redirect('/users/create');
            }
        }
        const { name, email, contact_person, phone, status, role_id } = req.body;

        // Check if user with same email already exists
        const existingUser = await models.Users.findOne({
            where: { email: email }
        });

        if (existingUser) {
            req.flash('error', 'A user with this email already exists');
            return res.redirect('/users/create');
        }

        var password = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10), null);
        await models.Users.create({ name, email, contact_person, phone, status, password, role_id });

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

            const roles = await models.Roles.findAll({ raw: true });

            // Retrieve flash messages
            const errors = req.flash('errors')[0] || {};  // Retrieve validation errors
            const formData = req.flash('formData')[0] || {}; // Retrieve old input values

            // Merge old input with existing user data
            const userDataMerged = { ...user, ...formData };

            res.render('users/edit', {
                user: userDataMerged, // Send merged data
                roles,
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

            if (req.user.role.name !== "SuperAdmin") {
                req.flash('error', 'You are not authorized to perform this action.');
                return res.redirect('/users/index');
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                req.flash('errors', errors.mapped());  // Store errors in flash
                req.flash('formData', req.body); // Store old input values
                return res.redirect(`/users/edit/${req.params.user_id}`); // Redirect back to edit page
            }

            const { user_id } = req.params;
            const { name, email, contact_person, phone, status, role_id } = req.body;
            let updatedFields = { name, email, contact_person, phone, status, role_id };

            // Handle file upload if provided
            if (req.files && req.files.logo) {
                let file = req.files.logo;
                let newFileName = file.name.split('.').join('-' + Date.now() + '.');
                let uploadPath = path.join(__dirname, '../public/uploads/', newFileName);

                await file.mv(uploadPath);
                updatedFields.logo = "https://lms.khabriya.in/uploads/" + newFileName;
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
            if (role.name !== "SuperAdmin") {
                return res.json({
                    success: false,
                    message: 'You are not authorised to access this page.'
                });
            }
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
};
