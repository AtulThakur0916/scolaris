const models = require('../models');
const waterfall = require('async-waterfall');
const path = require('path');
const moment = require('moment');

module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

    /*
     * Create a new setting, get
     */
    app.get('/settings', async (req, res) => {

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        const { role, name } = req.user;
        if (role.name !== "SuperAdmin") {
            req.flash('error', 'You are trying to access unauthorized page.');
            return res.redirect('/');
            //res.sendStatus({status: 500, error: "You are not authorised to access this page."});
        }

        var setting = await models.Settings.findOne({
            limit: 1,
            raw: true,
            order: [['created_at', 'DESC']]
        });

        if (!setting) {
            setting = {
                id: null,
                version: '',
                force_update: true,
                payment_activate: true,
                message: '',
                sort_value: '',
                watch_api: true
            };
        }

        console.log('setting', setting);
        res.render('settings/create', { role, name, setting });
    });

    /*
     * Create a new setting, post
     */
    app.post('/settings/create', async (req, res) => {

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

                const { version, force_update, payment_activate, message, sort_value, watch_api } = req.body;

                let object = { version, force_update, payment_activate, message, sort_value, watch_api };

                models.Settings.create(object)
                    .then(() => {
                        req.flash('success', 'New Setting has been saved.');
                        done(null, null);
                    })
                    .catch(error => {
                        req.session.setting = req.body;
                        req.session.save();
                        console.log(error)
                        req.flash('error', error.errors[0].message);
                        done(error, null);
                    });

            }
        ], function (err) {
            if (err)
                console.log(err);
            else
                req.flash('success', 'New setting save successfully.');
            res.redirect('/settings/index');
        });
    });

    /**
     * Update settings
     */
    app.post('/settings', async (req, res) => {

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        const { role } = req.user;
        if (role.name !== "SuperAdmin") {
            req.flash('error', 'You are trying to access unauthorized page.');
            return res.redirect('/');
            //res.sendStatus({status: 500, error: "You are not authorised to access this page."});
        }

        const { version, force_update, payment_activate, message, sort_value, watch_api } = req.body;
        const id = req.body.id || null;
        try {

            const object = { version, payment_activate: payment_activate == 'on' ? true : false, force_update: force_update == 'on' ? true : false, message, sort_value, watch_api: watch_api == 'on' ? true : false };
            if (id === null) {
                await models.Settings.create(object);
            } else {
                await models.Settings.update(object,
                    {
                        where: {
                            id
                        }
                    }
                )
            }
            req.flash('success', 'Setting saved successfully.');
            return res.redirect('/settings');
        } catch (err) {
            req.flash('error', err.message);
            res.redirect('/settings');
        }
    });
};
