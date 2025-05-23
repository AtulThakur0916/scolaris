const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const verifyJwt = require('./helpers/jwt');
const errorHandler = require('./helpers/error-handler');
const cron = require('./helpers/cron.js');
const config = require('./config/config.json');
const sequelize = require('sequelize');
const fileUpload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const session = require('express-session');
const flash = require('express-flash');
const methodOverride = require('method-override');
const { Users } = require('./models'); // Ensure correct import
const { sendEmail } = require('./helpers/zepto');
const { Op } = sequelize;
const { initializeRedisClient } = require('./helpers/redis');

//const apiRoutes = require('./routes/api');
require('dotenv').config();
require('./passport/init')(passport);

const app = express();

// Middleware Setup
app.use(flash());
app.use(methodOverride('_method'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session Configuration
app.use(
    session({
        secret: 'P5&A%R3s1Z(3Ea!dN@n!T3R7A',
        key: 'super-secret-cookie',
        resave: false,
        saveUninitialized: false,
        // cookie: { secure: false, maxAge: 1 * 60 * 60 * 1000 }, // 1-hour session
        cookie: { secure: false }
    })
);

app.use(passport.initialize());
app.use(passport.session()); // Persistent login sessions

// File Upload Middleware
app.use(fileUpload());

// Body Parsing Middleware
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json());

// Static Files & View Engine (Handlebars)
app.engine(
    'hbs',
    require('express-handlebars').engine({
        extname: '.hbs',
        defaultLayout: 'main',
        layoutsDir: path.join(__dirname, 'views/layouts'),
        partialsDir: path.join(__dirname, 'views/layouts/partials'),
        helpers: {
            ifEquals: (v1, v2, options) => (v1 === v2 ? options.fn(this) : options.inverse(this)),
            json: (context) => JSON.stringify(context, null, 2),
            eq: (a, b) => a === b,
            startsWith: (a, b) => a && a.startsWith(b),
        },
    })
);


app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
// API Routes
//app.use('/api', apiRoutes);

app.use(async (req, res, next) => {
    if (!req.isAuthenticated() && req.cookies.remember_me && !req.session.logout_flag) {
        try {
            const user = await Users.findByPk(req.cookies.remember_me);
            if (user) {
                req.login(user, (err) => {
                    if (err) {
                        console.error('Auto-login error:', err);
                        return next(err);
                    }
                    return next();
                });
            } else {
                res.clearCookie('remember_me');
                return next();
            }
        } catch (error) {
            console.error('Error fetching user:', error);
            return next(error);
        }
    } else {
        next();
    }
});

// Flash Middleware (For Notifications)
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentPath = req.path;
    next();
});

// Global Alert Handling
cron.handle(sequelize, sendEmail, Op);

// Route Authentication Middleware
app.get('/*', (req, res, next) => {
    const publicRoutes = ['/login', '/register', '/forgot', '/forgot-password', '/reset-password/:token', '/notify', '/web/school/add', '/web/school/save'];

    if (req.path.startsWith('/reset') || req.path.startsWith('/admin/')) {
        publicRoutes.push(req.path);
    }

    if (req.path.startsWith('/api/')) {
        return next();
    }
    if (req.path.startsWith('/web/')) {
        return next();
    }
    if (!req.isAuthenticated() && !publicRoutes.includes(req.path)) {
        return res.redirect('/login');
    }

    if (req.isAuthenticated() && publicRoutes.includes(req.path)) {
        return res.redirect('/');
    }

    next();
});

//Dynamically Load Controllers
fs.readdirSync('./controllers').forEach((file) => {
    if (file === 'api') {
        fs.readdirSync('./controllers/api/v1/').forEach(function (file) {

            if (file.endsWith('.js')) {
                var api = require('./controllers/api/v1/' + file);
                api.controller(app, verifyJwt, sendEmail, Op, config, sequelize);
            }
        });
    } else if (file.endsWith('.js')) {
        const route = require(`./controllers/${file}`);
        route.controller(app, passport, sendEmail, Op, sequelize);
    }
});

app.use(errorHandler);

module.exports = { app, initializeRedisClient };
