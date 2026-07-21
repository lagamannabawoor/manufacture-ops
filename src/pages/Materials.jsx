import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, Package, TrendingDown, Camera as CamIcon, FilePlus2, X, Eye, AlertTriangle, CheckCircle2, Download, Share2, Filter } from 'lucide-react';
import { fmtDate, todayISO, monthRange } from '../utils/date';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export default function Materials() {
  const app = useApp();
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState(freshForm);
  const [activeTab, setActiveTab]     = useState('stock');
  const [capturing, setCapturing]     = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [vBusy, setVBusy] = useState(false);
  const fileRef = useRef(null);
  const [filterFrom, setFilterFrom] = useState(() => monthRange().from);
  const [filterTo, setFilterTo]     = useState(() => monthRange().to);
  const [filterMat, setFilterMat]   = useState('');

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
        title="Raw Materials"
        subtitle="Stock & purchase tracking"
        action={
          <button
            onClick={() => { setForm(freshForm()); setShowModal(true); }}
            className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2"
          >
            <Plus size={20} />
          </button>
        }
      />

      <div className="px-4 py-4">
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
          {['stock', 'purchases'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              {tab === 'stock' ? 'Stock Levels' : 'Purchase History'}
            </button>
          ))}
        </div>

        {activeTab === 'stock' && (
          <div className="space-y-3">
            {app.materialTypes.map(mat => {
              const kgPerUnit = Number(mat.weightKgPerUnit || 0);
              const purchased = app.materialPurchases
                .filter(p => p.materialTypeId === mat.id)
                .reduce((s, p) => s + Number(p.quantity || 0), 0);
              const consumedKg = app.productionEntries
                .flatMap(e => e.materialsUsed || [])
                .filter(mu => mu.materialTypeId === mat.id)
                .reduce((s, mu) => s + Number(mu.kgUsed || 0), 0);
              const purchasedKg = kgPerUnit > 0 ? purchased * kgPerUnit : 0;
              const stockKg = purchasedKg - consumedKg;
              const useKg = kgPerUnit > 0;
              const fmtKg = (kg) => kg >= 1000
                ? `${(kg / 1000).toFixed(2)} T`
                : `${kg.toFixed(1)} kg`;
              const stockDisplay = useKg ? fmtKg(stockKg) : `${fmt(purchased)} ${mat.unit}`;
              const pct = purchasedKg > 0 ? Math.min(100, Math.max(0, (stockKg / purchasedKg) * 100)) : 0;
              return (
                <div key={mat.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                        <Package size={18} className="text-amber-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{mat.name}</p>
                        <p className="text-xs text-gray-400">{purchased} {mat.unit} purchased{kgPerUnit > 0 ? ` · ${kgPerUnit}kg/${mat.unit.replace(/s$/, '')}` : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${(!useKg && purchased > 0) || (useKg && stockKg > 0) ? 'text-gray-800' : 'text-red-600'}`}>
                        {stockDisplay}
                      </p>
                      <p className="text-xs text-gray-400">in stock</p>
                    </div>
                  </div>
                  {purchased > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <div className="grid grid-cols-3 gap-2 mb-2 text-center">
                        {useKg && (
                          <div>
                            <p className="text-xs font-semibold text-green-700">{fmtKg(purchasedKg)}</p>
                            <p className="text-[10px] text-gray-400">Purchased</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-red-600">{consumedKg > 0 ? fmtKg(consumedKg) : '—'}</p>
                          <p className="text-[10px] text-gray-400">Used</p>
                        </div>
                        {useKg && (
                          <div>
                            <p className={`text-xs font-semibold ${stockKg > 0 ? 'text-blue-700' : 'text-red-500'}`}>{fmtKg(Math.max(0, stockKg))}</p>
                            <p className="text-[10px] text-gray-400">Available</p>
                          </div>
                        )}
                      </div>
                      {useKg && (
                        <>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{Math.round(pct)}% remaining</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

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
