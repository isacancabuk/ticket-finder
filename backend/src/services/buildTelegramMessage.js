import { DOMAIN_CURRENCY, formatPriceByCurrency } from "../utils/currencyConfig.js";
import { convert } from "./fxService.js";

export async function buildTelegramMessage(query) {
  const eventName = query.eventName || "Bilinmeyen Etkinlik";
  const section = query.section || "Tümü";
  const minSeats = query.minSeats || 1;
  const domain = query.domain || "Unknown";
  const eventUrl = query.eventUrl || "Link yok";
  const orderNo = query.orderNo || "–";

  const foundCurrency = DOMAIN_CURRENCY[domain] || "EUR";
  const saleCurrency = query.salePriceCurrency || "EUR";

  const priceStr = formatPriceByCurrency(query.foundPrice, foundCurrency);
  const maxPriceStr = query.maxPrice != null
    ? formatPriceByCurrency(query.maxPrice, foundCurrency)
    : "Limit yok";
  const salePriceStr = query.salePrice != null
    ? formatPriceByCurrency(query.salePrice, saleCurrency)
    : "–";

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
    if (foundCurrency === saleCurrency) {
      // Same currency — simple subtraction
      const diff = query.salePrice - query.foundPrice;
      if (diff > 0) {
        lines.push(`💰 Kâr: ${formatPriceByCurrency(diff, saleCurrency)}`);
      } else if (diff < 0) {
        lines.push(`📉 Zarar: ${formatPriceByCurrency(Math.abs(diff), saleCurrency)}`);
      } else {
        lines.push(`⚖️ Başabaş`);
      }
    } else {
      // Cross-currency — convert foundPrice to saleCurrency
      const convertedFound = await convert(query.foundPrice, foundCurrency, saleCurrency);
      if (convertedFound != null) {
        const diff = query.salePrice - convertedFound;
        if (diff > 0) {
          lines.push(`💰 Kâr: ${formatPriceByCurrency(diff, saleCurrency)}`);
        } else if (diff < 0) {
          lines.push(`📉 Zarar: ${formatPriceByCurrency(Math.abs(diff), saleCurrency)}`);
        } else {
          lines.push(`⚖️ Başabaş`);
        }
      } else {
        lines.push(`⚠️ Kâr/Zarar: –`);
      }
    }
  }

  lines.push(``);
  lines.push(`🌍 Domain: ${domain}`);
  lines.push(`🔗 Link: ${eventUrl}`);

  return lines.join("\n");
}
