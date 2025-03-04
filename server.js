const express = require('express'),
  path = require('path'),
  fs = require('fs'),
  bodyParser = require('body-parser'),
  verifyJwt = require('./helpers/jwt'),
  errorHandler = require('./helpers/error-handler'),
  alert = require('./helpers/alert.js'),
  config = require('./config/config.json'),
  sequelize = require('sequelize'),
  //        cors = require('cors'),
  // flash = require('connect-flash'),
  fileUpload = require('express-fileupload');
// const session = require('express-session');



require('dotenv').config();
//route file 
const apiRouts = require('./routes/api')


const { initializeRedisClient } = require("./helpers/redis")

var session = require('express-session');
const flash = require('express-flash');
var app = express();
const methodOverride = require('method-override');
app.use(session({
  secret: 'e74c6ac40997da1a0c04a4be608c9ea1c29885271619795c02bd2eb11b27cdc2',
  resave: false,
  saveUninitialized: true
}));
app.use(flash());

app.use(methodOverride('_method'));
app.use(express.urlencoded({ extended: true }));

//routes for the API
app.use('/api', apiRouts)

const { sendEmail } = require('./helpers/zepto');  //Send email global function
const { Op } = sequelize;

var passport = require('passport');
require('./passport/init')(passport);

const hbs = require('express-handlebars');
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// parse application/json
app.use(bodyParser.json());

app.engine('hbs', hbs.engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/layouts/partials'),
  helpers: {
    ifEquals: function (v1, v2, options) {
      return v1 === v2 ? options.fn(this) : options.inverse(this);
    },
    json: function (context) {
      return JSON.stringify(context, null, 2);
    },
    eq: function (a, b) {
      return a === b;
    },
    startsWith: function (a, b) {
      return a && a.startsWith(b);
    }
  }
}));
app.set('view engine', 'hbs');

app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/public'));

//app.set('trust proxy', 1) // trust first proxy

//Session
app.use(session({
  secret: 'P5&A%R3s1Z(3Ea!dN@n!T3R7A',
  key: 'super-secret-cookie',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

// file upload default options
app.use(fileUpload());

// global error handler
app.use(errorHandler);


// Flash middleware
app.use(flash());

// Make flash messages available to all views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  next();
});
// global alert handler
alert.handle(sequelize, sendEmail, Op); // Uncomment this for alerts

//isRoute Authenticated
app.get('/*', (req, res, next) => {

  const publicRoutes = [
    '/login', '/register', '/forgot', '/notify'
  ]

  if (req.path.indexOf('/reset') === 0) // Add reset authentication
    publicRoutes.push(req.path);

  if (req.path.indexOf('/admin/') === 0) // No authentication rule for API routes
    publicRoutes.push(req.path);

  if (!req.isAuthenticated() && publicRoutes.indexOf(req.path) < 0) {
    res.redirect('/login');
  } else {
    if (req.isAuthenticated() && publicRoutes.indexOf(req.path) >= 0) {
      res.redirect('/');
    } else {
      next();
    }
  }
});

// // dynamically include routes (Controller)
// fs.readdirSync('./controllers').forEach(function (file) {

//   if (file.substr(-3) === '.js') {
//     var route = require('./controllers/' + file);
//     route.controller(app, passport, sendEmail, Op, sequelize);
//   }
// });

fs.readdirSync('./controllers').forEach(function (file) {
  if (file.endsWith('.js')) {
    const route = require('./controllers/' + file);

    if (typeof route === 'function') {
      route(app, passport, sendEmail, Op, sequelize);
      console.log(`Loaded controller: ${file}`);
    } else {
      console.warn(`⚠️ Skipping invalid controller file: ${file}`);
    }
  }
});

app.use((req, res, next) => {
  console.log(`\n===== Incoming Request =====`);
  console.log(`🔹 Method: ${req.method}`);
  console.log(`🔹 URL: ${req.originalUrl}`);
  console.log(`🔹 Headers:`, req.headers);
  console.log(`🔹 Body:`, req.body);
  console.log(`🔹 Query Params:`, req.query);
  console.log(`🔹 Params:`, req.params);
  console.log(`===========================\n`);
  next();
});



module.exports = { app, initializeRedisClient };