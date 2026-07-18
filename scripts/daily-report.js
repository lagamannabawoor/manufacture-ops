#!/usr/bin/env node
/**
 * Urbanmud Daily Report
 * Reads today's data from Firestore and emails all admin users.
 * Run via GitHub Actions every day at 12:00 AM IST (18:30 UTC).
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const nodemailer               = require('nodemailer');

// ── Firebase init ─────────────────────────────────────────────────────────
const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT secret is missing');
const serviceAccount = JSON.parse(raw);
// Fix newlines in private key if they were escaped when pasted into GitHub Secrets
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Email transport ───────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// ── Date helpers ──────────────────────────────────────────────────────────
function todayIST() {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function cur(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// ── Load Firestore data ───────────────────────────────────────────────────
async function loadCollection(docId) {
  const snap = await db.collection('mfg_data').doc(docId).get();
  return snap.exists ? snap.data() : {};
}

async function main() {
  const today = todayIST();
  console.log('Generating report for:', today);

  const [master, production, materials, finance] = await Promise.all([
    loadCollection('master'),
    loadCollection('production'),
    loadCollection('materials'),
    loadCollection('finance'),
  ]);

  const users            = master.users            || [];
  const products         = master.products         || [];
  const factories        = master.factories        || [];
  const productionEntries = (production.productionEntries || []).filter(e => e.date === today);
  const materialPurchases = (materials.materialPurchases  || []).filter(e => e.date === today);
  const laborPayments     = (finance.laborPayments        || []).filter(e => e.date === today);
  const expenses          = (finance.expenses             || []).filter(e => e.date === today);
  const orders            = (finance.orders               || []).filter(e => e.date === today);

  const prodName  = id => products.find(p => p.id === id)?.name  || id;
  const factName  = id => factories.find(f => f.id === id)?.name || id;

  // ── Compute totals ───────────────────────────────────────────────────────
  const totalUnits   = productionEntries.reduce((s, e) => s + Number(e.quantity || 0), 0);
  const totalMaterial = materialPurchases.reduce((s, e) => s + Number(e.totalCost || 0), 0);
  const totalLabour  = laborPayments.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalOrders  = orders.reduce((s, e) => s + Number(e.totalAmount || 0), 0);
  const totalCost    = totalMaterial + totalLabour + totalExpense;

  // ── Build HTML report ────────────────────────────────────────────────────
  const section = (title, color, rows) => rows.length === 0 ? '' : `
    <h3 style="color:${color};margin:20px 0 8px">${title}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${rows.map(r => `<tr>${r.map(c => `<td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${c}</td>`).join('')}</tr>`).join('')}
    </table>`;

  const prodRows = productionEntries.map(e => [
    factName(e.factoryId), prodName(e.productId), `${e.quantity} units`, e.notes || '—'
  ]);
  const matRows = materialPurchases.map(e => [
    e.materialName || e.materialId, `${e.quantity} ${e.unit}`, cur(e.totalCost), e.supplier || '—'
  ]);
  const labRows = laborPayments.map(e => [
    e.groupName || e.groupId, e.description || '—', cur(e.amount)
  ]);
  const expRows = expenses.map(e => [
    e.categoryName || e.category, e.description || '—', cur(e.amount)
  ]);
  const ordRows = orders.map(e => [
    e.customerName, e.items || '—', cur(e.totalAmount), e.status || '—'
  ]);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:680px;margin:0 auto;color:#1a1a1a">

  <div style="background:linear-gradient(135deg,#92400e,#451a03);padding:28px 32px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;margin:0;font-size:22px">🏭 Urbanmud Daily Report</h1>
    <p style="color:#fcd34d;margin:6px 0 0;font-size:14px">${fmtDate(today + 'T00:00:00')}</p>
  </div>

  <div style="background:#fffbf0;padding:24px 32px;border:1px solid #f5e6c8;border-top:none;border-radius:0 0 12px 12px">

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      ${[
        ['🧱 Units Produced', totalUnits, '#92400e'],
        ['📦 Orders Value',   cur(totalOrders),  '#1e40af'],
        ['💰 Total Costs',    cur(totalCost),    '#dc2626'],
      ].map(([l, v, c]) => `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center">
          <p style="margin:0;font-size:12px;color:#6b7280">${l}</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:${c}">${v}</p>
        </div>`).join('')}
    </div>

    ${section('🏭 Production', '#92400e', prodRows)}
    ${section('📦 Materials Purchased', '#1d4ed8', matRows)}
    ${section('👷 Labour Payments', '#065f46', labRows)}
    ${section('💸 Expenses', '#7c3aed', expRows)}
    ${section('🛒 Orders', '#0369a1', ordRows)}

    ${productionEntries.length === 0 && materialPurchases.length === 0 && expenses.length === 0
      ? '<p style="color:#9ca3af;text-align:center;padding:20px">No activity recorded today.</p>' : ''}

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb">
      <p style="color:#6b7280;font-size:12px;margin:0">
        This report is auto-generated by Urbanmud at 12:00 AM IST.<br>
        Material: ${cur(totalMaterial)} &nbsp;|&nbsp; Labour: ${cur(totalLabour)} &nbsp;|&nbsp; Other Expenses: ${cur(totalExpense)}
      </p>
    </div>
  </div>

</body>
</html>`;

  // ── Send to all admin emails + hardcoded fallback ────────────────────────
  const firestoreEmails = users
    .filter(u => u.role === 'admin' && u.email)
    .map(u => u.email);

  // Always include REPORT_TO (env var) as guaranteed recipient
  const fallback = process.env.REPORT_TO || process.env.GMAIL_USER;
  const allEmails = [...new Set([fallback, ...firestoreEmails].filter(Boolean))];

  console.log('Sending to:', allEmails.join(', '));

  await transporter.sendMail({
    from: `"Urbanmud Reports" <${process.env.GMAIL_USER}>`,
    to: allEmails.join(', '),
    subject: `Urbanmud Daily Report — ${fmtDate(today + 'T00:00:00')}`,
    html,
  });

  console.log('✅ Report sent successfully!');
}

main().catch(err => { console.error(err); process.exit(1); });
