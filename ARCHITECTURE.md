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
2. **Checking Loop:** The `Query` waits in the Prisma DB. The `startScheduler` interval picks it up via `getNextQueryToRun`. It calls `runQuery()`.
3. **Check Evaluated:** Status updates to `FINDING` to mark activity, the scraper runs, and the result determines the final status:
   - Match found inside `maxPrice` (or no `maxPrice` limit): `FOUND`, `isAvailable=true`, `priceExceeded=false`.
   - Match found but over `maxPrice`: `FINDING`, `isAvailable=true`, `priceExceeded=true` (Frontend maps this to `PRICE_EXCEEDED`).
   - Nothing found: `FINDING`.
   - Scraping failed: `ERROR`.
4. **Log Results:** Output is appended to the `CheckResult` relational table.

## The Pricing Concepts

It is critical to distinguish between the different price variables in the system:

- **Found Ticket Price (`foundPrice`):** The actual dynamic cost of the ticket extracted from the Ticketmaster API response.
- **Max Price (`maxPrice`):** Optional user constraint. If the `foundPrice` is higher than `maxPrice`, the system treats the ticket as "exceeded" and skips the notification.
- **Sale Price (`salePrice`):** Conceptually a business decision field inputted by the user. It represents the intended downstream resale value of the ticket.
- **Profit/Loss:** A purely derived calculation performed right before UI render or Telegram message sending (`Profit = salePrice - foundPrice`). It is not stored natively in the database.

## Scheduler Behavior

- Runs centrally inside `src/scheduler/startScheduler.js`.
- An asynchronous `setInterval` ticks every 60 seconds.
- Uses `getNextQueryToRun.js` enforcing a round-robin style single-thread queue across all active queries.

## Scraper Execution (`fetchDE`)

- Matches Sections: If `section` is null, operates in "Broad Availability Mode" matching *any* active section.
- Determines the lowest matched price, checks against user's `maxPrice`, and returns a standardized result.

## The Status System (Backend vs Frontend)

The backend schema only tracks: `FINDING, FOUND, STOPPED, PURCHASED, ERROR`.
The frontend relies on combinations of fields to render a derived "Display Status":
- If `status === "PURCHASED"` -> `Alındı`
- If `priceExceeded == true` and `foundPrice != null` -> `Fiyat Aşıldı`
- If `status === "FOUND"` -> `Bulundu`
...

## Telegram Notification Triggers

- Notifications do not fire on every `runQuery`. They fire on state edge transitions (e.g. `Finding -> Found`).
- Localized entirely in Turkish and statically injects the calculated profit/loss margin.

---

## 🔮 Upcoming Currency Challenge (Design Pending)

The architecture is currently operating under the tacit assumption that **everything is priced in EUR** because `fetchDE` is the only active scraper. However, as the system grows, we face a major architectural shift:

### The Problems
1. **Multi-Currency Found Prices:** Future scrapers (e.g. `TM_UK`, `TM_US`) will return `foundPrice` in GBP or USD.
2. **Disconnected Sale Price Currency:** A user might intend to resell a Ticketmaster UK ticket (found in GBP) on a European marketplace (priced in EUR). `salePrice` may not share the currency of `foundPrice`.
3. **Complex Profit/Loss Calculation:** We can no longer do a simple `salePrice - foundPrice` subtraction if the currencies do not match.

### Design Direction (Proposed Implementation)
We are gathering requirements for an FX/Currency feature. The likely direction includes:
- **Base Currency:** Introducing a global standard (likely `EUR`), ensuring all system-wide profit calculations resolve to a single understandable metric.
- **Schema Separation:** Decoupling amount from context (e.g. adding `salePriceCurrency` Enum).
- **Exchange Rate Provider:** Integrating a transparent FX provider abstraction. **Frankfurter** is the current leading candidate for open-source, background-syncable daily exchange rates. 

*(Note: These currency/FX concepts are currently in the discussion phase. They are NOT yet implemented as of this document's writing.)*
