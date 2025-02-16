const LocalStrategy = require('passport-local').Strategy;
const models = require('../models');
const bcrypt = require('bcryptjs');

module.exports = function(passport){

	passport.use('register', new LocalStrategy({
        usernameField: 'user_name',
        passwordField: 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
      },
        function(req, email, password, done) {

          findOrCreateUser = async() => {

            const { user_name, token_code } = req.body;
            var object = {
              user_name: user_name,
              token_code: token_code,
              password: createHash(password)
            };

            await models.Users.create(object)
              .then(async(newUser) => {
                    const user = await models.Users.findOne({
                        where: {id: newUser.id},
                        include: [{
                            model: models.Roles,
                            as: 'role'
                        }]
                    });
                    done(null, user)
                })
              .catch(error => {
                req.session.register = req.body;
                req.session.save();
                done(null, false, req.flash('error', error.errors[0].message, req.body));
              });
          };
          // Delay the execution of findOrCreateUser and execute the method
          // in the next tick of the event loop
          process.nextTick(findOrCreateUser);
      })
    );

    // Generates hash using bCrypt
    var createHash = function(password){
      return bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
    };
};