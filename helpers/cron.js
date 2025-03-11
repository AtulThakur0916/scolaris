const cron = require('node-cron');
const { Users, SchoolSessions } = require('../models');
const moment = require('moment');
const config = require('../config/config.json');

module.exports.handle = cronHandler;

function cronHandler(sequelize, sendEmail, Op) {

    // Cron job to update session status automatically
    var sessions = cron.schedule('0 0 * * *', async () => {

        try {
            console.log("Running cron job to update session status...");

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const updatedSessions = await SchoolSessions.update(
                { status: "Completed" },
                {
                    where: {
                        status: "Active",
                        end_date: { [Op.lte]: today },
                    },
                }
            );

            console.log(`Updated ${updatedSessions[0]} session(s) to "Completed".`);
        } catch (error) {
            console.error("Error updating session statuses:", error);
        }
    }, {
        scheduled: true,
        timezone: "Europe/London"
    });

    sessions.start();
}
