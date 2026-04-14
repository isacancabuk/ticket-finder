# ARCHITECTURE

This document describes the high-level architecture and data flow of the Ticket Availability Checker.

## Frontend / Backend Flow (Data Flow)

1. **Frontend State:** React acts primarily as a view layer rendering data fetched by `react-router-dom` loaders. There is no complex global state wrapper (like Redux or Zustand). State transitions happen via form posts using `react-router-dom`'s `<Form>` or `useSubmit`, hitting `App.jsx` actions.
2. **API Communication:** `frontend/src/api.js` encapsulates `fetch` requests, communicating with the backend's REST endpoints (`query.routes.js`).
3. **Backend:** Express unpacks the request, calls the DB (Prisma), and returns `JSON` which triggers a revalidation/re-render on the frontend.

## Query Lifecycle

A `Query` represents a user's intent to watch a specific event and section for matching tickets.

1. **Creation:** User pastes a Ticketmaster URL + section + optional price constraints. 
   - Backend `parseTicketmasterUrl` extracts the `eventId` and `domain`.
   - `fetchEventMetadata` attempts a quick scrape to get the human-readable date/location. This is non-blocking.
   - Initial status is `FINDING`. Total status in schema: `FINDING`, `FOUND`, `STOPPED`, `PURCHASED`, `ERROR`.
2. **Checking Loop:** The `Query` waits in the Prisma DB. The `startScheduler` interval picks it up via `getNextQueryToRun`. It calls `runQuery()`.
3. **Check Evaluated:** Status updates to `FINDING` to mark activity, the scraper runs, and the result determines the final status:
   - Match found inside `maxPrice`: `FOUND`, `isAvailable=true`, `priceExceeded=false`.
   - Match found but over `maxPrice`: `FINDING`, `isAvailable=true`, `priceExceeded=true` (Frontend derives a custom `PRICE_EXCEEDED` label from this combo).
   - Nothing found: `FINDING`.
   - Scraping failed: `ERROR`.
4. **Log Results:** Output is appended to the `CheckResult` relational table.

## Scheduler Behavior

- Runs centrally inside `src/scheduler/startScheduler.js`.
- An asynchronous `setInterval` ticks every 60 seconds.
- Uses `getNextQueryToRun.js` which queries Prisma for the oldest `lastCheckedAt` query that is NOT `STOPPED` or `PURCHASED`.
- This enforces a round-robin style single-thread queue across all active queries.
- Only one query is checked per minute across the whole system to prevent IP bans.

## Scraper Execution (`fetchDE`)

- Makes an Axios request directly to the generic TM Ticket availability endpoint using hardcoded `.env` cookies (to bypass basic bot protection).
- **Matching Rules:** 
  - Finds sections ending with `-<SectionName>`.
  - Determines if the section actually has seats listed.
  - If seats exist, uses the `offerIds` inside the section group to evaluate exact pricing per seat constraint.
  - Checks if quantities match `minSeats`.
  - Determines the lowest matched price, then checks against user's `maxPrice`.
- Returns a normalized payload to `runQuery.js`.

## The Status System (Backend vs Frontend)

The backend schema only tracks:
`FINDING, FOUND, STOPPED, PURCHASED, ERROR`

However, the frontend relies on combinations of database fields to render a derived "Display Status".
In `Card.jsx` and `MainSection.jsx` `getDisplayStatus(query)`:
- If `status === "PURCHASED"` -> `PURCHASED`
- If `priceExceeded == true` and `foundPrice != null` -> `PRICE_EXCEEDED` (Shows up as FİYAT AŞILDI)
- If `status === "FOUND"` -> `FOUND`
- If `status === "ERROR"` -> `ERROR`
- If `status === "STOPPED"` -> `STOPPED`
- Else -> `FINDING`

This dual-layer system means "Price Exceeded" is not a formal backend status blocking the scheduler. The system considers it a variation of "FINDING".

## Logs / Check Results

- Every `runQuery` writes one row to `CheckResult`.
- The dashboard modal hits `GET /queries/:id/logs?filter=significant`.
- "Significant" logs include any result where the status is `FOUND`, `ERROR`, or `priceExceeded = true`. Routine `FINDING` blanks are filtered out so the DB log feed remains readable for the user.

## Telegram Notification Triggers

- Notifications do not fire on every `runQuery`.
- `buildNotificationDecision.js` compares `previousIsAvailable` vs `currentIsAvailable`. If `true -> false` or `false -> true` (an edge transition), it sets a flag.
- It also checks if `foundPrice` changed significantly.
- Actual Telegram Markdown is generated in `buildTelegramMessage.js` using `updatedQuery`.

## Fragility & Missing Pieces

- **Authentication/Rate limiting:** TM DE relies strictly on a static raw Cookie injected via `.env`. If that cookie expires or TM revokes it, all `fetch-de` calls drop to `ERROR` status until the text file/env is rotated manually.
- **UK Region:** The backend parses `.co.uk` links as `UK` domain, but `runQuery.js` immediately throws `UNSUPPORTED_DOMAIN` for UK because `fetch-uk.js` is disconnected and unverified.
- **Prisma Constraints:** There is a unique constraint on `[site, domain, eventId, section]`. A user cannot track two different price configurations for the exact same event/section pairing.
