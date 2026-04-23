# CURRENT STATE

This document outlines the partially implemented, fully implemented, and rough edges of the current Ticket Availability Checker.

## Working Features (Implemented Today)

- **Query Creation & Editing:** Users can create queries via the header UI. `section` and `maxPrice` constraints are fully optional.
- **Section Picker helper:** A visual "Bölümler" button fetches the manifest for the event URL and provides a dropdown to select one or multiple sections easily. It shows visually which sections are currently selected in the input.
- **Broad Availability & Multi-Section Mode:** If a user omits the `section`, the scraper scans all available sections blindly. If multiple sections are inputted (comma/space separated), it evaluates all of them.
- **Multiple Configurations:** The system supports creating multiple identical queries (same event, same section) simultaneously without unique constraint blocking.
- **Ticketmaster DE & ES Checks:** Reliable JSON/API based scraping for German (TM_DE) and Spanish (TM_ES) events via `fetch-de.js` and `fetch-es.js`.
- **Minimum Seat Logic:** `minSeats` property is actively evaluated by checking group quantities.
- **Profit/Loss Notifications:** Fully Turkish-localized Telegram notifications that dynamically calculate and append actual profit/loss logic based on `salePrice`. Shows found section and per-ticket price breakdowns if minSeats > 1.
- **Duplicate Notification Prevention:** Scrapes that fail with temporary errors retain the previous availability state (`isAvailable`), preventing annoying notification spam when the block lifts.
- **Query Status Pausing:** Users can halt queries (`STOPPED` or `PURCHASED`).

## Current Query Definition (Fields)

- `url`: The TM page url
- `site`: The explicit provider parsed from the URL (e.g. `TICKETMASTER`)
- `domain`: `DE`, `ES`, or `UK`
- `section`: Target section text (Nullable — null checks all sections, space-separated for multiple).
- `minSeats`: Count of tickets desired.
- `maxPrice`: Ceiling cost (Nullable — null accepts any price). Evaluated strictly in the domain's native currency.
- `salePrice`: What the user intends to sell the ticket for (Nullable).
- `salePriceCurrency`: The explicitly tracked currency (EUR, GBP, USD, etc.) of the salePrice.
- `orderNo`: User operational identification text.

## Current UI Behavior

- **Card Grid:** Cards automatically filter by derived status strings (Tümü, Bulundu, Fiyat Aşıldı, Aranıyor, vb.).
- **Card Localization:** Sale pricing, found pricing, profit, and loss text are completely in Turkish. 
- **Filter Bar:** A robust filter bar exists for Order No/Event Name text search, Status, Platform, Country, and Sort Direction, complete with a "Temizle" reset button.
- **Log Table:** The modal includes a detailed Logs table. It natively surfaces the `Bulunan Bölüm` (Found Section) in its own column, along with price, latency, and specific error messages.

## Current Pricing & Domain Integrations

The system evaluates availability and user pricing actively:
- `foundPrice` matches are resolved locally by the scraper in that domain's native currency (DE -> EUR, ES -> EUR, UK -> GBP). 
- `maxPrice` constraints are consistently evaluated against `foundPrice` *without* exchange rates. 
- `salePrice` stores its own distinct currency (`salePriceCurrency`).
- The backend actively calls **Frankfurter** (`fxService.js`) to cache ECB daily exchange rates. 
- If `salePriceCurrency` differs from the event's native currency, `enrichQueryResponse.js` (for UI presentation) and `buildTelegramMessage.js` (for notifications) apply async conversions to calculate `Profit = salePrice - FX(foundPrice)`.

## Current Rough Edges / Known Limitations

- **No Ticketmaster UK execution:** Forms allow UK `.co.uk` inputs, but `fetch-uk.js` is merely a drafted stub. Submitting a UK link will result in errors unless resolved.
- **TM Cookie dependency:** There is no automated session rotation for domains that require them. When `.env` cookie strings expire, scrapers might return continuous `401 Unauthorized` or `403 Forbidden` errors.

---

## 🏗️ Future Implementation Goals

The core Multi-Currency/FX infrastructure is completely implemented. What remains:

- **Complete TM UK Scraper:** The `fetch-uk.js` scraper needs to be fully built and connected to the `runQuery.js` pipeline.
- **Automated Authentication:** Implement browser-based session refreshers or proxy rotations to prevent 401s on TM domains.
