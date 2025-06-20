const axios = require('axios');

const ONE_SIGNAL_APP_ID = 'YOUR_ONESIGNAL_APP_ID';
const ONE_SIGNAL_REST_API_KEY = 'YOUR_ONESIGNAL_REST_API_KEY';

/**
 * Sends a push notification via OneSignal
 * @param {string} playerId
 * @param {string} title
 * @param {string} message
 * @param {object} extraData
 */
async function sendPushNotification(playerId, title, message, extraData = {}) {
  try {
    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id: ONE_SIGNAL_APP_ID,
        include_player_ids: [playerId],
        headings: { en: title },
        contents: { en: message },
        data: extraData 
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${ONE_SIGNAL_REST_API_KEY}`,
        },
      }
    );

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

module.exports = sendPushNotification;
