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
- **Action**: Always run `npx prisma db push` or `npx prisma migrate dev` directly after doing this. Restart the generic node process.

## 3. Changing UI Card Layout or Text
- **`frontend/src/Main/Card.jsx`**: Add/remove variables, change markup, handling flags, mapping UI logic (profit margin, text coloring).
- **`frontend/src/Main/Card.module.css`**: Edit CSS grids/flex patterns or text sizing explicitly scoped to the card.

## 4. Changing Modal Layout, Modal Logs, or Editing Logic
- **`frontend/src/Main/QueryModal.jsx`**: Central modal layout, handles the tab switching between Edit / Logs, input field editing logic, and save handling.
- **`frontend/src/Main/QueryModal.module.css`**: Stylings.

## 5. Changing Status Logic
*e.g. Adding a "PAUSED_DUE_TO_RATE_LIMIT" status.*
- **Backend Enums**: `backend/prisma/schema.prisma` inside `QueryStatus`.
- **Route Guarding**: `query.routes.js` to modify `PATCH /:id/resume` or specific endpoints.
- **Queue Logic**: `backend/src/services/getNextQueryToRun.js` so the loop knows whether to ignore this new status.
- **UI Mapping**: `frontend/src/Main/MainSection.jsx` (`getDisplayStatus`) and `frontend/src/Main/Card.jsx` (`STATUS_LABELS`) to actually render the new string.

## 6. Changing Scheduler Speed or Stop Conditions
- **`backend/src/scheduler/startScheduler.js`**: `TICK_INTERVAL_MS` handles execution speed.
- **`backend/src/services/getNextQueryToRun.js`**: The `where` clause defines which queries actually qualify to be checked.

## 7. Changing availability checking logic or pricing logic
- **`backend/fetch-de.js`**: (Assuming DE). Modify how JSON is iterated, how sections are string matched (e.g. fixing a bug where `Section 5` doesn't match `Block-5`). Modify how `maxPrice` is evaluated against ticket quantities.
- **`backend/src/services/runQuery.js`**: Maps the result of `fetch-de` into DB mutations (e.g., tweaking `newStatus = "FOUND"` logic).

## 8. Changing Telegram notifications
- **`backend/src/services/buildNotificationDecision.js`**: Modify the `if()` checks determining *when* a notification should fire (e.g. fire when price changes, or on every error).
- **`backend/src/services/buildTelegramMessage.js`**: Modify the Markdown payload, format, or emojis mapped to the status.
- **`backend/src/services/sendTelegramMessage.js`**: Raw Telegram Bot API configs (Chat ID logic).

## 9. Changing event metadata fetching
- **`backend/src/utils/fetchEventMetadata.js`**: Uses `cheerio` to grab `<script type="application/ld+json">`. Modify JSON parsing here if Ticketmaster refactors their layout logic.
- **`backend/src/utils/parseTicketmasterUrl.js`**: Modify regex here if adding new Top Level Domains (.it, .es, .be).

## 10. Changing Log Display/Filtering
- **`backend/src/routes/query.routes.js`**: `GET /:id/logs` endpoint contains the OR schema for the `significant` filter, dumping out unwanted items conditionally.
- **`frontend/src/Main/QueryModal.jsx`**: Look closely inside the `FetchLogs` helper to see HTTP mappings.

## 11. Changing Card Filter Tabs/Sorting
- **`frontend/src/Main/MainSection.jsx`**: `FILTER_OPTIONS` array structures the buttons. `filtered.sort()` executes the display sorting logic prioritizing certain derived states.

## 12. Adding support for a new Provider/Location (ex. UK)
- **`backend/src/utils/parseTicketmasterUrl.js`**: Add `.co.uk` domain match.
- **`backend/prisma/schema.prisma`**: Ensure `Enum Domain` accepts `UK`.
- **`backend/src/services/runQuery.js`**: Add the `if (query.domain === "UK")` block.
- **Create scraper script**: Create a new file (e.g., `backend/fetch-uk.js`) mimicking `fetch-de.js` returning structured `{ success, isAvailable, foundPrice, priceExceeded }`.
- **`frontend/src/Main/Card.jsx`**: Add `{ symbol: "£", code: "GBP" }` in `CURRENCY_MAP` so UK correctly displays.

## 13. Changing API payload shapes (Frontend <-> Backend)
- **`backend/src/routes/query.routes.js`**: Ensure the node endpoint receives/formats the JSON response properly.
- **`frontend/src/App.jsx`**: Modify the `rootAction` formData bindings payload before the `apiFetch`.
