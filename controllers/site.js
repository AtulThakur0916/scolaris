const models = require('../models');
const bcrypt = require('bcryptjs');
const waterfall = require('async-waterfall');
const crypto = require('crypto');
const path = require('path');
const moment = require('moment');
const config = require('../config/config.json');

const { body, validationResult } = require('express-validator');

module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

    /**
     * Render view for dashboard
     */
    app.get('/', async (req, res) => {
        res.render('dashboard', {
            title: 'Dashboard',
            layout_style: 'light',
            use_apex_charts: true
        });
    });

    /**
     * Render view for login
     */
    app.get('/login', (req, res) => {
        res.render('login', {
            layout: 'auth',
            title: 'Login',
            customizer_hide: true,
            pageSpecificCSS: ['../assets/vendor/css/pages/page-auth.css']
        });
    });

    /* 
     * Handle Login POST
     */

    // app.post('/login',
    //     [
    //         body('email')
    //             .trim()
    //             .notEmpty().withMessage('Email is required')
    //             .isEmail().withMessage('Please enter a valid email address'),
    //         body('password')
    //             .notEmpty().withMessage('Password is required')
    //     ],
    //     (req, res, next) => {
    //         const errors = validationResult(req);
    //         if (!errors.isEmpty()) {
    //             return res.render('login', {
    //                 layout: 'auth',
    //                 title: 'Login',
    //                 customizer_hide: true,
    //                 pageSpecificCSS: ['../assets/vendor/css/pages/page-auth.css'],
    //                 errors: errors.mapped(), // Pass validation errors to view
    //                 oldInput: req.body // Keep entered data
    //             });
    //         }
    //         next();
    //     },
    //     passport.authenticate('login', (err, user, info) => {
    //         if (err) {
    //             return next(err);
    //         }
    //         if (!user) {
    //             return res.render('login', {
    //                 layout: 'auth',
    //                 title: 'Login',
    //                 customizer_hide: true,
    //                 pageSpecificCSS: ['../assets/vendor/css/pages/page-auth.css'],
    //                 errors: { email: { msg: "Invalid email or password!" } }, // Show error in email field
    //                 oldInput: req.body // Keep entered data
    //             });
    //         }
    //         req.logIn(user, (err) => {
    //             if (err) {
    //                 return next(err);
    //             }
    //             req.flash('success', 'Login successful! Welcome back.');
    //             return res.redirect("/");
    //         });
    //     })
    // );









    app.post('/login',
        [
            body('email')
                .trim()
                .notEmpty().withMessage('Please enter email')
                .isEmail().withMessage('Please enter a valid email address'),
            body('password')
                .notEmpty().withMessage('Please enter password')
        ],
        (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.render('login', {
                    layout: 'auth',
                    title: 'Login',
                    customizer_hide: true,
                    pageSpecificCSS: ['../assets/vendor/css/pages/page-auth.css'],
                    errors: errors.mapped(),
                    formData: req.body,
                    messages: { error: "Please enter email and password" }
                });
            }
            next();
        },
        (req, res, next) => {
            passport.authenticate('login', (err, user, info) => {
                if (err) {
                    console.error("Passport Authentication Error:", err);
                    req.flash('error', 'An unexpected error occurred. Please try again.');
                    return res.redirect('/login');
                }
                if (!user) {
                    return res.render('login', {
                        layout: 'auth',
                        title: 'Login',
                        customizer_hide: true,
                        pageSpecificCSS: ['../assets/vendor/css/pages/page-auth.css'],
                        errors: { email: { msg: "Credentials are incorrect!" } },
                        formData: req.body,
                        messages: { error: "Credentials are incorrect!" }
                    });
                }
                req.logIn(user, (err) => {
                    if (err) {
                        console.error("Login Error:", err);
                        req.flash('error', 'Error logging in. Please try again.');
                        return res.redirect('/login');
                    }

                    // Handle "Remember Me" Functionality
                    if (req.body.remember) {
                        res.cookie('remember_me', user.id, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true }); // 30 days
                    } else {
                        res.clearCookie('remember_me');
                    }

                    req.flash('success', 'Login successful! Welcome back.');
                    return res.redirect("/");
                });
            })(req, res, next);
        }
    );



    /**
     * Render view for register
     *
    app.get('/register', async(req, res) => {

        const roles = await models.Roles.findAll();

        var user = {
            user_name: '',
            token_code: ''
        };
        if (req.session.register !== undefined) {
            user = req.session.register;
            delete req.session['register'];
        }

        res.render('site/register', {user, roles});
    });

    /**
     * Handle Register POST
     *
    app.post('/register',
            passport.authenticate('register', {failureRedirect: "/register", failureFlash: true}),
            function (req, res) {
                if (!req.user.email) {
                    console.log('jer');
//        req.flash("info", "Your account needs to be verified. Please check your email to verify your account.");
                    req.flash("info", "Your account is created successfully, please login to continue.");
                    req.logout();
                    res.redirect("/account");
                } else {
                    res.redirect("/");
                }
            }
    );*/

    /**
     * Render view for account
     */
    app.get('/account', async (req, res) => {

        const { id, logo, role, name } = req.user;
        let account = await models.Users.findOne({
            where: { id }
        });

        if (req.session.account !== undefined) {
            account = req.session.account;
            delete req.session['account'];
        }

        res.render('site/account', { account, role, name, logo });
    });

    /**
     * Handle Account POST
     */
    app.post('/account', async (req, res) => {

        waterfall([
            function (done) {
                if (!req.isAuthenticated()) {
                    req.flash('error', 'Please login to continue');
                    return res.redirect('/login');
                } else {
                    done(null);
                }
            },
            function (done) {

                const { email } = req.body;
                const { role } = req.user;
                models.Users.findOne({ where: { id: req.user.id } }).then(async (user) => {
                    if (!user) {
                        req.flash('error', 'User not found.');
                        return res.redirect('/login');
                    }

                    if (role.name === "SuperAdmin") {
                        user.cpi = req.body.cpi;

                        const user_id = req.user.id;
                        //                        const month = moment().format('MMMM-YYYY');
                        await models.RevenueStats.findOne({ where: { user_id, month: req.body.month } }).then(async (revenue) => {
                            if (!revenue) {
                                await models.RevenueStats.create({ user_id, month: req.body.month, cpi: req.body.cpi });
                            } else {
                                revenue.cpi = req.body.cpi;
                                revenue.save();
                            }
                        });

                    }
                    //user.name = name;
                    user.email = email;
                    user.save();

                    done(null, user);
                });
            }
        ], function (err) {
            if (err)
                console.log(err);
            else
                req.flash('success', 'Account information save successfully.');
            res.redirect('/');
        });
    });


    /**
     * Render view for forgot password
     */
    app.get('/forgot', (req, res) => {
        res.render('site/forgot_password');
    });

    /**
     * Handle Forgot password POST
     */
    app.post('/forgot', (req, res) => {

        waterfall([
            function (done) {
                crypto.randomBytes(20, function (err, buf) {
                    var token = buf.toString('hex');
                    done(err, token);
                });
            },
            function (token, done) {

                const { email } = req.body;
                models.Users.findOne({ where: { email: email } }).then(user => {
                    if (!user) {
                        req.flash('error', 'No account with that email address exists.');
                        return res.redirect('/forgot');
                    }

                    user.reset_password_token = token;
                    user.reset_password_expires = Date.now() + 900000; // 15 mins

                    user.save();
                    done(null, token, user);
                });
            },
            function (token, user, done) {

                var text = 'Hello ' + user.name + ',\n\n' +
                    'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to change your password:\n\n' +
                    'https://dashboard.khabriya.in/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n\n' +
                    'Cheers, \nTeam Khabriya';

                sendEmail(user.email, 'Khabriya Password Reset', text, {})
                    .then(() => {
                        req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
                        done(null, 'done');
                    })
                    .catch((err) => {
                        console.log(err);
                        req.flash('error', err.message);
                        res.redirect('/login');
                    });
            }
        ], function (err) {
            if (err)
                console.log(err);
            res.redirect('/login');
        });
    });

    /**
     * Render view for reset password
     */
    app.get('/reset/:token', async (req, res) => {

        const user = await models.Users.findOne({ where: { reset_password_token: req.params.token, reset_password_expires: { [Op.gt]: Date.now() } } });
        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot');
        }

        res.render('site/reset_password', {
            user: user
        });
    });

    /**
     * Handle Reset password POST
     */
    app.post('/reset/:token', (req, res) => {

        waterfall([
            function (done) {

                models.Users.findOne({ where: { reset_password_token: req.params.token, reset_password_expires: { [Op.gt]: Date.now() } } }).then(user => {
                    if (!user) {
                        req.flash('error', 'Password reset token is invalid or has expired.');
                        return res.redirect('back');
                    }

                    const { password } = req.body;
                    var hashPassword = bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
                    user.password = hashPassword;
                    user.reset_password_token = null;
                    user.reset_password_expires = null;

                    user.save();
                    done(null, user);
                });
            },
            function (user, done) {

                var text = 'Hello ' + user.name + ',\n\n' +
                    'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n\n' +
                    'Cheers';

                sendEmail(user.email, 'Your password has been changed', text, {})
                    .then(() => {
                        req.flash('success', 'Success! Your password has been changed.');
                        done(null, user);
                    })
                    .catch((err) => {
                        done(err);
                    });
            }
        ], function (err) {
            res.redirect('/');
        });
    });

    /**
     * Update Password user
     */
    app.get('/password', (req, res) => {

        const { logo, role, name } = req.user;

        res.render('site/password', { logo, role, name });
    });

    /**
     * Update Password user
     */
    app.post('/password', (req, res) => {

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        waterfall([
            function (done) {

                models.Users.findOne({ where: { id: req.user.id } }).then(user => {
                    if (!user) {
                        req.flash('error', 'Something went wrong, please login to continue.');
                        return res.redirect('login');
                    }

                    const { password, current_password } = req.body;

                    if (!bcrypt.compareSync(current_password, user.password)) {
                        req.flash('error', 'Your current password is wrong, please enter correct password to continue.');
                        return res.redirect('/password');
                    }

                    var hashPassword = bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
                    user.password = hashPassword;
                    user.reset_password_token = null;
                    user.reset_password_expires = null;

                    user.save();
                    done(null, user);
                });
            },
            function (user, done) {

                //                var text = 'Hello ' + user.name + ',\n\n' +
                //                        'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n\n' +
                //                        'Cheers';
                //
                //                sendEmail(user.email, 'Your password has been changed', text, {})
                //                        .then(() => {
                //                            req.flash('success', 'Success! Your password has been changed.');
                done(null, user);
                //                        })
                //                        .catch((err) => {
                //                            done(err);
                //                        });
            }
        ], function (err) {
            res.redirect('/');
        });
    });

    /**
     * Logout user
     */
    // app.get('/logout', (req, res) => {
    //     console.log("szcxv");
    //     res.clearCookie('remember_me');
    //     req.logout();
    //     res.redirect('/login');
    // });
    app.get('/logout', (req, res) => {
        console.log("Logging out...");
        res.clearCookie('remember_me'); // Clear the cookie
        req.logout(); // No callback needed in passport@0.7.0
        res.redirect('/login'); // Redirect to login page
    });


    /**
     * Sync Revenue
     */
    app.get('/sync-revenue', async (req, res) => {

        let { id, logo, email, name, cpi, role, contact_person, phone } = req.user;

        if (role.name === "SuperAdmin") {
            return res.send('Access is denied... ' + req.user.role.name);
        }

        const monthF = moment().format('MMMM-YYYY');
        const month = moment().startOf('month').format();

        let views = viewsThisMonth = today = weekly = monthly = yearly = [];
        let adViews = adViewsThisMonth = adToday = adWeekly = adMonthly = adYearly = [];
        let todayLogins = 0;

        views = await models.Statistics.findAll({
            attributes: [
                'user_id',
                [sequelize.fn('sum', sequelize.col('views')), 'views'],
            ],
            where: { user_id: id },
            group: ['user_id']
        });

        viewsThisMonth = await models.Statistics.findAll({
            attributes: [
                'user_id',
                [sequelize.fn('sum', sequelize.col('views')), 'views'],
            ],
            where: {
                user_id: id,
                createdAt: {
                    [Op.gt]: month
                }
            },
            group: ['user_id'],
        });

        today = await models.Statistics.findAll({
            where: {
                user_id: id,
                createdAt: {
                    [Op.gt]: moment().startOf('day').format()
                }
            },
            attributes: [
                [sequelize.fn('date_trunc', 'hour', sequelize.col('created_at')), 'hour'],
                [sequelize.fn('count', '*'), 'count']
            ],
            group: 'hour',
            raw: true
        });
        weekly = await models.Statistics.count({
            where: {
                user_id: id,
                createdAt: {
                    [Op.gt]: moment().startOf('week').format()
                }
            },
            attributes: [
                [sequelize.fn('date_trunc', 'day', sequelize.col('created_at')), 'day'],
                [sequelize.fn('count', '*'), 'count']
            ],
            group: 'day',
            raw: true
        });
        monthly = await models.Statistics.count({
            where: {
                user_id: id,
                createdAt: {
                    [Op.gt]: moment().startOf('month').format()
                }
            },
            attributes: [
                [sequelize.fn('date_trunc', 'day', sequelize.col('created_at')), 'day'],
                [sequelize.fn('count', '*'), 'count']
            ],
            group: 'day',
            raw: true
        });
        yearly = await models.Statistics.count({
            where: {
                user_id: id,
                createdAt: {
                    [Op.gt]: moment().startOf('year').format()
                }
            },
            attributes: [
                [sequelize.fn('date_trunc', 'month', sequelize.col('created_at')), 'month'],
                [sequelize.fn('count', '*'), 'count']
            ],
            group: 'month',
            raw: true
        });

        views = await models.Statistics.findAll({
            attributes: [
                'user_id',
                [sequelize.fn('sum', sequelize.col('views')), 'views'],
            ],
            where: { user_id: id },
            group: ['user_id']
        });

        viewsThisMonth = await models.Statistics.findAll({
            attributes: [
                'user_id',
                [sequelize.fn('sum', sequelize.col('views')), 'views'],
            ],
            where: {
                user_id: id,
                createdAt: {
                    [Op.gt]: month
                }
            },
            group: ['user_id'],
        });

        adViewsThisMonth = await models.AdViews.findAll({
            attributes: [
                [sequelize.fn('sum', sequelize.col('views')), 'views'],
            ],
            where: {
                user_id: id,
                createdAt: {
                    [Op.gt]: month
                }
            }
        });

        adToday = await models.AdViews.findAll({
            where: {
                user_id: id,
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

        adWeekly = await models.AdViews.count({
            where: {
                user_id: id,
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

        adMonthly = await models.AdViews.count({
            where: {
                user_id: id,
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

        adYearly = await models.AdViews.count({
            where: {
                user_id: id,
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

        let hasCPI = await models.RevenueStats.findOne({
            where: {
                user_id: id,
                month: monthF
            }
        });
        if (!hasCPI)
            await models.RevenueStats.create({ cpi, month: monthF, user_id: id });

        // Get Admin CPM
        var admin = await models.RevenueStats.findOne({
            attributes: ['cpi'],
            where: {
                user_id: '4c47bfca-51d2-40d3-bd61-651f02337e28',
                month: monthF
            }
        });
        if (!admin)
            admin = await models.RevenueStats.create({ cpi: 0, month: monthF, user_id: '4c47bfca-51d2-40d3-bd61-651f02337e28' });

        let totalViews = 0;
        if (views.length > 0)
            totalViews = views[0].views;

        let monthlyViews = 0;
        if (adViewsThisMonth.length > 0)
            monthlyViews = adViewsThisMonth[0].views;

        console.log('monthlyViews', monthlyViews);

        let pCPI = (role.name === "SuperAdmin") ? admin.cpi : cpi;
        let cpm = (role.name === "SuperAdmin") ? admin.cpi : (pCPI / 100) * admin.cpi;
        let revenue = ((monthlyViews / 1000) * cpm).toFixed(2);
        let grossRevenue = ((monthlyViews / 1000) * admin.cpi).toFixed(2);

        //Realtime update views in RevenueStats
        await models.RevenueStats.update(
            { views: monthlyViews, revenue, gross_revenue: grossRevenue },
            {
                where: { user_id: id, month: monthF }
            }
        );

        if (adYearly.length > 0 && role.name !== "SuperAdmin") {

            let dd = await Promise.all(adYearly.map(async data => {
                let monViews = data.count;
                let mon = moment(data.month).format('MMMM-YYYY');

                let pCPI = (role.name === "SuperAdmin") ? admin.cpi : cpi;
                let cpm = (role.name === "SuperAdmin") ? admin.cpi : (pCPI / 100) * admin.cpi;
                let revenue = ((monViews / 1000) * cpm).toFixed(2);
                let grossRevenue = ((monViews / 1000) * admin.cpi).toFixed(2);

                const nw = { views: monViews, revenue, gross_revenue: grossRevenue, month: mon, user_id: id };
                const revRevision = await models.RevenueStats.findOne(
                    {
                        where: { user_id: id, month: mon },
                        raw: true
                    }
                );

                if (revRevision && (revRevision.views === null || revRevision.views == '0.00') && monViews > 0) {
                    //Revision update views in RevenueStats
                    await models.RevenueStats.update(
                        { views: monViews, revenue, gross_revenue: grossRevenue },
                        {
                            where: { user_id: id, month: mon }
                        }
                    );
                } else if (!revRevision && monViews > 0) {
                    await models.RevenueStats.create(
                        { views: monViews, revenue, gross_revenue: grossRevenue, user_id: id, month }
                    );
                }
                return nw;
            }));
            req.flash('success', 'Revenue synced successfully.');
            return res.redirect("/");
        }
        req.flash('error', 'Nothing to Sync.');
        return res.redirect("/");
    });

    /**
     * Render view for dashboard
     */
    app.get('/sync-views/:uId', async (req, res) => {

        if (req.user.role.name !== "SuperAdmin") {
            return res.send('Access is denied... ' + req.user.role.name);
        }

        const user = await models.Users.findOne({
            where: { id: req.params.uId },
            include: [{
                model: models.Roles,
                as: 'role'
            }]
        });

        if (!user) {
            return res.send('Parameter is incorrect...');
        }

        let { id, logo, email, name, cpi, role, contact_person, phone } = user;
        const monthF = moment().format('MMMM-YYYY');
        const month = moment().startOf('month').format();

        let views = viewsThisMonth = today = weekly = monthly = yearly = [];
        let adViews = adViewsThisMonth = adToday = adWeekly = adMonthly = adYearly = [];
        let todayLogins = 0;
        if (role.name == "SuperAdmin") {

            return res.send('Not available for Superadmin.');

            todayLogins = await models.Logins.count({
                distinct: 'subscriber_id',
                where: {
                    createdAt: {
                        [Op.gt]: moment().startOf('day').format()
                    }
                },
            });

            views = await models.Statistics.findAll({
                attributes: [
                    [sequelize.fn('sum', sequelize.col('views')), 'views'],
                ]
            });

            viewsThisMonth = await models.Statistics.findAll({
                attributes: [
                    [sequelize.fn('sum', sequelize.col('views')), 'views'],
                ],
                where: {
                    createdAt: {
                        [Op.gt]: month
                    }
                }
            });

            today = await models.Statistics.findAll({
                where: {
                    createdAt: {
                        [Op.gt]: moment().startOf('day').format()
                    }
                },
                attributes: [
                    [sequelize.fn('date_trunc', 'hour', sequelize.col('created_at')), 'hour'],
                    [sequelize.fn('count', '*'), 'count']
                ],
                group: 'hour',
                raw: true
            });

            weekly = await models.Statistics.count({
                where: {
                    createdAt: {
                        [Op.gt]: moment().startOf('week').format()
                    }
                },
                attributes: [
                    [sequelize.fn('date_trunc', 'day', sequelize.col('created_at')), 'day'],
                    [sequelize.fn('count', '*'), 'count']
                ],
                group: 'day',
                raw: true
            });

            monthly = await models.Statistics.count({
                where: {
                    createdAt: {
                        [Op.gt]: moment().startOf('month').format()
                    }
                },
                attributes: [
                    [sequelize.fn('date_trunc', 'day', sequelize.col('created_at')), 'day'],
                    [sequelize.fn('count', '*'), 'count']
                ],
                group: 'day',
                raw: true
            });

            yearly = await models.Statistics.count({
                where: {
                    createdAt: {
                        [Op.gt]: moment().startOf('year').format()
                    }
                },
                attributes: [
                    [sequelize.fn('date_trunc', 'month', sequelize.col('created_at')), 'month'],
                    [sequelize.fn('count', '*'), 'count']
                ],
                group: 'month',
                raw: true
            });

            adViews = await models.AdViews.findAll({
                attributes: [
                    [sequelize.fn('sum', sequelize.col('views')), 'views'],
                ]
            });

            adViewsThisMonth = await models.AdViews.findAll({
                attributes: [
                    [sequelize.fn('sum', sequelize.col('views')), 'views'],
                ],
                where: {
                    createdAt: {
                        [Op.gt]: month
                    }
                }
            });

            adToday = await models.AdViews.findAll({
                where: {
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

            adWeekly = await models.AdViews.count({
                where: {
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

            adMonthly = await models.AdViews.count({
                where: {
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

            adYearly = await models.AdViews.count({
                where: {
                    createdAt: {
                        [Op.gt]: moment().startOf('year').format()
                    }
                },
                attributes: [
                    [sequelize.fn('date_trunc', 'month', sequelize.col('created_at')), 'month'],
                    [sequelize.fn('sum', sequelize.col('views')), 'count'],
                ],
                group: 'month',
                raw: true
            });

        } else {

            views = await models.Statistics.findAll({
                attributes: [
                    'user_id',
                    [sequelize.fn('sum', sequelize.col('views')), 'views'],
                ],
                where: { user_id: id },
                group: ['user_id']
            });

            viewsThisMonth = await models.Statistics.findAll({
                attributes: [
                    'user_id',
                    [sequelize.fn('sum', sequelize.col('views')), 'views'],
                ],
                where: {
                    user_id: id,
                    createdAt: {
                        [Op.gt]: month
                    }
                },
                group: ['user_id'],
            });

            today = await models.Statistics.findAll({
                where: {
                    user_id: id,
                    createdAt: {
                        [Op.gt]: moment().startOf('day').format()
                    }
                },
                attributes: [
                    [sequelize.fn('date_trunc', 'hour', sequelize.col('created_at')), 'hour'],
                    [sequelize.fn('count', '*'), 'count']
                ],
                group: 'hour',
                raw: true
            });
            weekly = await models.Statistics.count({
                where: {
                    user_id: id,
                    createdAt: {
                        [Op.gt]: moment().startOf('week').format()
                    }
                },
                attributes: [
                    [sequelize.fn('date_trunc', 'day', sequelize.col('created_at')), 'day'],
                    [sequelize.fn('count', '*'), 'count']
                ],
                group: 'day',
                raw: true
            });
            monthly = await models.Statistics.count({
                where: {
                    user_id: id,
                    createdAt: {
                        [Op.gt]: moment().startOf('month').format()
                    }
                },
                attributes: [
                    [sequelize.fn('date_trunc', 'day', sequelize.col('created_at')), 'day'],
                    [sequelize.fn('count', '*'), 'count']
                ],
                group: 'day',
                raw: true
            });
            yearly = await models.Statistics.count({
                where: {
                    user_id: id,
                    createdAt: {
                        [Op.gt]: moment().startOf('year').format()
                    }
                },
                attributes: [
                    [sequelize.fn('date_trunc', 'month', sequelize.col('created_at')), 'month'],
                    [sequelize.fn('count', '*'), 'count']
                ],
                group: 'month',
                raw: true
            });

            views = await models.Statistics.findAll({
                attributes: [
                    'user_id',
                    [sequelize.fn('sum', sequelize.col('views')), 'views'],
                ],
                where: { user_id: id },
                group: ['user_id']
            });

            viewsThisMonth = await models.Statistics.findAll({
                attributes: [
                    'user_id',
                    [sequelize.fn('sum', sequelize.col('views')), 'views'],
                ],
                where: {
                    user_id: id,
                    createdAt: {
                        [Op.gt]: month
                    }
                },
                group: ['user_id'],
            });

            adViewsThisMonth = await models.AdViews.findAll({
                attributes: [
                    [sequelize.fn('sum', sequelize.col('views')), 'views'],
                ],
                where: {
                    user_id: id,
                    createdAt: {
                        [Op.gt]: month
                    }
                }
            });

            adToday = await models.AdViews.findAll({
                where: {
                    user_id: id,
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

            adWeekly = await models.AdViews.count({
                where: {
                    user_id: id,
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

            adMonthly = await models.AdViews.count({
                where: {
                    user_id: id,
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

            adYearly = await models.AdViews.count({
                where: {
                    user_id: id,
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

            let hasCPI = await models.RevenueStats.findOne({
                where: {
                    user_id: id,
                    month: monthF
                }
            });
            if (!hasCPI)
                await models.RevenueStats.create({ cpi, month: monthF, user_id: id });
        }

        // Get Admin CPM
        var admin = await models.RevenueStats.findOne({
            attributes: ['cpi'],
            where: {
                user_id: '4c47bfca-51d2-40d3-bd61-651f02337e28',
                month: monthF
            }
        });
        if (!admin)
            admin = await models.RevenueStats.create({ cpi: 0, month: monthF, user_id: '4c47bfca-51d2-40d3-bd61-651f02337e28' });

        let totalViews = 0;
        if (views.length > 0)
            totalViews = views[0].views;

        let monthlyViews = 0;
        if (adViewsThisMonth.length > 0)
            monthlyViews = adViewsThisMonth[0].views;

        console.log('monthlyViews', monthlyViews);

        let pCPI = (role.name === "SuperAdmin") ? admin.cpi : cpi;
        let cpm = (role.name === "SuperAdmin") ? admin.cpi : (pCPI / 100) * admin.cpi;
        let revenue = ((monthlyViews / 1000) * cpm).toFixed(2);
        let grossRevenue = ((monthlyViews / 1000) * admin.cpi).toFixed(2);

        //Realtime update views in RevenueStats
        await models.RevenueStats.update(
            { views: monthlyViews, revenue, gross_revenue: grossRevenue },
            {
                where: { user_id: id, month: monthF }
            }
        );

        if (adYearly.length > 0 && role.name !== "SuperAdmin") {

            let changed = await Promise.all(adYearly.map(async data => {
                let monViews = data.count;
                let mon = moment(data.month).format('MMMM-YYYY');

                let pCPI = (role.name === "SuperAdmin") ? admin.cpi : cpi;
                let cpm = (role.name === "SuperAdmin") ? admin.cpi : (pCPI / 100) * admin.cpi;
                let revenue = ((monViews / 1000) * cpm).toFixed(2);
                let grossRevenue = ((monViews / 1000) * admin.cpi).toFixed(2);

                const nw = { views: monViews, revenue, gross_revenue: grossRevenue, month: mon, user_id: id };
                const revRevision = await models.RevenueStats.findOne(
                    {
                        where: { user_id: id, month: mon },
                        raw: true
                    }
                );

                if (revRevision && (revRevision.views === null || revRevision.views == '0.00') && monViews > 0) {
                    //Revision update views in RevenueStats
                    await models.RevenueStats.update(
                        { views: monViews, revenue, gross_revenue: grossRevenue },
                        {
                            where: { user_id: id, month: mon }
                        }
                    );
                } else if (!revRevision && monViews > 0) {
                    await models.RevenueStats.create(
                        { views: monViews, revenue, gross_revenue: grossRevenue, user_id: id, month }
                    );
                }
                return nw;
            }));
            console.log('changed', changed);
            req.flash('success', 'Revenue synced successfully, please make sure you verify the count.');
            return res.redirect("/users/index");
        }
        req.flash('error', 'Nothing to Sync.');
        return res.redirect("/users/index");
    });

};
