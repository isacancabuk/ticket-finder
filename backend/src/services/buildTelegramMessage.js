import { formatPriceByCurrency } from "../utils/currencyConfig.js";

/**
 * Builds a Telegram notification message from a completed query result.
 *
 * @param {object} query - Completed query object from runQuery()
 * @returns {string} Formatted Telegram message
 */

export function buildTelegramMessage(query) {
  const eventName = query.eventName || "Bilinmeyen Etkinlik";
  const section = query.section || "Tümü";
  const minSeats = query.minSeats || 1;
  const domain = query.domain || "Unknown";
  const eventUrl = query.eventUrl || "Link yok";
  const orderNo = query.orderNo || "–";

  // Format event date
  let formattedDate = "–";
  if (query.eventDate) {
    try {
      const dateStr =
        query.eventDate instanceof Date
          ? query.eventDate.toISOString()
          : query.eventDate;
      if (typeof dateStr === "string" && dateStr.includes("-")) {
        const datePart = dateStr.split("T")[0];
        const [year, month, day] = datePart.split("-");
        if (year && month && day) {
          formattedDate = `${day}.${month}.${year}`;
        }
      }
    } catch (e) {
      // fallback to –
    }
  }

  // Use EUR normalized prices from backend enrichment
  let priceStr = "–";
  if (query.foundPriceInEUR != null) {
    priceStr = formatPriceByCurrency(query.foundPriceInEUR, "EUR");
    if (minSeats > 1) {
      const singlePrice = query.foundPriceInEUR / minSeats;
      priceStr += ` (${formatPriceByCurrency(singlePrice, "EUR")} / bilet)`;
    }
  }
  const salePriceStr =
    query.salePriceInEUR != null
      ? formatPriceByCurrency(query.salePriceInEUR, "EUR")
      : "–";

  let lines = [
    `🎟️ BİLET BULUNDU!`,
    ``,
    `📋 Sipariş: ${orderNo}`,
    `🎤 Etkinlik: ${eventName}`,
    `📅 Tarih: ${formattedDate}`,
    `📍 Bölüm: ${section}`,
  ];

  if (query.foundSection) {
    lines.push(`✅ Bulunan Bölüm: ${query.foundSection}`);
  }

  lines.push(
    `💺 Min. Koltuk: ${minSeats}`,
    `🏷️ Satış Fiyatı: ${salePriceStr} (EUR)`,
    `💰 Bulunan Fiyat: ${priceStr} (EUR)`,
  );

  // Profit/loss calculation in EUR (backend already normalized)
  if (query.profitLoss != null) {
    if (query.profitLoss > 0) {
      lines.push(`💰 Kâr: ${formatPriceByCurrency(query.profitLoss, "EUR")}`);
    } else if (query.profitLoss < 0) {
      lines.push(
        `📉 Zarar: ${formatPriceByCurrency(Math.abs(query.profitLoss), "EUR")}`,
      );
    } else {
      lines.push(`⚖️ Başabaş`);
    }
  }

  lines.push(``);
  lines.push(`🌍 Domain: ${domain}`);
  lines.push(`🔗 Link: ${eventUrl}`);

  return lines.join("\n");
}
