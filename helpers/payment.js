const { Paystack } = require('paystack-sdk');
const paystack = new Paystack('sk_test_a90f5baee41da5dd6ae6d0e37e37e6d5da0dde84'); // Replace with your real secret key

module.exports = paystack;