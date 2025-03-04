// E:\lms\helpers\dd.js
const util = require('util');

const dd = (...args) => {
    console.log(util.inspect(args, { depth: null, colors: true }));
    process.exit();
};

module.exports = dd;
