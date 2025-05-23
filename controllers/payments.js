const { Payments, Students, Schools, Parents, SchoolSubscriptions } = require('../models');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

module.exports.controller = function (app) {
    app.get('/payments/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School" && req.user.role.name !== "SubAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const whereCondition = {};

            // Only fetch related school payments for School role or SubAdmin role
            if (req.user.role.name === "School" || req.user.role.name === "SubAdmin") {
                whereCondition.school_id = req.user.school_id;
            }

            const payments = await Payments.findAll({
                where: whereCondition,
                include: [
                    {
                        model: Students,
                        as: 'student',
                        include: [{ model: Schools, as: 'school' }]
                    },
                    { model: Parents, as: 'parent' }
                ],
                order: [['created_at', 'DESC']],
            });

            const plainPayments = payments.map(payment => payment.get({ plain: true }));

            res.render('payments/index', { payments: plainPayments });
        } catch (error) {
            console.error('Error fetching payments:', error);
            req.flash('error', 'Unable to fetch payments.');
            res.redirect('/dashboard');
        }
    });

    app.get('/payments/views/:id', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "School" && req.user.role.name !== "SubAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        const { id } = req.params;

        try {
            const payment = await Payments.findByPk(id, {
                include: [
                    {
                        model: Students,
                        as: 'student',
                        include: [{ model: Schools, as: 'school' }]
                    },
                    { model: Parents, as: 'parent' }
                ],
            });

            if (!payment) {
                req.flash('error', 'Payment not found.');
                return res.redirect('/payments');
            }

            res.render('payments/view', { payment: payment.get({ plain: true }) });
        } catch (error) {
            console.error('Error fetching payment details:', error);
            req.flash('error', 'Unable to fetch payment details.');
            res.redirect('/payments');
        }
    });

    // School Subscription

    // School Subscription List
    app.get('/subscriptions/index', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        try {
            const subscriptions = await SchoolSubscriptions.findAll({
                include: [
                    {
                        model: Schools,
                        as: 'school',
                        attributes: ['id','name', 'email']
                    }
                ],
                order: [['created_at', 'DESC']],
            });

            const plainSubscriptions = subscriptions.map(sub => sub.get({ plain: true }));
            res.render('subscriptions/index', { subscriptions: plainSubscriptions });
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
            req.flash('error', 'Unable to fetch subscriptions.');
            res.redirect('/dashboard');
        }
    });

    // School Subscription Details View
    app.get('/subscriptions/views/:id', async (req, res) => {
        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (req.user.role.name !== "SuperAdmin" && req.user.role.name !== "SubAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        const { id } = req.params;

        try {
            const subscription = await SchoolSubscriptions.findByPk(id, {
                include: [
                    {
                        model: Schools,
                        as: 'school',
                        attributes: ['name', 'email', 'phone_number', 'location']
                    }
                ],
            });

            if (!subscription) {
                req.flash('error', 'Subscription not found.');
                return res.redirect('/subscriptions');
            }

            res.render('subscriptions/view', { subscription: subscription.get({ plain: true }) });
        } catch (error) {
            console.error('Error fetching subscription details:', error);
            req.flash('error', 'Unable to fetch subscription details.');
            res.redirect('/subscriptions');
        }
    });
};
