import { getShapeBySection, checkAvailabilityUK } from "./fetch-uk.js";
import { checkAvailabilityDE } from "./fetch-de.js";

const [sectionName, eventId, domain] = process.argv.slice(2);

if (!sectionName || !eventId || !domain) {
  console.error(
    "❌ Lütfen şu formatta gir: node main.js <sectionName> <eventId> <domain>"
  );
  process.exit(1);
}

console.log(
  `\n🎫 Event: ${eventId} | Section: ${sectionName} | Domain: ${domain.toUpperCase()}`
);

(async () => {
  try {
    if (domain.toUpperCase() === "UK") {
      console.log("🔍 UK: Section bilgisi alınıyor...");
      const shapeId = await getShapeBySection(sectionName, eventId);

      if (!shapeId) {
        console.log("❌ Section bulunamadı veya Shape ID alınamadı.");
        return;
      }

      console.log(`➡️ Shape ID: ${shapeId}`);
      const available = await checkAvailabilityUK(shapeId, eventId);
      console.log(`🎟️ Section ${sectionName} → Available: ${available}`);
    } else if (domain.toUpperCase() === "DE") {
      console.log("🔍 DE: Availability kontrolü yapılıyor...");
      const available = await checkAvailabilityDE(sectionName, eventId);
      console.log(`🎟️ Section ${sectionName} → Available: ${available}`);
    } else {
      console.log("⚠️ Geçersiz domain. 'UK' veya 'DE' olarak belirtmelisin.");
    }
  } catch (error) {
    console.error("💥 Genel hata:", error.message);
  }
})();
