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

## 3. Changing UI Card, Modal, or Filter Layout
- **`frontend/src/Main/Card.jsx`**: Add/remove variables, handling flags, UI logic (profit margin calculations, localized label rendering).
- **`frontend/src/Main/QueryModal.jsx`**: Modify the Log table columns or Modal editing forms.
- **`frontend/src/Main/FilterBar.jsx`**: Modify search, dropdowns, or reset logic for filtering cards on the dashboard.

## 4. Changing Status Logic
- **Backend Enums**: `backend/prisma/schema.prisma` inside `QueryStatus`.
- **Queue Logic**: `backend/src/services/getNextQueryToRun.js` so the loop knows whether to ignore this new status.
- **UI Mapping**: `frontend/src/Main/MainSection.jsx` (`getDisplayStatus`) and `frontend/src/Main/Card.jsx` (`STATUS_LABELS`).

## 5. Changing Availability Checking Logic
- **`backend/fetch-de.js` / `fetch-es.js`**: Modify scraping logic (e.g., broad mode checking, seat mapping).
- **`backend/src/services/runQuery.js`**: Maps the result of `fetch-*` into DB mutations. Modifying how `isAvailable` or `foundSectionStr` are merged or retained across errors happens here.

## 6. Changing Telegram Notifications
- **`backend/src/services/buildTelegramMessage.js`**: Centralizing formatting logic for Telegram messages (e.g., adding local currency symbols, changing profit math markdown, adding ticket breakdowns).
- **`backend/src/services/buildNotificationDecision.js`**: Modify rules for *when* a ping goes out.

## 7. Changing Section Picker UI or APIs
- **`backend/src/routes/query.routes.js`**: The `GET /queries/manifest-sections` endpoint extracts sections via helper utilities.
- **`frontend/src/Header/HeaderSection.jsx` & `SectionPicker.jsx`**: The component fetching the sections and mutating the `sectionInputRef` natively without standard React state bindings. CSS updates live in `SectionPicker.module.css`.

---

## 💱 Managing Currency & FX Operations

### Changing sale price support (Adding new currencies)
- **`backend/src/utils/currencyConfig.js`**: Add the ISO code to `SUPPORTED_SALE_CURRENCIES` and map its symbol in `CURRENCY_SYMBOLS`.
- **`frontend/src/Header/HeaderSection.jsx`**: Add the new currency to the `CURRENCY_OPTIONS` array.
- **`frontend/src/Main/QueryModal.jsx`**: Add the new currency to `CURRENCY_OPTIONS` array so users can select it when editing.

### Modifying the exchange-rate provider
- **`backend/src/services/fxService.js`**: Swap or abstract the `Frankfurter` API calls with a new provider. Adjust the 24-hour cache TTL logic as necessary.

### Changing profit/loss calculations or behavior
- **`backend/src/utils/enrichQueryResponse.js`**: Houses the FX calculation logic (`calculateProfitLoss`) used before passing DB results out of `query.routes.js`.
- **`backend/src/services/buildTelegramMessage.js`**: Performs its own async isolated FX conversion logic to determine notification contents.
- **`maxPrice` logic**: Modifying `maxPrice` evaluates natively and remains insulated from FX inside `backend/fetch-de.js`, `backend/fetch-es.js`, and `backend/src/services/runQuery.js`.

### Changing pricing display in cards and modals
- **`frontend/src/Main/Card.jsx`** / **`QueryModal.jsx`**: Both now natively consume backend-computed `profitLoss` arrays. Altering how strings display is purely presentational inside these React components using `formatPrice()`.

### Supporting varying found-ticket currencies across providers
- **`backend/src/utils/currencyConfig.js`**: Map the domain explicitly using `DOMAIN_CURRENCY['ES'] = 'EUR'`. 
- **`backend/fetch-*.js`**: Scrapers do not evaluate the currency itself but strictly align with the mapping set inside `currencyConfig.js`.
