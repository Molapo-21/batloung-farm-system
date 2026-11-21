# Batloung Farm Distribution Management System
**DIWA2110 Web Application Development - Take-Home Test**
Node.js + Express + MySQL REST API with an administrator-protected web interface styled after the supplied *International Year of Fruits and Vegetables* landing-page template (light-grey / black split layout, yellow page, Anton + Poppins fonts, olive sprout logo, mint-leaf artwork extracted from the template's PSD).

## 1. Run it locally
```bash
npm install
# edit .env  -> put your MySQL password in DB_PASSWORD and a long random JWT_SECRET
npm run db:setup     # runs database/schema.sql + database/seed.sql
npm run admin:create -- admin "ChangeMe123!" "Batloung Administrator"   # first administrator
npm start            # http://localhost:3000   (admin UI)   |   API under /api
npm run demo:rollback  # prints the COMMIT / ROLLBACK demonstration (great for the video)
```
Or in MySQL directly: `mysql -u root -p < database/schema.sql` then `mysql -u root -p < database/seed.sql`.

## 2. Project structure (Part B)
```
database/   schema.sql  seed.sql  reports.sql  admin.sql
src/
  config/db.js            MySQL pool (mysql2/promise), credentials from .env
  routes/                 supplier, fruit, stock, vendor, purchase, sales, report routes
  controllers/            validation + HTTP responses
  models/                 all SQL queries (incl. transactions)
  middleware/             auth (JWT), loginLimiter, asyncHandler, validateId, validateBody, requestLogger, errorHandler/notFound
  utils/                  AppError, validators, transaction helper (BEGIN / COMMIT / ROLLBACK)
  app.js  server.js
public/                   admin interface (index.html, login.html, css/, js/, img/)
scripts/                  setup-db.js, demo-transactions.js
```
* `.env` holds `DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, PORT` - nothing is hard-coded. `.env` is git-ignored; `.env.example` is committed.
* Every database call uses `async/await` with `try/catch` (via `asyncHandler` + central `errorHandler`).
* If MySQL is down the app does **not** crash: it starts anyway, logs a warning, and every API call answers `503` with a clear message; `/api/health` reports the DB state. `unhandledRejection`/`uncaughtException` are also caught.

## 2b. Administrator login
* Log in at `/login.html` (the admin interface redirects there when you are not logged in; **Log out** is in the top-right tab).
* `POST /api/auth/login` returns a JWT; send it as `Authorization: Bearer <token>`. All endpoints except `/api/health` and `/api/auth/login` require it. Also `GET /api/auth/me` and `POST /api/auth/change-password`.
* Passwords are bcrypt-hashed in the `admins` table (`database/admin.sql`); failed logins return one generic message and are rate-limited (429 after 8 tries / 15 min).
* `.env` needs `JWT_SECRET` (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). `ADMIN_USERNAME` / `ADMIN_PASSWORD` are only used by `npm run demo:rollback`.
* Behind a proxy on a live host, add `app.set('trust proxy', 1);` after `const app = express();` in `src/app.js`.

## 3. Database design (Part A)
8 required tables + 1 supporting table (`payments`, needed for Part D payment management).

| Table | Notes |
|---|---|
| suppliers | provinces as ENUM (the 8 listed + Northern Cape), UNIQUE business name & phone |
| fruits | status ACTIVE / INACTIVE, UNIQUE name |
| vendors | UNIQUE phone, registration_date |
| purchases / purchase_details | FK to supplier / fruit, CHECK quantity > 0, unit_cost >= 0 |
| sales / sales_details | payment_status ENUM(PAID, PARTIALLY_PAID, UNPAID), unit_price stored per line |
| **stock** | **one row per fruit + packaging size** (`UNIQUE(fruit_id, packaging_size)`), `CHECK (available_quantity >= 0)`, and `selling_price` so each size has its own price |
| payments | CASH / MOBILE_MONEY / CREDIT, instalments per sale |

Packaging sizes are `ENUM('SMALL','MEDIUM','LARGE')` everywhere. Seed data covers all tables (8 suppliers, 5 fruits, 8 vendors, 5 purchases, 6 sales, 15 stock rows) and stock is *derived* from purchases minus sales so it is always consistent.

## 4. API (Part C)  - base `/api`
| Area | Endpoints |
|---|---|
| Suppliers | `POST /suppliers`, `GET /suppliers`, `GET /suppliers/:id`, `PUT /suppliers/:id`, `DELETE /suppliers/:id` (409 if the supplier has purchases) |
| Fruits | `POST /fruits` (creates the 3 stock rows), `GET /fruits`, `GET /fruits/:id`, `PUT /fruits/:id`, `PUT /fruits/:id/prices`, `GET /fruits/:id/stock` |
| Stock | `GET /stock?fruit_id=&size=`, `GET /stock/low?threshold=10` |
| Vendors | `POST /vendors`, `GET /vendors`, `GET /vendors/search?q=name-or-phone`, `GET /vendors/:id`, `PUT /vendors/:id` (all include outstanding balance) |
| Purchases | `POST /purchases`, `GET /purchases`, `GET /purchases/:id` |
| Sales | `POST /sales`, `GET /sales?status=&vendor_id=`, `GET /sales/:id`, `POST /sales/:id/payments` |
| Reports | `GET /reports/top-fruits`, `/revenue?from=&to=`, `/top-vendor`, `/stock-levels`, `/outstanding-balances`, `/summary` |

Status codes: `200` ok, `201` created, `400` invalid input / insufficient stock, `404` not found, `409` duplicate or blocked delete, `503` database unavailable, `500` unexpected.

### Example - record a sale
```json
POST /api/sales
{ "vendor_id": 1,
  "items": [ {"fruit_id": 1, "packaging_size": "LARGE", "quantity": 4},
             {"fruit_id": 5, "packaging_size": "SMALL", "quantity": 3} ],
  "payment_method": "MOBILE_MONEY", "amount_paid": 500, "reference": "EC123" }
```
The administrator never enters a total or a price: the server takes the price from the per-size price list, calculates the total, reduces stock and records the first payment.

### Example - record a purchase
```json
POST /api/purchases
{ "supplier_id": 1, "purchase_date": "2026-11-15",
  "items": [ {"fruit_id": 1, "packaging_size": "LARGE", "quantity": 20, "unit_cost": 145.5},
             {"fruit_id": 3, "packaging_size": "SMALL", "quantity": 10, "unit_cost": 45} ] }
```

## 5. Business logic and transactions (Part D)
* **Sales total** = Σ (quantity × per-size selling price), calculated in whole cents (no floating point errors).
* **Stock**: purchases increase, sales decrease, per fruit **and** size. Negative stock is impossible: rows are locked with `SELECT … FOR UPDATE`, the decrement is `UPDATE … WHERE available_quantity >= ?`, and the table has a CHECK constraint.
* **Transactions** (`src/utils/transaction.js`): `BEGIN` → work → `COMMIT`; any error → `ROLLBACK`. The scenario from the paper (10 large apples requested, 6 available) returns `400`, lists every short item, creates no sale and leaves *all* stock unchanged - even other valid lines in the same request. Tested with 5 simultaneous requests for the same stock: exactly one succeeds.
* **Payments**: CASH, MOBILE_MONEY or CREDIT at sale time; later instalments via `POST /sales/:id/payments`. Status is recalculated as PAID / PARTIALLY_PAID / UNPAID; over-payment is rejected; the outstanding balance per sale and per vendor is shown in the API and UI.
* **SQL reports**: `database/reports.sql` (same queries the API runs): top 5 fruits, revenue in a date range, top vendor by boxes, stock by fruit & size (+ outstanding balances).

## 6. Admin interface
Dashboard (hero + low-stock card + top vendor + fruit carousel), Suppliers, Fruits & Stock (S/M/L quantities and prices, low stock in red), Vendors (live search, statement, balances), Purchases and Sales (multi-line forms with live totals and stock warnings, payment recording), Reports.

## 7. Submission checklist (from the test paper)
1. **GitHub repository link** - `git init && git add . && git commit -m "Batloung Farm" ` then push to a new GitHub repo (`.env` is ignored).
2. **Live link** - deploy the Node app and a hosted MySQL, set the same variables as in `.env.example` (e.g. Render / Railway + Railway MySQL or Aiven). Run `database/schema.sql` + `seed.sql` on the hosted database. Note: `schema.sql` creates a database called `batloung_farm`; if your host gives you a fixed database name, delete the first three lines (DROP/CREATE/USE) and set `DB_NAME` to it.
3. **Recorded video** - suggested order: show the folders and `.env` → tables in MySQL → UI tour → `npm run demo:rollback` (shows the rejected sale and unchanged stock) → reports page → stop MySQL to show the friendly 503 instead of a crash.

## 8. Customising the look
* Artwork lives in `public/img/` (`logo.png`, `leaf1-5.png` come from the template PSD). The hero photo `public/img/hero.jpg` was cropped from the template preview because the PSD only contains placeholder images - replace it with your own fruit photo (portrait, about 800x1000 px) under the same file name.
* Colours and fonts are CSS variables at the top of `public/css/style.css`.

## 9. Demo login box
`public/login.html` shows a demo username/password (`admin` / `ChangeMe123!`) with a "Fill in demo login" button, so markers can get in quickly. Create that account with `npm run admin:create -- admin "ChangeMe123!" "Batloung Administrator"`. Remove the `.demo` block from `login.html` before using the system with real data.
