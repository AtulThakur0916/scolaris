const models = require('../models');
const waterfall = require('async-waterfall');
const path = require('path');
const moment = require('moment');

module.exports = function (app) {

    /**
     * Render view for manage languages
     */
    app.get('/languages/index', async (req, res) => {

        const { id, logo, role, name } = req.user;

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        if (role.name !== "SuperAdmin") {
            req.flash('error', 'You are not authorised to access this page.');
            return res.redirect('/');
        }

        var languages = await models.Languages.findAll({
            //            attributes: ['insert_language', 'status'],
            //            where: {
            //                status: 1,
            //            },
            raw: true,
            order: [['sort_value', 'ASC']]
        });

        res.render('languages/index', { languages: JSON.stringify(languages), role, name });
    });

    /*
     * Create a new language, get
     */
    app.get('/languages/create', async (req, res) => {

        const { role, name } = req.user;

        var language = {
            insert_language: '',
            branch: '',
            country: ''
        };

        if (req.session.language !== undefined) {
            language = req.session.language;
            delete req.session['language'];
        }

        res.render('languages/create', { role, name, language: JSON.stringify(language) });
    });

    /*
     * Create a new language, post
     */
    app.post('/languages/create', async (req, res) => {

        waterfall([
            function (done) {
                if (!req.isAuthenticated()) {
                    req.flash('error', 'Please login to continue');
                    return res.redirect('/login');
                } else {
                    done(null);
                }
            },
            function (done) {
                if (req.files !== null && Object.keys(req.files).length > 0 && req.files.image !== undefined) {
                    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
                    let file = req.files.image;
                    let image = file.name.split('.').join('-lang-' + Date.now() + '.');

                    // Use the mv() method to place the file somewhere on your server
                    file.mv(path.join(`public/uploads/${image}`), function (err) {
                        done(err, image);
                    });
                } else {
                    done(null, null);
                }
            },
            function (data, done) {

                let { insert_language, sort_value, branch, country } = req.body;
                branch = branch ? '1001' : '';
                const website = true;
                const status = true;
                let object = data !== null ? { insert_language, sort_value, status, image: "https://dashboard.khabriya.in/uploads/" + data, branch, website, country } : { insert_language, sort_value, status, image: "https://dashboard.khabriya.in/uploads/default-lang.png", branch, website, country };
                models.Languages.create(object)
                    .then(() => {
                        done(null, null);
                    })
                    .catch(error => {
                        req.session.language = req.body;
                        req.session.save();
                        console.log(error)
                        //req.flash('error', error.errors[0].message);
                        done(error, null);
                    });

            }
        ], function (err) {
            if (err)
                console.log(err);
            else
                req.flash('success', 'New language saved successfully.');
            res.redirect('/languages/index');
        });
    });

    /**
     * Update language
     */
    app.put('/languages/update', async (req, res) => {

        if (!req.isAuthenticated()) {
            req.flash('error', 'Please login to continue');
            return res.redirect('/login');
        }

        const { role } = req.user;
        if (role.name !== "SuperAdmin") {
            res.sendStatus({ status: 500, error: "You are not authorised to access this page." });
        }

        //        const { id } = req.params;
        let { id, insert_language, status, branch, website, sort_value, country } = req.body;
        branch = branch ? '1001' : '';
        //      models.UserPresentations.findOrCreate({where: {presentation_id: presentation.id}, defaults: {user_id: req.user.id}})
        models.Languages.update(
            { insert_language, status, branch, website, country },
            {
                where: { id }
            }
        )
            .then(function (rowsUpdated) {
                res.send({ id, insert_language, branch: branch === "true" ? true : false, status: status === "true" ? true : false, website: website === "true" ? true : false, sort_value, country });
            });
    });

    /**
     * Update channels
     */
    app.post('/languages/edit', async (req, res) => {

        waterfall([
            function (done) {
                if (!req.isAuthenticated()) {
                    req.flash('error', 'Please login to continue');
                    return res.redirect('/login');
                } else {
                    done(null);
                }
            },
            async function (done) {
                if (req.files !== null && Object.keys(req.files).length > 0 && req.files.image !== undefined) {
                    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
                    let file = req.files.image;
                    let image = file.name.split('.').join('-lang-' + Date.now() + '.');

                    // Use the mv() method to place the file somewhere on your server
                    file.mv(path.join(`public/uploads/${image}`), function (err) {
                        done(err, "https://dashboard.khabriya.in/uploads/" + image);
                    });
                } else {
                    done(null, null);
                }
            },
            async function (image, done) {

                let { id, insert_language, sort_value, branch, website, country } = req.body;
                branch = branch === 'on' ? '1001' : '';
                website = website === 'on' ? true : false;
                let object = image !== null ? { insert_language, image, sort_value, branch, website, country } : { insert_language, sort_value, branch, website, country };

                models.Languages.update(object,
                    {
                        where: { id }
                    }
                )
                    .then(function (rowsUpdated) {
                        if (rowsUpdated)
                            req.flash('success', insert_language + ' updated successfully.');

                        done(null);
                    });
            }
        ], function (err) {
            if (err)
                console.log(err);

            res.redirect('/languages/index');
        });
    });
};
