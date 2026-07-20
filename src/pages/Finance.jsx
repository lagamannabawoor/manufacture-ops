import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, Users, ShoppingBag, Receipt, ArrowDownCircle, ArrowUpCircle, Download, Share2, Camera as CamIcon, FilePlus2, X, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fmtDate, todayISO } from '../utils/date';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }
function rp(n)  { return 'Rs.' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0); }

async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 1200;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.65).split(',')[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
}

async function shareOrDownloadPDF(pdf, filename) {
  const blob = pdf.output('blob');
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const b64 = await blobToBase64(blob);
    const result = await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
    await Share.share({ title: filename, url: result.uri, dialogTitle: 'Share Document' });
  } catch {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function buildFinancePDF(type, entry, meta, ci) {
  const coName    = ci?.name    || 'UrbanMud Bricks and Blocks';
  const coAddress = ci?.address || 'Bhaktharahalli, Poojeana Agrahara,\nnear Hoskote, Bangalore - 562114';
  const coPhone   = ci?.phone   || '';
  const coGSTIN   = ci?.gstin   || '';
  const A = [146,64,14], DK = [30,30,30], MD = [90,90,90], LT = [190,190,190];
  const W = 210, H = 297, ML = 14, MR = 14, CW = W - ML - MR;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = ML;

  const CFG = {
    expense:          { title: 'EXPENSE VOUCHER',        badge: 'EXPENSE AMOUNT',    col: [254,242,242], tcol: [220,38,38]  },
    labor:            { title: 'LABOUR PAYMENT VOUCHER', badge: 'AMOUNT PAID',        col: [238,242,255], tcol: [79,70,229]  },
    payment_received: { title: 'PAYMENT RECEIPT',        badge: 'AMOUNT RECEIVED',   col: [240,253,244], tcol: [22,163,74]  },
    payment_paid:     { title: 'PAYMENT ORDER',          badge: 'AMOUNT PAID',        col: [254,242,242], tcol: [220,38,38]  },
  };
  const cfg = CFG[type] || CFG.expense;
  const vno = (entry.id || '').slice(-8).toUpperCase() || 'VCH';

  // Left: company header
  const hY = y;
  pdf.setFontSize(14); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A);
  pdf.text(coName.toUpperCase(), ML, y+7); y += 11;
  pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
  coAddress.split('\n').forEach(l => { pdf.text(l, ML, y); y += 4; });
  if (coPhone) { pdf.text('Ph: '+coPhone, ML, y); y += 4; }
  if (coGSTIN) { pdf.setFont('helvetica','bold'); pdf.text('GSTIN: '+coGSTIN, ML, y); pdf.setFont('helvetica','normal'); y += 4; }

  // Right: doc meta
  const mX = W-MR; let ry = hY+7;
  pdf.setFontSize(13); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK);
  pdf.text(cfg.title, mX, ry, { align:'right' }); ry += 8;
  pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A);
  pdf.text(vno, mX, ry, { align:'right' }); ry += 6;
  pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
  pdf.text('Date: '+(entry.date||''), mX, ry, { align:'right' }); ry += 5;

  y = Math.max(y, ry)+4;
  pdf.setDrawColor(...A); pdf.setLineWidth(0.6); pdf.line(ML, y, W-MR, y); y += 7;

  // Details table
  const rows = [];
  if (type === 'expense') {
    rows.push(['Category', meta.categoryName||'—']);
    if (entry.description) rows.push(['Description', entry.description]);
    rows.push(['Amount', rp(entry.amount)]);
    if (entry.hasGST && entry.gstAmount) rows.push(['GST Amount', rp(entry.gstAmount)]);
    if (meta.accountName) rows.push(['Payment Via', meta.accountName]);
  } else if (type === 'labor') {
    rows.push(['Labor Group', meta.groupName||'—']);
    rows.push(['Payment Type', (entry.paymentType||'regular').charAt(0).toUpperCase()+(entry.paymentType||'regular').slice(1)]);
    rows.push(['Amount', rp(entry.amount)]);
    if (meta.accountName) rows.push(['Payment Via', meta.accountName]);
  } else {
    if (meta.orderNumber) rows.push(['Order No', meta.orderNumber]);
    rows.push(['Customer', meta.customerName||'—']);
    if (meta.productName) rows.push(['Product', meta.productName]);
    rows.push(['Direction', type === 'payment_received' ? 'Received from Customer' : 'Paid Out']);
    rows.push(['Amount', rp(entry.amount)]);
    if (meta.accountName) rows.push(['Payment Via', meta.accountName]);
  }
  if (entry.notes) rows.push(['Notes', entry.notes]);

  autoTable(pdf, {
    startY: y, margin: { left:ML, right:MR },
    body: rows, showHead: 'never',
    bodyStyles: { fontSize:10.5, textColor:DK, cellPadding:4 },
    columnStyles: { 0:{ cellWidth:52, fontStyle:'bold', textColor:MD }, 1:{ fontStyle:'normal' } },
    alternateRowStyles: { fillColor:[255,248,235] },
  });
  y = pdf.lastAutoTable.finalY + 7;

  // Amount highlight band
  if (y+13>H-18) { pdf.addPage(); y=ML; }
  pdf.setFillColor(...cfg.col); pdf.rect(ML, y, CW, 12, 'F');
  pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(...cfg.tcol);
  pdf.text(cfg.badge, ML+4, y+8);
  pdf.text(rp(Number(entry.amount)||0), W-MR-4, y+8, { align:'right' });
  y += 18;

  // Signing
  if (y+35>H-18) { pdf.addPage(); y=ML; }
  y += 4; pdf.setDrawColor(...LT); pdf.setLineWidth(0.3); pdf.line(ML,y,W-MR,y); y += 15;
  const sw = CW/3;
  [['Prepared By',''],['Verified By',''],['Authorised Signatory','For '+coName]]
    .forEach(([lbl,sub],i) => {
      const cx = ML+i*sw+sw/2;
      pdf.setDrawColor(...MD); pdf.setLineWidth(0.4); pdf.line(cx-sw/2+6,y,cx+sw/2-6,y);
      pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK); pdf.text(lbl,cx,y+5,{align:'center'});
      if(sub){pdf.setFontSize(7);pdf.setFont('helvetica','normal');pdf.setTextColor(...MD);pdf.text(sub,cx,y+9,{align:'center'});}
    });
  pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(...LT);
  pdf.text('Generated by Urbanmud Manufacturing Ops', W/2, H-8, { align:'center' });
  return pdf;
}

