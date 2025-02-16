var login = require('./login');
var register = require('./register');
const models = require('../models');

module.exports = function(passport) {

	// Passport needs to be able to serialize and deserialize users to support persistent login sessions
    passport.serializeUser(function(user, done) {
        done(null, user);
    });

    passport.deserializeUser(function(user, done) {
        done(null, user);
    });

    // Setting up Passport Strategies for Login, Registration
    login(passport);
    register(passport);
};