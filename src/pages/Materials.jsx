import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, Package, TrendingDown, Camera as CamIcon, FilePlus2, X, Eye, AlertTriangle, CheckCircle2, Download, Share2, Filter, Users, Receipt, Wrench, MapPin, ArrowDownCircle } from 'lucide-react';
import { fmtDate, todayISO, monthRange } from '../utils/date';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LaborTab, ExpensesTab } from './Finance';

function fmt(n) { return new Intl.NumberFormat('en-IN').format(n || 0); }
function rp(n)  { return 'Rs.' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n || 0); }

function genBillId() {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const t = (now.getTime() % 100000).toString().padStart(5, '0');
  return `URD-${d}-${t}`;
}

function freshForm() {
  return {
    date: todayISO(), materialTypeId: '', quantity: '', ratePerUnit: '', totalAmount: '',
    supplier: '', bankAccountId: '', billNumber: genBillId(), notes: '',
    billMode: '',        // 'uploaded' | 'urd' | ''
    billImage: '',       // compressed base64 JPEG
    supplierAddress: '', // for URD bill
    weightKgPerUnit: '', // kg per bag/truck/liter (auto-populated from materialType)
    weightLocked: false, // true after auto-fill; user must tap edit to change
  };
}

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
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.65).split(',')[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function buildURDPDF(purchase, matName, matUnit, ci) {
  const coName    = ci?.name    || 'UrbanMud Bricks and Blocks';
  const coAddress = ci?.address || 'Bhaktharahalli, Poojeana Agrahara,\nnear Hoskote, Bangalore - 562114';
  const coPhone   = ci?.phone   || '';
  const coGSTIN   = ci?.gstin   || '';
  const A = [146,64,14], DK = [31,41,55], MD = [107,114,128], LT = [253,230,138], AM = [146,64,14];
  const W = 210, H = 297, ML = 14, MR = 14, CW = W - ML - MR;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = ML;

  // URD Banner
  pdf.setFillColor(255, 247, 237); pdf.rect(ML, y, CW, 13, 'F');
  pdf.setDrawColor(...AM); pdf.setLineWidth(0.4); pdf.rect(ML, y, CW, 13);
  pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(...AM);
  pdf.text('SELF INVOICE — PURCHASE FROM UNREGISTERED DEALER (URD)', W/2, y+5, { align:'center' });
  pdf.setFontSize(7.5); pdf.setFont('helvetica','normal');
  pdf.text('Under Section 9(4) CGST Act 2017 / Rule 46A  |  GST payable under Reverse Charge (RCM)', W/2, y+10, { align:'center' });
  y += 17;

  // Left: company header
  const hY = y;
  pdf.setFontSize(14); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A);
  pdf.text(coName.toUpperCase(), ML, y+6); y += 10;
  pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
  coAddress.split('\n').forEach(l => { pdf.text(l, ML, y); y += 4; });
  if (coPhone) { pdf.text('Ph: '+coPhone, ML, y); y += 4; }
  if (coGSTIN) { pdf.setFont('helvetica','bold'); pdf.text('GSTIN: '+coGSTIN, ML, y); pdf.setFont('helvetica','normal'); y += 4; }

  // Right: doc meta
  const mX = W-MR; let ry = hY+7;
  pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A);
  pdf.text(purchase.billNumber||'URD-SELF', mX, ry, { align:'right' }); ry += 7;
  pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
  pdf.text('Date: '+(purchase.date||''), mX, ry, { align:'right' }); ry += 5;
  pdf.text('Self Invoice (URD)', mX, ry, { align:'right' }); ry += 5;
  pdf.text('RCM Applicable: YES', mX, ry, { align:'right' }); ry += 5;

  y = Math.max(y, ry)+4;
  pdf.setDrawColor(...A); pdf.setLineWidth(0.6); pdf.line(ML, y, W-MR, y); y += 7;

  // Buyer & Supplier
  const hW = CW/2-3;
  pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.setTextColor(...MD);
  pdf.text('BUYER', ML, y); pdf.text('SUPPLIER (UNREGISTERED DEALER)', ML+hW+6, y); y += 4;
  pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK);
  pdf.text(coName, ML, y); pdf.text(purchase.supplier||'(Name not provided)', ML+hW+6, y); y += 5;
  pdf.setFontSize(8.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
  if (purchase.supplierAddress) {
    const sl = pdf.splitTextToSize(purchase.supplierAddress, hW);
    pdf.text(sl, ML+hW+6, y); y += sl.length*4;
  }
  pdf.setFont('helvetica','bold'); pdf.setTextColor(220,38,38);
  pdf.text('GST Status: UNREGISTERED', ML+hW+6, y);
  pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD); y += 8;
  pdf.setDrawColor(...LT); pdf.setLineWidth(0.3); pdf.line(ML, y, W-MR, y); y += 6;

  // Items table
  const qty = Number(purchase.quantity)||0, rate = Number(purchase.ratePerUnit)||0;
  const total = Number(purchase.totalAmount)||qty*rate;
  autoTable(pdf, {
    startY: y, margin: { left:ML, right:MR },
    head: [['#','Description','Unit','Qty','Rate','Amount']],
    body: [[1, matName||'Raw Material', matUnit||'unit', qty, rp(rate), rp(total)]],
    headStyles: { fillColor:A, textColor:[255,255,255], fontSize:9, fontStyle:'bold', cellPadding:3.5 },
    bodyStyles: { fontSize:9, textColor:DK, cellPadding:3.5, alternateRowStyles:{ fillColor:[255,251,235] } },
    columnStyles: { 0:{cellWidth:8,halign:'center'}, 2:{cellWidth:18,halign:'center'}, 3:{cellWidth:14,halign:'right'}, 4:{cellWidth:28,halign:'right'}, 5:{cellWidth:30,halign:'right'} },
  });
  y = pdf.lastAutoTable.finalY + 7;

  // Total
  const TX = W-MR-70;
  pdf.setDrawColor(...A); pdf.setLineWidth(0.4); pdf.line(TX, y, W-MR, y); y += 4;
  pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A);
  pdf.text('TOTAL', TX, y); pdf.text(rp(total), W-MR, y, { align:'right' }); y += 8;

  // RCM note
  if (y+28>H-18) { pdf.addPage(); y=ML; }
  pdf.setFillColor(255,247,237); pdf.rect(ML,y,CW,22,'F');
  pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(...AM);
  pdf.text('REVERSE CHARGE NOTICE', ML+3, y+6);
  pdf.setFont('helvetica','normal'); pdf.setTextColor(...DK);
  const rc = 'This self-invoice is issued for purchase from an Unregistered Dealer. '+coName+' is liable to pay GST under Reverse Charge Mechanism (RCM) as per Section 9(4) of CGST Act 2017. The supplier is not registered under GST.';
  pdf.text(pdf.splitTextToSize(rc, CW-6), ML+3, y+12); y += 27;

  // Notes
  if (purchase.notes) {
    if (y+20>H-18) { pdf.addPage(); y=ML; }
    pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.setTextColor(...MD);
    pdf.text('NOTES', ML, y); y += 4;
    pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
    const nl = pdf.splitTextToSize(purchase.notes, CW); pdf.text(nl, ML, y); y += nl.length*4+5;
  }

  // Signing — Authorised Signatory only (right-aligned)
  if (y+35>H-18) { pdf.addPage(); y=ML; }
  y += 5; pdf.setDrawColor(...LT); pdf.setLineWidth(0.3); pdf.line(ML,y,W-MR,y); y += 15;
  const sw = CW/3; const sx = W-MR-sw;
  if (ci?.signature) { try { pdf.addImage(ci.signature,'PNG',sx+4,y-14,sw-8,12); } catch(e){} }
  pdf.setDrawColor(...MD); pdf.setLineWidth(0.4); pdf.line(sx,y,W-MR,y);
  pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK); pdf.text('Authorised Signatory',sx+sw/2,y+5,{align:'center'});
  pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD); pdf.text('For '+coName,sx+sw/2,y+9,{align:'center'});

  pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(...LT);
  pdf.text('Generated by Urbanmud Manufacturing Ops', W/2, H-8, { align:'center' });
  return pdf;
}

