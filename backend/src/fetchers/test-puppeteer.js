import { connect } from "puppeteer-real-browser";
import { writeFile, readFile, rename } from "fs/promises";

// ── Configuration ─────────────────────────────────────────────────────
const COOKIE_CHECK_INTERVAL_MS = 15 * 1000;    // Check readiness every 15s
const KEEP_ALIVE_INTERVAL_MS = 3 * 60 * 1000;  // Keep-alive ping every 3min
const MAX_CONSECUTIVE_403 = 3;                  // After this many 403s, navigate back to target

// Canonical resale ticket-list page.
// Cookies are ONLY valid when harvested AFTER the session reaches this
// "advantage-selected + ticket-list visible" state — NOT the earlier /secured/content page.
const RESALE_TARGET_URL =
  "https://fwc26-resale-usd.tickets.fifa.com/secure/selection/event/date/product/10229225515651/contact-advantages/10229997382729/lang/en";

// SHA-256 of empty string — stx_advantage_ids uses this when no advantages are selected
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

// ── Readiness Check ───────────────────────────────────────────────────
// All 5 conditions must pass before cookies are written to fifa-cookies.json.
function checkCookieReadiness(cookies) {
  const map = {};
  for (const c of cookies) map[c.name] = c.value;

  const results = {};

  // 1. datadome — anti-bot token
  results.datadome = map.datadome
    ? { ok: true, detail: "present" }
    : { ok: false, detail: "MISSING" };

  // 2. Core session — STX_SESSION or PKP_ID
  const sessionName = map.STX_SESSION ? "STX_SESSION" : map.PKP_ID ? "PKP_ID" : null;
  results.session = sessionName
    ? { ok: true, detail: sessionName }
    : { ok: false, detail: "MISSING (need STX_SESSION or PKP_ID)" };

  // 3. CACHE_PKP_TOKEN — auth/session token
  results.CACHE_PKP_TOKEN = map.CACHE_PKP_TOKEN
    ? { ok: true, detail: `present (${map.CACHE_PKP_TOKEN.substring(0, 20)}…)` }
    : { ok: false, detail: "MISSING" };

  // 4. stx_advantage_ids — must exist AND not be the empty-state hash
  const advIds = map.stx_advantage_ids;
  if (!advIds) {
    results.stx_advantage_ids = { ok: false, detail: "MISSING" };
  } else if (advIds === EMPTY_SHA256) {
    results.stx_advantage_ids = { ok: false, detail: `EMPTY HASH (${advIds.substring(0, 16)}…)` };
  } else {
    results.stx_advantage_ids = { ok: true, detail: `set (${advIds.substring(0, 16)}…)` };
  }

  // 5. AcpAT-*-Resale — resale-specific auth token
  const resaleCookie = cookies.find(
    (c) => c.name.startsWith("AcpAT") && c.name.includes("Resale"),
  );
  results.resaleAuth = resaleCookie
    ? { ok: true, detail: resaleCookie.name }
    : { ok: false, detail: "MISSING (no AcpAT-*-Resale cookie found)" };

  const issues = Object.entries(results)
    .filter(([, v]) => !v.ok)
    .map(([k, v]) => `${k}: ${v.detail}`);

  return { ready: issues.length === 0, issues, results, map };
}

// ── Page State Validation ─────────────────────────────────────────────
// Confirms the browser page actually shows resale ticket content, not a
// login screen, waiting room, or DataDome challenge.
async function validatePageState(page) {
  try {
    const url = page.url();
    if (!url.includes("fwc26-resale")) {
      return { valid: false, reason: `Page is NOT on resale domain (current: ${url})` };
    }

    const check = await page.evaluate(() => {
      const text = document.body?.innerText || "";
      if (text.includes("Please enable JS") || text.includes("Checking your browser")) {
        return { type: "challenge" };
      }
      const html = document.body?.innerHTML || "";
      const hasContent =
        html.includes("product_") ||
        html.includes("advantage") ||
        html.includes("selection") ||
        html.includes("event_date");
      return { type: hasContent ? "ticket_content" : "unknown" };
    });

    if (check.type === "challenge") {
      return { valid: false, reason: "DataDome JS challenge detected — solve it manually" };
    }
    if (check.type === "unknown") {
      return { valid: false, reason: "Page does not contain ticket/product content yet" };
    }
    return { valid: true, reason: "Page shows resale ticket content ✓" };
  } catch (e) {
    return { valid: false, reason: `Validation error: ${e.message}` };
  }
}

