/**
 * tmpt-lifetime-test.js
 *
 * Measures how long a fresh `tmpt` cookie remains valid.
 * Run manually from the terminal:
 *
 *   node src/tmpt-lifetime-test.js
 *
 * ─── HOW TO CONFIGURE ─────────────────────────────────────────────────────────
 *  1. Paste a fresh cookie string into COOKIE below (copy from browser DevTools)
 *  2. Adjust INTERVAL_MINUTES  (default: 10)
 *  3. Adjust MAX_ATTEMPTS      (default: 12  → covers ~2 hours)
 *  4. Optionally change EVENT_ID / SECTION to a known-working event
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from "axios";
import { normalizeError } from "./utils/normalizeError.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG  ← edit these before running
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_ID        = "2049708374";
const SECTION         = "101";
const INTERVAL_MINUTES = 1;   // how often to probe (minutes)
const MAX_ATTEMPTS    = 336;    // 12 × 10 min = 2 hours max

// Paste your fresh full cookie string here.
// Minimum required: BID + SID + TMUO + sticky + tmpt
const COOKIE =
  "BID=zL-iB79jZV2PyvHFhxZa_HAfhF-jm-Ym2orqykmK9Ey2oqVwaweRo3BEGgbiyCSWA_I3riRhjLHSDpYs; SID=5KYkOpq1o_EUY-z4OjIPqEjkux853QeIA7alym69I9vSneyLsgYNeLj0EPRRjcxRsSV9aLzVNjHmLQb6; TMUO=east_Oeo+kRQR4J9gBICPbpSA/O0eOjE/4InjSmRxyFBP/7M=; sticky=BCBA; tmpt=1:CAESGPQvqSHjsvMAkZJHwTvNtjPo18BxKn7-chjv-tem1DMiMKk8OHF-adVctZHEhgJQ4znwaCklROSlLMlqrNzGQoj30b-Ru3qebZwH1QxDZWETcA;";

// ─────────────────────────────────────────────────────────────────────────────
// INTERNALS — do not edit below this line
// ─────────────────────────────────────────────────────────────────────────────

const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;
const startTime   = Date.now();

function nowLabel() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function elapsedMin() {
  return Math.round((Date.now() - startTime) / 60000);
}

function separator() {
  return "─".repeat(50);
}

async function probe() {
  const url = `https://availability.ticketmaster.de/api/v2/TM_DE/availability/${EVENT_ID}?subChannelId=1`;

  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    Accept      : "application/json, text/plain, */*",
    Referer     : "https://www.ticketmaster.de/",
    Origin      : "https://www.ticketmaster.de",
    Cookie      : COOKIE,
  };

  const t0 = Date.now();
  try {
    const res       = await axios.get(url, { headers, timeout: 12000 });
    const latencyMs = Date.now() - t0;
    const data      = res.data;

    let isAvailable = false;
    for (const g of data.groups || []) {
      const places   = g.places || {};
      const hasMatch = Object.keys(places).some(
        (k) => k === `U-${SECTION}` || k === `M-${SECTION}`
      );
      if (hasMatch) { isAvailable = true; break; }
    }

    return { success: true, httpStatus: res.status, isAvailable, latencyMs };
  } catch (err) {
    const latencyMs   = Date.now() - t0;
    const normalized  = normalizeError(err);
    return {
      success       : false,
      httpStatus    : normalized.httpStatus ?? "ERR",
      isAvailable   : false,
      errorCategory : normalized.category,
      errorMessage  : `${normalized.category}: ${normalized.message}`,
      retryable     : normalized.retryable,
      latencyMs,
    };
  }
}

function printResult(attempt, result) {
  console.log(separator());
  console.log(`[Attempt ${attempt}] ${nowLabel()}`);
  console.log(`Elapsed:     ${elapsedMin()} min`);
  console.log(`HTTP:        ${result.httpStatus}`);
  console.log(`success:     ${result.success}`);
  console.log(`isAvailable: ${result.isAvailable}`);
  if (result.errorCategory) {
    console.log(`category:    ${result.errorCategory}`);
  }
  if (result.errorMessage) {
    console.log(`errorMessage: ${result.errorMessage}`);
  }
  if (result.retryable !== undefined) {
    console.log(`retryable:   ${result.retryable}`);
  }
  console.log(`latencyMs:   ${result.latencyMs}`);
}

