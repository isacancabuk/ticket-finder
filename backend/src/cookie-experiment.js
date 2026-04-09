/**
 * cookie-experiment.js
 *
 * Controlled cookie dependency test for the TM DE availability endpoint.
 * Runs 8 experiments, each using a different cookie subset.
 * Prints a results table and a diagnostic conclusion.
 *
 * Usage:  node src/cookie-experiment.js
 *
 * IMPORTANT: This file is read-only for experiments.
 *            Do NOT modify fetch-de.js, routes, or business logic.
 */

import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────────
// 1.  FULL COOKIE STRING  (copy from fetch-de.js — edit here when refreshing)
// ─────────────────────────────────────────────────────────────────────────────
const FULL_COOKIE =
  "BID=zL-iB79jZV2PyvHFhxZa_HAfhF-jm-Ym2orqykmK9Ey2oqVwaweRo3BEGgbiyCSWA_I3riRhjLHSDpYs; language=de-de; LANGUAGE=de-de; OptanonAlertBoxClosed=2026-02-13T10:43:37.649Z; eupubconsent-v2=CQfjnkgQfjnkgAcABBENCSFsAP_gAAAAACiQJ8JBzC7FbUFCwDZzaLoAMAgHRMAIQoQAAASBAGABQAKQIAQCkkAYFASABAACAAIAICRBIQIECAAAAUAAAAAAIAAEAAAAAAAKAAAAgAAAAAAIAAACAIAAEAAIgAAAkAAAmAgAAAIAGEAAgAAAIAAAAAAAAAAAAAAAAAAAAAIAAAAAACAAAQAAAAAAAAACQAAAAAAAAAAAAAAAAAAAAACAADwAAAEBICoAFQAOAAggBkAGgAPAAmABVAEIAIgAYYA9gB-gEcAJMAYoA4gB7QFIgKbAXmAycdAaAAWABUADgAIIAZABoADwAJgAVQBEACjAGGAMoAewA_QCLAEcAJMAYoA4gB7QEXgKbAXmAycBlgDVRwAYAB4AFwAugEIAOkAvohAHAAWAFUAjgBigFNgMnAaqSgHAALAA4ADwAJgAVQBEACjAI4AYoA4gCLwF5gMnAZYSAAgAXKQEwAFgAVAA4ACCAGQAaAA8ACYAFUARAAowBlAD9AIsARwAxQCLwFNgLzAZOUABAAXAX0AA.f_wAAAAAAAAA.IJ8JBzC7FbUFCwDZzaLoAMAgXRMAIQoQAAASBAGABQAKQIAQCkkAYFESABAACAAIAICRBIQIMCAAAAUABAAAAIAAEAAAAAAgKAAAAgAAAAAAIAAACAIAAEAAIgAAAkAAAmQgAAAIAGEAAgAAAIAAAAAAAAAAAAAAAAAAAAAIAAAAAACAAAQAAAAAAAAACQAAAAAAAAAAAAAAAAAAAAACAADw; _gcl_au=1.1.609476924.1770979418; OptanonGroups=,C0001,C0002,C0003,C0004,C0005; SID=bhj787DsnWLvz_TjXYXCrdElc-x65iGW3A76jMGUL1L7ek6ZHc-8q5M1n7AkihK5TY4idinHTz8t_RPp; NDMA=610; TMUO=east_5licw/b8ezWZ+t+m/B6oRXBDy+6driS8iHVj2tBkLq4=; sticky=DBBA; tmpt=1:CAESGKSdS1Gnq75AT6eATXChwesUvvSPpcRXsxjV_eGk1DMiMM89XIwXsxXQuNo_nOnld5xvk3z1-26ooJm4VFs_GcLOtva2w80FxZy0K6KbSMfOuw; ORIGIN_2049708374=#{1}#; OptanonConsent=isGpcEnabled=0&datestamp=Tue+Mar+31+2026+18%3A52%3A19+GMT%2B0300+(GMT%2B03%3A00)&version=202601.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=26d38e15-7546-40c0-aa69-0960ab83ccf1&interactionCount=2&isAnonUser=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1%2CC0005%3A1%2CV2STACK42%3A1&crTime=1770979418369&AwaitingReconsent=false&intType=1&geolocation=TR%3B34";

// ─────────────────────────────────────────────────────────────────────────────
// 2.  DETERMINISTIC TEST CASE
// ─────────────────────────────────────────────────────────────────────────────
const EVENT_ID = "2049708374";
const SECTION   = "104"; // section 104 — matches updated test-de.js

