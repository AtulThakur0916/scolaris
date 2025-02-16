const LocalStrategy = require('passport-local').Strategy;
const models = require('../models');
const bcrypt = require('bcryptjs');

module.exports = function (passport) {

  passport.use('login', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
  },
    async (req, email, password, done) => {
      // check in database if a user with email exists or not
      const user = await models.Users.findOne({
        where: {email: email},
        include: [{
            model: models.Roles,
            as: 'role'
        }]
      });
      if (!user) {
        return done(null, false, req.flash('error', 'User not found.'));
      }
      if (!isValidPassword(user, password)) {
        return done(null, false, req.flash('error', 'Invalid Password'));
      }
      
      return done(null, user);
    })
  );

  var isValidPassword = ((user, password) => bcrypt.compareSync(password, user.password));
};