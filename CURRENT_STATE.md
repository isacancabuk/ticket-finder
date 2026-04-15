# CURRENT STATE

This document outlines the partially implemented, fully implemented, and rough edges of the current Ticket Availability Checker.

## Working Features (Implemented Today)

- **Query Creation & Editing:** Users can via the header UI create queries. `section` and `maxPrice` constraints are now fully optional.
- **Broad Availability Mode:** If a user omits the `section` during creation, `fetch-de.js` scans all available sections blindly for the cheapest ticket.
- **Multiple Configurations:** The system supports creating multiple identical queries (same event, same section) simultaneously without unique constraint blocking.
- **German Ticketmaster (DE) Checks:** Reliable JSON/API based scraping for German events via `fetch-de.js` works reliably.
- **Minimum Seat Logic:** `minSeats` property is actively evaluated by checking group quantities.
- **Profit/Loss Notifications:** Fully Turkish-localized Telegram notifications that dynamically calculate and append actual profit/loss logic based on `salePrice`.
- **Query Status Pausing:** Users can halt queries (`STOPPED` or `PURCHASED`).

## Current Query Definition (Fields)

- `url`: The TM page url
- `section`: Target section text (Nullable — null checks all sections).
- `minSeats`: Count of tickets desired.
- `maxPrice`: Ceiling cost (Nullable — null accepts any price).
- `salePrice`: What the user intends to sell the ticket for (Nullable).
- `orderNo`: User operational identification text.

## Current UI Behavior

- **Card Grid:** Cards automatically filter by derived status strings (Tümü, Bulundu, Fiyat Aşıldı, Aranıyor, vb.).
- **Card Localization:** Sale pricing, found pricing, profit, and loss text are completely in Turkish. 
- **Flags & Currency (Limitations):** A rudimentary `CURRENCY_MAP` exists mapping `DE` to `EUR` and `UK` to `GBP` for the display symbol prefix, but this is entirely cosmetic.

## Current Pricing & Domain Assumptions

*IMPORTANT CONTEXT*: The system currently assumes an implicit 1:1 currency match across the board.
- The `salePrice` inputted by the user is assumed to be in EUR.
- The `maxPrice` inputted by the user is assumed to be in EUR.
- The `foundPrice` returned by `fetchDE` is naturally in EUR.
- We perform a raw subtraction (`salePrice - foundPrice = Profit`) directly in JS under the unverified assumption that both are EUR.
- There are no database fields tracking the intended currency of prices. 

## Current Rough Edges / Known Limitations

- **No Ticketmaster UK execution:** Forms allow UK `.co.uk` inputs, but `fetch-uk.js` is merely a drafted stub. Submitting a UK link immediately errors out.
- **TM_DE_COOKIE dependency:** There is no automated session rotation. When `.env` cookie strings expire, `fetch-de` returns continuous `401 Unauthorized`.
- **Concurrency Issue Risk:** The query loop fails open if network requests hang over 60 seconds because `isRunning` flag blocks overlaps, but there is no explicit timeout inside the outermost try/catch beyond axios.

---

## 🏗️ Known Upcoming Design Area: Multi-Currency & FX Support

We are actively planning to transition from the assumed EUR-only model to a robust multi-currency calculation engine. 

**What is MISSING and requires future implementation:**
- **Schema missing fields:** We do not track the user's intended currency for the `salePrice` (e.g. `salePriceCurrency`).
- **Domain discrepancies:** When `fetchUK` is completed, it will return prices in `GBP`. A user might specify `salePrice: 200, salePriceCurrency: EUR`.
- **Missing FX Layer:** We currently lack any API to pull live exchange rates (e.g. Frankfurter) to accurately evaluate Profit/Loss (e.g., `(200 EUR) - (150 GBP in EUR) = Output`).
- **Missing Base Accounting:** There is no concept of a generic `baseAccountCurrency` for the whole dashboard layout to normalize analytics.
