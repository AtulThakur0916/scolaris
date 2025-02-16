const cron = require('node-cron');
const models = require('../models');
const moment = require('moment');
const config = require('../config/config.json');
const axios = require('axios');
const { planExpiry, planExpiryNeo } = require('./zepto');  //Send email global function

module.exports.handle = alertHandler;

function alertHandler(sequelize, sendEmail, Op) {

    // missed report cron wont start automatically
    var syncRevenue = cron.schedule('*/15 * * * *', async() => {
        
        const month = moment().format('MMMM-YYYY');

        const revenues = await models.RevenueStats.findAll({
            attributes: ['user_id'],
            where: {
                month // : { [Op.eq]: month },
            },
            group: ['user_id'],
            raw: true
        });

        var user_ids = [];
        if(revenues.length > 0) {
            user_ids = revenues.map((item) => item.user_id);
        }

        // Get user
        const users = await models.Users.findAll({
            attributes: ['id', 'cpi'],
            where: {
                id: { [Op.notIn]: user_ids },
                status: true
            },
            raw: true
        });

        console.log('syncRevenue', users);

        if(users.length > 0) {
            users.map(async (item) => await models.RevenueStats.create({ user_id: item.id, month, cpi: item.cpi }));
        }
    }, {
        scheduled: true,
//        timezone: "Europe/London"
    });

    // start method is called to start the above defined cron job
    syncRevenue.start();

    // Validate Channel's streaming URL
    var verifyChannel = cron.schedule('* 2 * * *', async() => {

        const channels = await models.Channels.findAll({
            attributes: ['id', 'channel_name','stream_url', 'status'],
            raw: true
        });

        channels.map(async (item) => {

            let config = {
                method: 'get',
                url: item.stream_url,
                headers: { }
            };
            await axios.request(config).then( async (response) => {
                /*if(!item.status) {
                    await models.Channels.update({status: true},
                        {
                            where: {id: item.id}
                        }
                    )
                }*/
//                console.log('response', item.channel_name, item.status, response.status);
            }).catch(async (error) => {
                let channel_status = error.response && error.response.status || error.message;
                channel_status = channel_status.toString().replaceAll("/","_");
                channel_status = channel_status.toString().replaceAll("'","");
                channel_status = channel_status.toString().replaceAll(":","");
                if(channel_status.includes("EPROTO")) {
                    channel_status = "HIT URL";
                }
//                console.log('error', item.channel_name, item.status, channel_status);
                if(item.status) {
                    await models.Channels.update({status: false, channel_status},
                        {
                            where: {id: item.id}
                        }
                    )
                }
            });
        });
    }, {
        scheduled: true
//        timezone: "Europe/London"
    });

    // start method is called to start the above defined cron job
    verifyChannel.stop();

    // Send Alert Emails for plan Expiry before 3 days
    var expiryPlanNotify = cron.schedule('15 10,19 * * *', async() => {

        var subscribers = await models.Subscribers.findAll({
            include: [{
                model: models.Subscriptions,
                attributes: ['id', 'plan_id', 'valid_from', 'valid_to', 'transaction_id', 'updated_at'],
                where: {
                    status: 'PAID',
                    valid_to: {
                        [Op.gt]: moment().startOf('day').format(),
                        [Op.lt]: moment().add(4, 'days').format(),
                    }
                }
            }],
            where: {
                email_alerts: 0,
                branch: {
                    [Op.ne]: '1001'
                }
            },
//            limit: 5,
//            offset: 0,
            order: [
                [{ model: models.Subscriptions }, 'updated_at', 'DESC'],
                ['created_at', 'DESC']
            ]
        });
        
        if(subscribers.length > 0) {
            subscribers.map(async (data) => {
                
                let plan = await models.Plans.findOne({
                    where: {
                        id: data.Subscriptions[0].plan_id
                    },
                    raw: true
                });
                const expiry_date = moment(data.Subscriptions[0].valid_to).format('lll');
                const plan_name = plan.name || '';
                const subscriber_id = data.subscriber_id;
                const user_name = data.name;
                const variables = { user_name, expiry_date, plan_name, subscriber_id};
//                planExpiry('apps@khabriya.in', variables)
                planExpiry(data.email, variables)
                    .then(async (resp) => {
                        await models.Subscribers.update({ 
                            email_alerts: 1
                        }, {
                            where: {
                                id: data.id
                            }
                        })
                        console.log('Mail Response: ')//, resp.message);
                    })
                    .catch((error) => { console.log('Mail Error: ', error); });
            });
        }

        console.log('subscribers', subscribers.length, moment().format(), moment().add(4, 'days').format());
    }, {
        scheduled: true
//        timezone: "Europe/London"
    });

    // start method is called to start the above defined cron job
    expiryPlanNotify.start();

    // Send Alert Emails for plan Expiry before 3 days
    var expiryPlanNeoNotify = cron.schedule('16 11,20 * * *', async() => {

        var subscribers = await models.Subscribers.findAll({
            include: [{
                model: models.Subscriptions,
                attributes: ['id', 'plan_id', 'valid_from', 'valid_to', 'transaction_id', 'updated_at'],
                where: {
                    status: 'PAID',
                    valid_to: {
                        [Op.gt]: moment().startOf('day').format(),
                        [Op.lt]: moment().add(4, 'days').format(),
                    }
                }
            }],
            where: {
                email_alerts: 0,
                branch: {
                    [Op.eq]: '1001'
                }
            },
//            limit: 5,
//            offset: 0,
            order: [
                [{ model: models.Subscriptions }, 'updated_at', 'DESC'],
                ['created_at', 'DESC']
            ]
        });
        
        if(subscribers.length > 0) {
            subscribers.map(async (data) => {
                
                let plan = await models.Plans.findOne({
                    where: {
                        id: data.Subscriptions[0].plan_id
                    },
                    raw: true
                });
                const expiry_date = moment(data.Subscriptions[0].valid_to).format('lll');
                const plan_name = plan.name || '';
                const subscriber_id = data.subscriber_id;
                const email = data.email;
                const sId = data.id;
                const user_name = data.name;
                const variables = { user_name, expiry_date, plan_name, subscriber_id, sId, email};
//                planExpiry('apps@khabriya.in', variables)
                planExpiry(data.email, variables)
                    .then(async (resp) => {
                        await models.Subscribers.update({ 
                            email_alerts: 1
                        }, {
                            where: {
                                id: data.id
                            }
                        })
                        console.log('Mail Response: ')//, resp.message);
                    })
                    .catch((error) => { console.log('Mail Error: ', error); });
            });
        }

        console.log('subscribers', subscribers.length, moment().format(), moment().add(4, 'days').format());
    }, {
        scheduled: true
//        timezone: "Europe/London"
    });

    // start method is called to start the above defined cron job
    expiryPlanNeoNotify.start();
}