async function run() {
  // Guard: catch the placeholder before wasting time
  if (COOKIE.startsWith("PASTE_FRESH")) {
    console.error("❌  Please paste a real cookie string into the COOKIE variable before running.");
    process.exit(1);
  }

  console.log("═".repeat(50));
  console.log("  TMPT LIFETIME TEST");
  console.log(`  Event:    ${EVENT_ID}  |  Section: ${SECTION}`);
  console.log(`  Interval: every ${INTERVAL_MINUTES} min`);
  console.log(`  Max:      ${MAX_ATTEMPTS} attempts (~${MAX_ATTEMPTS * INTERVAL_MINUTES} min)`);
  console.log(`  Started:  ${nowLabel()}`);
  console.log("═".repeat(50));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await probe();
    printResult(attempt, result);

    // ── Failure path ──────────────────────────────────────────────────────
    if (!result.success || result.httpStatus !== 200) {
      const cat = result.errorCategory || "UNKNOWN";
      console.log();

      if (cat === "AUTH_OR_BLOCK") {
        console.log("🔴  AUTH_OR_BLOCK — anti-bot block detected");
        console.log(`    tmpt survived approximately ${elapsedMin()} minutes before being blocked.`);
        console.log("    Stopping test.");
      } else if (cat === "AUTH_EXPIRED") {
        console.log("🔴  AUTH_EXPIRED — cookie/session likely expired");
        console.log(`    tmpt survived approximately ${elapsedMin()} minutes.`);
        console.log("    Stopping test.");
      } else if (cat === "UPSTREAM_ERROR") {
        console.log(`🟡  UPSTREAM_ERROR — transient failure (HTTP ${result.httpStatus})`);
        console.log("    This is NOT a cookie/session issue.");
        console.log("    Continuing test — upstream errors can be intermittent.");
        // Do NOT stop — upstream errors are transient
        if (attempt < MAX_ATTEMPTS) {
          const nextAt = new Date(Date.now() + INTERVAL_MS)
            .toISOString().replace("T", " ").slice(0, 19);
          console.log(`    Next probe at ${nextAt}`);
          await new Promise((r) => setTimeout(r, INTERVAL_MS));
          continue;
        }
      } else if (cat === "NETWORK_ERROR" || cat === "TIMEOUT") {
        console.log(`🟡  ${cat} — infrastructure issue, not cookie-related`);
        console.log("    Continuing test — may be intermittent.");
        if (attempt < MAX_ATTEMPTS) {
          const nextAt = new Date(Date.now() + INTERVAL_MS)
            .toISOString().replace("T", " ").slice(0, 19);
          console.log(`    Next probe at ${nextAt}`);
          await new Promise((r) => setTimeout(r, INTERVAL_MS));
          continue;
        }
      } else {
        console.log(`🔴  ${cat} — unrecognized failure`);
        console.log(`    tmpt survived approximately ${elapsedMin()} minutes.`);
        console.log("    Stopping test.");
      }

      console.log(separator());
      process.exit(0);
    }

    // ── Success — wait before next attempt (skip wait on last attempt) ────
    if (attempt < MAX_ATTEMPTS) {
      const nextAt = new Date(Date.now() + INTERVAL_MS)
        .toISOString().replace("T", " ").slice(0, 19);
      console.log(`✅  OK — next probe at ${nextAt}`);
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  }

  // Reached max attempts without failure
  console.log(separator());
  console.log("🟢  MAX_ATTEMPTS reached — tmpt is still valid.");
  console.log(`    Survived at least ${elapsedMin()} minutes.`);
  console.log("    Increase MAX_ATTEMPTS and rerun to continue measuring.");
  console.log(separator());
}

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
