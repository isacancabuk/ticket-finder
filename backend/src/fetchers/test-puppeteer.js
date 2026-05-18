import { connect } from "puppeteer-real-browser";

// ── Configuration ─────────────────────────────────────────────────────
const COOKIE_CHECK_INTERVAL_MS = 15 * 1000;    // Check readiness every 15s
const COOKIE_REFRESH_INTERVAL_MS = 30 * 1000;  // After initial capture, refresh every 30s
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;  // Reload page every 4min to keep session alive

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

// ── Cookie Harvesting Loop ────────────────────────────────────────────
async function startHarvesting(page) {
  const fs = await import("fs/promises");
  let initialCaptured = false;

  return new Promise((resolveInitial) => {
    const interval = setInterval(async () => {
      const now = new Date().toLocaleTimeString();

      try {
        const cookies = await page.cookies();
        const { ready, issues, results, map } = checkCookieReadiness(cookies);

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

        // ── Everything passed — write cookies ──
        const cookieMap = {};
        for (const c of cookies) cookieMap[c.name] = c.value;
        cookieMap["_harvestedAt"] = Date.now();

        // Read existing file (preserve structure)
        let allCookies = {};
        try {
          const existing = await fs.readFile("fifa-cookies.json", "utf-8");
          allCookies = JSON.parse(existing);
        } catch {
          // File doesn't exist yet — start fresh
        }

        // Write ONLY under "resale" key — no shop, no other variants
        allCookies["resale"] = cookieMap;

        // Remove any stale "shop" key if it exists — resale-only from now on
        delete allCookies["shop"];

        await fs.writeFile(
          "fifa-cookies.json",
          JSON.stringify(allCookies, null, 2),
        );

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
    }, initialCaptured ? COOKIE_REFRESH_INTERVAL_MS : COOKIE_CHECK_INTERVAL_MS);
  });
}

// ── Keep-Alive (lightweight XHR, NOT page reload) ────────────────────
// page.reload() destroys CACHE_PKP_TOKEN and breaks the session.
// Instead, make a lightweight fetch from the page context to keep the
// server-side session alive without clearing any cookies.
function startKeepAlive(page) {
  return setInterval(async () => {
    const now = new Date().toLocaleTimeString();
    try {
      const result = await page.evaluate(async () => {
        try {
          const res = await fetch(window.location.href, {
            method: "HEAD",
            credentials: "include",
          });
          return { ok: true, status: res.status };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      });
      if (result.ok) {
        console.log(`[${now}] 💓 Keep-alive ping OK (HTTP ${result.status})`);
      } else {
        console.log(`[${now}] ⚠️ Keep-alive ping failed: ${result.error}`);
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
  console.log("  6. Page must show resale ticket content (not challenge/login)\n");

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
      console.log("   Cookies are refreshed every 30 seconds.");
      console.log("   Page is reloaded every 4 minutes to keep session alive.");
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
