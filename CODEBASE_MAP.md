# CODEBASE MAP

This document maps the Ticket Availability Checker repository to quickly point you to the responsible code for any given feature.

## Top-Level Project Structure

```
/
├── backend/    # Node.js + Express + Prisma backend
├── frontend/   # React + Vite frontend
```

## Backend Map (`/backend`)

The backend is a Node.js Express server structured around Prisma ORM.

### Entry & Core
- `package.json` / `package-lock.json` - Node dependencies.
- `src/index.js` - Main entry point. Initializes Express server, configures CORS, mounts routes, and starts the background scheduler.
- `src/prisma.js` - Initializes the Prisma database client adapter.

### Database (`/backend/prisma`)
- `prisma/schema.prisma` - The central database schema file. Defines the `Query` and `CheckResult` models, as well as enums like `QueryStatus`. **Migrations/Schema state live here.** (Note: `@@unique` constraints have been recently dropped to allow multiple identical queries).

### API Routes (`/backend/src/routes`)
- `query.routes.js` - Defines all REST endpoints (`GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, `PATCH /:id/stop`, etc.). Handles request validation, HTTP responses, and database interactions for query CRUD operations. Log filtering logic (`GET /:id/logs`) is here.

### Services (`/backend/src/services`)
Centralized business logic for processing queries.
- `runQuery.js` - The primary availability check boundary. Updates database status to `FINDING`, calls the scraper/checker logic (`fetchDE`), handles errors, and records metrics to `CheckResult`.
- `getNextQueryToRun.js` - Database query logic used by the scheduler to pick the next `Query` for checking (round-robin style or skipping over checked items).
- `sendTelegramMessage.js` - Low-level API call to Telegram bot.
- `buildNotificationDecision.js` - Decides whether a status change warrants a notification.
- `buildTelegramMessage.js` - Formats the payload text/markdown sent to Telegram. Fully localized in Turkish, includes calculated profit/loss.

### Scheduler (`/backend/src/scheduler`)
- `startScheduler.js` - The check loop implementation. Uses `setInterval` to run one query per minute. Calls `getNextQueryToRun()`, `runQuery()`, and notification services sequentially.

### Scraping / Verification (`/backend`)
These scripts perform the actual external API requests.
- `fetch-de.js` - The active scraper for Ticketmaster Germany (`TM_DE`). Handles parsing Ticketmaster API JSON, parsing sections/seats, matching prices, and returning actionable booleans (`isAvailable`, `priceExceeded`). Currently includes "broad availability mode" when `section` is null.
- `fetch-uk.js` - A partially implemented draft script for Ticketmaster UK using `mapsapi.tmol.co` geometry matching and facets (currently unintegrated into `runQuery.js`).

### Utilities (`/backend/src/utils`)
- `fetchEventMetadata.js` - Extracts event date/location from Ticketmaster LD+JSON metadata when a URL is first submitted.
- `parseTicketmasterUrl.js` - Converts raw Ticketmaster URLs into Domain, Event ID, and Event Slug.
- `normalizeError.js` - Translates raw axios/network errors into structured error types for logs and UI.

---

## Frontend Map (`/frontend`)

The frontend is a Vite + React application using `react-router-dom` loaders and actions for data mutation via fetching.

### Entry & Core
- `src/main.jsx` - Root React render call.
- `src/App.jsx` - Router configuration. Defines the `loader` (fetch all queries) and `action` (create, edit, stop, resume, purchase, delete) functions that talk to the backend.
- `src/api.js` - Small helper wrapping `fetch` to standardize calls to the backend API via ngrok or localhost.
- `src/RootLayout.jsx` - Wrapper component laying out the Header and Main sections.

### Components - Header (`/frontend/src/Header`)
Handles the input form and Query creation.
- `HeaderSection.jsx` - Renders the form grid using `react-router-dom`'s `<Form>`. Holds the `url`, `section` (optional), `minSeats`, `maxPrice` (optional), `salePrice`, `orderNo` inputs. Contains UI hint logic for these inputs.
- `Input.jsx` & `Button.jsx` - Base UI components styling for the form.

### Components - Main UI (`/frontend/src/Main`)
Handles displaying cards, sorting, and user interaction modals.
- `MainSection.jsx` - Renders the list of active/inactive queries. **Contains the Card filtering and sorting logic** (mapping backend statuses to localized UI display categories like `Tümü`, `Bulundu`, etc.).
- `Card.jsx` & `Card.module.css` - Visual representation of a Query. **Contains logic for deriving dynamic text** (like mapping `STATUS_LABELS`, profit/loss calculation strings, and formatting currency based on domain).
- `QueryModal.jsx` & `QueryModal.module.css` - The details pop-up. Handles displaying `CheckResult` logs, editing inputs, and triggering state changes.

---

## Planned Future Extension Points (Currency/FX Architecture)

We are planning a multi-currency upgrade. When implementing FX conversions and multi-currency pricing, expect to scaffold new structures here:

- **`backend/src/services/currencyService.js` (Proposed):** Likely location for an exchange rate abstraction provider (e.g., fetching open-source rates from `Frankfurter`).
- **`backend/src/cron/fetchRates.js` (Proposed):** Potential background job to hydrate a local rates cache to prevent blocking the query scheduler.
- **`backend/src/utils/currencyFormatter.js` (Proposed):** To centralize base-currency conversions rather than polluting the scraper layer or Telegram message builder.
- **`frontend/src/utils/pricing.js` (Proposed):** Shared frontend logic for rendering mixed currency text so `Card.jsx` and `QueryModal.jsx` stay clean.
