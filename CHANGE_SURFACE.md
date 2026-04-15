# CHANGE SURFACE

Use this guide to know exactly which files to edit when making common changes to the application.

## 1. Adding a new query input field
*e.g. adding a "promoCode" constraint.*
- **`backend/prisma/schema.prisma`**: Add the field to the `Query` model. Create migration `npx prisma db push`.
- **`backend/src/routes/query.routes.js`**: Parse the field from `req.body` in `POST /` (for creation) and `PATCH /:id` (for editing). Add validation.
- **`frontend/src/App.jsx`**: Add it to the formData payloads in `rootAction` under `intent === "create"` and `intent === "edit"`.
- **`frontend/src/Header/HeaderSection.jsx`**: Add the visual input binding to `INPUTS` configuration const.
- **`frontend/src/Main/QueryModal.jsx`**: Add it to editing form fields inside the modal render logic.

## 2. Changing Prisma schema / database fields
- **`backend/prisma/schema.prisma`**: Make the change.
- **Action**: Always run `npx prisma db push` or `npx prisma migrate dev` directly after doing this. Restart the node process and regenerate Prisma clients.

## 3. Changing UI Card Formatting or Layout
- **`frontend/src/Main/Card.jsx`**: Add/remove variables, handling flags, UI logic (profit margin calculations, text coloring, localized label rendering).
- **`frontend/src/Main/Card.module.css`**: Edit CSS grids/flex patterns.

## 4. Changing Status Logic
- **Backend Enums**: `backend/prisma/schema.prisma` inside `QueryStatus`.
- **Queue Logic**: `backend/src/services/getNextQueryToRun.js` so the loop knows whether to ignore this new status.
- **UI Mapping**: `frontend/src/Main/MainSection.jsx` (`getDisplayStatus`) and `frontend/src/Main/Card.jsx` (`STATUS_LABELS`).

## 5. Changing Availability Checking Logic
- **`backend/fetch-de.js`**: Modify scraping logic (e.g. tweaking "broad availability mode" when `section` is null).
- **`backend/src/services/runQuery.js`**: Maps the result of `fetch-de` into DB mutations.

## 6. Changing Telegram Notifications
- **`backend/src/services/buildTelegramMessage.js`**: Centralizing formatting logic for Telegram messages (e.g., adding local currency symbols, changing profit math markdown).
- **`backend/src/services/buildNotificationDecision.js`**: Modify rules for *when* a ping goes out.

---

## 💱 Future Currency / FX Workflow Guide

When the time comes to implement the **Multi-Currency and Frankfurter FX Integration**, here is the anticipated change surface:

### Changing sale price storage model (adding currency field)
- **`backend/prisma/schema.prisma`**: Add `salePriceCurrency Enum` (e.g. EUR, GBP, USD).
- **`backend/src/routes/query.routes.js`**: Validate the new currency enum in the POST and PATCH body map.
- **`frontend/src/Header/HeaderSection.jsx`**: Introduce a dropdown/select element next to the user's `salePrice` integer box.

### Adding an exchange-rate provider / base currency logic
- Creates new files: Likely `backend/src/services/fxService.js`.
- This file will need to poll the Frankfurter API, cache the response in memory (or Redis/DB), and export a `convertCurrency(amount, from, to)` method.

### Changing profit/loss calculations
- **Current Locations**: `Card.jsx` (Frontend) and `buildTelegramMessage.js` (Backend).
- **Required Shift**: Currently, these do raw math (`salePrice - foundPrice`). They must be updated to invoke asynchronous FX conversions or accept pre-calculated FX payloads injected by `runQuery.js`.

### Changing pricing display in cards and modals
- **`frontend/src/Main/Card.jsx`** / **`QueryModal.jsx`**: The `formatPrice` utility function currently relies strictly on the `domain` symbol. This will need to be refactored to look at `salePriceCurrency` and the `eventDomain` concurrently to render mixed strings like: `Sale: €200.00 | Found: £150.00`.

### Supporting varying found-ticket currencies across providers
- **`backend/fetch-uk.js`** / **`fetch-de.js`**: Scrapers will need to explicitly return the currency of the metadata parsed alongside `foundPrice`. (e.g. returning `{ isAvailable: true, foundPrice: 15000, currency: "GBP" }`).
- **`backend/src/services/runQuery.js`**: Will need to ingest this explicitly returned currency downstream to persist it to the `CheckResult` context blocks.