// ── Atomic Cookie File Write ──────────────────────────────────────────
// Write to a temp file first, then rename. This prevents the fetcher from
// reading a half-written JSON file.
async function atomicWriteCookies(cookieData) {
  const tmpPath = "fifa-cookies.json.tmp";
  const finalPath = "fifa-cookies.json";
  const json = JSON.stringify(cookieData, null, 2);
  await writeFile(tmpPath, json, "utf-8");
  await rename(tmpPath, finalPath);
}

// ── Cookie Harvesting Loop ────────────────────────────────────────────
async function startHarvesting(page) {
  let initialCaptured = false;

  return new Promise((resolveInitial) => {
    const interval = setInterval(async () => {
      const now = new Date().toLocaleTimeString();

      try {
        const cookies = await page.cookies();
        const { ready, issues, results } = checkCookieReadiness(cookies);

        // ── Not ready yet — log what's missing ──
        if (!ready) {
          console.log(`[${now}] ⏳ RESALE session not ready yet:`);
          for (const issue of issues) {
            console.log(`         ❌ ${issue}`);
          }
          // Show what IS present for debugging
          const okItems = Object.entries(results)
            .filter(([, v]) => v.ok)
            .map(([k, v]) => `${k}=${v.detail}`);
          if (okItems.length > 0) {
            console.log(`         ✅ Present: ${okItems.join(", ")}`);
          }
          return;
        }

        // ── All cookie checks passed — now validate page state ──
        const pageValidation = await validatePageState(page);
        if (!pageValidation.valid) {
          console.log(`[${now}] ⏳ Cookies ready but page state invalid:`);
          console.log(`         ❌ ${pageValidation.reason}`);
          return;
        }

        // ── Everything passed — write cookies atomically ──
        const cookieMap = {};
        for (const c of cookies) cookieMap[c.name] = c.value;
        cookieMap["_harvestedAt"] = Date.now();

        // Read existing file (preserve structure)
        let allCookies = {};
        try {
          const existing = await readFile("fifa-cookies.json", "utf-8");
          allCookies = JSON.parse(existing);
        } catch {
          // File doesn't exist yet — start fresh
        }

        // Write ONLY under "resale" key — no shop, no other variants
        allCookies["resale"] = cookieMap;

        // Remove any stale "shop" key if it exists — resale-only from now on
        delete allCookies["shop"];

        // Atomic write: tmp file + rename
        await atomicWriteCookies(allCookies);

        if (!initialCaptured) {
          console.log(`\n[${now}] ${"═".repeat(60)}`);
          console.log(`[${now}] ✅ RESALE COOKIES CAPTURED SUCCESSFULLY`);
          console.log(`[${now}] ${"═".repeat(60)}`);
          console.log(`[${now}]   📋 Cookie count: ${Object.keys(cookieMap).length - 1}`);
          console.log(`[${now}]   🔑 Session: ${results.session.detail}`);
          console.log(`[${now}]   🛡️ CACHE_PKP_TOKEN: present`);
          console.log(`[${now}]   🎫 stx_advantage_ids: ${results.stx_advantage_ids.detail}`);
          console.log(`[${now}]   🔐 Resale auth: ${results.resaleAuth.detail}`);
          console.log(`[${now}]   📄 Page: ${pageValidation.reason}`);
          console.log(`[${now}] ${"═".repeat(60)}\n`);
          initialCaptured = true;
          resolveInitial(true);
        } else {
          console.log(`[${now}] 🔄 RESALE cookies refreshed (${Object.keys(cookieMap).length - 1} cookies)`);
        }
      } catch (e) {
        if (e.message.includes("Session closed") || e.message.includes("Target closed")) {
          clearInterval(interval);
          if (!initialCaptured) resolveInitial(false);
        } else {
          console.error(`[${now}] ❌ Cookie read error: ${e.message}`);
        }
      }
    }, COOKIE_CHECK_INTERVAL_MS);
  });
}

