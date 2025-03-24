const { Payments, Students, Schools, Parents } = require('../models');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

module.exports.controller = function (app) {
    app.get('/payments/index', async (req, res) => {
        try {
            const payments = await Payments.findAll({
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

            // Convert Sequelize instances to plain objects if needed
            const plainPayments = payments.map((payment) => payment.get({ plain: true }));

            // Pass plainPayments to the view if needed
            res.render('payments/index', { payments: plainPayments });
        } catch (error) {
            console.error('Error fetching payments:', error);
            req.flash('error', 'Unable to fetch payments.');
            res.redirect('/dashboard');
        }
    });


    app.get('/payments/views/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const payment = await Payments.findByPk(id, {
                include: [
                    {
                        model: Students,
                        as: 'student',
                        include: [
                            { model: Schools, as: 'school' },
                        ],
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

};
