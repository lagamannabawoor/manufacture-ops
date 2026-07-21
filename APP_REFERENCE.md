# Urbanmud Manufacturing Ops — Complete App Reference

> **Company:** UrbanMud Bricks and Blocks  
> **Stack:** React + Vite · TailwindCSS · Firebase Firestore (sync) · Google Drive (backup) · Capacitor (Android APK)  
> **Live URL:** https://mfgops-lagamanna.netlify.app  
> **GitHub:** https://github.com/lagamannabawoor/manufacture-ops  

---

## 1. Architecture Overview

```
src/
├── App.jsx                  # Root shell, routing, UserBar, SyncBadge
├── context/AppContext.jsx   # Global state, Firebase sync, CRUD, ROLES
├── pages/
│   ├── Dashboard.jsx        # Home page
│   ├── Production.jsx       # Production records + stock
│   ├── Materials.jsx        # Raw material purchases + stock
│   ├── Finance.jsx          # Orders, payments, expenses, labour
│   ├── Sales.jsx            # Quotes, invoices, enquiries
│   ├── Reports.jsx          # P&L and production reports
│   ├── Settings.jsx         # Master data + Firebase + users + backup
│   ├── AuditLog.jsx         # Action audit trail
│   └── CAExport.jsx         # CA/audit ZIP export
├── components/
│   ├── BottomNav.jsx        # Mobile bottom navigation bar
│   ├── Header.jsx           # Page header with amber gradient
│   ├── Modal.jsx            # Reusable modal + Field + inputCls + selectCls + SaveBtn
│   └── UrbanmudLogo.jsx     # SVG logo
├── services/
│   ├── firestoreDb.js       # Firebase Firestore read/write/subscribe
│   └── googleDrive.js       # Google Drive OAuth + backup/restore
└── utils/
    └── date.js              # todayISO(), fmtDate(), monthRange()
```

---

## 2. Data Model (AppContext — `SEED` keys)

All data lives in `AppContext` (localStorage + Firestore sync). Every list item has an `id` field auto-generated via `uid()`.

| Key | Description |
|---|---|
| `users` | App user accounts with username/password/role |
| `factories` | Factory locations (Factory 1, Factory 2, …) |
| `productCategories` | Product category groups (Concrete Blocks, Paving Stones, etc.) |
| `products` | Individual products with `categoryId`, `unit`, `labourCostPerUnit`, BOM (`bom[]`) |
| `materialTypes` | Raw material definitions: `name`, `unit` (bags/trucks/liters), `weightKgPerUnit` |
| `laborGroups` | Labour contractor groups (Group A, B, C) |
| `bankAccounts` | Bank accounts and cash accounts used for payments |
| `expenseCategories` | Expense category labels (Electricity, Vehicle/Transport, etc.) |
| `productionEntries` | Production records (product, factory, qty, labour group, materials used, date) |
| `materialPurchases` | Raw material purchase records with bill photos / URD bills |
| `pendingProduction` | Labour-submitted production awaiting admin approval |
| `orders` | Customer orders (product, qty, rate, delivery date, customer details) |
| `orderPayments` | Payments against orders (received/paid direction) |
| `orderDispatches` | Dispatch records against orders (qty dispatched per dispatch event) |
| `expenses` | General operational expenses with category, bank account, receipt |
| `laborPayments` | Payments made to labour groups (regular/advance) |
| `quotes` | Sales quotations with line items, tax, discount |
| `invoices` | Sales invoices with line items, tax, discount, payment terms |
| `enquiries` | Customer enquiries / leads |
| `auditLog` | Auto-generated log of all create/update/delete actions with user + timestamp |
| `reportEmails` | List of email addresses for report sharing |
| `companyInfo` | Company name, tagline, address, phone, email, GSTIN, website |

### Product BOM (Bill of Materials)
Each product can have a `bom` array:
```js
bom: [{ materialTypeId, kgPerProductUnit, qtyPerProductUnit }]
```
When a production entry is saved, `materialsUsed` is auto-calculated:
```js
materialsUsed: [{ materialTypeId, kgUsed, qtyUsed }]
```

---

## 3. Roles & Permissions

