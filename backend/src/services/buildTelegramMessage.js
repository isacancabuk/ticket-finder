export function buildTelegramMessage(query) {
  const eventName = query.eventName || "Unknown Event";
  const section = query.section || "Any";
  const minSeats = query.minSeats || 1;
  const domain = query.domain || "Unknown";
  const eventUrl = query.eventUrl || "No Link Available";

  return `🎟️ TICKETS AVAILABLE!\n\n` +
         `Event: ${eventName}\n` +
         `Section: ${section}\n` +
         `Min Seats: ${minSeats}\n` +
         `Domain: ${domain}\n` +
         `Link: ${eventUrl}`;
}
