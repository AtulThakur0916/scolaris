const models = require('../models');
const waterfall = require('async-waterfall');
const path = require('path');
const moment = require('moment');

module.exports = function (app) {

    /**
     * Render view for manage notifications
     */
    app.get('/config/index', async (req, res) => {

        const { id, logo, role, name } = req.user;

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        var configs = await models.Configs.findAll({
            raw: true,
            order: [['created_at', 'ASC']]
        });

        res.render('configs/index', { configs: JSON.stringify(configs), role, name });
    });

    /*
     * Create a new notify, get
     */
    app.get('/config/create', async (req, res) => {

        const { role, name } = req.user;

        var config = {
            key: '',
            config_type: 'info',
            value: 'all',
            status: true,
            other: ''
        };

        if (req.session.config !== undefined) {
            config = req.session.config;
            delete req.session['config'];
        }

        res.render('configs/create', { role, name, config: JSON.stringify(config) });
    });

    /*
     * Create a new notify, post
     */
    app.post('/config/create', async (req, res) => {

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

                const { key, config_type, value, other, status } = req.body;

                let object = { key, config_type, value, other, status: status === 'on' ? true : false };

                models.Configs.create(object)
                    .then(() => {
                        req.flash('success', 'New Config has been created.');
                        done(null, null);
                    })
                    .catch(error => {
                        req.session.config = req.body;
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
                req.flash('success', 'New Config save successfully.');
            res.redirect('/config/index');
        });
    });

    /**
     * Update notifications
     */
    app.post('/config/update', async (req, res) => {

        waterfall([
            function (done) {
                if (!req.isAuthenticated()) {
                    req.flash('error', 'Please login to continue');
                    return res.redirect('/login');
                } else {
                    done(null);
                }
            },
            async function (done) {

                const { id, key, config_type, value, other, status } = req.body;

                let object = { key, config_type, value, other, status: status === 'on' ? true : false };

                models.Configs.update(object,
                    {
                        where: { id }
                    }
                )
                    .then(function (rowsUpdated) {
                        if (rowsUpdated)
                            req.flash('success', 'Config updated successfully.');

                        done(null);
                    });
            }
        ], function (err) {
            if (err)
                console.log(err);

            res.redirect('/config/index');
        });
    });
};
