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
- `maxPrice`: Ceiling cost (Nullable — null accepts any price). Evaluated strictly in the domain's native currency.
- `salePrice`: What the user intends to sell the ticket for (Nullable).
- `salePriceCurrency`: The explicitly tracked currency (EUR, GBP, USD, etc.) of the salePrice.
- `orderNo`: User operational identification text.

## Current UI Behavior

- **Card Grid:** Cards automatically filter by derived status strings (Tümü, Bulundu, Fiyat Aşıldı, Aranıyor, vb.).
- **Card Localization:** Sale pricing, found pricing, profit, and loss text are completely in Turkish. 
- **Flags & Currency (Limitations):** A rudimentary `CURRENCY_MAP` exists mapping `DE` to `EUR` and `UK` to `GBP` for the display symbol prefix, but this is entirely cosmetic.

## Current Pricing & Domain Integrations

The system evaluates availability and user pricing actively:
- `foundPrice` matches are resolved locally by the scraper in that domain's native currency (DE -> EUR, UK -> GBP). 
- `maxPrice` constraints are consistently evaluated against `foundPrice` *without* exchange rates. 
- `salePrice` stores its own distinct currency (`salePriceCurrency`).
- The backend actively calls **Frankfurter** (`fxService.js`) to cache ECB daily exchange rates. 
- If `salePriceCurrency` differs from the event's native currency, `query.routes.js` (for UI presentation) and `buildTelegramMessage.js` (for notifications) apply async conversions to calculate `Profit = salePrice - FX(foundPrice)`.

## Current Rough Edges / Known Limitations

- **No Ticketmaster UK execution:** Forms allow UK `.co.uk` inputs, but `fetch-uk.js` is merely a drafted stub. Submitting a UK link immediately errors out.
- **TM_DE_COOKIE dependency:** There is no automated session rotation. When `.env` cookie strings expire, `fetch-de` returns continuous `401 Unauthorized`.
- **Concurrency Issue Risk:** The query loop fails open if network requests hang over 60 seconds because `isRunning` flag blocks overlaps, but there is no explicit timeout inside the outermost try/catch beyond axios.

---

## 🏗️ Future Implementation Goals

The core Multi-Currency/FX infrastructure is completely implemented. What remains:

- **Complete TM UK Scraper:** The `fetch-uk.js` scraper needs to be connected to the `runQuery.js` pipeline so that the active currency mappings (`DOMAIN_CURRENCY['UK'] === 'GBP'`) are exercised against real Ticketmaster UK tickets.
- **Provider Expansion:** If expanding into APIs with non-ECB supported currencies and higher exchange volatility, Frankfurter might need to be abstracted to a secondary fallback API.
