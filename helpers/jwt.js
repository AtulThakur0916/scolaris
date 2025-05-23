const { expressjwt: jwt } = require('express-jwt');
const fs = require('fs');
const path = require('path');
const { Parents } = require('../models'); // adjust the path to your models

// Load config.json
const configPath = path.join(__dirname, '../config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// JWT Middleware
function verifyJwt() {
  return [
    jwt({ secret: config.jwt_secret, algorithms: ['HS256'] }),

    // Attach decoded token to req.user and validate parent existence
    async (req, res, next) => {
      try {
        if (!req.auth || !req.auth.id) {
          return res.status(401).json({ success: false, message: "Unauthorized: Invalid token payload" });
        }

        const parent = await Parents.findByPk(req.auth.id);

        if (!parent) {
          return res.status(401).json({ success: false, message: "Unauthorized: Parent does not exist" });
        }

        req.user = req.auth;
        next();

      } catch (error) {
        console.error("JWT validation error:", error.message);
        return res.status(500).json({ success: false, message: "Internal Server Error during auth" });
      }
    }
  ];
}

module.exports = verifyJwt;

