import { parseTicketmasterUrl } from './src/utils/parseTicketmasterUrl.js';
import { fetchESManifestSections } from '../fetchESManifestSections.js';
import { fetchES } from '../fetch-es.js';

async function test() {
  const url = "https://www.ticketmaster.es/event/the-weeknd-after-hours-til-dawn-tour-entradas/1894732982";
  const parsed = parseTicketmasterUrl(url);
  console.log("Parsed URL:", parsed);

  console.log("\nFetching Manifest (Sections/Levels fallback):");
  const manifest = await fetchESManifestSections({ eventId: parsed.eventId, domain: "es" });
  console.log(manifest.success ? `Found ${manifest.sections.length} entries.` : manifest.error);
  if (manifest.success && manifest.sections.length > 0) {
    console.log("Sample:", manifest.sections.slice(0, 3));
  }

  console.log("\nFetching Availability:");
  const avail = await fetchES({ eventId: parsed.eventId, maxPrice: 40000 });
  console.log(avail);
}

test();
