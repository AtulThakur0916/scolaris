const { Paystack } = require('paystack-sdk');
const paystack = new Paystack('sk_live_c273ac78a5d6b8c32a4643dcb1ad545beed6d20f'); // Replace with your real secret key

module.exports = paystack;