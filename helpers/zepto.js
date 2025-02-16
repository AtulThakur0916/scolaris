var { SendMailClient } = require("zeptomail");

//const env = process.env.NODE_ENV || 'development';
//const config = require('../config/config.json')[env];

const sendEmail = (email, subject, text, options) => {

    const url = "api.zeptomail.in/";
    const token = "Zoho-enczapikey PHtE6r1cFrvqiGUt8BcF4f+8EpbxPdh/qbsxJAQWt4cXW/YEGk0Bqtt4lmCyqkguAPlGFfSYno9r5ezP5+mHIWq5ZzsdWmqyqK3sx/VYSPOZsbq6x00ctl0ZckHdV4DuddVs0CLWvd3cNA==";

    let client = new SendMailClient({url, token});
//    const { host, username, password, port } = config.mail;

    
    return new Promise((resolve, reject) => {

        client.sendMail({
            "from": {
                "address": "noreply@khabriya.in",
                "name": "Live TV Khabriya"
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

    let client = new SendMailClient({url, token});

    return new Promise((resolve, reject) => {
        client.sendMail({
            "mail_template_key": "2518b.1c74ee1eb79b1b91.k1.34e1b170-ee98-11ee-b53a-525400ab18e6.18e8f845607",
            "from": {
                "address": "noreply@khabriya.in",
                "name": "Live Tv Khabriya"
            },
            "to": [{
                "email_address": {
                    "address": email,
                }
            }],
            "merge_info": variables,
            "subject": "Payment Successful Live Tv Khabriya"
        }).then((resp) => resolve(resp)).catch((error) => reject(error));
    });
}

const planExpiry = (email, variables) => {

    const url = "api.zeptomail.in/v1.1/email/template";
    const token = "Zoho-enczapikey PHtE6r1cFrvqiGUt8BcF4f+8EpbxPdh/qbsxJAQWt4cXW/YEGk0Bqtt4lmCyqkguAPlGFfSYno9r5ezP5+mHIWq5ZzsdWmqyqK3sx/VYSPOZsbq6x00ctl0ZckHdV4DuddVs0CLWvd3cNA==";

    let client = new SendMailClient({url, token});

    return new Promise((resolve, reject) => {
        client.sendMail({
            "mail_template_key": "2518b.1c74ee1eb79b1b91.k1.511e6170-5b0e-11ef-950f-525400674725.19156545107",
            "from": {
                "address": "noreply@khabriya.in",
                "name": "Live Tv Khabriya"
            },
            "to": [{
                "email_address": {
                    "address": email,
                }
            }],
            "merge_info": variables,
            "subject": "Plan Expiry - Live Tv Khabriya"
        }).then((resp) => resolve(resp)).catch((error) => reject(error));
    });
}

const planExpiryNeo = (email, variables) => {

    const url = "api.zeptomail.in/v1.1/email/template";
    const token = "Zoho-enczapikey PHtE6r1cFrvqiGUt8BcF4f+8EpbxPdh/qbsxJAQWt4cXW/YEGk0Bqtt4lmCyqkguAPlGFfSYno9r5ezP5+mHIWq5ZzsdWmqyqK3sx/VYSPOZsbq6x00ctl0ZckHdV4DuddVs0CLWvd3cNA==";

    let client = new SendMailClient({url, token});

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

// Export function
module.exports = { sendEmail, paymentSuccess, planExpiry };
