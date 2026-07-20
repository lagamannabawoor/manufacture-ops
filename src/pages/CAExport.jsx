import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Download, Share2, Archive } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { fmtDate } from '../utils/date';

function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }
function rp(n)  { return 'Rs.' + fmt(n); }
function num(n) { return Number(n || 0); }

function toCSV(headers, rows) {
  const esc = v => {
    const s = String(v == null ? '' : v);
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map(r => r.map(esc).join(',')).join('\n');
}

function getRange(period, customFrom, customTo) {
  const now  = new Date();
  const today = now.toISOString().slice(0, 10);
  const yr   = now.getFullYear();
  const mo   = now.getMonth();

  if (period === 'thisMonth') {
    return { from: `${today.slice(0, 7)}-01`, to: today,
      label: now.toLocaleString('en-IN', { month: 'long', year: 'numeric' }) };
  }
  if (period === 'lastMonth') {
    const d    = new Date(yr, mo - 1, 1);
    const last = new Date(yr, mo, 0).toISOString().slice(0, 10);
    return { from: d.toISOString().slice(0, 10), to: last,
      label: d.toLocaleString('en-IN', { month: 'long', year: 'numeric' }) };
  }
  if (period === 'thisQuarter') {
    const q = Math.floor(mo / 3);
    return { from: new Date(yr, q * 3, 1).toISOString().slice(0, 10), to: today,
      label: `Q${q + 1} FY${yr}-${String(yr + 1).slice(2)}` };
  }
  if (period === 'lastQuarter') {
    const q  = Math.floor(mo / 3) - 1;
    const fy = q < 0 ? yr - 1 : yr;
    const qq = ((q % 4) + 4) % 4;
    const from = new Date(fy, qq * 3, 1).toISOString().slice(0, 10);
    const to   = new Date(fy, qq * 3 + 3, 0).toISOString().slice(0, 10);
    return { from, to: to > today ? today : to,
      label: `Q${qq + 1} FY${fy}-${String(fy + 1).slice(2)}` };
  }
  if (period === 'thisHalfYear') {
    const half = mo < 6 ? 0 : 1;
    return { from: new Date(yr, half * 6, 1).toISOString().slice(0, 10), to: today,
      label: `H${half + 1} ${yr}` };
  }
  if (period === 'lastHalfYear') {
    const half = mo < 6 ? 1 : 0;
    const hy   = mo < 6 ? yr - 1 : yr;
    const from = new Date(hy, half * 6, 1).toISOString().slice(0, 10);
    const to   = new Date(hy, half * 6 + 6, 0).toISOString().slice(0, 10);
    return { from, to: to > today ? today : to, label: `H${half + 1} ${hy}` };
  }
  if (period === 'thisFY') {
    const s = mo >= 3 ? yr : yr - 1;
    return { from: `${s}-04-01`, to: today, label: `FY ${s}-${String(s + 1).slice(2)}` };
  }
  if (period === 'lastFY') {
    const s = (mo >= 3 ? yr : yr - 1) - 1;
    return { from: `${s}-04-01`, to: `${s + 1}-03-31`, label: `FY ${s}-${String(s + 1).slice(2)}` };
  }
  if (period === 'custom')
    return { from: customFrom, to: customTo,
      label: customFrom && customTo ? `${fmtDate(customFrom)} to ${fmtDate(customTo)}` : '' };
  return { from: today, to: today, label: fmtDate(today) };
}

function buildCAPDF(from, to, label, rows, totals, ci) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, ML = 12, CW = W - ML * 2;

  const coName  = (ci?.name  || 'UrbanMud Bricks and Blocks').toUpperCase();
  const coAddr  = (ci?.address || 'Bhaktharahalli, near Hoskote, Bangalore - 562114').replace(/\n/g, ', ');
  const coMeta  = [ci?.phone ? 'Ph: ' + ci.phone : '', ci?.gstin ? 'GSTIN: ' + ci.gstin : ''].filter(Boolean).join('  |  ');

  const C = { amber: [146, 64, 14], dark: [31, 41, 55], gray: [107, 114, 128],
    green: [21, 128, 61], red: [220, 38, 38], white: [255, 255, 255] };

  let y = 12;

  // Company banner
  doc.setFillColor(...C.amber);
  doc.rect(ML, y, CW, 22, 'F');
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold').setFontSize(13);
  doc.text(coName, ML + 4, y + 9);
  doc.setFont('helvetica', 'normal').setFontSize(7);
  doc.text([coAddr, coMeta].filter(Boolean).join('  ·  '), ML + 4, y + 16, { maxWidth: CW - 8 });

  y += 26;
  doc.setFillColor(255, 243, 199);
  doc.rect(ML, y, CW, 10, 'F');
  doc.setTextColor(...C.dark);
  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text('STATEMENT OF INCOME & EXPENDITURE', W / 2, y + 7, { align: 'center' });

  y += 14;
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...C.gray);
  doc.text(`Period: ${label}  (${fmtDate(from)}  —  ${fmtDate(to)})`, ML, y);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, W - ML, y, { align: 'right' });

  y += 6;

  // KPI strip
  doc.setFillColor(254, 243, 199);
  doc.rect(ML, y, CW, 18, 'F');
  const kw = CW / 3;
  [
    ['TOTAL INCOME',      rp(totals.income),  C.green],
    ['TOTAL EXPENDITURE', rp(totals.totalOut), C.red],
    ['NET P&L',           (totals.netPL >= 0 ? '+' : '') + rp(totals.netPL), totals.netPL >= 0 ? C.green : C.red],
  ].forEach(([l, v, c], i) => {
    const kx = ML + i * kw + 3;
    doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...C.gray).text(l, kx, y + 6);
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...c).text(v, kx, y + 14);
  });
  y += 22;

  const sec = (title, color) => {
    if (y > 245) { doc.addPage(); y = 16; }
    doc.setFillColor(color[0], color[1], color[2]);
    doc.setGState && doc.setGState(doc.GState({ opacity: 0.12 }));
    doc.setFillColor(Math.min(255, color[0] + 100), Math.min(255, color[1] + 100), Math.min(255, color[2] + 100));
    doc.rect(ML, y, CW, 7, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...color);
    doc.text(title, ML + 3, y + 5);
    y += 9;
  };

  const tbl = (head, body, foot, colAligns) => {
    autoTable(doc, {
      startY: y, margin: { left: ML, right: ML },
      head: [head], body, foot: foot ? [foot] : undefined,
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [243, 244, 246], textColor: C.dark, fontStyle: 'bold', fontSize: 7 },
      footStyles: { fillColor: [243, 244, 246], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: colAligns || {},
      theme: 'grid',
    });
    y = doc.lastAutoTable.finalY + 5;
    if (y > 260) { doc.addPage(); y = 16; }
  };

  // A. Income
  sec('A.  INCOME  —  SALES & ORDER PAYMENTS RECEIVED', C.green);
  tbl(
    ['Date', 'Customer', 'Order #', 'Product', 'Bank Account', 'Amount Received'],
    rows.income,
    ['', '', '', '', 'TOTAL INCOME', rp(totals.income)],
    { 5: { halign: 'right' } }
  );

  // B. Material Purchases
  sec('B.  EXPENDITURE  —  MATERIAL PURCHASES', [29, 78, 216]);
  tbl(
    ['Date', 'Material', 'Qty', 'Supplier', 'Bill No', 'Bill Type', 'Amount'],
    rows.mat,
    ['', '', '', '', '', 'TOTAL', rp(totals.matCost)],
    { 6: { halign: 'right' } }
  );

  // C. Labour Payments
  sec('C.  EXPENDITURE  —  LABOUR PAYMENTS', [6, 95, 70]);
  tbl(
    ['Date', 'Labour Group', 'Type', 'Bank Account', 'Notes', 'Amount'],
    rows.labor,
    ['', '', '', '', 'TOTAL', rp(totals.laborCost)],
    { 5: { halign: 'right' } }
  );

  // D. Other Expenses
  sec('D.  EXPENDITURE  —  OTHER EXPENSES', [124, 58, 237]);
  tbl(
    ['Date', 'Category', 'Description', 'GST', 'Bank Account', 'Bill Type', 'Amount'],
    rows.exp,
    ['', '', '', '', '', 'TOTAL', rp(totals.expCost)],
    { 6: { halign: 'right' } }
  );

  // E. P&L Summary
  sec('E.  PROFIT & LOSS SUMMARY', C.amber);
  autoTable(doc, {
    startY: y, margin: { left: ML, right: ML },
    body: [
      ['Total Income (Sales Receipts)',  '', rp(totals.income)],
      ['Less: Material Purchases',        '', `(${rp(totals.matCost)})`],
      ['Less: Labour Payments',           '', `(${rp(totals.laborCost)})`],
      ['Less: Other Expenses',            '', `(${rp(totals.expCost)})`],
      ['Total Expenditure',               '', `(${rp(totals.totalOut)})`],
      [(totals.netPL >= 0 ? 'NET PROFIT' : 'NET LOSS'), '', (totals.netPL >= 0 ? '+' : '') + rp(totals.netPL)],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 110 },
      2: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell(d) {
      if (d.row.index === 5) {
        d.cell.styles.fontSize = 11;
        d.cell.styles.fillColor = totals.netPL >= 0 ? [220, 252, 231] : [254, 226, 226];
        d.cell.styles.textColor = totals.netPL >= 0 ? C.green : C.red;
      }
    },
    theme: 'plain',
  });
  y = doc.lastAutoTable.finalY + 5;

  // F. Bank Account Summary
  sec('F.  BANK ACCOUNT SUMMARY', C.dark);
  tbl(
    ['Account', 'Bank', 'Type', 'Total Income', 'Total Outflow', 'Net'],
    rows.bank,
    null,
    { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } }
  );

  // G. Production
  sec('G.  PRODUCTION RECORDS', [59, 130, 246]);
  tbl(
    ['Date', 'Factory', 'Product', 'Qty (pcs)', 'Cement (bags)', 'Notes'],
    rows.prod,
    null,
    { 3: { halign: 'right' }, 4: { halign: 'right' } }
  );

  // CA Notes
  if (y > 230) { doc.addPage(); y = 16; }
  doc.setFillColor(255, 252, 232);
  doc.rect(ML, y, CW, 32, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...C.amber);
  doc.text('NOTES FOR CHARTERED ACCOUNTANT:', ML + 3, y + 6);
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...C.dark);
  [
    '• Bill photos for all expenses and material purchases are included in the ZIP under Bills_Expenses/ and Bills_Materials/ folders.',
    '• URD = Unregistered Dealer Receipt — purchase from a supplier not registered under GST. Self-invoices are generated internally.',
    '• GST column shows input tax credit claimed. Verify with original bills for ITC reconciliation.',
    '• Labour payments may include regular wages, advance, overtime, or festival bonus — refer to payment type column.',
  ].forEach((line, i) => doc.text(line, ML + 3, y + 12 + i * 5, { maxWidth: CW - 6 }));

  // Page footers
  const n = doc.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(156, 163, 175);
    doc.text(`Page ${i} of ${n}  ·  ${coName}  ·  ${label}  ·  CONFIDENTIAL — FOR CA USE ONLY`,
      W / 2, 291, { align: 'center' });
  }

  return doc.output('arraybuffer');
}