export default function Materials({ initialAction, onActionConsumed }) {
  const app = useApp();
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState(freshForm);
  const [activeTab, setActiveTab]       = useState('stock');
  const [triggerLabourAdd, setTriggerLabourAdd]   = useState(false);
  const [triggerExpenseAdd, setTriggerExpenseAdd] = useState(false);

  useEffect(() => {
    if (!initialAction) return;
    if (initialAction === 'new_purchase')      { setActiveTab('purchases'); setShowModal(true);           onActionConsumed?.(); }
    else if (initialAction === 'tab_labour_add')  { setActiveTab('labour');   setTriggerLabourAdd(true);   onActionConsumed?.(); }
    else if (initialAction === 'tab_expenses_add'){ setActiveTab('expenses');  setTriggerExpenseAdd(true);  onActionConsumed?.(); }
    else {
      const map = { tab_stock: 'stock', tab_purchases: 'purchases', tab_labour: 'labour', tab_expenses: 'expenses' };
      if (map[initialAction]) { setActiveTab(map[initialAction]); onActionConsumed?.(); }
    }
  }, [initialAction]);
  const [capturing, setCapturing]     = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [vBusy, setVBusy] = useState(false);
  const fileRef = useRef(null);
  const [filterFrom, setFilterFrom] = useState(() => monthRange().from);
  const [filterTo, setFilterTo]     = useState(() => monthRange().to);
  const [filterMat, setFilterMat]   = useState('');

  function openAddForMaterial(matId) {
    const f = freshForm();
    f.materialTypeId = matId;
    const mat = app.materialTypes.find(m => m.id === matId);
    const wpu = parseFloat(mat?.weightKgPerUnit) || 0;
    if (wpu > 0) { f.weightKgPerUnit = String(wpu); f.weightLocked = true; }
    setForm(f);
    setShowModal(true);
  }

  function set(k, v) {
    setForm(f => {
      const updated = { ...f, [k]: v };
      if (k === 'quantity' || k === 'ratePerUnit') {
        const qty  = parseFloat(k === 'quantity'    ? v : f.quantity)    || 0;
        const rate = parseFloat(k === 'ratePerUnit' ? v : f.ratePerUnit) || 0;
        if (qty > 0 && rate > 0) updated.totalAmount = String(qty * rate);
      }
      if (k === 'materialTypeId') {
        const mat = app.materialTypes.find(m => m.id === v);
        const wpu = parseFloat(mat?.weightKgPerUnit) || 0;
        if (wpu > 0) { updated.weightKgPerUnit = String(wpu); updated.weightLocked = true; }
        else { updated.weightKgPerUnit = ''; updated.weightLocked = false; }
      }
      return updated;
    });
  }

  async function handleCapture() {
    setCapturing(true);
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({ resultType: CameraResultType.Base64, source: CameraSource.Prompt, quality: 65, width: 1200 });
      set('billImage', photo.base64String); set('billMode', 'uploaded');
    } catch {
      fileRef.current?.click();
    } finally { setCapturing(false); }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturing(true);
    try {
      const b64 = await compressImage(file);
      set('billImage', b64); set('billMode', 'uploaded');
    } catch (err) { alert('Could not process image: ' + err.message); }
    finally { setCapturing(false); e.target.value = ''; }
  }

  async function shareOrDownloadPhoto(base64JPEG, filename) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const result = await Filesystem.writeFile({ path: filename, data: base64JPEG, directory: Directory.Cache });
      await Share.share({ title: filename, url: result.uri, dialogTitle: 'Share / Save Photo' });
    } catch (err) {
      try {
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${base64JPEG}`; link.download = filename; link.click();
      } catch (e2) {
        alert('Could not save/share: ' + (err?.message || err));
      }
    }
  }

  async function shareURDPDF(purchase) {
    try {
      const mat = app.materialTypes.find(m => m.id === purchase.materialTypeId);
      const pdf = buildURDPDF(purchase, mat?.name, mat?.unit, app.companyInfo || {});
      const blob = pdf.output('blob');
      const filename = `${purchase.billNumber || 'URD'}.pdf`;
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
        const result = await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
        await Share.share({ title: filename, url: result.uri, dialogTitle: 'Share URD Bill' });
      } catch {
        pdf.save(filename);
      }
    } catch (err) {
      alert('Failed to generate PDF: ' + (err?.message || err));
    }
  }

  function save() {
    if (!form.materialTypeId)  return alert('Material type is required.');
    if (!form.quantity)        return alert('Quantity is required.');
    if (!form.ratePerUnit)     return alert('Rate per unit is required.');
    if (!form.totalAmount)     return alert('Total amount is required.');
    if (!form.weightKgPerUnit) return alert('Weight per unit is required for stock tracking.');
    if (!form.supplier)        return alert('Supplier name is required.');
    if (!form.bankAccountId)   return alert('Payment account is required.');
    if (!form.notes?.trim())   return alert('Notes is required.');
    if (!form.billMode) return alert('Bill is mandatory. Please upload a bill photo or select "No Bill (URD)".');
    app.addItem('materialPurchases', form);
    setForm({ ...freshForm(), date: form.date });
    setShowModal(false);
  }

  function getStock(materialTypeId) {
    const purchased = app.materialPurchases
      .filter(p => p.materialTypeId === materialTypeId)
      .reduce((s, p) => s + Number(p.quantity || 0), 0);
    const consumed = app.productionEntries
      .flatMap(e => e.materialsUsed || [])
      .filter(mu => mu.materialTypeId === materialTypeId)
      .reduce((s, mu) => s + Number(mu.qtyUsed || 0), 0);
    return purchased - consumed;
  }

  const filteredPurchases = [...app.materialPurchases]
    .filter(p => (!filterFrom || p.date >= filterFrom) && (!filterTo || p.date <= filterTo))
    .filter(p => !filterMat || p.materialTypeId === filterMat)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <Header
        title="Purchases"
        subtitle="Materials · Production Team · Installation · Expenses"
        action={
          <button
            onClick={() => { setForm(freshForm()); setShowModal(true); }}
            className="bg-white/20 hover:bg-white/30 text-white rounded-xl px-2.5 py-1.5 flex flex-col items-center gap-0.5"
          >
            <Plus size={16} />
            <span className="text-[9px] font-semibold leading-none">Purchase</span>
          </button>
        }
      />

      <div className="px-4 pt-3 pb-1">
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4 gap-0.5">
          {[
            { id: 'stock',     label: 'Stock'     },
            { id: 'purchases', label: 'Purchases' },
            { id: 'labour',       label: 'Production Team' },
            { id: 'installation',  label: 'Installation'    },
            { id: 'expenses',      label: 'Expenses'        },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pb-4">

        {activeTab === 'stock' && (() => {
          const stockItems = app.materialTypes.map(mat => {
            const kgPerUnit = Number(mat.weightKgPerUnit || 0);
            const unit = (mat.unit || '').toLowerCase();
            const purchased = app.materialPurchases
              .filter(p => p.materialTypeId === mat.id)
              .reduce((s, p) => s + Number(p.quantity || 0), 0);
            const consumedQty = app.productionEntries
              .flatMap(e => e.materialsUsed || [])
              .filter(mu => mu.materialTypeId === mat.id)
              .reduce((s, mu) => s + Number(mu.qtyUsed || 0), 0);
            const consumedKg = app.productionEntries
              .flatMap(e => e.materialsUsed || [])
              .filter(mu => mu.materialTypeId === mat.id)
              .reduce((s, mu) => s + Number(mu.kgUsed || 0), 0);

            let stockLabel, stockVal, pct = 0;
            if (unit === 'trucks') {
              const effectiveKg = kgPerUnit > 0 ? kgPerUnit : 30000;
              const purchasedT = (purchased * effectiveKg) / 1000;
              const consumedT = consumedKg / 1000;
              const availT = Math.max(0, purchasedT - consumedT);
              stockLabel = `${availT.toFixed(2)} T`;
              stockVal = availT;
              pct = purchasedT > 0 ? Math.min(100, (availT / purchasedT) * 100) : 0;
            } else if (unit === 'bags') {
              const avail = Math.max(0, purchased - consumedQty);
              stockLabel = `${fmt(Math.round(avail))} bags`;
              stockVal = avail;
              pct = purchased > 0 ? Math.min(100, (avail / purchased) * 100) : 0;
            } else if (unit === 'liters' || unit === 'litres') {
              const avail = Math.max(0, purchased - consumedQty);
              stockLabel = `${fmt(avail)} L`;
              stockVal = avail;
              pct = purchased > 0 ? Math.min(100, (avail / purchased) * 100) : 0;
            } else {
              const avail = Math.max(0, purchased - consumedQty);
              stockLabel = `${avail >= 1000 ? (avail / 1000).toFixed(2) + ' T' : fmt(avail) + ' ' + mat.unit}`;
              stockVal = avail;
              pct = purchased > 0 ? Math.min(100, (avail / purchased) * 100) : 0;
            }
            return { mat, stockLabel, stockVal, pct, purchased };
          });

          return (
            <div className="grid grid-cols-2 gap-2">
              {stockItems.map(({ mat, stockLabel, stockVal, pct, purchased }) => (
                <div key={mat.id} onClick={() => openAddForMaterial(mat.id)}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 cursor-pointer active:scale-95 transition-transform hover:border-amber-300">
                  <p className="text-xs font-semibold text-gray-600 truncate mb-1">{mat.name}</p>
                  <p className={`text-lg font-bold leading-tight ${stockVal > 0 ? 'text-gray-800' : 'text-red-500'}`}>{stockLabel}</p>
                  <p className="text-[10px] text-gray-400 mb-1.5">available</p>
                  {purchased > 0 && (
                    <div className="w-full bg-gray-100 rounded-full h-1">
                      <div className={`h-1 rounded-full transition-all ${stockVal > 0 ? 'bg-amber-500' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {activeTab === 'purchases' && (
          <div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Filter size={12} className="text-amber-700" />
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Filter</span>
                <span className="ml-auto text-xs text-gray-400">{filteredPurchases.length} purchase{filteredPurchases.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className={inputCls} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
                <input type="date" className={inputCls} value={filterTo}   onChange={e => setFilterTo(e.target.value)} />
                <select className={`${selectCls} col-span-2`} value={filterMat} onChange={e => setFilterMat(e.target.value)}>
                  <option value="">All Material Types</option>
                  {app.materialTypes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            {/* Summary tile */}
            {filteredPurchases.length > 0 && (() => {
              const totalSpend = filteredPurchases.reduce((s, p) => s + Number(p.totalAmount || 0), 0);
              const byMat = app.materialTypes.map(m => ({
                name: m.name, unit: m.unit,
                qty: filteredPurchases.filter(p => p.materialTypeId === m.id).reduce((s, p) => s + Number(p.quantity || 0), 0),
                spend: filteredPurchases.filter(p => p.materialTypeId === m.id).reduce((s, p) => s + Number(p.totalAmount || 0), 0),
              })).filter(m => m.qty > 0);
              return (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-amber-800">Period Summary</p>
                    <p className="text-sm font-bold text-red-600">₹{new Intl.NumberFormat('en-IN').format(totalSpend)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {byMat.map(m => (
                      <div key={m.name} className="bg-white rounded-lg px-2.5 py-1.5">
                        <p className="text-[10px] text-gray-500 truncate">{m.name}</p>
                        <p className="text-xs font-bold text-gray-800">{new Intl.NumberFormat('en-IN').format(m.qty)} {m.unit}</p>
                        <p className="text-[10px] text-gray-400">₹{new Intl.NumberFormat('en-IN').format(m.spend)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {filteredPurchases.length === 0 ? (
              <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100">
                <Package size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">No purchases in this range</p>
                <p className="text-gray-400 text-xs mt-1">Adjust the date filter or tap + to add</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPurchases.map(p => {
                  const mat = app.materialTypes.find(m => m.id === p.materialTypeId);
                  const account = app.bankAccounts.find(b => b.id === p.bankAccountId);
                  return (
                    <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{mat?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(p.date)}</p>
                          {p.supplier && <p className="text-xs text-gray-500 mt-1">Supplier: {p.supplier}</p>}
                          {p.billNumber && <p className="text-xs text-gray-500">Bill #: {p.billNumber}</p>}
                          {account && <p className="text-xs text-gray-500">Via: {account.name}</p>}
                        </div>
                        <div className="text-right ml-3">
                          <p className="text-lg font-bold text-gray-800">{fmt(p.quantity)}</p>
                          <p className="text-xs text-gray-400">{mat?.unit}</p>
                          {p.ratePerUnit && <p className="text-xs text-gray-400">@ ₹{fmt(p.ratePerUnit)}/{app.materialTypes.find(m=>m.id===p.materialTypeId)?.unit||'unit'}</p>}
                          {p.totalAmount && (
                            <p className="text-sm font-semibold text-red-600 mt-1">₹{fmt(p.totalAmount)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                        <div className="flex items-center gap-1.5">
                          {p.billMode === 'uploaded' ? (
                            <span className="text-[9px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                              <CheckCircle2 size={9}/> Bill
                            </span>
                          ) : p.billMode === 'urd' ? (
                            <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                              <FilePlus2 size={9}/> URD
                            </span>
                          ) : (
                            <span className="text-[9px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                              <AlertTriangle size={9}/> No Bill
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {(p.billMode === 'uploaded' || p.billMode === 'urd') && (
                            <button onClick={() => setViewingPurchase(p)}
                              className="flex items-center gap-1 text-blue-600 text-xs font-bold px-2.5 py-1.5 border border-blue-200 rounded-lg bg-blue-50 active:scale-95 transition-transform">
                              <Eye size={13}/> View
                            </button>
                          )}
                          <button onClick={() => { if (confirm('Delete this purchase?')) app.deleteItem('materialPurchases', p.id); }}
                            className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'labour' && <LaborTab triggerAdd={triggerLabourAdd} onTriggerConsumed={() => setTriggerLabourAdd(false)} />}
        {activeTab === 'installation' && <InstallationTab />}
        {activeTab === 'expenses' && <ExpensesTab triggerAdd={triggerExpenseAdd} onTriggerConsumed={() => setTriggerExpenseAdd(false)} />}
      </div>

      {showModal && (
        <Modal title="Add Material Purchase" onClose={() => setShowModal(false)}>
          <Field label="Date" required>
            <input type="date" className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          <Field label="Material Type" required>
            <select className={selectCls} value={form.materialTypeId} onChange={e => set('materialTypeId', e.target.value)}>
              <option value="">Select material...</option>
              {app.materialTypes.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
              ))}
            </select>
          </Field>
          {(() => {
            const mat = app.materialTypes.find(m => m.id === form.materialTypeId);
            const unitLabel = mat?.unit || 'unit';
            return (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantity" required>
                    <input type="number" className={inputCls} placeholder="0" value={form.quantity}
                      onChange={e => set('quantity', e.target.value)} min="0" />
                  </Field>
                  <Field label={`Rate per ${unitLabel} (₹)`} required>
                    <input type="number" className={inputCls} placeholder="0" value={form.ratePerUnit}
                      onChange={e => set('ratePerUnit', e.target.value)} min="0" />
                  </Field>
                </div>
                <Field label="Total Amount (₹) — auto-calculated" required>
                  <input type="number" className={inputCls} placeholder="Auto-filled or enter manually" value={form.totalAmount}
                    onChange={e => set('totalAmount', e.target.value)} min="0" />
                </Field>
                <Field label="Weight per unit (kg)" required>
                  <div className="relative">
                    <input type="number" min="0" step="any"
                      className={`${inputCls} ${form.weightLocked ? 'bg-gray-50 text-gray-500 pr-20' : ''}`}
                      placeholder="e.g. 50 for a cement bag"
                      value={form.weightKgPerUnit}
                      readOnly={form.weightLocked}
                      onChange={e => !form.weightLocked && set('weightKgPerUnit', e.target.value)} />
                    {form.weightLocked
                      ? <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-semibold"
                          onClick={() => setForm(f => ({ ...f, weightLocked: false }))}>Edit</button>
                      : form.weightKgPerUnit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">kg/{unitLabel?.replace(/s$/, '') || 'unit'}</span>
                    }
                  </div>
                </Field>
              </>
            );
          })()}
          <Field label="Supplier" required>
            <input type="text" className={inputCls} placeholder="Supplier name..." value={form.supplier}
              onChange={e => set('supplier', e.target.value)} />
          </Field>
          <Field label="Bill Number (auto-generated)">
            <input type="text" className={inputCls} value={form.billNumber}
              onChange={e => set('billNumber', e.target.value)} />
          </Field>
          <Field label="Payment Account" required>
            <select className={selectCls} value={form.bankAccountId} onChange={e => set('bankAccountId', e.target.value)}>
              <option value="">Select account...</option>
              {app.bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Notes" required>
            <textarea className={inputCls} rows={2} placeholder="e.g. supplier contact, vehicle no, remarks..." value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </Field>

          {/* Bill section */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 mt-1">
            <p className="text-xs font-bold text-gray-500 mb-2">Purchase Bill <span className="text-red-500">* (mandatory)</span></p>
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
                <button type="button" onClick={() => setForm(f => ({...f, billMode:'', billImage:''}))}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow">
                  <X size={13}/>
                </button>
                <p className="text-xs text-green-600 font-medium mt-1.5 flex items-center gap-1"><CheckCircle2 size={12}/> Bill photo captured</p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5"><AlertTriangle size={14}/> URD — No Original Bill</p>
                  <button type="button" onClick={() => setForm(f => ({...f, billMode:''}))} className="text-gray-400"><X size={14}/></button>
                </div>
                <p className="text-xs text-amber-600 mb-2">A GST-compliant self-invoice (URD) will be generated & downloadable.</p>
                <Field label="Supplier Address (optional, for URD bill)">
                  <textarea className={inputCls} rows={2} placeholder="Supplier full address…"
                    value={form.supplierAddress} onChange={e => set('supplierAddress', e.target.value)} />
                </Field>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          </div>

          <SaveBtn onClick={save} />
        </Modal>
      )}

      {/* Bill / URD viewer */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-[300] bg-gray-50 flex flex-col">
          <div className="flex items-center gap-2 px-3 py-3 bg-white border-b border-gray-100 shadow-sm shrink-0">
            <button onClick={() => setViewingPurchase(null)} className="p-1.5 text-gray-600"><X size={20}/></button>
            <span className="flex-1 font-bold text-gray-800 text-sm truncate">
              {viewingPurchase.billMode === 'uploaded' ? 'Bill Photo' : 'URD Self Invoice'}
            </span>
            {viewingPurchase.billMode === 'uploaded' && (
              <>
                <button onClick={async () => { setVBusy(true); try { await shareOrDownloadPhoto(viewingPurchase.billImage, `BillPhoto-${viewingPurchase.date}.jpg`); } finally { setVBusy(false); } }}
                  disabled={vBusy}
                  className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50 active:scale-95">
                  <Download size={13}/> Save
                </button>
                <button onClick={async () => { setVBusy(true); try { await shareOrDownloadPhoto(viewingPurchase.billImage, `BillPhoto-${viewingPurchase.date}.jpg`); } finally { setVBusy(false); } }}
                  disabled={vBusy}
                  className="flex items-center gap-1.5 bg-purple-600 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50 active:scale-95">
                  <Share2 size={13}/> Share
                </button>
              </>
            )}
            {viewingPurchase.billMode === 'urd' && (
              <>
                <button onClick={async () => { setVBusy(true); try { await shareURDPDF(viewingPurchase); } finally { setVBusy(false); } }}
                  disabled={vBusy}
                  className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50 active:scale-95">
                  <Download size={13}/> Save
                </button>
                <button onClick={async () => { setVBusy(true); try { await shareURDPDF(viewingPurchase); } finally { setVBusy(false); } }}
                  disabled={vBusy}
                  className="flex items-center gap-1.5 bg-purple-600 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50 active:scale-95">
                  <Share2 size={13}/> Share
                </button>
              </>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {viewingPurchase.billMode === 'uploaded' && (
              <img src={`data:image/jpeg;base64,${viewingPurchase.billImage}`} alt="Bill" className="w-full rounded-xl shadow-xl" />
            )}
            {viewingPurchase.billMode === 'urd' && (() => {
              const mat = app.materialTypes.find(m => m.id === viewingPurchase.materialTypeId);
              const account = app.bankAccounts.find(b => b.id === viewingPurchase.bankAccountId);
              return (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-amber-800 px-4 pt-4 pb-3">
                    <p className="font-bold text-white">{app.companyInfo?.name || 'UrbanMud Bricks and Blocks'}</p>
                    <p className="text-amber-200 text-xs mt-0.5 whitespace-pre-line">{app.companyInfo?.address || 'Bhaktharahalli, near Hoskote, Bangalore - 562114'}</p>
                  </div>
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-center text-sm font-bold py-2 rounded-xl bg-amber-100 text-amber-800">URD Self Invoice — Purchase from Unregistered Dealer</p>
                  </div>
                  <div className="px-4 py-4 space-y-3">
                    {[['Bill No.', viewingPurchase.billNumber], ['Date', viewingPurchase.date], ['Material', mat?.name], ['Quantity', `${viewingPurchase.quantity} ${mat?.unit||''}`], ['Rate', viewingPurchase.ratePerUnit ? `₹${viewingPurchase.ratePerUnit}/${mat?.unit}` : null], ['Supplier', viewingPurchase.supplier], ['Account', account?.name], ['Notes', viewingPurchase.notes]].filter(([,v]) => v).map(([l,v],i) => (
                      <div key={i} className="flex justify-between items-start gap-3">
                        <span className="text-xs text-gray-500 shrink-0 w-28">{l}</span>
                        <span className="text-xs font-semibold text-gray-800 text-right flex-1">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mx-4 mb-4 pt-3 border-t-2 border-amber-700 flex justify-between items-center">
                    <span className="font-bold text-gray-800">Total Amount</span>
                    <span className="text-xl font-bold text-amber-800">₹{viewingPurchase.totalAmount ? new Intl.NumberFormat('en-IN').format(viewingPurchase.totalAmount) : '—'}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Installation Tab
// ─────────────────────────────────────────────────────────────────────────────

function genInstallBillId() {
  const now = new Date();
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const t = (now.getTime() % 100000).toString().padStart(5, '0');
  return `INST-${d}-${t}`;
}

function buildInstallationPaymentPDF(payment, job, team, ci) {
  const coName    = ci?.name    || 'UrbanMud Bricks and Blocks';
  const coAddress = ci?.address || 'Bhaktharahalli, Poojeana Agrahara,\nnear Hoskote, Bangalore - 562114';
  const coPhone   = ci?.phone   || '';
  const A = [13,148,136], DK = [31,41,55], MD = [107,114,128], LT = [167,243,208];
  const W = 210, ML = 14, MR = 14, CW = W - ML - MR;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = ML;

  pdf.setFillColor(240,253,250); pdf.rect(ML, y, CW, 12, 'F');
  pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A);
  pdf.text('INSTALLATION PAYMENT VOUCHER', W/2, y+8, { align:'center' });
  y += 16;

  pdf.setFontSize(14); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A);
  pdf.text(coName.toUpperCase(), ML, y); y += 7;
  pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
  coAddress.split('\n').forEach(l => { pdf.text(l, ML, y); y += 4; });
  if (coPhone) { pdf.text('Ph: '+coPhone, ML, y); y += 4; }

  pdf.setDrawColor(...A); pdf.setLineWidth(0.5); pdf.line(ML, y+2, W-MR, y+2); y += 8;

  const rows = [
    ['Voucher No.',   payment.billNumber || '—'],
    ['Date',          payment.date       || '—'],
    ['Installation Team', team?.name     || '—'],
    ['Project / Client',  (job?.projectName || job?.clientName) || '—'],
    ['Client Name',   job?.clientName    || '—'],
    ['Location',      job?.location      || '—'],
    ['Price / Sqft',  job?.pricePerSqft ? `Rs.${fmt(job.pricePerSqft)}` : '—'],
    ['Total Area',    job?.totalArea     ? `${fmt(job.totalArea)} sqft`  : '—'],
    ['Job Value',     job?.totalAmount   ? rp(job.totalAmount)           : '—'],
    ['Notes',         payment.notes      || '—'],
  ];
  autoTable(pdf, {
    startY: y, margin: { left: ML, right: MR },
    head: [['Field', 'Details']],
    body: rows,
    headStyles: { fillColor: A, textColor: [255,255,255], fontSize: 9, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 9, textColor: DK, cellPadding: 3, alternateRowStyles: { fillColor: [240,253,250] } },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' } },
  });
  y = pdf.lastAutoTable.finalY + 8;

  pdf.setDrawColor(...A); pdf.setLineWidth(0.4); pdf.line(W-MR-70, y, W-MR, y); y += 5;
  pdf.setFontSize(13); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A);
  pdf.text('AMOUNT PAID', W-MR-70, y);
  pdf.text(rp(payment.amount), W-MR, y, { align: 'right' }); y += 12;

  const sw = CW/3; const sx = W-MR-sw;
  if (ci?.signature) { try { pdf.addImage(ci.signature,'PNG',sx+4,y-4,sw-8,10); } catch {} }
  pdf.setDrawColor(...MD); pdf.setLineWidth(0.4); pdf.line(sx, y+8, W-MR, y+8);
  pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(DK[0],DK[1],DK[2]);
  pdf.text('Authorised Signatory', sx+sw/2, y+13, { align:'center' });

  pdf.setFontSize(7); pdf.setTextColor(...LT);
  pdf.text('Generated by Urbanmud Manufacturing Ops', W/2, 287, { align:'center' });
  return pdf;
}

async function shareInstallPDF(pdf, filename) {
  const blob = pdf.output('blob');
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
    const result = await Filesystem.writeFile({ path: filename, data: b64, directory: Directory.Cache });
    await Share.share({ title: filename, url: result.uri });
  } catch { pdf.save(filename); }
}

const INSTALL_STATUS = [
  { id: 'yet_to_start', label: 'Yet to Start',  color: 'bg-gray-100 text-gray-600'  },
  { id: 'pending',      label: 'Pending',        color: 'bg-amber-100 text-amber-700' },
  { id: 'in_progress',  label: 'In Progress',    color: 'bg-blue-100 text-blue-700'  },
  { id: 'completed',    label: 'Completed',       color: 'bg-green-100 text-green-700'},
];

function emptyJob() {
  return { date: todayISO(), installationTeamId: '', clientName: '', projectName: '', location: '', productId: '', pricePerSqft: '', totalArea: '', status: 'pending', notes: '' };
}
function emptyPay() {
  return { date: todayISO(), amount: '', bankAccountId: '', notes: '', billNumber: genInstallBillId() };
}

export function InstallationTab() {
  const app = useApp();
  const [showJobModal, setShowJobModal]   = useState(false);
  const [editingJob, setEditingJob]       = useState(null);
  const [jobForm, setJobForm]             = useState(emptyJob);
  const [showPayModal, setShowPayModal]   = useState(false);
  const [payJob, setPayJob]               = useState(null);
  const [payForm, setPayForm]             = useState(emptyPay);
  const [viewingPay, setViewingPay]       = useState(null);
  const [vBusy, setVBusy]                 = useState(false);
  const [filterFrom, setFilterFrom]       = useState(() => monthRange().from);
  const [filterTo, setFilterTo]           = useState(() => monthRange().to);
  const [filterTeam, setFilterTeam]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterSearch, setFilterSearch]   = useState('');

  const jobs = (app.installationJobs || []);
  const payments = (app.installationPayments || []);
  const teams = (app.installationTeams || []);

  function setJF(k, v) {
    setJobForm(f => {
      const u = { ...f, [k]: v };
      if (k === 'pricePerSqft' || k === 'totalArea') {
        const p = parseFloat(k === 'pricePerSqft' ? v : f.pricePerSqft) || 0;
        const a = parseFloat(k === 'totalArea'     ? v : f.totalArea)     || 0;
        if (p > 0 && a > 0) u.totalAmount = String((p * a).toFixed(2));
        else u.totalAmount = '';
      }
      return u;
    });
  }
  function setPF(k, v) { setPayForm(f => ({ ...f, [k]: v })); }

  function openAddJob() {
    const base = emptyJob();
    if (teams.length === 1) base.installationTeamId = teams[0].id;
    if ((app.products||[]).length === 1) base.productId = (app.products||[])[0].id;
    setEditingJob(null); setJobForm(base); setShowJobModal(true);
  }
  function openEditJob(job) { setEditingJob(job); setJobForm({ ...emptyJob(), ...job }); setShowJobModal(true); }

  function saveJob() {
    if (!jobForm.installationTeamId) return alert('Installation Team is required.');
    if (!jobForm.clientName.trim())  return alert('Client Name is required.');
    if (!jobForm.totalArea)          return alert('Total Area is required.');
    const totalAmount = (parseFloat(jobForm.pricePerSqft)||0) * (parseFloat(jobForm.totalArea)||0);
    const entry = { ...jobForm, totalAmount: totalAmount.toFixed(2) };
    if (editingJob) app.updateItem('installationJobs', editingJob.id, entry);
    else app.addItem('installationJobs', entry);
    setShowJobModal(false);
  }

  function openPay(job) {
    const base = emptyPay();
    if ((app.bankAccounts||[]).length === 1) base.bankAccountId = (app.bankAccounts||[])[0].id;
    setPayJob(job); setPayForm(base); setShowPayModal(true);
  }
  function savePay() {
    if (!payForm.amount) return alert('Amount is required.');
    app.addItem('installationPayments', { ...payForm, jobId: payJob.id, installationTeamId: payJob.installationTeamId });
    setShowPayModal(false);
  }

  // Summary per team
  const teamSummary = teams.map(t => {
    const tJobs = jobs.filter(j => j.installationTeamId === t.id);
    const totalValue = tJobs.reduce((s, j) => s + Number(j.totalAmount || 0), 0);
    const totalPaid  = payments.filter(p => p.installationTeamId === t.id).reduce((s, p) => s + Number(p.amount || 0), 0);
    const balance    = totalValue - totalPaid;
    return { ...t, totalValue, totalPaid, balance };
  }).filter(t => t.totalValue > 0 || t.totalPaid > 0);

  const statusMap = Object.fromEntries(INSTALL_STATUS.map(s => [s.id, s]));

  const filtered = [...jobs]
    .filter(j => { const d = j.date || todayISO(); return (!filterFrom || d >= filterFrom) && (!filterTo || d <= filterTo); })
    .filter(j => !filterTeam   || j.installationTeamId === filterTeam)
    .filter(j => !filterStatus || j.status === filterStatus)
    .filter(j => !filterSearch || `${j.clientName} ${j.projectName} ${j.location}`.toLowerCase().includes(filterSearch.toLowerCase()))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="px-4 py-4">

      {/* ── Summary widgets ─── */}
      {teamSummary.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Team Summary</p>
          {teamSummary.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
                    <Wrench size={13} className="text-teal-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.balance > 0.5 ? 'bg-red-100 text-red-700' : t.balance < -0.5 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {t.balance > 0.5 ? `Due ₹${fmt(t.balance)}` : t.balance < -0.5 ? `Overpaid ₹${fmt(-t.balance)}` : 'Settled'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
                <div><p className="text-gray-400">Job Value</p><p className="font-bold text-gray-800">₹{fmt(t.totalValue)}</p></div>
                <div><p className="text-gray-400">Paid</p><p className="font-bold text-green-700">₹{fmt(t.totalPaid)}</p></div>
                <div><p className="text-gray-400">Balance</p><p className={`font-bold ${t.balance > 0 ? 'text-red-600' : 'text-green-700'}`}>₹{fmt(Math.abs(t.balance))}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Header & Add button ─── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">Installation Jobs</p>
        <button onClick={openAddJob} className="flex items-center gap-1 bg-teal-600 text-white text-xs font-semibold px-3 py-2 rounded-xl">
          <Plus size={14} /> Add Job
        </button>
      </div>

      {/* ── Filters ─── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Filter size={12} className="text-teal-600" />
          <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Filter</span>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className={inputCls} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          <input type="date" className={inputCls} value={filterTo}   onChange={e => setFilterTo(e.target.value)} />
          <select className={selectCls} value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
            <option value="">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className={selectCls} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {INSTALL_STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <input type="search" placeholder="Search client / project / location…" className={`${inputCls} col-span-2`}
            value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
        </div>
      </div>

      {/* ── Job cards ─── */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-300">
          <Wrench size={40} className="mx-auto mb-2" />
          <p className="text-sm font-medium">No installation jobs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(job => {
            const team    = teams.find(t => t.id === job.installationTeamId);
            const product = (app.products||[]).find(p => p.id === job.productId);
            const jobPays = payments.filter(p => p.jobId === job.id);
            const totalPaid = jobPays.reduce((s, p) => s + Number(p.amount || 0), 0);
            const balance   = Number(job.totalAmount || 0) - totalPaid;
            const st = statusMap[job.status] || statusMap['pending'];
            return (
              <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 items-center mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      {team && <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">{team.name}</span>}
                    </div>
                    <p className="font-semibold text-gray-800 truncate">{job.clientName}{job.projectName && job.projectName !== job.clientName ? ` · ${job.projectName}` : ''}</p>
                    {job.location && <p className="text-xs text-gray-400 flex items-center gap-0.5"><MapPin size={10}/>{job.location}</p>}
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-base font-bold text-gray-800">₹{fmt(job.totalAmount)}</p>
                    <p className="text-xs text-green-600">Paid: ₹{fmt(totalPaid)}</p>
                    {balance > 0.5 && <p className="text-xs text-red-500">Due: ₹{fmt(balance)}</p>}
                  </div>
                </div>

                {/* Details row */}
                <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-gray-50 pt-2 mb-2">
                  {product && <span>{product.name}</span>}
                  {job.pricePerSqft && <span>₹{fmt(job.pricePerSqft)}/sqft</span>}
                  {job.totalArea && <span>{fmt(job.totalArea)} sqft</span>}
                  <span>{fmtDate(job.date)}</span>
                </div>

                {/* Payment history */}
                {jobPays.length > 0 && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2 space-y-1">
                    {jobPays.slice(-3).map(p => {
                      const acc = (app.bankAccounts||[]).find(b => b.id === p.bankAccountId);
                      return (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{fmtDate(p.date)}{acc ? ` · ${acc.name}` : ''}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-green-700">+₹{fmt(p.amount)}</span>
                            <button onClick={() => setViewingPay({ p, job, team })}
                              className="text-blue-600 text-[10px] font-bold px-1.5 py-0.5 border border-blue-200 rounded bg-blue-50">
                              <Eye size={10} className="inline mr-0.5"/>Receipt
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {jobPays.length > 3 && <p className="text-[10px] text-gray-400">{jobPays.length - 3} more…</p>}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openPay(job)}
                    className="flex items-center gap-1 bg-teal-50 text-teal-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-teal-200">
                    <ArrowDownCircle size={12}/> Add Payment
                  </button>
                  <button onClick={() => openEditJob(job)}
                    className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200">
                    Edit Job
                  </button>
                  {/* Status quick-update */}
                  <select value={job.status}
                    onChange={e => app.updateItem('installationJobs', job.id, { status: e.target.value })}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600">
                    {INSTALL_STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <button onClick={() => { if (confirm('Delete this job and all its payments?')) { payments.filter(p => p.jobId === job.id).forEach(p => app.deleteItem('installationPayments', p.id)); app.deleteItem('installationJobs', job.id); }}}
                    className="ml-auto text-gray-300 hover:text-red-400 p-1"><Trash2 size={15}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Job Modal ─── */}
      {showJobModal && (
        <Modal title={editingJob ? 'Edit Installation Job' : 'Add Installation Job'} onClose={() => setShowJobModal(false)}>
          <Field label="Date" required>
            <input type="date" className={inputCls} value={jobForm.date} onChange={e => setJF('date', e.target.value)} />
          </Field>
          <Field label="Installation Team" required>
            <select className={selectCls} value={jobForm.installationTeamId} onChange={e => setJF('installationTeamId', e.target.value)}>
              <option value="">Select team…</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client Name" required>
              <input className={inputCls} placeholder="Customer name…" value={jobForm.clientName} onChange={e => setJF('clientName', e.target.value)} />
            </Field>
            <Field label="Project Name">
              <input className={inputCls} placeholder="Site / project…" value={jobForm.projectName} onChange={e => setJF('projectName', e.target.value)} />
            </Field>
          </div>
          <Field label="Location">
            <input className={inputCls} placeholder="Address / area…" value={jobForm.location} onChange={e => setJF('location', e.target.value)} />
          </Field>
          <Field label="Product">
            <select className={selectCls} value={jobForm.productId} onChange={e => setJF('productId', e.target.value)}>
              <option value="">Select product…</option>
              {(app.productCategories||[]).map(cat => (
                <optgroup key={cat.id} label={cat.name}>
                  {(app.products||[]).filter(p => p.categoryId === cat.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price per Sqft (₹)">
              <input type="number" className={inputCls} placeholder="0.00" value={jobForm.pricePerSqft} onChange={e => setJF('pricePerSqft', e.target.value)} min="0" />
            </Field>
            <Field label="Total Area (sqft)" required>
              <input type="number" className={inputCls} placeholder="0" value={jobForm.totalArea} onChange={e => setJF('totalArea', e.target.value)} min="0" />
            </Field>
          </div>
          {jobForm.totalArea && jobForm.pricePerSqft && (
            <div className="bg-teal-50 rounded-lg px-3 py-2 mb-3 flex justify-between text-sm">
              <span className="text-gray-600">Total Amount</span>
              <span className="font-bold text-teal-700">₹{fmt((parseFloat(jobForm.pricePerSqft)||0)*(parseFloat(jobForm.totalArea)||0))}</span>
            </div>
          )}
          <Field label="Fitting Completion Status" required>
            <select className={selectCls} value={jobForm.status} onChange={e => setJF('status', e.target.value)}>
              {INSTALL_STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} placeholder="Any remarks…" value={jobForm.notes} onChange={e => setJF('notes', e.target.value)} />
          </Field>
          <SaveBtn onClick={saveJob} label={editingJob ? 'Update Job' : 'Add Job'} />
        </Modal>
      )}

      {/* ── Add Payment Modal ─── */}
      {showPayModal && payJob && (
        <Modal title={`Add Payment — ${payJob.clientName}`} onClose={() => setShowPayModal(false)}>
          <div className="bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 mb-3">
            <p className="text-xs font-semibold text-teal-800">{payJob.clientName}{payJob.projectName ? ` · ${payJob.projectName}` : ''}</p>
            <p className="text-xs text-teal-600">Job Value: ₹{fmt(payJob.totalAmount)}</p>
          </div>
          <Field label="Date" required>
            <input type="date" className={inputCls} value={payForm.date} onChange={e => setPF('date', e.target.value)} />
          </Field>
          <Field label="Voucher No.">
            <input className={inputCls} value={payForm.billNumber} onChange={e => setPF('billNumber', e.target.value)} />
          </Field>
          <Field label="Amount (₹)" required>
            <input type="number" className={inputCls} placeholder="0.00" value={payForm.amount} onChange={e => setPF('amount', e.target.value)} min="0" />
          </Field>
          <Field label="Payment Account">
            <select className={selectCls} value={payForm.bankAccountId} onChange={e => setPF('bankAccountId', e.target.value)}>
              <option value="">Select account…</option>
              {(app.bankAccounts||[]).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} placeholder="Instalment details…" value={payForm.notes} onChange={e => setPF('notes', e.target.value)} />
          </Field>
          <SaveBtn onClick={savePay} label="Record Payment" />
        </Modal>
      )}

      {/* ── Payment Receipt Viewer ─── */}
      {viewingPay && (
        <div className="fixed inset-0 z-[300] bg-gray-50 flex flex-col">
          <div className="flex items-center gap-2 px-3 py-3 bg-white border-b border-gray-100 shadow-sm shrink-0">
            <button onClick={() => setViewingPay(null)} className="p-1.5 text-gray-600"><X size={20}/></button>
            <span className="flex-1 font-bold text-gray-800 text-sm truncate">Installation Payment Receipt</span>
            <button onClick={async () => { setVBusy(true); try { const pdf = buildInstallationPaymentPDF(viewingPay.p, viewingPay.job, viewingPay.team, app.companyInfo||{}); await shareInstallPDF(pdf, `${viewingPay.p.billNumber||'INST'}.pdf`); } finally { setVBusy(false); } }}
              disabled={vBusy}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50">
              <Download size={13}/> Save / Share
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-teal-700 px-4 pt-4 pb-3">
                <p className="font-bold text-white">{app.companyInfo?.name || 'UrbanMud Bricks and Blocks'}</p>
                <p className="text-teal-200 text-xs mt-0.5">Installation Payment Voucher</p>
              </div>
              <div className="px-4 py-4 space-y-2.5">
                {[
                  ['Voucher No.', viewingPay.p.billNumber],
                  ['Date', fmtDate(viewingPay.p.date)],
                  ['Team', viewingPay.team?.name],
                  ['Client', viewingPay.job?.clientName],
                  ['Project', viewingPay.job?.projectName],
                  ['Location', viewingPay.job?.location],
                  ['Product', (app.products||[]).find(p => p.id === viewingPay.job?.productId)?.name],
                  ['Price/Sqft', viewingPay.job?.pricePerSqft ? `₹${fmt(viewingPay.job.pricePerSqft)}` : null],
                  ['Total Area', viewingPay.job?.totalArea ? `${fmt(viewingPay.job.totalArea)} sqft` : null],
                  ['Job Value', viewingPay.job?.totalAmount ? `₹${fmt(viewingPay.job.totalAmount)}` : null],
                  ['Account', (app.bankAccounts||[]).find(b => b.id === viewingPay.p.bankAccountId)?.name],
                  ['Notes', viewingPay.p.notes],
                ].filter(([,v]) => v).map(([l, v], i) => (
                  <div key={i} className="flex justify-between items-start gap-3">
                    <span className="text-xs text-gray-400 shrink-0 w-24">{l}</span>
                    <span className="text-xs font-semibold text-gray-800 text-right">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mx-4 mb-4 pt-3 border-t-2 border-teal-600 flex justify-between items-center">
                <span className="font-bold text-gray-800">Amount Paid</span>
                <span className="text-xl font-bold text-teal-700">₹{fmt(viewingPay.p.amount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