// ─────────────────────────────────────────────────────────────────────────────
// 3.  COOKIE PARSER  (key=value; …  →  Map<key, value>)
// ─────────────────────────────────────────────────────────────────────────────
function parseCookies(cookieStr) {
  const map = new Map();
  for (const pair of cookieStr.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    map.set(k, v);
  }
  return map;
}

function buildCookieString(map, keys) {
  return keys
    .filter((k) => map.has(k))
    .map((k) => `${k}=${map.get(k)}`)
    .join("; ");
}

function buildCookieStringExcluding(map, excludeKeys) {
  const keep = [...map.keys()].filter((k) => !excludeKeys.includes(k));
  return keep.map((k) => `${k}=${map.get(k)}`).join("; ");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  EXPERIMENT DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const cookieMap = parseCookies(FULL_COOKIE);

const EXPERIMENTS = [
  {
    id: 1,
    label: "Full Cookie (Baseline)",
    cookie: FULL_COOKIE,
  },
  {
    id: 2,
    label: "Minimal: BID + SID + TMUO + sticky",
    cookie: buildCookieString(cookieMap, ["BID", "SID", "TMUO", "sticky"]),
  },
  {
    id: 3,
    label: "Minimal + tmpt",
    // tmpt is NOT in this cookie string — will be empty / missing gracefully
    cookie: buildCookieString(cookieMap, ["BID", "SID", "TMUO", "sticky", "tmpt"]),
  },
  {
    id: 4,
    label: "Minimal + Consent cookies",
    cookie: buildCookieString(cookieMap, [
      "BID", "SID", "TMUO", "sticky",
      "OptanonConsent", "OptanonGroups", "eupubconsent-v2",
    ]),
  },
  {
    id: 5,
    label: "Full Cookie MINUS tmpt",
    cookie: buildCookieStringExcluding(cookieMap, ["tmpt"]),
  },
  {
    id: 6,
    label: "Full Cookie MINUS SID",
    cookie: buildCookieStringExcluding(cookieMap, ["SID"]),
  },
  {
    id: 7,
    label: "Full Cookie MINUS TMUO",
    cookie: buildCookieStringExcluding(cookieMap, ["TMUO"]),
  },
  {
    id: 8,
    label: "Full Cookie MINUS sticky",
    cookie: buildCookieStringExcluding(cookieMap, ["sticky"]),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 5.  SINGLE REQUEST RUNNER
// ─────────────────────────────────────────────────────────────────────────────
async function runExperiment({ id, label, cookie }) {
  const url = `https://availability.ticketmaster.de/api/v2/TM_DE/availability/${EVENT_ID}?subChannelId=1`;

  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    Accept: "application/json, text/plain, */*",
    Referer: "https://www.ticketmaster.de/",
    Origin: "https://www.ticketmaster.de",
    Cookie: cookie,
  };

  const start = Date.now();

  try {
    const res = await axios.get(url, { headers, timeout: 12000 });
    const latencyMs = Date.now() - start;
    const data = res.data;

    // Check section availability
    let isAvailable = false;
    for (const g of data.groups || []) {
      const places = g.places || {};
      const hasMatch = Object.keys(places).some(
        (key) => key === `U-${SECTION}` || key === `M-${SECTION}`
      );
      if (hasMatch) { isAvailable = true; break; }
    }

    return {
      id,
      label,
      httpStatus: res.status,
      success: true,
      isAvailable,
      latencyMs,
      note: isAvailable ? `section ${SECTION} has tickets` : `section ${SECTION} empty`,
      responseHeaders: res.headers,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const status   = err.response?.status ?? "N/A";
    const body     = err.response?.data
      ? JSON.stringify(err.response.data).slice(0, 300)
      : "(no body)";
    const respHeaders = err.response?.headers ?? {};

    return {
      id,
      label,
      httpStatus: status,
      success: false,
      latencyMs,
      note: `Error: ${status} — ${body.slice(0, 120)}`,
      responseHeaders: respHeaders,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6.  HELPERS — console table rendering
// ─────────────────────────────────────────────────────────────────────────────
function pad(str, len) {
  return String(str).padEnd(len);
}

function printTable(results) {
  const cols = [
    { key: "id",         header: "Test#", width: 6  },
    { key: "label",      header: "Cookie Set",  width: 38 },
    { key: "httpStatus", header: "HTTP", width: 6  },
    { key: "success",    header: "OK?",  width: 6  },
    { key: "latencyMs",  header: "ms",   width: 7  },
    { key: "note",       header: "Notes", width: 55 },
  ];

  const sep = cols.map((c) => "─".repeat(c.width)).join("┼");
  const header = cols.map((c) => pad(c.header, c.width)).join("│");

  console.log("\n" + "─".repeat(sep.length));
  console.log(header);
  console.log(sep);

  for (const r of results) {
    const row = cols
      .map((c) => pad(r[c.key] ?? "", c.width))
      .join("│");
    console.log(row);
  }
  console.log("─".repeat(sep.length) + "\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// 7.  ANALYSIS — derive conclusions automatically
// ─────────────────────────────────────────────────────────────────────────────
function analyzeResults(results) {
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));

  const baseline   = byId[1]?.success;
  const minimal    = byId[2]?.success;  // BID + SID + TMUO + sticky
  const withTmpt   = byId[3]?.success;  // minimal + tmpt
  const withConsent= byId[4]?.success;  // minimal + consent
  const noTmpt     = byId[5]?.success;  // full − tmpt
  const noSid      = byId[6]?.success;  // full − SID
  const noTmuo     = byId[7]?.success;  // full − TMUO
  const noSticky   = byId[8]?.success;  // full − sticky

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  AUTOMATED ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════");

  if (!baseline) {
    console.log("⚠️  BASELINE FAILED — cookies are expired or environment issue.");
    console.log("   Please obtain a fresh cookie string and rerun.");
    return;
  }

  console.log("✅  Baseline (full cookie) works — environment is valid.");
  console.log();

  // tmpt analysis
  if (noTmpt === false) {
    console.log("🔴  tmpt is REQUIRED  (full−tmpt failed)");
  } else if (noTmpt === true) {
    console.log("🟢  tmpt is NOT required (full−tmpt succeeded)");
  }

  // Minimal set
  if (minimal) {
    console.log("🟢  MINIMAL set (BID+SID+TMUO+sticky) is SUFFICIENT");
  } else {
    if (withTmpt) {
      console.log("🟡  Minimal fails, but adding tmpt fixes it → tmpt is required");
    } else {
      console.log("🔴  Minimal set is NOT sufficient even with tmpt");
    }
  }

  // Consent cookies
  if (withConsent && !minimal) {
    console.log("🟡  Consent cookies help — minimal alone not enough");
  } else {
    console.log("⚪  Consent cookies appear irrelevant for API access");
  }

  // Individual cookie roles
  if (noSid === false)    console.log("🔴  SID is REQUIRED");
  else if (noSid === true) console.log("🟢  SID is not required");

  if (noTmuo === false)   console.log("🔴  TMUO is REQUIRED");
  else if (noTmuo === true) console.log("🟢  TMUO is not required");

  if (noSticky === false)  console.log("🔴  sticky is REQUIRED");
  else if (noSticky === true) console.log("🟢  sticky (load-balancer) is not required");

  console.log();

  // Recommendation
  console.log("── RECOMMENDATION ──────────────────────────────────────────");
  if (minimal) {
    console.log("→  Use reduced static set: BID + SID + TMUO + sticky");
    console.log("   Fewer cookies = smaller surface area for expiry issues.");
    console.log("   Implement cookie-expired detection (on 403) + manual refresh.");
  } else if (withTmpt) {
    console.log("→  Add tmpt to your refresh target. Minimal set + tmpt is enough.");
    console.log("   Consider documenting which 5 cookies to refresh manually.");
  } else {
    console.log("→  Minimal subsets all fail. Full cookie string required.");
    console.log("   STRONGLY RECOMMEND moving to Playwright/Puppeteer for cookie");
    console.log("   acquisition — the server likely uses additional session state.");
  }
  console.log("═══════════════════════════════════════════════════════════\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// 8.  MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("TM DE Cookie Dependency Experiment");
  console.log(`Event: ${EVENT_ID}  |  Section: ${SECTION}`);
  console.log(`Cookie keys present: ${[...cookieMap.keys()].join(", ")}`);
  console.log();

  const results = [];

  for (const exp of EXPERIMENTS) {
    process.stdout.write(`Running Test ${exp.id}: ${exp.label} ... `);
    const result = await runExperiment(exp);
    results.push(result);
    console.log(result.success ? `✅ ${result.httpStatus}` : `❌ ${result.httpStatus}`);

    // Extra detail for failures
    if (!result.success) {
      console.log(`   ↳ ${result.note}`);
      const ct = result.responseHeaders?.["content-type"] ?? "(unknown)";
      console.log(`   ↳ Content-Type: ${ct}`);
    }

    // Small delay between requests to avoid rate-limiting skew
    await new Promise((r) => setTimeout(r, 800));
  }

  printTable(results);
  analyzeResults(results);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
