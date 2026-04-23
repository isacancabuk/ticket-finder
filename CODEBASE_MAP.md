# CODEBASE MAP

This document maps the Ticket Availability Checker repository to quickly point you to the responsible code for any given feature.

## Top-Level Project Structure

```text
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
- `query.routes.js` - Defines all REST endpoints (`GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, `PATCH /:id/stop`, etc.). Handles request validation, HTTP responses, parsing of URLs for domain/site, database interactions, and logs filtering logic (`GET /:id/logs`). It also provides the `/queries/manifest-sections` endpoint for the frontend section picker.

### Services (`/backend/src/services`)
Centralized business logic for processing queries.
- `runQuery.js` - The primary availability check boundary. Updates database status, handles multi-section parallel/sequential checks by calling the scraper (`fetchDE` or `fetchES`), handles errors (retains previous availability state on failure), and records metrics to `CheckResult`.
- `getNextQueryToRun.js` - Database query logic used by the scheduler to pick the next `Query` for checking.
- `enrichQueryResponse.js` - Extracts FX calculations (`salePriceInEUR`, `foundPriceInEUR`, `profitLoss`) out of the route to centralize the logic.
- `fxService.js` - Exchange rate provider abstraction wrapping the **Frankfurter API**. Maintains an in-memory 24-hour cache of daily ECB rates.
- `sendTelegramMessage.js` - Low-level API call to Telegram bot.
- `buildNotificationDecision.js` - Decides whether a status change warrants a notification (e.g., checks if `previousIsAvailable` went from `false` to `true`).
- `buildTelegramMessage.js` - Formats the payload text/markdown sent to Telegram. Fully localized in Turkish, includes asynchronous cross-currency FX calculated profit/loss, found section, and multi-seat pricing breakdown.

### Scheduler (`/backend/src/scheduler`)
- `startScheduler.js` - The check loop implementation. Uses `setInterval` to run sequentially. Calls `getNextQueryToRun()`, `runQuery()`, and notification services sequentially.

### Scraping / Verification (`/backend`)
These scripts perform the actual external API requests.
- `fetch-de.js` - Scraper for Ticketmaster Germany (`TM_DE`). Handles parsing Ticketmaster API JSON, parsing sections/seats, matching prices, and returning actionable data (`isAvailable`, `priceExceeded`, `foundPrice`, `foundSections`).
- `fetch-es.js` - Scraper for Ticketmaster Spain (`TM_ES`). Mirrors the DE scraper but points to the Spanish domain endpoints.
- `fetch-uk.js` - A partially implemented draft script for Ticketmaster UK using `mapsapi.tmol.co` geometry matching and facets (currently unintegrated into `runQuery.js`).

### Utilities (`/backend/src/utils`)
- `fetchEventMetadata.js` - Extracts event date/location from Ticketmaster LD+JSON metadata when a URL is first submitted.
- `parseTicketmasterUrl.js` - Converts raw Ticketmaster URLs into Domain, Site (e.g. `TICKETMASTER`), Event ID, and Event Slug.
- `normalizeError.js` - Translates raw axios/network errors into structured error types for logs and UI.
- `currencyConfig.js` - Centralizes domain-to-currency mappings (`DOMAIN_CURRENCY`) and valid `salePriceCurrency` option parsing.

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
- `HeaderSection.jsx` - Renders the form grid using `react-router-dom`'s `<Form>`. Holds the `url`, `section`, `minSeats`, `maxPrice`, `salePrice`, `orderNo` inputs. Also manages the state for the Section Picker modal.
- `SectionPicker.jsx` & `SectionPicker.module.css` - A visual dropdown that fetches available sections for an event via manifest API, allowing users to click to add multiple sections visually. Shows a checked style for already selected sections.
- `Input.jsx` & `Button.jsx` - Base UI components styling for the form.

### Components - Main UI (`/frontend/src/Main`)
Handles displaying cards, sorting, and user interaction modals.
- `MainSection.jsx` - Renders the list of active/inactive queries. Maps backend statuses to localized UI display categories.
- `FilterBar.jsx` & `FilterBar.module.css` - Top row filters allowing users to search by Order No, filter by Domain, Platform, Status, Sort Direction, and includes a "Temizle" (Reset) button.
- `Card.jsx` & `Card.module.css` - Visual representation of a Query. **Contains logic for deriving dynamic text** (like mapping `STATUS_LABELS`, profit/loss calculation strings, found sections, and formatting currency based on domain).
- `QueryModal.jsx` & `QueryModal.module.css` - The details pop-up. Handles displaying `CheckResult` logs (including dedicated `Bulunan Bölüm` column), editing inputs, and triggering state changes.

---

## Currency & FX Architecture

The system evaluates multi-currency operations using the newly integrated exchange rate engine.
- **Backend:** `fxService.js` caches exchange rates from Frankfurter. 
- **Routes/Utils:** `enrichQueryResponse.js` computes cross-currency profit/loss (`profitLoss` and `profitLossCurrency`) before delivering to the frontend.
- **Frontend Display:** `Card.jsx` and `QueryModal.jsx` utilize the pre-calculated metrics from the API rather than attempting local math, keeping the client pure of FX logic.
