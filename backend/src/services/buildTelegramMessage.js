const CURRENCY_MAP = {
  DE: { symbol: "€", code: "EUR" },
  UK: { symbol: "£", code: "GBP" },
};

function formatPrice(cents, domain) {
  if (cents == null) return null;
  const { symbol } = CURRENCY_MAP[domain] || { symbol: "€" };
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export function buildTelegramMessage(query) {
  const eventName = query.eventName || "Bilinmeyen Etkinlik";
  const section = query.section || "Tümü";
  const minSeats = query.minSeats || 1;
  const domain = query.domain || "Unknown";
  const eventUrl = query.eventUrl || "Link yok";
  const orderNo = query.orderNo || "–";

  const priceStr = formatPrice(query.foundPrice, domain) || "Bilinmiyor";
  const maxPriceStr = formatPrice(query.maxPrice, domain) || "Limit yok";
  const salePriceStr = formatPrice(query.salePrice, domain) || "–";

  let lines = [
    `🎟️ BİLET BULUNDU!`,
    ``,
    `📋 Sipariş: ${orderNo}`,
    `🎤 Etkinlik: ${eventName}`,
    `📍 Bölüm: ${section}`,
    `💺 Min. Koltuk: ${minSeats}`,
    `💰 Bulunan Fiyat: ${priceStr}`,
    `📊 Max. Fiyat: ${maxPriceStr}`,
    `🏷️ Satış Fiyatı: ${salePriceStr}`,
  ];

  // Profit/loss calculation
  if (query.foundPrice != null && query.salePrice != null) {
    const diff = query.salePrice - query.foundPrice;
    if (diff > 0) {
      lines.push(`💰 Kâr: ${formatPrice(diff, domain)}`);
    } else if (diff < 0) {
      lines.push(`📉 Zarar: ${formatPrice(Math.abs(diff), domain)}`);
    } else {
      lines.push(`⚖️ Başabaş`);
    }
  }

  lines.push(``);
  lines.push(`🌍 Domain: ${domain}`);
  lines.push(`🔗 Link: ${eventUrl}`);

  return lines.join("\n");
}