| Role | Tabs Accessible | canWrite | canApprove | canSettings |
|---|---|---|---|---|
| `admin` | All (dashboard, production, materials, finance, sales, reports, settings) | ✅ | ✅ | ✅ |
| `accountant` | dashboard, production, materials, finance, sales, reports | ✅ | ✅ | ❌ |
| `labour` | production only | ❌ (submit only) | ❌ | ❌ |
| `guest` | dashboard, production, materials, finance, reports | ❌ | ❌ | ❌ |

**Labour role behaviour:** Labour users can submit production entries which go into `pendingProduction`. Admin/accountant must approve or reject them before they appear in `productionEntries`.

**Super Admin:** `username = 'lbawoor'` — has exclusive access to Firebase config, user management, audit log, report emails, company info, backup/restore, CA export.

---

## 4. Authentication

- **Login:** Username + password matched against `data.users[]`
- **Session:** Stored in `sessionStorage` as JSON (`mfg_session`)
- **Logout:** Clears session, triggers audit log entry
- **Default credentials:**
  - Super Admin: `lbawoor` / `@urbanmud#RK`
  - Admin: `admin` / `admin123`
  - Accountant: `accountant` / `accountant123`
  - Labour: `labour` / `labour123`
  - Guest: `guest` / `guest123`

---

## 5. Data Sync & Storage

### localStorage
- All data saved to `mfg_ops_data` on every state change
- Fallback when Firebase is not configured

### Firebase Firestore
- Configured in Settings → Firebase Configuration (Super Admin only)
- Config stored in `localStorage` as `mfg_firebase_config`
- On connect: loads remote data, then subscribes to real-time changes
- On any data mutation: debounced 1500ms save to Firestore (only dirty collections)
- Sync status shown in `SyncBadge` (Connecting… / Sync error / not shown when ready)
- Firestore document map: data split across multiple Firestore docs for size efficiency

### Google Drive (Backup Only)
- OAuth sign-in using `VITE_GOOGLE_CLIENT_ID`
- Creates daily JSON backup to Google Drive
- Manual backup/restore available in Settings → Backup & Restore

---

## 6. Bottom Navigation

Tabs shown depend on role. Order: **Home · Production · Materials · Finance · Sales · Reports · Settings**

---

## 7. Home / Dashboard Page

Single-scroll page (no tabs). Sections in order:

### Header
- Amber gradient, company logo, date (short format)
- Red alert badge showing count of pending items
- **3 hero stats:** Units Today · Today's Income · Total Receivables (all time)

### Alerts Panel *(only shown when there are items)*
Tappable rows navigating to the relevant page:
- Pending production entries awaiting approval → Production
- Orders past delivery date (overdue) → Finance
- Raw materials with < 20% stock remaining → Materials
- Labour balance amount due → Finance

### Quick Actions (8 icons in 4-col grid)
Add Production · Add Material · Record Payment · Add Expense · New Quote · New Invoice · Add Enquiry · New Order

### This Month KPIs (2×2 grid)
Revenue Received · Total Cost Out · Gross Margin % · Receivables

### Today's Net P&L *(only shown if any financial activity today)*
Net amount (Profit/Loss label), broken down: Income / Labour / Materials

### Active Orders Pipeline
List of open/unfulfilled orders sorted by delivery date, each showing:
- Customer name · Product · Quantity
- Dispatch progress bar (X/Y dispatched)
- Outstanding balance due
- OVERDUE badge if past delivery date

### Today's Production (by product type)
Per-product breakdown with category chip + quantity. No consolidated total.

### Finished Goods Stock (by product type)
Per product: in-stock count, pending order quantity, colour-coded:
- Green = stock > pending
- Amber = stock ≤ pending
- Red = zero stock

### 7-Day Production Trend
Bar chart, last 7 days. Today's bar highlighted in darker amber.

### Recent Receipts
Last 4 payment receipts received, customer name + date + amount.

---

## 8. Production Page

**Tabs:** Stock (default) · Records

### Stock Tab
2-column grid of finished goods per product:
- Product name · Category chip
- In-stock qty (large, colour-coded)
- Produced / Dispatched / Pending Orders (3-col stat row)
- Progress bar showing stock fill
- Stock = Total Produced − Total Dispatched (via `orderDispatches`)
- Pending = sum of remaining qty across open orders

### Records Tab
Filter bar: date range · category · factory  
Each production entry card (compact, 3-row):
- Row 1: Category chip · Factory chip · Date
- Row 2: Product name · Qty (bold)
- Row 3: Labour group · Labour charge · Materials used (inline chips)

