const expressJwt = require('express-jwt');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config/config.json'); // Adjust path if needed
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')); // Read config.json

module.exports = verifyJwt;

function verifyJwt() {
  return expressJwt({ secret: config.jwt_secret, algorithms: ['HS256'] }).unless({
    path: ['/api/v2/status']
  });
}