function freshExpenseForm() {
  return { date: todayISO(), categoryId: '', description: '', amount: '', bankAccountId: '',
           hasGST: false, gstAmount: '', notes: '',
           billMode: '', billImage: '', urdSupplierName: '', urdSupplierAddress: '' };
}

function buildExpenseURDPDF(expense, meta, ci) {
  const coName    = ci?.name    || 'UrbanMud Bricks and Blocks';
  const coAddress = ci?.address || 'Bhaktharahalli, Poojeana Agrahara,\nnear Hoskote, Bangalore - 562114';
  const coGSTIN   = ci?.gstin   || '';
  const A = [146,64,14], DK = [30,30,30], MD = [90,90,90], LT = [190,190,190];
  const W = 210, H = 297, ML = 14, MR = 14, CW = W - ML - MR;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 0;

  // Header banner
  pdf.setFillColor(...A); pdf.rect(0, 0, W, 24, 'F');
  pdf.setFontSize(12); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
  pdf.text('SELF INVOICE — EXPENSE FROM UNREGISTERED DEALER (URD)', W/2, 10, { align:'center' });
  pdf.setFontSize(7.5); pdf.setFont('helvetica','normal');
  pdf.text('Under Section 9(4) CGST Act 2017 / Rule 46A — Reverse Charge Mechanism applies', W/2, 17, { align:'center' });
  y = 30;

  const vno = (expense.id || '').slice(-8).toUpperCase() || 'EXP';
  pdf.setFontSize(8.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
  pdf.text(`Self Invoice No: URD-EXP-${vno}`, ML, y);
  pdf.text(`Date: ${expense.date||''}`, W-MR, y, { align:'right' }); y += 9;
  pdf.setDrawColor(...A); pdf.setLineWidth(0.4); pdf.line(ML, y, W-MR, y); y += 6;

  // Two-column: Buyer | Supplier
  const colW = (CW-6)/2, col2X = ML+colW+6, boxY = y;
  pdf.setFillColor(255,248,235); pdf.roundedRect(ML, boxY, colW, 36, 2, 2, 'F');
  pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A); pdf.text('BUYER (Self)', ML+4, boxY+7);
  pdf.setFontSize(8.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK); pdf.text(coName, ML+4, boxY+14);
  pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
  let ay = boxY+20;
  coAddress.split('\n').forEach(l => { pdf.text(l, ML+4, ay); ay += 4.5; });
  if (coGSTIN) { pdf.setFont('helvetica','bold'); pdf.text('GSTIN: '+coGSTIN, ML+4, ay); }

  pdf.setFillColor(254,243,199); pdf.roundedRect(col2X, boxY, colW, 36, 2, 2, 'F');
  pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A); pdf.text('SUPPLIER / PAYEE', col2X+4, boxY+7);
  pdf.setFontSize(8.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK);
  pdf.text(pdf.splitTextToSize(expense.urdSupplierName||'(Not Provided)', colW-8)[0], col2X+4, boxY+14);
  pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
  let sy = boxY+20;
  if (expense.urdSupplierAddress) {
    pdf.splitTextToSize(expense.urdSupplierAddress, colW-8).slice(0,3).forEach(l => { pdf.text(l, col2X+4, sy); sy += 4.5; });
  }
  pdf.setFont('helvetica','bold'); pdf.setTextColor(220,38,38);
  pdf.text('GST Status: UNREGISTERED', col2X+4, sy+1);
  y = boxY+42;

  // Items table
  const cat    = meta.categoryName || '—';
  const desc   = expense.description || cat;
  const amount = Number(expense.amount)||0;
  const gstAmt = expense.hasGST ? (Number(expense.gstAmount)||0) : 0;
  const rows   = [['1', cat, desc, '', rp(amount)]];
  if (gstAmt > 0) rows.push([' ', ' ', 'GST (Reverse Charge)', '', rp(gstAmt)]);
  rows.push([' ', ' ', '', 'TOTAL', rp(amount + gstAmt)]);
  autoTable(pdf, {
    startY: y, margin: { left:ML, right:MR },
    head: [['#','Category','Description','','Amount']],
    body: rows,
    headStyles: { fillColor:A, textColor:[255,255,255], fontStyle:'bold', fontSize:9 },
    bodyStyles: { fontSize:9, textColor:DK, cellPadding:3 },
    columnStyles: { 0:{cellWidth:8}, 1:{cellWidth:32}, 3:{cellWidth:18}, 4:{cellWidth:28,halign:'right',fontStyle:'bold'} },
    alternateRowStyles: { fillColor:[255,248,235] },
    didParseCell: (data) => { if (data.row.index === rows.length-1) { data.cell.styles.fillColor=[254,243,199]; data.cell.styles.fontStyle='bold'; } },
  });
  y = pdf.lastAutoTable.finalY + 8;

  // RCM notice
  if (y+20>H-50) { pdf.addPage(); y=ML; }
  pdf.setFillColor(254,243,199); pdf.roundedRect(ML, y, CW, 18, 2, 2, 'F');
  pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(180,83,9); pdf.text('REVERSE CHARGE NOTICE:', ML+4, y+6);
  pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(...DK);
  pdf.text('Tax is payable on reverse charge basis as per Section 9(4) of CGST Act 2017.', ML+4, y+12);
  pdf.text('Buyer ('+coName+') is liable to pay applicable GST.', ML+4, y+17);
  y += 24;

  // Signing
  if (y+40>H-12) { pdf.addPage(); y=ML; }
  y += 4; pdf.setDrawColor(...LT); pdf.setLineWidth(0.3); pdf.line(ML,y,W-MR,y); y += 15;
  const sw = CW/3;
  [['Supplier / Payee', expense.urdSupplierName||''],['Prepared By',''],['Authorised Signatory','For '+coName]]
    .forEach(([lbl,sub],i) => {
      const cx = ML+i*sw+sw/2;
      pdf.setDrawColor(...MD); pdf.setLineWidth(0.4); pdf.line(cx-sw/2+6,y,cx+sw/2-6,y);
      pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK); pdf.text(lbl,cx,y+5,{align:'center'});
      if(sub){pdf.setFontSize(7);pdf.setFont('helvetica','normal');pdf.setTextColor(...MD);pdf.text(sub,cx,y+9,{align:'center'});}
    });
  pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(...LT);
  pdf.text('Generated by Urbanmud Manufacturing Ops', W/2, H-8, { align:'center' });
  return pdf;
}

