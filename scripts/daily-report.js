#!/usr/bin/env node
/**
 * Urbanmud Daily Report
 * Reads today's data from Firestore, sends HTML email + Excel attachment.
 * Run via GitHub Actions every day at 12:00 AM IST (18:30 UTC).
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const nodemailer               = require('nodemailer');
const XLSX                     = require('xlsx');

// ── Firebase init ─────────────────────────────────────────────────────────
const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT secret is missing');
const serviceAccount = JSON.parse(raw);
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Email transport ───────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

// ── Helpers ───────────────────────────────────────────────────────────────
function todayIST() {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}
function fmtDate(d) {
  const [y, m, day] = String(d).slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}
function cur(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function num(n) { return Number(n || 0); }

// ── Load Firestore ────────────────────────────────────────────────────────
async function loadDoc(docId) {
  const snap = await db.collection('mfg_data').doc(docId).get();
  return snap.exists ? snap.data() : {};
}

// ── HTML helpers ──────────────────────────────────────────────────────────
const TH = c => `<th style="padding:8px 10px;background:#f3f4f6;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb">${c}</th>`;
const TD = (c, bold) => `<td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:13px${bold?';font-weight:700':''};">${c}</td>`;

function htmlTable(headers, rows, emptyMsg) {
  if (!rows.length) return `<p style="color:#9ca3af;font-size:13px;padding:8px 0">${emptyMsg || 'No data'}</p>`;
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:4px">
    <thead><tr>${headers.map(TH).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((c,i) => TD(c, i === r.length-1 && String(c).startsWith('₹'))).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function sectionBlock(title, color, icon, content) {
  return `
  <div style="margin-top:24px">
    <h3 style="color:${color};margin:0 0 12px;font-size:15px;display:flex;align-items:center;gap:6px">
      ${icon} ${title}
    </h3>
    ${content}
  </div>`;
}

// ── Excel builder ─────────────────────────────────────────────────────────
function buildExcel(today, { productionEntries, allMatPurchases, allOrderPayments,
    laborPayments, expenses, orders, products, factories, materialTypes,
    laborGroups, bankAccounts, expenseCategories }) {

  const wb = XLSX.utils.book_new();
  const dateStr = fmtDate(today);

  // Sheet 1: Production
  const prodSheet = [
    ['Date', 'Factory', 'Product', 'Quantity', 'Cement Bags', 'Notes'],
    ...productionEntries.map(e => [
      dateStr,
      factories.find(f => f.id === e.factoryId)?.name || '',
      products.find(p => p.id === e.productId)?.name || '',
      num(e.quantity),
      num(e.cementBags),
      e.notes || '',
    ])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prodSheet), 'Production');

  // Sheet 2: Incoming (order payments received)
  const incomingSheet = [
    ['Date', 'Customer', 'Product', 'Order Total', 'Payment Received', 'Bank Account', 'Notes'],
    ...allOrderPayments
      .filter(p => (p.date || '').slice(0, 10) === today && p.direction === 'received')
      .map(p => {
        const order = orders.find(o => o.id === p.orderId) || {};
        const product = products.find(pr => pr.id === order.productId);
        const account = bankAccounts.find(b => b.id === p.bankAccountId);
        return [
          fmtDate(p.date),
          order.customerName || '',
          product?.name || '',
          num(order.totalAmount),
          num(p.amount),
          account?.name || '',
          p.notes || '',
        ];
      })
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incomingSheet), 'Incoming');

  // Sheet 3: Outgoing (materials + labor + expenses)
  const outgoingRows = [
    ['Date', 'Category', 'Description', 'Quantity', 'Unit', 'Rate per Unit', 'Amount', 'Supplier/Group', 'Bank Account', 'Bill No', 'Notes'],
  ];
  allMatPurchases
    .filter(p => (p.date || '').slice(0, 10) === today)
    .forEach(p => {
      const mat = materialTypes.find(m => m.id === p.materialTypeId);
      const account = bankAccounts.find(b => b.id === p.bankAccountId);
      outgoingRows.push([
        fmtDate(p.date), 'Material Purchase', mat?.name || '',
        num(p.quantity), mat?.unit || '', num(p.ratePerUnit),
        num(p.totalAmount), p.supplier || '', account?.name || '',
        p.billNumber || '', p.notes || '',
      ]);
    });
  laborPayments.forEach(p => {
    const group = laborGroups.find(g => g.id === p.laborGroupId);
    const account = bankAccounts.find(b => b.id === p.bankAccountId);
    outgoingRows.push([
      fmtDate(p.date), `Labor (${p.paymentType || 'regular'})`, group?.name || '',
      '', '', '', num(p.amount), group?.name || '', account?.name || '', '', p.notes || '',
    ]);
  });
  expenses.forEach(e => {
    const cat = expenseCategories.find(c => c.id === e.categoryId);
    const account = bankAccounts.find(b => b.id === e.bankAccountId);
    outgoingRows.push([
      fmtDate(e.date), 'Expense', cat?.name || e.description || '',
      '', '', '', num(e.amount), '', account?.name || '', '', e.notes || '',
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(outgoingRows), 'Outgoing');

  // Sheet 4: Stock
  const stockSheet = [
    ['Material', 'Unit', 'Total Purchased (All Time)', 'Total Used', 'Current Stock'],
    ...materialTypes.map(mat => {
      const purchased = allMatPurchases
        .filter(p => p.materialTypeId === mat.id)
        .reduce((s, p) => s + num(p.quantity), 0);
      const used = mat.id === 'm1'
        ? productionEntries.reduce((s, e) => s + num(e.cementBags), 0)
        : 0;
      return [mat.name, mat.unit, purchased, used, purchased - used];
    })
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stockSheet), 'Stock');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const today    = todayIST();
  const fromDate = (process.env.REPORT_FROM_DATE || '').trim() || today;
  const toDate   = (process.env.REPORT_TO_DATE   || '').trim() || today;
  const isRange  = fromDate !== toDate;
  const rangeLabel = isRange ? `${fmtDate(fromDate)} to ${fmtDate(toDate)}` : fmtDate(today);
  console.log('Generating report for:', fromDate, '->', toDate);

  const inRange = d => { const s = (d||'').slice(0,10); return s >= fromDate && s <= toDate; };

  const [master, production, materials, finance] = await Promise.all([
    loadDoc('master'), loadDoc('production'), loadDoc('materials'), loadDoc('finance'),
  ]);

  const users             = master.users             || [];
  const products          = master.products          || [];
  const factories         = master.factories         || [];
  const materialTypes     = master.materialTypes     || [];
  const laborGroups       = master.laborGroups       || [];
  const bankAccounts      = master.bankAccounts      || [];
  const expenseCategories = master.expenseCategories || [];

  const allProdEntries    = production.productionEntries || [];
  const allMatPurchases   = materials.materialPurchases  || [];
  const allOrderPayments  = finance.orderPayments        || [];
  const allOrders         = finance.orders               || [];
  const allLaborPayments  = finance.laborPayments        || [];
  const allExpenses       = finance.expenses             || [];

  // Filter to date range
  const todayProd   = allProdEntries .filter(e => inRange(e.date));
  const todayMat    = allMatPurchases.filter(p => inRange(p.date));
  const todayPays   = allOrderPayments.filter(p => inRange(p.date));
  const todayLabor  = allLaborPayments.filter(p => inRange(p.date));
  const todayExp    = allExpenses.filter(e => inRange(e.date));

  const todayIncoming = todayPays.filter(p => p.direction === 'received');

  const pName = id => products.find(p => p.id === id)?.name  || '—';
  const fName = id => factories.find(f => f.id === id)?.name || '—';
  const mName = id => materialTypes.find(m => m.id === id)?.name || '—';
  const mUnit = id => materialTypes.find(m => m.id === id)?.unit || '';
  const gName = id => laborGroups.find(g => g.id === id)?.name  || '—';
  const aName = id => bankAccounts.find(b => b.id === id)?.name || '—';
  const cName = id => expenseCategories.find(c => c.id === id)?.name || '—';

  // ── Totals ────────────────────────────────────────────────────────────
  const totalUnits    = todayProd.reduce((s,e) => s + num(e.quantity), 0);
  const totalCement   = todayProd.reduce((s,e) => s + num(e.cementBags), 0);
  const totalIncome   = todayIncoming.reduce((s,p) => s + num(p.amount), 0);
  const totalMatCost  = todayMat.reduce((s,p) => s + num(p.totalAmount), 0);
  const totalLabor    = todayLabor.reduce((s,p) => s + num(p.amount), 0);
  const totalExpense  = todayExp.reduce((s,e) => s + num(e.amount), 0);
  const totalOut      = totalMatCost + totalLabor + totalExpense;
  const netPL         = totalIncome - totalOut;

  // ── Stock (all-time) ──────────────────────────────────────────────────
  const stockData = materialTypes.map(mat => {
    const purchased = allMatPurchases
      .filter(p => p.materialTypeId === mat.id)
      .reduce((s,p) => s + num(p.quantity), 0);
    const used = mat.id === 'm1'
      ? allProdEntries.reduce((s,e) => s + num(e.cementBags), 0)
      : 0;
    return { name: mat.name, unit: mat.unit, purchased, used, stock: purchased - used };
  });

  // ── Production by product ─────────────────────────────────────────────
  const byProduct = {};
  todayProd.forEach(e => {
    const key = e.productId;
    if (!byProduct[key]) byProduct[key] = { name: pName(key), qty: 0, cement: 0, factories: [] };
    byProduct[key].qty    += num(e.quantity);
    byProduct[key].cement += num(e.cementBags);
    const fn = fName(e.factoryId);
    if (!byProduct[key].factories.includes(fn)) byProduct[key].factories.push(fn);
  });

  // ── HTML ──────────────────────────────────────────────────────────────
  const summaryCards = [
    ['🧱 Units Produced', totalUnits, '#92400e'],
    ['🏭 Cement Used',    `${totalCement} bags`, '#b45309'],
    ['💰 Income',         cur(totalIncome), '#15803d'],
    ['📤 Total Outflow',  cur(totalOut),    '#dc2626'],
    ['📊 Net P&L',        `${netPL>=0?'+':''}${cur(netPL)}`, netPL>=0?'#15803d':'#dc2626'],
    ['📦 Mat. Cost',      cur(totalMatCost), '#1d4ed8'],
  ].map(([l,v,c]) => `
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center">
      <p style="margin:0;font-size:11px;color:#6b7280">${l}</p>
      <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${c}">${v}</p>
    </div>`).join('');

  // Section 1: Production detail
  const prodDetailRows = todayProd.map(e => [
    fName(e.factoryId), pName(e.productId),
    `${num(e.quantity)} units`, `${num(e.cementBags)} bags`, e.notes || '—'
  ]);
  const prodSummaryRows = Object.values(byProduct).map(p => [
    p.name, `${p.qty} units`, `${p.cement} bags`, p.factories.join(', ')
  ]);

  // Section 2: Sales
  const salesRows = todayIncoming.map(p => {
    const order = allOrders.find(o => o.id === p.orderId) || {};
    return [order.customerName||'—', pName(order.productId),
            `${num(order.quantity)} units`, cur(p.amount), aName(p.bankAccountId)];
  });

  // Section 3: Purchases
  const purchaseRows = todayMat.map(p => [
    mName(p.materialTypeId), `${num(p.quantity)} ${mUnit(p.materialTypeId)}`,
    p.ratePerUnit ? cur(p.ratePerUnit)+'/'+mUnit(p.materialTypeId) : '—',
    cur(p.totalAmount), p.supplier||'—', p.billNumber||'—'
  ]);

  // Section 4: Stock
  const stockRows = stockData.map(s => [
    s.name, `${s.purchased} ${s.unit}`,
    s.used > 0 ? `${s.used} ${s.unit}` : '—',
    `${s.stock} ${s.unit}`,
  ]);

  // Section 5: Labor
  const laborRows = todayLabor.map(p => [
    gName(p.laborGroupId), p.paymentType||'regular', aName(p.bankAccountId), cur(p.amount)
  ]);

  // Section 6: Expenses
  const expenseRows = todayExp.map(e => [
    cName(e.categoryId), e.description||'—', aName(e.bankAccountId), cur(e.amount)
  ]);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:0 auto;color:#1a1a1a;background:#f9fafb;padding:16px">

<div style="background:linear-gradient(135deg,#92400e,#451a03);padding:28px 32px;border-radius:12px 12px 0 0">
  <h1 style="color:#fff;margin:0;font-size:22px">🏭 Urbanmud Daily Report</h1>
  <p style="color:#fcd34d;margin:6px 0 0;font-size:14px">${fmtDate(today)} &nbsp;|&nbsp; Generated at 12:00 AM IST</p>
</div>

<div style="background:#fff;padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px">
    ${summaryCards}
  </div>

  ${sectionBlock('1. Production Details', '#92400e', '🏭',
    `${htmlTable(['Factory','Product','Quantity','Cement','Notes'], prodDetailRows, 'No production today')}
     ${prodSummaryRows.length > 1 ? `<div style="margin-top:12px"><p style="font-size:12px;color:#6b7280;margin:0 0 6px">Summary by Product</p>
     ${htmlTable(['Product','Total Units','Cement Used','Factories'], prodSummaryRows)}</div>` : ''}`
  )}

  ${sectionBlock('2a. Sales — Incoming Payments', '#15803d', '💰',
    htmlTable(['Customer','Product','Quantity','Amount Received','Bank Account'], salesRows, 'No payments received today')
  )}

  ${sectionBlock('2b. Material Purchases', '#1d4ed8', '📦',
    htmlTable(['Material','Quantity','Rate','Total Amount','Supplier','Bill No'], purchaseRows, 'No material purchases today')
  )}

  ${sectionBlock('3. Material Stock (as of today)', '#b45309', '�',
    htmlTable(['Material','Total Purchased','Total Used','Current Stock'], stockRows, 'No materials configured')
  )}

  ${sectionBlock('4. Labor Payments', '#065f46', '👷',
    htmlTable(['Group','Type','Bank Account','Amount'], laborRows, 'No labor payments today')
  )}

  ${sectionBlock('5. Other Expenses', '#7c3aed', '💸',
    htmlTable(['Category','Description','Bank Account','Amount'], expenseRows, 'No expenses today')
  )}

  <div style="margin-top:28px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
    <p style="font-weight:700;font-size:14px;margin:0 0 10px;color:#374151">📋 Daily Summary</p>
    <table style="width:100%;font-size:13px">
      <tr><td style="padding:4px 0;color:#6b7280">Total Income</td><td style="text-align:right;font-weight:600;color:#15803d">${cur(totalIncome)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Material Cost</td><td style="text-align:right;font-weight:600;color:#dc2626">${cur(totalMatCost)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Labor Cost</td><td style="text-align:right;font-weight:600;color:#dc2626">${cur(totalLabor)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Other Expenses</td><td style="text-align:right;font-weight:600;color:#dc2626">${cur(totalExpense)}</td></tr>
      <tr style="border-top:2px solid #e5e7eb"><td style="padding:8px 0 4px;font-weight:700;color:#374151">Net P&L</td>
        <td style="text-align:right;font-weight:800;font-size:16px;color:${netPL>=0?'#15803d':'#dc2626'}">${netPL>=0?'+':''}${cur(netPL)}</td></tr>
    </table>
  </div>

  <p style="color:#9ca3af;font-size:11px;margin-top:20px;text-align:center">
    Excel attachment contains full transaction details for Incoming, Outgoing &amp; Stock.<br>
    Auto-generated by Urbanmud · ${rangeLabel}
  </p>
</div>
</body></html>`;

  // ── Build Excel ───────────────────────────────────────────────────────
  const excelBuffer = buildExcel(today, {
    productionEntries: todayProd,
    allMatPurchases, allOrderPayments, laborPayments: todayLabor,
    expenses: todayExp, orders: allOrders, products, factories,
    materialTypes, laborGroups, bankAccounts, expenseCategories,
  });

  // ── Send email ────────────────────────────────────────────────────────
  // Primary: reportEmails list managed from app Settings
  const configuredEmails = (master.reportEmails || []).filter(Boolean);
  // Fallback: admin users with email + REPORT_TO env var
  const adminEmails = users.filter(u => u.role === 'admin' && u.email).map(u => u.email);
  const fallback = process.env.REPORT_TO || process.env.GMAIL_USER;
  const allEmails = [...new Set([...configuredEmails, ...adminEmails, fallback].filter(Boolean))];
  console.log('Sending to:', allEmails.join(', '));

  await transporter.sendMail({
    from: `"Urbanmud Reports" <${process.env.GMAIL_USER}>`,
    to: allEmails.join(', '),
    subject: `Urbanmud Report — ${rangeLabel}`,
    // date-range subject uses rangeLabel (single day or period)
    html,
    attachments: [{
      filename: `Urbanmud_Transactions_${fromDate}${isRange?'_to_'+toDate:''}.xlsx`,
      content: excelBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }],
  });

  console.log('✅ Report sent with Excel attachment!');
}

main().catch(err => { console.error(err); process.exit(1); });
