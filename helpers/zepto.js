var { SendMailClient } = require("zeptomail");
const fs = require('fs');
const handlebars = require('handlebars');
const path = require('path');

//const env = process.env.NODE_ENV || 'development';
//const config = require('../config/config.json')[env];

const sendEmail = (email, subject, text, options) => {

    const url = "api.zeptomail.in/";
    const token = "Zoho-enczapikey PHtE6r1cFrvqiGUt8BcF4f+8EpbxPdh/qbsxJAQWt4cXW/YEGk0Bqtt4lmCyqkguAPlGFfSYno9r5ezP5+mHIWq5ZzsdWmqyqK3sx/VYSPOZsbq6x00ctl0ZckHdV4DuddVs0CLWvd3cNA==";

    let client = new SendMailClient({ url, token });
    //    const { host, username, password, port } = config.mail;


    return new Promise((resolve, reject) => {

        client.sendMail({
            "from": {
                "address": "noreply@khabriya.in",
                "name": "Scolaris Pay"
            }, "to": [{
                "email_address": {
                    "address": email,
                    //                    "name": "Apps"
                }
            }],
            "subject": subject,
            "textbody": text,
        }).then((resp) => resolve(resp)).catch((error) => reject(error));
    });
};

const paymentSuccess = (email, variables) => {

    const url = "api.zeptomail.in/v1.1/email/template";
    const token = "Zoho-enczapikey PHtE6r1cFrvqiGUt8BcF4f+8EpbxPdh/qbsxJAQWt4cXW/YEGk0Bqtt4lmCyqkguAPlGFfSYno9r5ezP5+mHIWq5ZzsdWmqyqK3sx/VYSPOZsbq6x00ctl0ZckHdV4DuddVs0CLWvd3cNA==";

    let client = new SendMailClient({ url, token });

    return new Promise((resolve, reject) => {
        client.sendMail({
            "mail_template_key": "2518b.1c74ee1eb79b1b91.k1.34e1b170-ee98-11ee-b53a-525400ab18e6.18e8f845607",
            "from": {
                "address": "noreply@khabriya.in",
                "name": "Scolaris Pay"
            },
            "to": [{
                "email_address": {
                    "address": email,
                }
            }],
            "merge_info": variables,
            "subject": "Payment Successful Scolaris Pay"
        }).then((resp) => resolve(resp)).catch((error) => reject(error));
    });
}

const planExpiry = (email, variables) => {

    const url = "api.zeptomail.in/v1.1/email/template";
    const token = "Zoho-enczapikey PHtE6r1cFrvqiGUt8BcF4f+8EpbxPdh/qbsxJAQWt4cXW/YEGk0Bqtt4lmCyqkguAPlGFfSYno9r5ezP5+mHIWq5ZzsdWmqyqK3sx/VYSPOZsbq6x00ctl0ZckHdV4DuddVs0CLWvd3cNA==";

    let client = new SendMailClient({ url, token });

    return new Promise((resolve, reject) => {
        client.sendMail({
            "mail_template_key": "2518b.1c74ee1eb79b1b91.k1.511e6170-5b0e-11ef-950f-525400674725.19156545107",
            "from": {
                "address": "noreply@khabriya.in",
                "name": "Scolaris Pay"
            },
            "to": [{
                "email_address": {
                    "address": email,
                }
            }],
            "merge_info": variables,
            "subject": "Plan Expiry - Scolaris Pay"
        }).then((resp) => resolve(resp)).catch((error) => reject(error));
    });
}

const planExpiryNeo = (email, variables) => {

    const url = "api.zeptomail.in/v1.1/email/template";
    const token = "Zoho-enczapikey PHtE6r1cFrvqiGUt8BcF4f+8EpbxPdh/qbsxJAQWt4cXW/YEGk0Bqtt4lmCyqkguAPlGFfSYno9r5ezP5+mHIWq5ZzsdWmqyqK3sx/VYSPOZsbq6x00ctl0ZckHdV4DuddVs0CLWvd3cNA==";

    let client = new SendMailClient({ url, token });

    return new Promise((resolve, reject) => {
        client.sendMail({
            "mail_template_key": "2518b.1c74ee1eb79b1b91.k1.8bbb5780-7449-11ef-b8eb-525400ab18e6.191fbaf84f8",
            "from": {
                "address": "notify@neotvapp.com",
                "name": "Neo TV+"
            },
            "to": [{
                "email_address": {
                    "address": email,
                }
            }],
            "merge_info": variables,
            "subject": "Plan Expiry - Neo TV+"
        }).then((resp) => resolve(resp)).catch((error) => reject(error));
    });
}