**Approval workflow (Labour role):**
- Labour submits → goes to `pendingProduction`
- Admin sees pending badge → can Approve or Reject
- Approved entries move to `productionEntries`

**Add Production modal fields:**
Date · Product · Factory · Quantity · Labour Group · Notes  
Materials used auto-calculated from product BOM × quantity  
Labour amount owed auto-calculated from `labourCostPerUnit × qty`

---

## 9. Materials Page

**Tabs:** Stock Levels (default) · Purchase History

### Stock Levels Tab
2-column compact grid per material type:
- Material name
- Available stock (unit-aware display):
  - **Bags** → `X bags` (purchased bags − consumed qty from production)
  - **Trucks** → `X.XX T` (converted to metric tons using `weightKgPerUnit`, defaults to 30T/truck if not set)
  - **Liters** → `X L`
- "available" label beneath stock value
- Thin progress bar (% remaining)
- **Tapping any tile opens Add Purchase modal with that material pre-selected**

### Purchase History Tab
- Filter: date range + material type
- **Period Summary tile** (shown when results exist):
  - Total spend for the period
  - Per-material breakdown: qty purchased + spend amount
- Individual purchase cards showing:
  - Material name · Date · Supplier · Bill # · Bank account
  - Quantity + unit + rate + total amount
  - Bill status badge: ✅ Bill / URD / ⚠ No Bill
  - View bill photo button (if uploaded)
  - Share/download URD PDF button
  - Delete button (admin only)

### Add Purchase Modal fields:
Date · Material Type · Quantity · Rate per unit · Total amount (auto-calc) · Weight per unit (kg) · Supplier · Payment account · Bill number (auto-generated `URD-YYYYMMDD-NNNNN`) · Notes  
**Bill options:**
- Upload photo (camera or file) — compressed to JPEG base64
- "No Bill (URD)" — generates a Self Invoice PDF under Reverse Charge Mechanism (Section 9(4) CGST)

### URD PDF
Auto-generated self-invoice PDF with:
- Company header + supplier details
- Material, quantity, rate, total
- GST/RCM declaration text
- Bill number + date

---

## 10. Finance Page

**Tabs:** Orders · Expenses · Labour

### Orders Tab

**Order list** filtered by: date range · product · status  
Each order card shows:
- Order # · Customer name · Product · Quantity
- Total amount · Amount received · Balance due
- Delivery date · Status badge
- Dispatch progress bar

**Order statuses:** pending · in_progress · completed (auto-derived from dispatch + payment)

**Add Order modal fields:**
Customer name · Customer phone · Product · Quantity · Rate per unit · Total amount · Advance amount · Delivery date · Notes

**Order actions:**
- **Add Payment** — record amount received, payment type, bank account, date, notes. Generates payment receipt PDF.
- **Add Dispatch** — record quantity dispatched, date, vehicle number, driver name, notes. Generates dispatch note PDF.
- **View receipts** — view/share/download existing payment receipts as PDF
- **Delete order** (admin only)

**Payment receipt PDF:** Company header, customer details, order info, amount, payment method, bank.

**Dispatch note PDF:** Company header, customer details, product, quantity dispatched, vehicle info.

### Expenses Tab
Filter: date range · category  
**Summary bar:** Total expenses for period  
Each expense card: Date · Category · Description · Amount · Bank account · Receipt photo (if any)  
**Add Expense modal fields:** Date · Category · Description · Amount · Bank account · Notes · Receipt photo (optional)

### Labour Tab
**Group balance cards** per labour group:
- Amount Owed (from production entries `labourAmountOwed`)
- Amount Paid (from `laborPayments`)
- Advance paid separately
- Balance = Owed − Paid (colour-coded: pending/settled/overpaid)

**Payment history** filtered by: date range · group · payment type  
**Add Payment modal fields:** Date · Labour group · Payment type (regular/advance) · Amount · Bank account · Notes  
Generates payment voucher PDF (shareable).

---

## 11. Sales Page

**Three sections** via tabs/buttons: Quotes · Invoices · Enquiries

