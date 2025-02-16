const nodemailer = require('nodemailer');
const env = process.env.NODE_ENV || 'development';
const config = require('../../config/config.json')[env];
const hbs = require('nodemailer-express-handlebars');
const path = require('path');
const winston = require('winston');

    const logger = winston.createLogger({
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({ filename: 'combined.log' })
        ]
    });

const sendEmail = (email, subject, text, options, template = null, context = {}) => {


    const { host, username, password, port } = config.mail;
        var smtpConfig = {
            host: host,
            port: port,
    //        secure: true, // use SSL
            auth: {
                user: username,
                pass: password
            }
        };

        var smtpTransport = nodemailer.createTransport(smtpConfig);
        
        logger.info(template);
        if(template != null) {

            // point to the template folder
            const handlebarOptions = {
                viewEngine: {
                    partialsDir: path.resolve('./tempates/'),
                    defaultLayout: false,
                },
                viewPath: path.resolve('./tempates/'),
            };
        logger.info(handlebarOptions);

            // use a template file with nodemailer
            smtpTransport.use('compile', hbs(handlebarOptions))

            const mailOptions = {
                from: 'publisher@khabriya.in',  // sender address
                to: email,  // list of receivers
                subject: subject, // Subject line
                template, // the name of the template file, i.e., email.handlebars
                context,
            };
            console.log(mailOptions)
            // Send email function
            return new Promise((resolve, reject) => {

                smtpTransport.sendMail(mailOptions, function(err) {
                  smtpTransport.close();
                  if(err)
                    return reject(err);
                  else
                    return resolve(template);
                });
            });
        } else {
            // Set default options
            var mailOptions = {
              from: 'publisher@khabriya.in',  // sender address
              to: email,  // list of receivers
              subject: subject, // Subject line
              //html: text,
              text: 'test'
            };

            // Merge options if any new option provided
            // This will add fields or override old fields
            if (options) mailOptions = { ...mailOptions, ...options };
        }

        // Send email function
        return new Promise((resolve, reject) => {

            smtpTransport.sendMail(mailOptions, function(err) {
              smtpTransport.close();
              if(err)
                return reject(err);
              else
                return resolve('text');
            });
        });
};

// Export function
module.exports = { sendEmail };