# CURRENT STATE

This document outlines the partially implemented, fully implemented, and rough edges of the current Ticket Availability Checker.

## Working Features

- **Query Creation & Editing:** Users can via the header UI create queries. They can click on a card to open an edit/log modal to change specific tracking parameters.
- **German Ticketmaster (DE) Checks:** Reliable JSON/API based scraping for German events via `fetch-de.js` works, provided the `TM_DE_COOKIE` is valid.
- **Minimum Seat Logic:** `minSeats` property is actively evaluated by checking availability group quantities or calculating sequential fallback seats.
- **Price Constraints (`maxPrice`):** Evaluates strictly. Bypasses found seats if they exceed maxPrice, but returns the exceeded price for the UI to display.
- **Profit/Loss UI:** Users can input a `salePrice`. When a card hits `FOUND`, the UI calculates and displays profit/loss inline (in UI only, via `Card.jsx`).
- **Query Status Pausing:** Users can halt queries (change to `STOPPED` or `PURCHASED`), causing the DB query queue in `getNextQueryToRun.js` to skip them.
- **Scheduler Loop:** Checks one active query every 60 seconds over a rotating round-robin fashion.
- **Telegram Notifications:** Automatically fires rich Markdown messages on state transitions (e.g. from Finding -> Found).
- **Log Activity Modal:** Displays a readable timeline of "significant" (found/error) checks skipping boring blank checks.

## Current Query Definition (Fields)

- `url`: The TM page url
- `section`: Target section text matching the layout map (`e.g., v8, l2`)
- `minSeats`: Count of tickets desired
- `maxPrice`: Ceiling cost (per ticket, user input in EUR, stored as Cents in DB).
- `salePrice`: What the user intends to sell the ticket for (per ticket, input EUR, stored in Cents in DB).
- `orderNo`: User operational identification text.

## Current UI Behavior

- **Card Grid:** Cards automatically filter by derived status (All, Found, Price Exceeded, Finding, Error, Purchased).
- **Sorting:** Priority is given to `FOUND` and `PRICE_EXCEEDED` statuses over `FINDING`, with secondary sort handling `updatedAt` recency.
- **Flags & Currency:** Flags map to domains (`DE` -> EUR / German Flag).
- **Date parsing:** Handles fetching partial date string from `fetchEventMetadata.js` and formats it using native JS strings.

## Current Rough Edges / Known Limitations

- **No Ticketmaster UK execution:** Forms allow UK `.co.uk` inputs, and `parseTicketmasterUrl.js` handles them. But `fetch-uk.js` is merely a drafted stub. Submitting a UK link immediately errors out.
- **HardCoded Refresh Logic:** Frontend only fetches data when components mount or actions are dispatched. Wait time is handled server-side, but UI relies on refresh intervals.
- **TM_DE_COOKIE dependency:** There is no automated session rotation. When `.env` cookie strings expire, `fetch-de` returns continuous `401 Unauthorized` or Cloudflare locks.
- **Concurrency Issue Risk:** Setting `interval` to 60,000 miliseconds works. However, the query loop fails open if network requests hang over 60 seconds because `isRunning` flag blocks overlaps, but there is no explicit timeout inside the outermost try/catch beyond axios.
