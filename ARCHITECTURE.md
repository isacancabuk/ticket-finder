# ARCHITECTURE

This document describes the high-level architecture and data flow of the Ticket Availability Checker.

## Frontend / Backend Flow (Data Flow)

1. **Frontend State:** React acts primarily as a view layer rendering data fetched by `react-router-dom` loaders. There is no complex global state wrapper. State transitions happen via form posts hitting `App.jsx` actions.
2. **API Communication:** `frontend/src/api.js` encapsulates `fetch` requests, communicating with the backend's REST endpoints (`query.routes.js`).
3. **Backend:** Express unpacks the request, calls the DB (Prisma), and returns `JSON` which triggers a revalidation/re-render on the frontend.

## Query Lifecycle

A `Query` represents a user's intent to watch a specific event for matching tickets.

1. **Creation:** User pastes a Ticketmaster URL + optional section + optional price constraints. 
   - Initial status is `FINDING`. Total statuses: `FINDING`, `FOUND`, `STOPPED`, `PURCHASED`, `ERROR`.
   - The backend uses `parseTicketmasterUrl.js` to parse the domain, event ID, and the explicit `site` value (e.g. `TICKETMASTER`) which is then saved to the DB.
2. **Checking Loop:** The `Query` waits in the Prisma DB. The `startScheduler` interval picks it up via `getNextQueryToRun`. It calls `runQuery()`.
3. **Check Evaluated:** Status updates to `FINDING` to mark activity, the scraper runs, and the result determines the final status:
   - Match found inside `maxPrice` (or no `maxPrice` limit): `FOUND`, `isAvailable=true`, `priceExceeded=false`.
   - Match found but over `maxPrice`: `FINDING`, `isAvailable=true`, `priceExceeded=true` (Frontend maps this to `PRICE_EXCEEDED`).
   - Nothing found: `FINDING`, `isAvailable=false`.
   - Scraping failed: `ERROR`. **Important:** During an error, `runQuery.js` retains the *previous* `isAvailable`, `foundPrice`, and `foundSection` values to prevent flip-flopping state and duplicate notifications on temporary bans.
4. **Log Results:** Output is appended to the `CheckResult` relational table.

## The Pricing Concepts

It is critical to distinguish between the different price variables in the system:

- **Found Ticket Price (`foundPrice`):** The actual dynamic cost of the ticket extracted from the Ticketmaster API response. Its currency is implicitly derived from the domain (e.g., DE = EUR, ES = EUR, UK = GBP).
- **Max Price (`maxPrice`):** Optional user constraint used by the scraper. If the `foundPrice` is higher than `maxPrice`, the system treats the ticket as "exceeded". This value is always evaluated in the domain's native currency.
- **Sale Price (`salePrice`):** Conceptually a business decision field inputted by the user. It represents the intended downstream resale value of the ticket.
- **Sale Price Currency (`salePriceCurrency`):** Explicitly stores the currency of the intended resale (e.g., EUR, GBP, USD). This may differ from the ticket's found native currency.
- **Profit/Loss:** A purely derived calculation performed right before UI render or Telegram message sending. It is not stored natively in the database. If currencies match, it's `salePrice - foundPrice`. If they differ, the backend fetches FX rates.

## Scheduler Behavior

- Runs centrally inside `src/scheduler/startScheduler.js`.
- An asynchronous `setInterval` ticks sequentially. It avoids overlaps with an `isRunning` lock.
- Uses `getNextQueryToRun.js` enforcing a round-robin style single-thread queue across all active queries.

## Scraper Execution (`fetchDE` / `fetchES`)

- Matches Sections: If `section` is null or empty, it operates in "Broad Availability Mode" matching *any* active section.
- Multiple Sections: If `section` contains multiple codes (separated by spaces or commas), it iterates through them to check.
- Returns `isAvailable`, `foundPrice`, `priceExceeded`, and an array of `foundSections` which `runQuery.js` joins into a string.

## The Status System (Backend vs Frontend)

The backend schema only tracks: `FINDING, FOUND, STOPPED, PURCHASED, ERROR`.
The frontend relies on combinations of fields to render a derived "Display Status":
- If `status === "PURCHASED"` -> `Alındı`
- If `priceExceeded == true` and `foundPrice != null` -> `Fiyat Aşıldı`
- If `status === "FOUND"` -> `Bulundu`
- If `status === "ERROR"` -> `HATA` (regardless of `isAvailable`)
...

## Telegram Notification Triggers

- Notifications do not fire on every `runQuery`. They fire on state edge transitions (e.g. `Finding -> Found`) evaluated in `buildNotificationDecision.js`.
- Because `runQuery.js` retains `isAvailable` during an `ERROR` state, a `FOUND -> ERROR -> FOUND` sequence will *not* trigger a duplicate notification, keeping channels quiet during temporary IP blocks.
- Localized entirely in Turkish and statically injects the calculated profit/loss margin, found section, and individual ticket pricing if `minSeats > 1`.

---

## 💱 Multi-Currency & FX Architecture

Because Ticketmaster domains span multiple currencies (e.g., TM DE in EUR, TM UK in GBP) while a reseller's downstream marketplace might use a different currency, the architecture decouples prices from explicit single currencies:

### Design Implementation
- **Schema Separation:** The system explicitly tracks the intended currency of the sale via `salePriceCurrency`. `maxPrice` is an operational constraint running natively against the domain API without FX processing.
- **Base/Target Currency Maps:** A constant mapping `DOMAIN_CURRENCY` dictates the expected currency format of `foundPrice` per provider/region.
- **Exchange Rate Engine:**
  - Integrated via `fxService.js`, the platform pulls daily rates from the **Frankfurter** open-source API.
  - The provider is abstracted gracefully to fallback against failures, maintaining a 24-hour cache (TTL).
- **Asymmetric Rendering:**
  - Front-end fetches rely on the Backend `enrichQueryResponse.js` enriching queried tickets with calculated `profitLoss` and `profitLossCurrency` before browser presentation.
  - Telegram messages process cross-currency margins dynamically before dispatch.