// ── Keep-Alive with 403 Recovery ──────────────────────────────────────
// Uses a browser-context GET (with credentials) instead of HEAD to behave
// like a real browser navigation. If we get repeated 403s, navigate back
// to the resale target URL to try to recover the session.
// Recovery navigation does NOT bypass readiness checks — the harvesting
// loop will only write cookies when all gates pass.
function startKeepAlive(page) {
  let consecutive403 = 0;

  return setInterval(async () => {
    const now = new Date().toLocaleTimeString();
    try {
      // Use a browser-context GET with credentials — more browser-like than HEAD
      const result = await page.evaluate(async (targetUrl) => {
        try {
          const res = await fetch(targetUrl, {
            method: "GET",
            credentials: "include",
            // Don't follow redirects in the fetch — just check the status
            redirect: "manual",
          });
          return { ok: true, status: res.status, type: res.type };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }, RESALE_TARGET_URL);

      if (!result.ok) {
        console.log(`[${now}] ⚠️ Keep-alive fetch error: ${result.error}`);
        return;
      }

      // Check for 403 (DataDome block)
      if (result.status === 403) {
        consecutive403++;
        console.log(
          `[${now}] ⚠️ Keep-alive got 403 (${consecutive403}/${MAX_CONSECUTIVE_403} before recovery)`,
        );

        if (consecutive403 >= MAX_CONSECUTIVE_403) {
          console.log(
            `[${now}] 🔄 Recovery: navigating back to resale target page…`,
          );
          consecutive403 = 0;
          try {
            await page.goto(RESALE_TARGET_URL, {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });
            console.log(`[${now}] ✓ Recovery navigation complete — readiness checks will re-evaluate`);
          } catch (navErr) {
            console.error(`[${now}] ❌ Recovery navigation failed: ${navErr.message}`);
          }
        }
      } else {
        // Reset counter on any non-403 response
        if (consecutive403 > 0) {
          console.log(`[${now}] 💓 Keep-alive OK (HTTP ${result.status}) — 403 counter reset`);
        } else {
          console.log(`[${now}] 💓 Keep-alive OK (HTTP ${result.status})`);
        }
        consecutive403 = 0;
      }
    } catch (e) {
      if (e.message.includes("Session closed") || e.message.includes("Target closed")) {
        console.log(`[${now}] ⚠️ Browser tab closed`);
      } else {
        console.error(`[${now}] ❌ Keep-alive error: ${e.message}`);
      }
    }
  }, KEEP_ALIVE_INTERVAL_MS);
}

// ── Main Entry Point ──────────────────────────────────────────────────
async function main() {
  console.log(`\n${"═".repeat(70)}`);
  console.log("🎟️  FIFA RESALE Cookie Harvester (RESALE-ONLY)");
  console.log(`${"═".repeat(70)}`);
  console.log(`Target: ${RESALE_TARGET_URL}`);
  console.log(`Mode:   RESALE-ONLY (no shop variant)`);
  console.log(`${"═".repeat(70)}\n`);

  console.log("Readiness gates before cookies are saved:");
  console.log("  1. datadome cookie must exist");
  console.log("  2. STX_SESSION or PKP_ID must exist");
  console.log("  3. CACHE_PKP_TOKEN must exist");
  console.log("  4. stx_advantage_ids must exist and NOT be empty hash");
  console.log("  5. AcpAT-*-Resale auth token must exist");
  console.log("  6. Page must show resale ticket content (not challenge/login)");
  console.log(`\nKeep-alive: GET every ${KEEP_ALIVE_INTERVAL_MS / 1000}s`);
  console.log(`Recovery: navigate to target after ${MAX_CONSECUTIVE_403} consecutive 403s\n`);

  const { browser, page } = await connect({
    headless: false,
    turnstile: true,
  });

  try {
    console.log(`Navigating to resale ticket-list page…`);
    console.log("─── PLEASE LOG IN MANUALLY / SOLVE CAPTCHA IF NEEDED ───\n");

    await page.goto(RESALE_TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Start keep-alive and harvesting in parallel
    startKeepAlive(page);
    const success = await startHarvesting(page);

    if (success) {
      console.log(`${"═".repeat(70)}`);
      console.log("✅ Initial capture complete. Harvester will continue running.");
      console.log("   Cookies are refreshed every 15 seconds (when readiness passes).");
      console.log(`   Keep-alive ping every ${KEEP_ALIVE_INTERVAL_MS / 60000} minutes.`);
      console.log(`   Auto-recovery after ${MAX_CONSECUTIVE_403} consecutive keep-alive 403s.`);
      console.log("   Cookie writes are atomic (tmp+rename).");
      console.log("   Keep this browser open. Close it when done.");
      console.log(`${"═".repeat(70)}\n`);
    } else {
      console.error("❌ Cookie harvesting failed (browser was closed before capture).");
      process.exit(1);
    }
  } catch (e) {
    console.error(`❌ Fatal error: ${e.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