const schoolApproval = (email, variables) => {
    const url = "api.zeptomail.in/v1.1/email";
    const token = "Zoho-enczapikey PHtE6r1cFrvqiGUt8BcF4f+8EpbxPdh/qbsxJAQWt4cXW/YEGk0Bqtt4lmCyqkguAPlGFfSYno9r5ezP5+mHIWq5ZzsdWmqyqK3sx/VYSPOZsbq6x00ctl0ZckHdV4DuddVs0CLWvd3cNA==";

    const client = new SendMailClient({ url, token });

    // Read and compile the Handlebars template from the 'tempates' folder
    const templatePath = path.join(__dirname, '../tempates/school_approval.hbs');

    let templateContent;
    try {
        templateContent = fs.readFileSync(templatePath, 'utf-8');
    } catch (err) {
        return Promise.reject(new Error("Error reading school approval email template: " + err.message));
    }

    const template = handlebars.compile(templateContent);
    const htmlContent = template(variables);

    return new Promise((resolve, reject) => {
        client.sendMail({
            from: {
                address: "noreply@khabriya.in",
                name: "Scolaris Pay"
            },
            to: [{
                email_address: { address: email }
            }],
            subject: "School Registration Approved - Payment Required",
            htmlbody: htmlContent
        }).then(resolve).catch(reject);
    });
};

const schoolReject = (email, variables) => {
    const url = "api.zeptomail.in/v1.1/email";
    const token = "Zoho-enczapikey PHtE6r1cFrvqiGUt8BcF4f+8EpbxPdh/qbsxJAQWt4cXW/YEGk0Bqtt4lmCyqkguAPlGFfSYno9r5ezP5+mHIWq5ZzsdWmqyqK3sx/VYSPOZsbq6x00ctl0ZckHdV4DuddVs0CLWvd3cNA==";

    const client = new SendMailClient({ url, token });

    // Read and compile the Handlebars template
    const templatePath = path.join(__dirname, '../tempates/school_reject.hbs');

    let templateContent;
    try {
        templateContent = fs.readFileSync(templatePath, 'utf-8');
    } catch (err) {
        return Promise.reject(new Error("Error reading school rejection email template: " + err.message));
    }

    const template = handlebars.compile(templateContent);
    const htmlContent = template(variables);

    return new Promise((resolve, reject) => {
        client.sendMail({
            from: {
                address: "noreply@khabriya.in",
                name: "Scolaris Pay"
            },
            to: [{
                email_address: { address: email }
            }],
            subject: "School Registration Status Update",
            htmlbody: htmlContent
        }).then(resolve).catch(reject);
    });
};
const forgotPassword = (email, variables) => {
    const url = "api.zeptomail.in/v1.1/email";
    const token = "Zoho-enczapikey PHtE6r1cFrvqiGUt8BcF4f+8EpbxPdh/qbsxJAQWt4cXW/YEGk0Bqtt4lmCyqkguAPlGFfSYno9r5ezP5+mHIWq5ZzsdWmqyqK3sx/VYSPOZsbq6x00ctl0ZckHdV4DuddVs0CLWvd3cNA==";

    const client = new SendMailClient({ url, token });

    // Read and compile the Handlebars template
    const templatePath = path.join(__dirname, '../tempates/forgot_password.hbs');

    let templateContent;
    try {
        templateContent = fs.readFileSync(templatePath, 'utf-8');
    } catch (err) {
        return Promise.reject(new Error("Error reading forgot password email template: " + err.message));
    }

    const template = handlebars.compile(templateContent);
    const htmlContent = template(variables);

    return new Promise((resolve, reject) => {
        client.sendMail({
            from: {
                address: "noreply@khabriya.in",
                name: "Scolaris Pay"
            },
            to: [{
                email_address: { address: email }
            }],
            subject: "Reset Your Password - Scolaris Pay",
            htmlbody: htmlContent
        }).then(resolve).catch(reject);
    });
};
// Update exports
module.exports = { sendEmail, paymentSuccess, planExpiry, forgotPassword, planExpiryNeo, schoolApproval, schoolReject };
