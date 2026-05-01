/**
 * This is a manual anti-bot spacing test script.
 * It is NOT part of the production application flow.
 * Its purpose is to test whether spacing requests out (e.g., 60 seconds)
 * helps avoid anti-bot blocking from the Ticketmaster server environment.
 * 
 * It reads the required cookies from the existing backend/.env file and 
 * runs standalone using Node.js's native fetch.
 */

const fs = require('fs');
const path = require('path');

// 1. Load .env
// We manually parse the .env file so this script remains completely standalone 
// and doesn't require "dotenv" to be installed in the root node_modules.
function loadEnv() {
  const envPath = path.join(__dirname, 'backend', '.env');
  if (fs.existsSync(envPath)) {
    console.log(`[INFO] Loading env variables from ${envPath}`);
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let key = match[1];
        let value = match[2] || '';
        // handle quoted values
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.replace(/\\n/gm, '\n');
        }
        value = value.replace(/(^['"]|['"]$)/g, '').trim();
        process.env[key] = value;
      }
    });
  } else {
    console.warn(`[WARN] Could not find .env file at ${envPath}`);
  }
}

// 2. Minimum needed URL parsing directly in script
function parseTicketUrl(ticketUrl) {
  const parsed = new URL(ticketUrl);
  const hostname = parsed.hostname.replace(/^www\./, "");
  
  let domain;
  if (hostname === "ticketmaster.de") domain = "DE";
  else if (hostname === "ticketmaster.es") domain = "ES";
  else if (hostname === "ticketmaster.co.uk") domain = "UK";
  else throw new Error(`Unknown or unsupported domain: ${hostname}`);

  const segments = parsed.pathname.split("/").filter(Boolean);
  const eventId = segments[segments.length - 1];

  return { domain, eventId, hostname };
}

// Helper to build endpoint rules based on domain
function buildTestConfig(domain, eventId) {
  if (domain === "DE") {
    return {
      url: `https://availability.ticketmaster.de/api/v2/TM_DE/manifest/${eventId}`,
      cookieKey: "TM_DE_COOKIE"
    };
  } else if (domain === "ES") {
    return {
      url: `https://availability.ticketmaster.es/api/v2/TM_ES/manifest/${eventId}`,
      cookieKey: "TM_ES_COOKIE"
    };
  } else if (domain === "UK") {
    return {
      url: `https://www.ticketmaster.co.uk/api/quickpicks/${eventId}/list?defaultToOne=true&promoted=primary&primary=true&resale=true&qty=1`,
      cookieKey: "TM_UK_COOKIE"
    };
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const urlsToTest = [
  "https://www.ticketmaster.de/event/backstreet-boys-into-the-millennium-homecoming-live-in-germany-tickets/1291764047",
  "https://www.ticketmaster.es/event/karol-g-viajando-por-el-mundo-tropitour-entradas/843841286",
  "https://www.ticketmaster.co.uk/bon-jovi-hospitality-edinburgh-28-08-2026/event/3600635BB08079C7"
];

async function runTest() {
  loadEnv();
  const summary = [];

  for (let i = 0; i < urlsToTest.length; i++) {
    const originalUrl = urlsToTest[i];
    const timestamp = new Date().toISOString();
    
    console.log(`\n======================================================`);
    console.log(`[${timestamp}] Request ${i + 1} of ${urlsToTest.length}`);
    console.log(`Original URL: ${originalUrl}`);

    try {
      // Parse domain / eventId
      const { domain, eventId, hostname } = parseTicketUrl(originalUrl);
      console.log(`Parsed Domain:  ${domain}`);
      console.log(`Parsed EventId: ${eventId}`);

      // Build target endpoint
      const config = buildTestConfig(domain, eventId);
      const finalUrl = config.url;
      console.log(`Target URL:     ${finalUrl}`);

      const cookie = process.env[config.cookieKey];
      if (!cookie) {
        throw new Error(`Missing cookie for key: ${config.cookieKey}`);
      }

      // Prepare headers
      const headers = {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': originalUrl,
        'Origin': `https://${hostname}`
      };

      // Execute request
      const response = await fetch(finalUrl, { method: 'GET', headers });
      console.log(`Response Status: ${response.status} ${response.statusText}`);
      
      const contentType = response.headers.get('content-type');
      console.log(`Content-Type:   ${contentType}`);

      const text = await response.text();
      let isSuccess = response.ok;
      let shortNote = `HTTP ${response.status}`;

      try {
        const data = JSON.parse(text);
        console.log('JSON Parsing:   Succeeded');
        console.log('Top-level keys: ', Object.keys(data));
        
        const previewStr = JSON.stringify(data, null, 2);
        console.log('\n--- Compact Preview ---');
        console.log(previewStr.substring(0, 300) + (previewStr.length > 300 ? '\n... (truncated)' : ''));
        console.log('-----------------------');
        
        shortNote += ', Valid JSON';
      } catch (e) {
        console.log('JSON Parsing:   Failed');
        console.log('\n--- Raw Response Preview ---');
        console.log(text.substring(0, 300) + (text.length > 300 ? '\n... (truncated)' : ''));
        console.log('----------------------------');
        
        isSuccess = false;
        shortNote += ', Invalid JSON';
      }

      summary.push({
        domain,
        eventId,
        status: response.status,
        success: isSuccess ? 'YES' : 'NO',
        note: shortNote
      });

    } catch (err) {
      console.error(`[ERROR] Failed to process URL: ${err.message}`);
      summary.push({
        domain: 'N/A',
        eventId: 'N/A',
        status: 'ERR',
        success: 'NO',
        note: err.message
      });
    }

    // Wait 1 minute before the next request, but skip wait for the very last item
    if (i < urlsToTest.length - 1) {
      console.log(`\n[${new Date().toISOString()}] Waiting 60 seconds to simulate human spacing...`);
      await sleep(60_000);
    }
  }

  // Print Summary
  console.log(`\n================================================================================`);
  console.log(`                                SUMMARY REPORT                                  `);
  console.log(`================================================================================`);
  console.log(`| DOMAIN | EVENT ID             | STATUS | SUCCESS | NOTE`);
  console.log(`|--------|----------------------|--------|---------|----------------------------`);
  
  for (const row of summary) {
    const dom = row.domain.padEnd(6, ' ');
    const eid = String(row.eventId).padEnd(20, ' ');
    const stat = String(row.status).padEnd(6, ' ');
    const succ = row.success.padEnd(7, ' ');
    console.log(`| ${dom} | ${eid} | ${stat} | ${succ} | ${row.note}`);
  }
  console.log(`================================================================================\n`);
}

runTest();