### Quotes
- List filtered by date range + search (customer/quote#)
- Status: draft · sent · accepted · rejected · expired
- Each quote: Quote# · Date · Customer · Total · Status badge
- **Create/Edit Quote modal:**
  - Customer name, address, GSTIN, phone
  - Line items: description, qty, unit, unit price (add/remove rows)
  - Tax type: None / CGST+SGST / IGST
  - Tax rate %
  - Discount (amount or %)
  - Valid until date, payment terms, notes
  - Auto-calculates: subtotal, discount, taxable, CGST/SGST/IGST, total
- **Convert Quote → Invoice** (one-click)
- **PDF generation:** Professional quote PDF with company header, line items table, tax breakdown, amount in words
- **Share/Download PDF**

### Invoices
- List filtered by date range + search
- Status: draft · sent · paid · partially_paid · overdue
- Each invoice: Invoice# · Date · Due date · Customer · Total · Payment status
- **Create/Edit Invoice modal:** Same fields as quote + due date + payment terms
- **Mark as Paid / Partially Paid**
- **PDF generation:** Tax invoice PDF with full GST breakdown, company GSTIN, amount in words, bank details for payment
- **Share/Download PDF**

### Enquiries
- List of customer leads/enquiries
- Fields: customer name, phone, product interest, quantity, message, status, follow-up date
- Status: new · contacted · quoted · won · lost
- **Add/Edit Enquiry modal**
- Convert enquiry → Quote

---

## 12. Reports Page

**Date range presets:** Today · This Week · Last Week · Pick Week · This Month · Pick Month · This Quarter · Pick Quarter · This FY · Pick FY · Custom

### Production Report
- Total units produced in period (per product type — no consolidation)
- Per-product breakdown: product name, category, units produced
- By factory breakdown
- Day-wise production list

### Financial Report (P&L)
- Revenue received in period
- Cost breakdown:
  - Raw material purchases
  - Labour payments
  - General expenses
- Gross profit / loss
- Margin %
- Receivables outstanding

### Material Consumption Report
- Per material: qty purchased, qty consumed (via BOM from production), remaining stock

**Email report:** Send PDF report to configured email recipients (Super Admin sets emails in Settings)

**Super Admin extra:** Access to full financial data export

---

## 13. Settings Page

### Master Data Sections (all roles with `canSettings`)
Each section: list view + add/edit/delete modals

1. **Factories** — name
2. **Product Categories** — name
3. **Products** — name, category, unit, labour cost per unit, BOM (materials + kg/qty per product unit)
4. **Material Types** — name, unit (bags/trucks/liters/kg), `weightKgPerUnit` (for ton conversion)
5. **Labor Groups** — name
6. **Bank Accounts** — name, bank name, account type (current/savings/cash)
7. **Expense Categories** — name

### Super Admin Only Sections

**Firebase Configuration**
- Paste full Firebase project config JSON
- Connects app to Firestore for real-time multi-device sync
- Status indicator: Connecting / Ready / Error

**User Management**
- Add/edit/delete users
- Fields: name, username, password, role, email
- Roles: admin, accountant, labour, guest

**Audit Log**
- Full chronological list of all actions
- Filters: date range, user, category
- Each entry: timestamp, user name, role, category, description

**Report Email Recipients**
- Add/remove email addresses that receive report emails

**Company Info & Address**
- Name, tagline, address, phone, email, GSTIN, website
- Used in all PDF headers (invoices, quotes, receipts, URD bills)

**Backup & Restore**
- **Export:** Downloads full JSON backup of all app data
- **Import/Restore:** Upload a JSON backup file to restore all data (writes to Firestore + local)

**CA / Audit Export**
- Generates a ZIP file containing:
  - P&L PDF report
  - CSV exports of: production, materials, orders, payments, expenses, labour
  - All bill photos (base64 → JPEG files)
- For CA/accountant audit submissions

**Google Drive Backup**
- Sign in with Google OAuth
- Creates automatic daily JSON backup to Google Drive
- Manual backup trigger available

---

## 14. Audit Log

Every `addItem`, `updateItem`, `deleteItem`, `login`, `logout`, `submitPendingProduction`, `approvePendingProduction`, `rejectPendingProduction` call generates an entry in `auditLog`:
```js
{ id, timestamp, userId, userName, role, category, description }
```
Stored in Firestore, capped at 5000 entries. Viewable by Super Admin in Settings.

---

## 15. PDF Generation

All PDFs use `jsPDF` + `jspdf-autotable`. PDFs can be:
- **Downloaded** directly in browser
- **Shared** via native share sheet on Android (via `@capacitor/share` + `@capacitor/filesystem`)

| Document | Trigger |
|---|---|
| Tax Invoice | Sales → Invoices → View/Share |
| Quotation | Sales → Quotes → View/Share |
| Payment Receipt | Finance → Orders → Add/View Payment |
| Dispatch Note | Finance → Orders → Add Dispatch |
| Labour Payment Voucher | Finance → Labour → Add Payment |
| Material URD Bill | Materials → Purchase → No Bill (URD) |
| P&L Report | Reports → Email/Share |
| CA Export ZIP | Settings → CA/Audit Export |

---

## 16. Key Calculations

### Stock — Finished Goods
```
inStock = sum(productionEntries.quantity WHERE productId) 
        − sum(orderDispatches.quantity WHERE order.productId)
```

### Stock — Raw Materials
```
# For bags:
available = purchased_qty − consumedQty (from materialsUsed.qtyUsed)

# For trucks (in tons):
purchasedT = purchased_qty × (weightKgPerUnit OR 30000) / 1000
consumedT  = sum(materialsUsed.kgUsed) / 1000
availableT = purchasedT − consumedT

# For liters:
available = purchased_qty − consumedQty
```

### Labour Balance
```
balance = sum(productionEntries.labourAmountOwed WHERE laborGroupId)
        − sum(laborPayments.amount WHERE laborGroupId)
```

### Labour Amount Owed (auto on production save)
```
labourAmountOwed = product.labourCostPerUnit × quantity
```

### Materials Used (auto on production save from BOM)
```
kgUsed  = bom.kgPerProductUnit  × quantity
qtyUsed = bom.qtyPerProductUnit × quantity
```

### Order Outstanding Balance
```
balance = order.totalAmount − sum(orderPayments.amount WHERE orderId AND direction='received')
```

### Gross Margin
```
margin% = ((revenue − totalCost) / revenue) × 100
totalCost = materialPurchases + laborPayments + expenses
```

---

## 17. Mobile (Android APK)

- Built with Capacitor 6 targeting Android
- APK built via: `npx cap sync android` → `./gradlew assembleDebug`
- Camera integration for bill photo capture (`@capacitor/camera`)
- File sharing for PDFs (`@capacitor/share` + `@capacitor/filesystem`)
- Responsive mobile-first UI (TailwindCSS, touch-friendly)

---

## 18. Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID for Drive backup |

Firebase config is stored in `localStorage` (not env vars) — entered via Settings UI.

---

## 19. Important Implementation Notes

- **Date format:** All dates stored as ISO strings `YYYY-MM-DD`. Utility: `todayISO()`, `fmtDate()`, `monthRange()`
- **IDs:** Auto-generated `uid()` = `Date.now().toString(36) + random`. Firestore uses string doc IDs (not numeric timestamps).
- **Bill IDs:** `URD-YYYYMMDD-NNNNN` format (e.g. `URD-20260721-54321`)
- **Image compression:** All bill/receipt photos compressed to max 1200px JPEG at 65% quality before storing as base64
- **Debounced Firestore save:** 1500ms after last data change, only dirty collections written
- **Real-time sync:** Firestore `onSnapshot` listener keeps all devices in sync automatically
- **Pending production approval:** `pendingProduction[]` array; approved entries move to `productionEntries[]`, rejected are deleted
- **Product tracking:** Stocks, production, sales all tracked per individual product — no cross-product consolidation
- **Truck→Ton conversion default:** 30 metric tons per truck when `weightKgPerUnit` not configured in Settings

---

## 20. Navigation Flow (navigate function)

```js
navigate(page, action?)
```
- `navigate('production')` → open Production page
- `navigate('finance')` → open Finance page  
- `navigate('sales', 'new_quote')` → open Sales + trigger new quote modal
- `navigate('sales', 'new_invoice')` → open Sales + trigger new invoice modal
- `navigate('sales', 'new_enquiry')` → open Sales + trigger new enquiry modal
- Only navigates to tabs the current role has access to

---

*Last updated: July 2026. Generated from codebase at `/Users/lbawoor/CascadeProjects/manufacturing-daily-ops`*