function genOrderId() {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const t = (now.getTime() % 100000).toString().padStart(5, '0');
  return `ORD-${d}-${t}`;
}

export default function Finance() {
  const [tab, setTab] = useState('orders');
  const tabs = [
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'labor', label: 'Labour', icon: Users },
  ];
  return (
    <div>
      <Header title="Finance" subtitle="Orders · Expenses · Labour" />
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 pt-2 pb-0">
        <div className="flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        {tab === 'orders' && <OrdersTab />}
        {tab === 'expenses' && <ExpensesTab />}
        {tab === 'labor' && <LaborTab />}
      </div>
    </div>
  );
}

/* ── LABOR ─────────────────────────────────────────────── */
function LaborTab() {
  const app = useApp();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), laborGroupId: '', amount: '', paymentType: 'regular', bankAccountId: '', notes: '' });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function save() {
    if (!form.laborGroupId || !form.amount) return alert('Group and amount required.');
    app.addItem('laborPayments', form);
    setForm(f => ({ ...f, laborGroupId: '', amount: '', notes: '' }));
    setShowModal(false);
  }

  const sorted = [...app.laborPayments].sort((a, b) => b.date.localeCompare(a.date));

  const groupTotals = app.laborGroups.map(g => ({
    ...g,
    total: app.laborPayments.filter(p => p.laborGroupId === g.id).reduce((s, p) => s + Number(p.amount || 0), 0),
    advance: app.laborPayments.filter(p => p.laborGroupId === g.id && p.paymentType === 'advance').reduce((s, p) => s + Number(p.amount || 0), 0),
  }));

  return (
    <div className="px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Labor Group Summary</h2>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl">
          <Plus size={14} /> Add Payment
        </button>
      </div>

      <div className="space-y-3 mb-5">
        {groupTotals.map(g => (
          <div key={g.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Users size={18} className="text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{g.name}</p>
                  <p className="text-xs text-gray-400">Advance: ₹{fmt(g.advance)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-800">₹{fmt(g.total)}</p>
                <p className="text-xs text-gray-400">total paid</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Payment History</h2>
      {sorted.length === 0 ? (
        <EmptyState icon={<Users size={36} className="text-gray-200" />} msg="No labor payments yet" />
      ) : (
        <div className="space-y-2">
          {sorted.map(p => {
            const group = app.laborGroups.find(g => g.id === p.laborGroupId);
            const account = app.bankAccounts.find(b => b.id === p.bankAccountId);
            const typeColors = { regular: 'bg-green-50 text-green-700', advance: 'bg-amber-50 text-amber-700', installment: 'bg-blue-50 text-blue-700' };
            return (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-800">{group?.name || 'Unknown'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${typeColors[p.paymentType] || 'bg-gray-100 text-gray-600'}`}>
                        {p.paymentType}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{fmtDate(p.date)} {account ? `· ${account.name}` : ''}</p>
                    {p.notes && <p className="text-xs text-gray-500 mt-1">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-base font-bold text-red-600 mr-1">₹{fmt(p.amount)}</p>
                    <button title="Download voucher" onClick={() => {
                      const pdf = buildFinancePDF('labor', p, { groupName: group?.name, accountName: account?.name }, app.companyInfo||{});
                      pdf.save(`Labour-${p.date}-${(p.id||'').slice(-5)}.pdf`);
                    }} className="text-blue-400 hover:text-blue-600 p-1"><Download size={14}/></button>
                    <button title="Share" onClick={async () => {
                      const pdf = buildFinancePDF('labor', p, { groupName: group?.name, accountName: account?.name }, app.companyInfo||{});
                      await shareOrDownloadPDF(pdf, `Labour-${p.date}.pdf`);
                    }} className="text-purple-400 hover:text-purple-600 p-1"><Share2 size={14}/></button>
                    <button onClick={() => { if (confirm('Delete?')) app.deleteItem('laborPayments', p.id); }} className="text-gray-300 hover:text-red-400 p-1"><Trash2 size={15}/></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Add Labor Payment" onClose={() => setShowModal(false)}>
          <Field label="Date" required><input type="date" className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} /></Field>
          <Field label="Labor Group" required>
            <select className={selectCls} value={form.laborGroupId} onChange={e => set('laborGroupId', e.target.value)}>
              <option value="">Select group...</option>
              {app.laborGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Payment Type" required>
            <select className={selectCls} value={form.paymentType} onChange={e => set('paymentType', e.target.value)}>
              <option value="regular">Regular Payment</option>
              <option value="advance">Advance</option>
              <option value="installment">Installment</option>
            </select>
          </Field>
          <Field label="Amount (₹)" required><input type="number" className={inputCls} placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} min="0" /></Field>
          <Field label="Bank Account">
            <select className={selectCls} value={form.bankAccountId} onChange={e => set('bankAccountId', e.target.value)}>
              <option value="">Select account...</option>
              {app.bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Notes"><textarea className={inputCls} rows={2} placeholder="Optional notes..." value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
          <SaveBtn onClick={save} />
        </Modal>
      )}
    </div>
  );
}

/* ── ORDERS ─────────────────────────────────────────────── */
function OrdersTab() {
  const app = useApp();
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderForm, setOrderForm] = useState(() => ({ orderNumber: genOrderId(), customerName: '', customerPhone: '', productId: '', quantity: '', unitPrice: '', deliveryDate: '', notes: '' }));
  const [payForm, setPayForm] = useState({ date: todayISO(), orderId: '', amount: '', direction: 'received', bankAccountId: '', notes: '' });

  function setOF(k, v) { setOrderForm(f => ({ ...f, [k]: v })); }
  function setPF(k, v) { setPayForm(f => ({ ...f, [k]: v })); }

  function saveOrder() {
    if (!orderForm.customerName || !orderForm.productId || !orderForm.quantity) return alert('Customer, product, and quantity required.');
    const total = Number(orderForm.quantity) * Number(orderForm.unitPrice || 0);
    app.addItem('orders', { ...orderForm, totalAmount: total, status: 'pending' });
    setOrderForm({ orderNumber: genOrderId(), customerName: '', customerPhone: '', productId: '', quantity: '', unitPrice: '', deliveryDate: '', notes: '' });
    setShowOrderModal(false);
  }

  function savePayment() {
    if (!payForm.orderId || !payForm.amount) return alert('Order and amount required.');
    app.addItem('orderPayments', payForm);
    setPF('amount', ''); setPF('notes', '');
    setShowPayModal(false);
  }

  const sorted = [...app.orders].sort((a, b) => (b.id > a.id ? 1 : -1));
  const statusColors = { pending: 'bg-amber-50 text-amber-700', in_progress: 'bg-blue-50 text-blue-700', completed: 'bg-green-50 text-green-700' };

  return (
    <div className="px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Orders</h2>
        <div className="flex gap-2">
          <button onClick={() => { setPayForm(f => ({ ...f, orderId: '' })); setShowPayModal(true); }} className="flex items-center gap-1 bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-xl">
            <ArrowDownCircle size={14} /> Payment
          </button>
          <button onClick={() => setShowOrderModal(true)} className="flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl">
            <Plus size={14} /> Order
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={<ShoppingBag size={36} className="text-gray-200" />} msg="No orders yet" />
      ) : (
        <div className="space-y-3">
          {sorted.map(order => {
            const product = app.products.find(p => p.id === order.productId);
            const payments = app.orderPayments.filter(p => p.orderId === order.id);
            const received = payments.filter(p => p.direction === 'received').reduce((s, p) => s + Number(p.amount || 0), 0);
            const paid = payments.filter(p => p.direction === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
            const balance = Number(order.totalAmount || 0) - received;
            return (
              <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {order.orderNumber && <span className="text-xs text-gray-400">#{order.orderNumber}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-800">{order.customerName}</p>
                    {order.customerPhone && <p className="text-xs text-gray-400">{order.customerPhone}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-gray-800">₹{fmt(order.totalAmount)}</p>
                    <p className="text-xs text-green-600">Rcvd: ₹{fmt(received)}</p>
                    {balance > 0 && <p className="text-xs text-red-500">Due: ₹{fmt(balance)}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 border-t border-gray-50 pt-2">
                  <span>{product?.name || 'Unknown'} · {fmt(order.quantity)} units</span>
                  {order.deliveryDate && <span>· Delivery: {order.deliveryDate}</span>}
                </div>
                <div className="flex gap-2 mt-3">
                  <select
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                    value={order.status}
                    onChange={e => app.updateItem('orders', order.id, { status: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button
                    onClick={() => { setPayForm(f => ({ ...f, orderId: order.id })); setShowPayModal(true); }}
                    className="flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-green-200"
                  >
                    <ArrowDownCircle size={12} /> Add Payment
                  </button>
                  <button onClick={() => { if (confirm('Delete order?')) app.deleteItem('orders', order.id); }} className="text-gray-300 hover:text-red-400 p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
                {payments.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-50 space-y-1">
                    {payments.slice(-3).map(p => {
                      const pAcc = app.bankAccounts.find(b => b.id === p.bankAccountId);
                      const prod = app.products.find(pr => pr.id === order.productId);
                      return (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{fmtDate(p.date)}</span>
                          <div className="flex items-center gap-1">
                            <span className={p.direction === 'received' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                              {p.direction === 'received' ? '+' : '-'}₹{fmt(p.amount)}
                            </span>
                            <button title="Download receipt" onClick={() => {
                              const pdf = buildFinancePDF(p.direction === 'received' ? 'payment_received' : 'payment_paid', p,
                                { orderNumber: order.orderNumber, customerName: order.customerName, productName: prod?.name, accountName: pAcc?.name }, app.companyInfo||{});
                              pdf.save(`Receipt-${p.date}-${(p.id||'').slice(-5)}.pdf`);
                            }} className="text-blue-400 p-0.5 hover:text-blue-600"><Download size={11}/></button>
                            <button title="Share" onClick={async () => {
                              const pdf = buildFinancePDF(p.direction === 'received' ? 'payment_received' : 'payment_paid', p,
                                { orderNumber: order.orderNumber, customerName: order.customerName, productName: prod?.name, accountName: pAcc?.name }, app.companyInfo||{});
                              await shareOrDownloadPDF(pdf, `Receipt-${p.date}.pdf`);
                            }} className="text-purple-400 p-0.5 hover:text-purple-600"><Share2 size={11}/></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showOrderModal && (
        <Modal title="Add New Order" onClose={() => setShowOrderModal(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Order ID (auto-generated)"><input type="text" className={inputCls} value={orderForm.orderNumber} onChange={e => setOF('orderNumber', e.target.value)} /></Field>
            <Field label="Delivery Date"><input type="date" className={inputCls} value={orderForm.deliveryDate} onChange={e => setOF('deliveryDate', e.target.value)} /></Field>
          </div>
          <Field label="Customer Name" required><input type="text" className={inputCls} placeholder="Customer name..." value={orderForm.customerName} onChange={e => setOF('customerName', e.target.value)} /></Field>
          <Field label="Phone"><input type="tel" className={inputCls} placeholder="Phone number..." value={orderForm.customerPhone} onChange={e => setOF('customerPhone', e.target.value)} /></Field>
          <Field label="Product" required>
            <select className={selectCls} value={orderForm.productId} onChange={e => setOF('productId', e.target.value)}>
              <option value="">Select product...</option>
              {app.productCategories.map(cat => (
                <optgroup key={cat.id} label={cat.name}>
                  {app.products.filter(p => p.categoryId === cat.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" required><input type="number" className={inputCls} placeholder="0" value={orderForm.quantity} onChange={e => setOF('quantity', e.target.value)} min="0" /></Field>
            <Field label="Unit Price (₹)"><input type="number" className={inputCls} placeholder="0.00" value={orderForm.unitPrice} onChange={e => setOF('unitPrice', e.target.value)} min="0" /></Field>
          </div>
          {orderForm.quantity && orderForm.unitPrice && (
            <div className="bg-blue-50 rounded-lg p-3 mb-3 text-sm">
              <span className="text-gray-600">Total: </span>
              <span className="font-bold text-blue-700">₹{fmt(Number(orderForm.quantity) * Number(orderForm.unitPrice))}</span>
            </div>
          )}
          <Field label="Notes"><textarea className={inputCls} rows={2} placeholder="Optional notes..." value={orderForm.notes} onChange={e => setOF('notes', e.target.value)} /></Field>
          <SaveBtn onClick={saveOrder} label="Create Order" />
        </Modal>
      )}

      {showPayModal && (
        <Modal title="Record Payment" onClose={() => setShowPayModal(false)}>
          <Field label="Date" required><input type="date" className={inputCls} value={payForm.date} onChange={e => setPF('date', e.target.value)} /></Field>
          <Field label="Order" required>
            <select className={selectCls} value={payForm.orderId} onChange={e => setPF('orderId', e.target.value)}>
              <option value="">Select order...</option>
              {app.orders.map(o => <option key={o.id} value={o.id}>{o.customerName} — ₹{fmt(o.totalAmount)}</option>)}
            </select>
          </Field>
          <Field label="Direction" required>
            <select className={selectCls} value={payForm.direction} onChange={e => setPF('direction', e.target.value)}>
              <option value="received">Payment Received (from customer)</option>
              <option value="paid">Payment Made (to supplier/other)</option>
            </select>
          </Field>
          <Field label="Amount (₹)" required><input type="number" className={inputCls} placeholder="0" value={payForm.amount} onChange={e => setPF('amount', e.target.value)} min="0" /></Field>
          <Field label="Bank Account">
            <select className={selectCls} value={payForm.bankAccountId} onChange={e => setPF('bankAccountId', e.target.value)}>
              <option value="">Select account...</option>
              {app.bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Notes"><textarea className={inputCls} rows={2} value={payForm.notes} onChange={e => setPF('notes', e.target.value)} /></Field>
          <SaveBtn onClick={savePayment} label="Record Payment" />
        </Modal>
      )}
    </div>
  );
}

/* ── EXPENSES ─────────────────────────────────────────────── */
function ExpensesTab() {
  const app = useApp();
  const [showModal, setShowModal] = useState(false);
  const [capturing, setCapturing]     = useState(false);
  const [viewingBill, setViewingBill] = useState(null);
  const [form, setForm] = useState(freshExpenseForm);
  const fileRef = useRef(null);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleCapture() {
    setCapturing(true);
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({ resultType: CameraResultType.Base64, source: CameraSource.Prompt, quality: 65, width: 1200 });
      set('billImage', photo.base64String); set('billMode', 'uploaded');
    } catch { fileRef.current?.click(); }
    finally { setCapturing(false); }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setCapturing(true);
    try { const b64 = await compressImage(file); set('billImage', b64); set('billMode', 'uploaded'); }
    catch (err) { alert('Could not process image: ' + err.message); }
    finally { setCapturing(false); e.target.value = ''; }
  }

  function downloadURDExpense(e) {
    const cat = app.expenseCategories.find(c => c.id === e.categoryId);
    const pdf = buildExpenseURDPDF(e, { categoryName: cat?.name }, app.companyInfo||{});
    pdf.save(`ExpenseURD-${e.date}-${(e.id||'').slice(-5)}.pdf`);
  }

  function save() {
    if (!form.categoryId || !form.amount) return alert('Category and amount required.');
    if (!form.billMode) return alert('Bill is mandatory. Upload a bill photo or choose "No Bill (URD)".');
    if (form.billMode === 'urd' && !form.urdSupplierName) return alert('Please enter supplier name for URD bill.');
    app.addItem('expenses', form);
    setForm(f => ({ ...freshExpenseForm(), date: f.date }));
    setShowModal(false);
  }

  const sorted = [...app.expenses].sort((a, b) => b.date.localeCompare(a.date));
  const totalToday = app.expenses.filter(e => e.date === todayISO()).reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="px-4 py-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Other Expenses</h2>
          <p className="text-xs text-gray-400">Today: ₹{fmt(totalToday)}</p>
        </div>
        <button onClick={() => { setForm(freshExpenseForm()); setShowModal(true); }}
          className="flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl">
          <Plus size={14} /> Add Expense
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={<Receipt size={36} className="text-gray-200" />} msg="No expenses recorded" />
      ) : (
        <div className="space-y-2">
          {sorted.map(e => {
            const cat = app.expenseCategories.find(c => c.id === e.categoryId);
            const account = app.bankAccounts.find(b => b.id === e.bankAccountId);
            return (
              <div key={e.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded-full font-medium">{cat?.name || 'Other'}</span>
                      {e.hasGST && <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">GST</span>}
                    </div>
                    <p className="text-sm font-medium text-gray-800">{e.description || cat?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(e.date)} {account ? `· ${account.name}` : ''}</p>
                    {e.hasGST && e.gstAmount && <p className="text-xs text-purple-600 mt-0.5">GST: ₹{fmt(e.gstAmount)}</p>}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <p className="text-base font-bold text-red-600 mr-1">₹{fmt(e.amount)}</p>
                    <button title="Download internal voucher" onClick={() => {
                      const pdf = buildFinancePDF('expense', e, { categoryName: cat?.name, accountName: account?.name }, app.companyInfo||{});
                      pdf.save(`Expense-${e.date}-${(e.id||'').slice(-5)}.pdf`);
                    }} className="text-blue-400 hover:text-blue-600 p-1"><Download size={14}/></button>
                    <button title="Share voucher" onClick={async () => {
                      const pdf = buildFinancePDF('expense', e, { categoryName: cat?.name, accountName: account?.name }, app.companyInfo||{});
                      await shareOrDownloadPDF(pdf, `Expense-${e.date}.pdf`);
                    }} className="text-purple-400 hover:text-purple-600 p-1"><Share2 size={14}/></button>
                    <button onClick={() => { if (confirm('Delete?')) app.deleteItem('expenses', e.id); }} className="text-gray-300 hover:text-red-400 p-1"><Trash2 size={15}/></button>
                  </div>
                </div>
                {/* Bill status strip */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    {e.billMode === 'uploaded' ? (
                      <span className="text-[9px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5"><CheckCircle2 size={9}/> Bill</span>
                    ) : e.billMode === 'urd' ? (
                      <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5"><FilePlus2 size={9}/> URD · {e.urdSupplierName}</span>
                    ) : (
                      <span className="text-[9px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5"><AlertTriangle size={9}/> No Bill</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {e.billMode === 'uploaded' && e.billImage && (
                      <button onClick={() => setViewingBill(e.billImage)} className="text-blue-500 p-1" title="View Bill"><Eye size={15}/></button>
                    )}
                    {e.billMode === 'urd' && (
                      <button onClick={() => downloadURDExpense(e)} className="text-amber-600 p-1" title="Download URD Bill"><Download size={15}/></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Add Expense" onClose={() => setShowModal(false)}>
          <Field label="Date" required><input type="date" className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} /></Field>
          <Field label="Category" required>
            <select className={selectCls} value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
              <option value="">Select category...</option>
              {app.expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Description"><input type="text" className={inputCls} placeholder="e.g. June electricity bill" value={form.description} onChange={e => set('description', e.target.value)} /></Field>
          <Field label="Amount (₹)" required><input type="number" className={inputCls} placeholder="0" value={form.amount} onChange={e => set('amount', e.target.value)} min="0" /></Field>
          <Field label="Bank Account">
            <select className={selectCls} value={form.bankAccountId} onChange={e => set('bankAccountId', e.target.value)}>
              <option value="">Select account...</option>
              {app.bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <div className="flex items-center gap-3 mb-4">
            <input type="checkbox" id="expHasGST" checked={form.hasGST} onChange={e => set('hasGST', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <label htmlFor="expHasGST" className="text-sm text-gray-700">Includes GST</label>
          </div>
          {form.hasGST && (
            <Field label="GST Amount (₹)"><input type="number" className={inputCls} placeholder="0" value={form.gstAmount} onChange={e => set('gstAmount', e.target.value)} min="0" /></Field>
          )}
          <Field label="Notes"><textarea className={inputCls} rows={2} placeholder="Optional notes..." value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>

          {/* Bill section */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 mt-1">
            <p className="text-xs font-bold text-gray-500 mb-2">Expense Bill <span className="text-red-500">* (mandatory)</span></p>
            {!form.billMode ? (
              <div className="flex flex-col gap-2">
                <button type="button" onClick={handleCapture} disabled={capturing}
                  className="w-full py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
                  <CamIcon size={16}/> {capturing ? 'Processing…' : 'Upload / Capture Bill Photo'}
                </button>
                <button type="button" onClick={() => set('billMode', 'urd')}
                  className="w-full py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform">
                  <FilePlus2 size={16}/> No Original Bill — Generate URD Self Invoice
                </button>
              </div>
            ) : form.billMode === 'uploaded' ? (
              <div className="relative">
                <img src={`data:image/jpeg;base64,${form.billImage}`} alt="Bill" className="w-full rounded-xl border border-gray-200" />
                <button type="button" onClick={() => setForm(f => ({...f, billMode:'', billImage:''}))} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow"><X size={13}/></button>
                <p className="text-xs text-green-600 font-medium mt-1.5 flex items-center gap-1"><CheckCircle2 size={12}/> Bill photo captured</p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5"><AlertTriangle size={14}/> URD — No Original Bill</p>
                  <button type="button" onClick={() => setForm(f => ({...f, billMode:''}))} className="text-gray-400"><X size={14}/></button>
                </div>
                <p className="text-xs text-amber-600 mb-3">Enter supplier details. A GST-compliant self-invoice will be stored &amp; downloadable after saving.</p>
                <Field label="Supplier / Payee Name *">
                  <input type="text" className={inputCls} placeholder="Name of supplier / payee…"
                    value={form.urdSupplierName} onChange={e => set('urdSupplierName', e.target.value)} />
                </Field>
                <Field label="Supplier Address (optional)">
                  <textarea className={inputCls} rows={2} placeholder="Full address…"
                    value={form.urdSupplierAddress} onChange={e => set('urdSupplierAddress', e.target.value)} />
                </Field>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          </div>

          <SaveBtn onClick={save} />
        </Modal>
      )}

      {/* Bill photo fullscreen viewer */}
      {viewingBill && (
        <div className="fixed inset-0 z-[300] bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="text-white font-semibold text-sm">Bill Photo</p>
            <button onClick={() => setViewingBill(null)} className="text-white p-1"><X size={22}/></button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
            <img src={`data:image/jpeg;base64,${viewingBill}`} alt="Bill" className="w-full max-w-xl rounded-xl shadow-xl" />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, msg }) {
  return (
    <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="text-gray-500 text-sm font-medium">{msg}</p>
    </div>
  );
}
