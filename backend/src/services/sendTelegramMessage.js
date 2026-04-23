import axios from "axios";

/**
 * Sends a notification message to a Telegram chat.
 *
 * @param {string} text - Message text to send
 * @returns {Promise<void>}
 */

export async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("[sendTelegramMessage] Telegram config missing, skipping notification");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: chatId,
      text: text,
    });
  } catch (err) {
    console.error("[sendTelegramMessage] Network error sending to Telegram:", err.message);
  }
}