const PERIODS = [
  ['thisMonth',    'This Month'],
  ['lastMonth',    'Last Month ✓'],
  ['thisQuarter',  'This Quarter'],
  ['lastQuarter',  'Last Quarter ✓'],
  ['thisHalfYear', 'This Half-Year'],
  ['lastHalfYear', 'Last Half-Year ✓'],
  ['thisFY',       'This FY (Apr–Mar)'],
  ['lastFY',       'Last FY (Apr–Mar) ✓'],
  ['custom',       'Custom Range'],
];

export default function CAExport({ onClose }) {
  const app = useApp();
  const [period, setPeriod]         = useState('lastMonth');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [busy, setBusy]             = useState('');
  const [done, setDone]             = useState('');

  if (app.currentUser?.username !== 'lbawoor') return null;

  const { from, to, label } = getRange(period, customFrom, customTo);
  const valid = !!(from && to && from <= to);
  const inRange = d => { const s = (d || '').slice(0, 10); return s >= from && s <= to; };

  const expenses       = app.expenses.filter(e => inRange(e.date));
  const matPurchases   = app.materialPurchases.filter(p => inRange(p.date));
  const laborPayments  = app.laborPayments.filter(p => inRange(p.date));
  const orderPayments  = (app.orderPayments || []).filter(p => inRange(p.date));
  const prodEntries    = app.productionEntries.filter(e => inRange(e.date));
  const income         = orderPayments.filter(p => p.direction === 'received');

  const totalIncome  = income.reduce((s, p) => s + num(p.amount), 0);
  const matCost      = matPurchases.reduce((s, p) => s + num(p.totalAmount), 0);
  const laborCost    = laborPayments.reduce((s, p) => s + num(p.amount), 0);
  const expCost      = expenses.reduce((s, e) => s + num(e.amount), 0);
  const totalOut     = matCost + laborCost + expCost;
  const netPL        = totalIncome - totalOut;
  const billCount    = expenses.filter(e => e.billImage).length + matPurchases.filter(p => p.billImage).length;
  const totalTxns    = income.length + matPurchases.length + laborPayments.length + expenses.length;

  async function generate(mode) {
    if (!valid) return alert('Select a valid date range first.');
    setBusy(mode); setDone('');
    try {
      const ci    = app.companyInfo || {};
      const pName = id => app.products.find(p => p.id === id)?.name || '—';
      const mName = id => app.materialTypes.find(m => m.id === id)?.name || '—';
      const mUnit = id => app.materialTypes.find(m => m.id === id)?.unit || '';
      const gName = id => app.laborGroups.find(g => g.id === id)?.name || '—';
      const aName = id => app.bankAccounts.find(b => b.id === id)?.name || '—';
      const cName = id => app.expenseCategories.find(c => c.id === id)?.name || '—';

      const incRows = income.map(p => {
        const o = (app.orders || []).find(x => x.id === p.orderId) || {};
        return [fmtDate(p.date), o.customerName || '—', o.orderNumber || '—',
          pName(o.productId), aName(p.bankAccountId), rp(p.amount)];
      });
      const matRows = matPurchases.map(p => [
        fmtDate(p.date), mName(p.materialTypeId),
        `${num(p.quantity)} ${mUnit(p.materialTypeId)}`,
        p.supplier || '—', p.billNumber || '—',
        p.billMode === 'urd' ? 'URD' : 'Original',
        rp(p.totalAmount),
      ]);
      const laborRows = laborPayments.map(p => [
        fmtDate(p.date), gName(p.laborGroupId), p.paymentType || 'regular',
        aName(p.bankAccountId), p.notes || '—', rp(p.amount),
      ]);
      const expRows = expenses.map(e => [
        fmtDate(e.date), cName(e.categoryId), e.description || '—',
        e.hasGST && e.gstAmount ? `Rs.${fmt(e.gstAmount)}` : 'No',
        aName(e.bankAccountId),
        e.billMode === 'urd' ? 'URD' : e.billMode === 'uploaded' ? 'Original' : 'None',
        rp(e.amount),
      ]);
      const bankRows = app.bankAccounts.map(acc => {
        const inc = income.filter(p => p.bankAccountId === acc.id).reduce((s, p) => s + num(p.amount), 0);
        const out = laborPayments.filter(p => p.bankAccountId === acc.id).reduce((s, p) => s + num(p.amount), 0)
          + matPurchases.filter(p => p.bankAccountId === acc.id).reduce((s, p) => s + num(p.totalAmount), 0)
          + expenses.filter(e => e.bankAccountId === acc.id).reduce((s, e) => s + num(e.amount), 0);
        return [acc.name, acc.bankName || '—', acc.type || '—', rp(inc), rp(out),
          (inc - out >= 0 ? '+' : '') + rp(inc - out)];
      }).filter(r => r[3] !== 'Rs.0' || r[4] !== 'Rs.0');
      const prodRows = prodEntries.map(e => [
        fmtDate(e.date), app.factories?.find(f => f.id === e.factoryId)?.name || '—',
        pName(e.productId), num(e.quantity), num(e.cementBags), e.notes || '',
      ]);

      // Build P&L PDF
      const pdfBytes = buildCAPDF(from, to, label,
        { income: incRows, mat: matRows, labor: laborRows, exp: expRows, bank: bankRows, prod: prodRows },
        { income: totalIncome, matCost, laborCost, expCost, totalOut, netPL }, ci);

      // CSVs
      const csvPL    = toCSV(['Item', 'Amount'], [
        ['Total Income (Sales)', rp(totalIncome)],
        ['Material Purchases', rp(matCost)],
        ['Labour Payments', rp(laborCost)],
        ['Other Expenses', rp(expCost)],
        ['Total Expenditure', rp(totalOut)],
        ['Net P&L', (netPL >= 0 ? '+' : '') + rp(netPL)],
      ]);
      const csvSales = toCSV(['Date','Customer','Order #','Product','Bank Account','Amount Received'], incRows);
      const csvMat   = toCSV(['Date','Material','Quantity','Supplier','Bill No','Bill Type','Amount'], matRows);
      const csvLabor = toCSV(['Date','Labour Group','Payment Type','Bank Account','Notes','Amount'], laborRows);
      const csvExp   = toCSV(['Date','Category','Description','GST Amount','Bank Account','Bill Type','Amount'], expRows);
      const csvProd  = toCSV(['Date','Factory','Product','Quantity (pcs)','Cement (bags)','Notes'], prodRows);
      const csvBank  = toCSV(['Account','Bank','Type','Total Income','Total Outflow','Net'], bankRows);

      const slug    = label.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      const zipName = `Urbanmud_CA_Export_${slug}.zip`;

      const zip = new JSZip();

      zip.file('README.txt', [
        'URBANMUD MANUFACTURING OPS — CA EXPORT PACKAGE',
        '='.repeat(52),
        `Company   : ${ci.name || 'UrbanMud Bricks and Blocks'}`,
        `Period    : ${label} (${from} to ${to})`,
        `Generated : ${new Date().toLocaleString('en-IN')}`,
        `Exported by: ${app.currentUser?.name || 'Super Admin'}`,
        '',
        'FILE CONTENTS',
        '-'.repeat(52),
        '01_PL_Statement.pdf          Printable A4 P&L statement — 7 sections with CA notes',
        '02_PL_Summary.csv            P&L totals summary',
        '03_Sales_Income.csv          All order payment receipts',
        '04_Material_Purchases.csv    All material purchases (with URD flag)',
        '05_Labour_Payments.csv       All labour payments by group',
        '06_Other_Expenses.csv        All expenses with GST breakdown',
        '07_Production_Records.csv    Daily production entries',
        '08_Bank_Account_Summary.csv  Bank-wise income/outflow',
        'Bills_Expenses/              Original expense bill photos (JPEG)',
        'Bills_Materials/             Material purchase bill photos (JPEG)',
        '',
        'NOTES FOR CA',
        '-'.repeat(52),
        '* URD = Unregistered Dealer Receipt (supplier not registered under GST)',
        '* GST amounts in expenses are input tax credits claimed',
        '* Verify bill photos against transaction records for ITC reconciliation',
        '* Labour payments include regular, advance, and overtime — see "Type" column',
        '* All amounts in Indian Rupees (INR)',
      ].join('\n'));

      zip.file('01_PL_Statement.pdf', pdfBytes);
      zip.file('02_PL_Summary.csv', csvPL);
      zip.file('03_Sales_Income.csv', csvSales);
      zip.file('04_Material_Purchases.csv', csvMat);
      zip.file('05_Labour_Payments.csv', csvLabor);
      zip.file('06_Other_Expenses.csv', csvExp);
      zip.file('07_Production_Records.csv', csvProd);
      zip.file('08_Bank_Account_Summary.csv', csvBank);

      const expFolder = zip.folder('Bills_Expenses');
      expenses.filter(e => e.billImage && e.billMode === 'uploaded').forEach((e, i) => {
        const cat = cName(e.categoryId).replace(/[^a-zA-Z0-9]/g, '_');
        expFolder.file(`EXP_${e.date}_${cat}_${String(i + 1).padStart(3, '0')}.jpg`, e.billImage, { base64: true });
      });

      const matFolder = zip.folder('Bills_Materials');
      matPurchases.filter(p => p.billImage && p.billMode === 'uploaded').forEach((p, i) => {
        const mat = mName(p.materialTypeId).replace(/[^a-zA-Z0-9]/g, '_');
        matFolder.file(`MAT_${p.date}_${mat}_${String(i + 1).padStart(3, '0')}.jpg`, p.billImage, { base64: true });
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 },
      });

      if (mode === 'share') {
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload  = () => res(r.result.split(',')[1]);
          r.onerror = rej;
          r.readAsDataURL(zipBlob);
        });
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const result = await Filesystem.writeFile({ path: zipName, data: b64, directory: Directory.Cache });
        await Share.share({ title: zipName, url: result.uri, dialogTitle: 'Share CA Export Package' });
      } else {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a'); a.href = url; a.download = zipName; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }

      setDone(`✅ CA package ready  —  ${Math.round(zipBlob.size / 1024)} KB  ·  ${billCount} bills  ·  ${totalTxns} transactions`);
    } catch (err) {
      alert('Export failed: ' + err.message);
      console.error(err);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-gray-50 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100 shadow-sm shrink-0">
        <button onClick={onClose} className="text-gray-500 font-bold text-xl px-1">←</button>
        <div>
          <h2 className="font-bold text-gray-800 text-base">CA / Audit Export</h2>
          <p className="text-xs text-gray-400">ZIP package for Chartered Accountant — P&L · CSVs · Bill photos</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Period selector */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Select Period</p>
          <div className="grid grid-cols-2 gap-2">
            {PERIODS.map(([id, lbl]) => (
              <button key={id} onClick={() => { setPeriod(id); setDone(''); }}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-left transition-colors ${
                  period === id ? 'bg-amber-700 text-white shadow-sm' : 'bg-gray-100 text-gray-600'}`}>
                {lbl}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">From</p>
                <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setDone(''); }}
                  className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">To</p>
                <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setDone(''); }}
                  className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>
          )}
          {valid && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
              <p className="text-xs font-bold text-amber-800">{label}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">{fmtDate(from)} → {fmtDate(to)}</p>
            </div>
          )}
        </div>

        {/* Period data preview */}
        {valid && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Period Preview</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Income',       `₹${fmt(totalIncome)}`,   totalIncome > 0  ? 'text-green-600' : 'text-gray-500'],
                ['Expenditure',  `₹${fmt(totalOut)}`,      totalOut    > 0  ? 'text-red-600'   : 'text-gray-500'],
                ['Net P&L',      `${netPL >= 0 ? '+' : ''}₹${fmt(netPL)}`, netPL >= 0 ? 'text-green-600' : 'text-red-600'],
                ['Transactions', totalTxns,                'text-gray-800'],
                ['Bill Photos',  billCount,                'text-gray-800'],
                ['Prod. Entries',prodEntries.length,        'text-gray-800'],
              ].map(([l, v, c]) => (
                <div key={l} className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-[9px] text-gray-400 leading-tight">{l}</p>
                  <p className={`text-sm font-bold mt-0.5 ${c}`}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What's included */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">What's in the ZIP</p>
          <div className="space-y-2">
            {[
              ['📄', '01_PL_Statement.pdf',      'Printable A4 letterhead — Income, Expenses, P&L, Bank summary, CA notes', 'bg-amber-50 text-amber-700'],
              ['📊', '02–08 CSV data files',      'P&L · Sales · Materials · Labour · Expenses · Production · Bank (open in Excel)', 'bg-blue-50 text-blue-700'],
              ['🧾', `Bills_Expenses/ (${expenses.filter(e=>e.billImage).length} files)`, 'Original expense bill photos as JPEG', 'bg-green-50 text-green-700'],
              ['📦', `Bills_Materials/ (${matPurchases.filter(p=>p.billImage).length} files)`, 'Material purchase bill photos as JPEG', 'bg-green-50 text-green-700'],
              ['📝', 'README.txt',                'Contents index + notes for CA about URD, GST, ITC', 'bg-gray-50 text-gray-700'],
            ].map(([icon, title, desc, cls]) => (
              <div key={title} className={`${cls.split(' ')[0]} rounded-xl px-3 py-2.5`}>
                <p className={`text-xs font-bold ${cls.split(' ')[1]}`}>{icon} {title}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2 pb-6">
          {done && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <p className="text-xs text-green-700 font-semibold text-center">{done}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => generate('download')} disabled={!!busy || !valid}
              className="flex-1 py-3.5 bg-amber-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
              <Download size={15}/>
              {busy === 'download' ? 'Building ZIP…' : 'Download ZIP'}
            </button>
            <button onClick={() => generate('share')} disabled={!!busy || !valid}
              className="flex-1 py-3.5 bg-blue-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
              <Share2 size={15}/>
              {busy === 'share' ? 'Preparing…' : 'Share ZIP'}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center">
            Large packages with many bill photos may take a few seconds to generate
          </p>
        </div>

      </div>
    </div>
  );
}
