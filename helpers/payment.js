const { Paystack } = require('paystack-sdk');
const paystack = new Paystack('sk_live_2942278ee9ac231f3c85de21574fcbc74a076dff'); // Replace with your real secret key

module.exports = paystack;