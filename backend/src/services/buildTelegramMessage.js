const CURRENCY_MAP = {
  DE: { symbol: "€", code: "EUR" },
  UK: { symbol: "£", code: "GBP" },
};

export function buildTelegramMessage(query) {
  const eventName = query.eventName || "Unknown Event";
  const section = query.section || "Any";
  const minSeats = query.minSeats || 1;
  const domain = query.domain || "Unknown";
  const eventUrl = query.eventUrl || "No Link Available";
  const orderNo = query.orderNo || "–";
  const currency = CURRENCY_MAP[domain] || { symbol: "€", code: "EUR" };
  const priceStr = query.foundPrice != null
    ? `${currency.symbol}${(query.foundPrice / 100).toFixed(2)}`
    : "Unknown";

  return `🎟️ TICKETS AVAILABLE!\n\n` +
         `Order: ${orderNo}\n` +
         `Event: ${eventName}\n` +
         `Section: ${section}\n` +
         `Min Seats: ${minSeats}\n` +
         `Price: ${priceStr} per ticket\n` +
         `Domain: ${domain}\n` +
         `Link: ${eventUrl}`;
}
