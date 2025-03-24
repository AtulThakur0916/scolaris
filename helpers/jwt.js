const { expressjwt: jwt } = require('express-jwt');
const fs = require('fs');
const path = require('path');

// Load config.json
const configPath = path.join(__dirname, '../config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// JWT Middleware
function verifyJwt() {
  return [
    jwt({ secret: config.jwt_secret, algorithms: ['HS256'] }),

    // Attach decoded token to req.user
    (req, res, next) => {
      if (req.auth) {
        req.user = req.auth;  // ✅ Attach decoded token to req.user
      }
      next();
    }
  ];
}

module.exports = verifyJwt;
