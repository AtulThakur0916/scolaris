const expressJwt = require('express-jwt');
const config = require('../config/config.json');
const models = require('../models');
const fs = require('fs');

module.exports = verifyJwt;

function verifyJwt() {
  const secret = fs.readFileSync('certs/public.key');

  return expressJwt({ secret, algorithms: ['RS256'], isRevoked: isRevokedCallback }).unless({
    path: [
      // public routes that don't require authentication
      '/api/v2/status',
    ]
  });
}

async function isRevokedCallback(req, payload, done) {

    console.log('isRevoked', req.path, payload, req.body);
    const subscribers = await models.Subscribers.findOne({ where: {id: payload.id } });

    // revoke token if user no longer exists
    if (!subscribers) {
        return done(null, true);
    }
    done();
}