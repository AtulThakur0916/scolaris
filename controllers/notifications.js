const models = require('../models');
const waterfall = require('async-waterfall');
const path = require('path');
const moment = require('moment');

module.exports.controller = function (app, passport, sendEmail, Op, sequelize) {

    /**
     * Render view for manage notifications
     */
    app.get('/notifications/index', async(req, res) => {

        const {id, logo, role, name} = req.user;

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if(role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        var notifications = await models.Notifications.findAll({
            raw: true,
            order: [['sort_value', 'ASC']]
        });

//        var subscribers = await models.Subscribers.findAll({
//            attributes: ['id', 'email'],
//            where: {
//                subscriber_id,
//                status: 'PAID',
//                valid_to: {[Op.gt]: Date.now()}
//            },
//            raw: true,
//            limit: 5,
//            offset: 0,
//            order: [['valid_to', 'DESC']]
//        });

        res.render('notifications/index', {notifications: JSON.stringify(notifications), role, name});
    });

    /*
     * Create a new notify, get
     */
    app.get('/notifications/create', async(req, res) => {

        const {role, name} = req.user;

        var notify = {
            message: '',
            notify_type: 'info',
            notify_for: 'all',
            status: true,
            sort_value: 0
        };
        
        if(req.session.notify !== undefined) {
            notify = req.session.notify;
            delete req.session['notify'];
        }

        res.render('notifications/create', {role, name, notify: JSON.stringify(notify)});
    });

    /*
     * Create a new notify, post
     */
    app.post('/notifications/create', async(req, res) => {

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
                
                const { message, notify_type, notify_for, subscriber_id, status, sort_value } = req.body;
                
                let object = { message, notify_type, notify_for, subscriber_id, status: status === 'on' ? true : false, sort_value };

                models.Notifications.create(object)
                    .then(() => {
                        req.flash('success', 'New Notification has been created.');
                        done(null, null);
                    })
                    .catch(error => {
                        req.session.notify = req.body;
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
                req.flash('success', 'New Notification save successfully.');
            res.redirect('/notifications/index');
        });
    });

    /**
     * Update notifications
     */
    app.post('/notifications/update', async(req, res) => {

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

                const { id, message, notify_type, notify_for, subscriber_id, status, sort_value } = req.body;
                
                let object = { message, notify_type, notify_for, subscriber_id, status: status === 'on' ? true : false, sort_value };

                models.Notifications.update( object,
                    {
                        where: {id}
                    }
                )
                .then(function (rowsUpdated) { 
                   if(rowsUpdated)
                        req.flash('success', 'Notification updated successfully.');
                    
                    done(null);
                });
            }
        ], function (err) {
            if (err)
                console.log(err);

            res.redirect('/notifications/index');
        });
    });
};
