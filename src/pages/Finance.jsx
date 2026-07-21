import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import Modal, { Field, inputCls, selectCls, SaveBtn } from '../components/Modal';
import { Plus, Trash2, Users, ShoppingBag, Receipt, ArrowDownCircle, ArrowUpCircle, Download, Share2, Camera as CamIcon, FilePlus2, X, Eye, AlertTriangle, CheckCircle2, Filter, Truck, ShieldCheck, FileText } from 'lucide-react';
import { fmtDate, todayISO, monthRange } from '../utils/date';
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

async function shareOrDownloadPhoto(base64JPEG, filename) {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const result = await Filesystem.writeFile({ path: filename, data: base64JPEG, directory: Directory.Cache });
    await Share.share({ title: filename, url: result.uri, dialogTitle: 'Share / Save Photo' });
  } catch {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${base64JPEG}`; link.download = filename; link.click();
  }
}

function ReceiptViewer({ title, children, onDownload, onShare, onClose, busy }) {
  return (
    <div className="fixed inset-0 z-[300] bg-gray-50 flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 bg-white border-b border-gray-100 shadow-sm shrink-0">
        <button onClick={onClose} className="p-1.5 text-gray-600"><X size={20}/></button>
        <span className="flex-1 font-bold text-gray-800 text-sm truncate">{title}</span>
        <button onClick={onDownload} disabled={!!busy}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50 active:scale-95 transition-transform">
          <Download size={13}/> Save
        </button>
        <button onClick={onShare} disabled={!!busy}
          className="flex items-center gap-1.5 bg-purple-600 text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50 active:scale-95 transition-transform">
          <Share2 size={13}/> Share
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

function ReceiptHTML({ docTitle, docColor, rows, amount, amountColor, refId, ci, extra }) {
  const coName = ci?.name || 'UrbanMud Bricks and Blocks';
  const coAddr = ci?.address || 'Bhaktharahalli, Poojeana Agrahara,\nnear Hoskote, Bangalore - 562114';
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-3">
      <div className="bg-amber-800 px-4 pt-4 pb-3">
        <p className="font-bold text-white">{coName}</p>
        <p className="text-amber-200 text-xs mt-0.5 whitespace-pre-line">{coAddr}</p>
      </div>
      <div className="px-4 py-3 border-b border-gray-100">
        <p className={`text-center text-sm font-bold py-2 rounded-xl ${docColor}`}>{docTitle}</p>
      </div>
      <div className="px-4 py-4 space-y-3">
        {rows.filter(([,v]) => v !== undefined && v !== null && v !== '').map(([l, v], i) => (
          <div key={i} className="flex justify-between items-start gap-3">
            <span className="text-xs text-gray-500 shrink-0 w-28">{l}</span>
            <span className="text-xs font-semibold text-gray-800 text-right flex-1">{v}</span>
          </div>
        ))}
      </div>
      <div className="mx-4 mb-4 pt-3 border-t-2 border-amber-700 flex justify-between items-center">
        <span className="font-bold text-gray-800">Total Amount</span>
        <span className={`text-xl font-bold ${amountColor || 'text-amber-800'}`}>₹{amount}</span>
      </div>
      {extra}
      <div className="bg-gray-50 px-4 py-2.5 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">Ref: {refId}</p>
      </div>
    </div>
  );
}

function buildFinancePDF(type, entry, meta, ci) {
  const coName    = ci?.name    || 'UrbanMud Bricks and Blocks';
  const coAddress = ci?.address || 'Bhaktharahalli, Poojeana Agrahara,\nnear Hoskote, Bangalore - 562114';
  const coPhone   = ci?.phone   || '';
  const coGSTIN   = ci?.gstin   || '';
  const A = [146,64,14], DK = [31,41,55], MD = [107,114,128], LT = [253,230,138];
  const W = 210, H = 297, ML = 14, MR = 14, CW = W - ML - MR;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = ML;

  const CFG = {
    expense:          { title: 'EXPENSE VOUCHER',        badge: 'EXPENSE AMOUNT',    col: [255,251,235], tcol: [146,64,14]  },
    labor:            { title: 'LABOUR PAYMENT VOUCHER', badge: 'AMOUNT PAID',        col: [255,251,235], tcol: [146,64,14]  },
    payment_received: { title: 'PAYMENT RECEIPT',        badge: 'AMOUNT RECEIVED',   col: [236,244,238], tcol: [21,128,61]  },
    payment_paid:     { title: 'PAYMENT ORDER',          badge: 'AMOUNT PAID',        col: [255,251,235], tcol: [146,64,14]  },
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
    alternateRowStyles: { fillColor:[255,251,235] },
  });
  y = pdf.lastAutoTable.finalY + 7;

  // Amount highlight band
  if (y+13>H-18) { pdf.addPage(); y=ML; }
  pdf.setFillColor(...cfg.col); pdf.rect(ML, y, CW, 12, 'F');
  pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(...cfg.tcol);
  pdf.text(cfg.badge, ML+4, y+8);
  pdf.text(rp(Number(entry.amount)||0), W-MR-4, y+8, { align:'right' });
  y += 18;

  // Signing — Authorised Signatory only (right-aligned)
  if (y+35>H-18) { pdf.addPage(); y=ML; }
  y += 4; pdf.setDrawColor(...LT); pdf.setLineWidth(0.3); pdf.line(ML,y,W-MR,y); y += 15;
  const sw = CW/3; const sx = W-MR-sw;
  if (ci?.signature) { try { pdf.addImage(ci.signature,'PNG',sx+4,y-14,sw-8,12); } catch(e){} }
  pdf.setDrawColor(...MD); pdf.setLineWidth(0.4); pdf.line(sx,y,W-MR,y);
  pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK); pdf.text('Authorised Signatory',sx+sw/2,y+5,{align:'center'});
  pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD); pdf.text('For '+coName,sx+sw/2,y+9,{align:'center'});
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
  const A = [146,64,14], DK = [31,41,55], MD = [107,114,128], LT = [253,230,138];
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
    alternateRowStyles: { fillColor:[255,251,235] },
    didParseCell: (data) => { if (data.row.index === rows.length-1) { data.cell.styles.fillColor=[254,243,199]; data.cell.styles.fontStyle='bold'; } },
  });
  y = pdf.lastAutoTable.finalY + 8;

  // RCM notice
  if (y+20>H-50) { pdf.addPage(); y=ML; }
  pdf.setFillColor(255,251,235); pdf.roundedRect(ML, y, CW, 18, 2, 2, 'F');
  pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A); pdf.text('REVERSE CHARGE NOTICE:', ML+4, y+6);
  pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(...DK);
  pdf.text('Tax is payable on reverse charge basis as per Section 9(4) of CGST Act 2017.', ML+4, y+12);
  pdf.text('Buyer ('+coName+') is liable to pay applicable GST.', ML+4, y+17);
  y += 24;

  // Signing — Authorised Signatory only (right-aligned)
  if (y+40>H-12) { pdf.addPage(); y=ML; }
  y += 4; pdf.setDrawColor(...LT); pdf.setLineWidth(0.3); pdf.line(ML,y,W-MR,y); y += 15;
  const sw = CW/3; const sx = W-MR-sw;
  if (ci?.signature) { try { pdf.addImage(ci.signature,'PNG',sx+4,y-14,sw-8,12); } catch(e){} }
  pdf.setDrawColor(...MD); pdf.setLineWidth(0.4); pdf.line(sx,y,W-MR,y);
  pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK); pdf.text('Authorised Signatory',sx+sw/2,y+5,{align:'center'});
  pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD); pdf.text('For '+coName,sx+sw/2,y+9,{align:'center'});
  pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(...LT);
  pdf.text('Generated by Urbanmud Manufacturing Ops', W/2, H-8, { align:'center' });
  return pdf;
}

function buildConsolidatedOrderPDF(order, dispatches, payments, product, bankAccounts, ci) {
  const coName    = ci?.name    || 'UrbanMud Bricks and Blocks';
  const coAddress = ci?.address || 'Bhaktharahalli, Poojeana Agrahara,\nnear Hoskote, Bangalore - 562114';
  const coGSTIN   = ci?.gstin   || '';
  const coPhone   = ci?.phone   || '';
  const A  = [146,64,14], DK = [31,41,55], MD = [107,114,128], LT = [253,230,138];
  const W = 210, H = 297, ML = 14, MR = 14, CW = W-ML-MR;
  const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  let y = ML;
  const needPage = (h) => { if (y+h > H-18) { pdf.addPage(); y = ML; } };
  const today = new Date().toISOString().slice(0,10);
  const invoiceNo = `CINV-${(order.id||'').slice(-8).toUpperCase()}`;
  const unitPrice = Number(order.unitPrice||0);
  const receivedPayments = payments.filter(p => p.direction==='received');
  const totalDispatched = dispatches.reduce((s,d)=>s+Number(d.quantity||0),0);
  const totalReceived   = receivedPayments.reduce((s,p)=>s+Number(p.amount||0),0);
  const orderValue = Number(order.totalAmount||0);
  const balance = orderValue - totalReceived;

  // Header
  let ry = y+7;
  pdf.setFontSize(16); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A); pdf.text(coName.toUpperCase(), ML, y+7); y+=11;
  pdf.setFontSize(8.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
  coAddress.split('\n').forEach(l => { pdf.text(l, ML, y); y+=4; });
  if (coPhone) { pdf.text('Ph: '+coPhone, ML, y); y+=4; }
  if (coGSTIN) { pdf.setFont('helvetica','bold'); pdf.text('GSTIN: '+coGSTIN, ML, y); pdf.setFont('helvetica','normal'); y+=4; }

  pdf.setFontSize(14); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK); pdf.text('DELIVERY INVOICE', W-MR, ry, {align:'right'}); ry+=8;
  pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(...A); pdf.text(invoiceNo, W-MR, ry, {align:'right'}); ry+=6;
  pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
  pdf.text('Invoice Date: '+today, W-MR, ry, {align:'right'}); ry+=5;
  pdf.text('Order Ref: '+(order.orderNumber||''), W-MR, ry, {align:'right'}); ry+=5;
  if (order.deliveryDate) { pdf.text('Delivery Date: '+order.deliveryDate, W-MR, ry, {align:'right'}); ry+=5; }

  y = Math.max(y, ry)+4;
  pdf.setDrawColor(...A); pdf.setLineWidth(0.6); pdf.line(ML, y, W-MR, y); y+=7;

  // Bill To
  pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.setTextColor(...MD); pdf.text('BILL TO', ML, y); y+=4.5;
  pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK); pdf.text(order.customerName||'—', ML, y); y+=5;
  pdf.setFontSize(8.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD);
  if (order.customerPhone) { pdf.text(order.customerPhone, ML, y); y+=4; }
  y+=5;

  // Dispatch table
  needPage(30);
  pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK); pdf.text('DELIVERY DETAILS', ML, y); y+=5;
  const dispRows = dispatches.map((d,i) => [
    i+1, d.date, product?.name||'Product', product?.unit||'units',
    fmt(Number(d.quantity||0)), rp(unitPrice), rp(Number(d.quantity||0)*unitPrice)
  ]);
  autoTable(pdf, {
    startY: y, margin:{left:ML,right:MR},
    head: [['#','Date','Description','Unit','Qty','Rate','Amount']],
    body: dispRows,
    foot: [['','','Total Delivered','',fmt(totalDispatched),'',rp(totalDispatched*unitPrice)]],
    headStyles: {fillColor:A, textColor:[255,255,255], fontSize:9, fontStyle:'bold', cellPadding:3.5},
    bodyStyles: {fontSize:8.5, textColor:DK, cellPadding:3},
    footStyles: {fillColor:[254,243,199], textColor:A, fontStyle:'bold', fontSize:9},
    alternateRowStyles: {fillColor:[255,251,235]},
    columnStyles: {0:{cellWidth:8,halign:'center'},1:{cellWidth:22},3:{cellWidth:14,halign:'center'},4:{cellWidth:16,halign:'right'},5:{cellWidth:24,halign:'right'},6:{cellWidth:28,halign:'right'}},
  });
  y = pdf.lastAutoTable.finalY + 8;

  // Payment table
  if (receivedPayments.length > 0) {
    needPage(30);
    pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK); pdf.text('PAYMENT HISTORY', ML, y); y+=5;
    const payRows = receivedPayments.map((p,i) => {
      const acc = bankAccounts.find(b=>b.id===p.bankAccountId);
      return [i+1, p.date, acc?.name||'—', rp(Number(p.amount||0)), p.notes||''];
    });
    autoTable(pdf, {
      startY: y, margin:{left:ML,right:MR},
      head: [['#','Date','Mode / Account','Amount Received','Notes']],
      body: payRows,
      foot: [['','','Total Received', rp(totalReceived),'']],
      headStyles: {fillColor:[22,163,74], textColor:[255,255,255], fontSize:9, fontStyle:'bold', cellPadding:3.5},
      bodyStyles: {fontSize:8.5, textColor:DK, cellPadding:3},
      footStyles: {fillColor:[220,252,231], textColor:[22,163,74], fontStyle:'bold', fontSize:9},
      alternateRowStyles: {fillColor:[240,253,244]},
      columnStyles: {0:{cellWidth:8,halign:'center'},1:{cellWidth:24},3:{cellWidth:32,halign:'right',fontStyle:'bold'}},
    });
    y = pdf.lastAutoTable.finalY + 8;
  }

  // Financial summary box
  needPage(55);
  pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK); pdf.text('FINANCIAL SUMMARY', ML, y); y+=5;
  pdf.setFillColor(255,251,235); pdf.roundedRect(ML, y, CW, 30, 2, 2, 'F');
  pdf.setDrawColor(...LT); pdf.setLineWidth(0.3); pdf.roundedRect(ML, y, CW, 30, 2, 2, 'D');
  const srow = (lbl, val, col) => {
    pdf.setFontSize(8.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD); pdf.text(lbl, ML+4, y+5);
    pdf.setFont('helvetica','bold'); pdf.setTextColor(...(col||DK)); pdf.text(val, W-MR-4, y+5, {align:'right'}); y+=7;
  };
  y+=2; srow('Order Value:', rp(orderValue)); srow('Total Dispatched:', fmt(totalDispatched)+' '+(product?.unit||'units'));
  srow('Total Payments Received:', rp(totalReceived), [22,163,74]);
  srow('Balance Due:', rp(Math.max(0,balance)), balance<=0?[22,163,74]:[220,38,38]);
  y+=4;
  needPage(16);
  if (balance<=0) {
    pdf.setFillColor(220,252,231); pdf.roundedRect(ML, y, CW, 12, 2, 2, 'F');
    pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(22,163,74);
    pdf.text('PAID IN FULL', W/2, y+8, {align:'center'});
  } else {
    pdf.setFillColor(254,226,226); pdf.roundedRect(ML, y, CW, 12, 2, 2, 'F');
    pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(220,38,38);
    pdf.text('BALANCE DUE: '+rp(balance), W/2, y+8, {align:'center'});
  }
  y+=18;

  // Signatory
  needPage(38);
  y+=5; pdf.setDrawColor(...LT); pdf.setLineWidth(0.3); pdf.line(ML,y,W-MR,y); y+=15;
  const sw=CW/3; const sx=W-MR-sw;
  if (ci?.signature) { try { pdf.addImage(ci.signature,'PNG',sx+4,y-14,sw-8,12); } catch(e){} }
  pdf.setDrawColor(...MD); pdf.setLineWidth(0.4); pdf.line(sx,y,W-MR,y);
  pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(...DK); pdf.text('Authorised Signatory',sx+sw/2,y+5,{align:'center'});
  pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(...MD); pdf.text('For '+coName,sx+sw/2,y+9,{align:'center'});
  const tp=pdf.internal.getNumberOfPages();
  for(let p=1;p<=tp;p++) { pdf.setPage(p); pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(...LT); pdf.text('Generated by Urbanmud Manufacturing Ops | Page '+p+' of '+tp, W/2, H-8, {align:'center'}); }
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
  const [viewing, setViewing] = useState(null);
  const [vBusy, setVBusy] = useState(false);
  const [filterFrom, setFilterFrom] = useState(() => monthRange().from);
  const [filterTo, setFilterTo]     = useState(() => monthRange().to);
  const [filterGroup, setFilterGroup] = useState('');
  const [filterPayType, setFilterPayType] = useState('');
  const emptyForm = { date: todayISO(), laborGroupId: '', amount: '', paymentType: 'regular', bankAccountId: '', notes: '' };
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function openPayModal(groupId, balance) {
    setForm({ ...emptyForm, laborGroupId: groupId, amount: balance > 0 ? String(balance) : '' });
    setShowModal(true);
  }
  function save() {
    if (!form.laborGroupId || !form.amount) return alert('Group and amount required.');
    app.addItem('laborPayments', form);
    setForm(f => ({ ...f, laborGroupId: '', amount: '', notes: '' }));
    setShowModal(false);
  }

  const sorted = [...app.laborPayments]
    .filter(p => (!filterFrom || p.date >= filterFrom) && (!filterTo || p.date <= filterTo))
    .filter(p => !filterGroup || p.laborGroupId === filterGroup)
    .filter(p => !filterPayType || p.paymentType === filterPayType)
    .sort((a, b) => b.date.localeCompare(a.date));

  const groupBalance = app.laborGroups.map(g => {
    const owed = app.productionEntries
      .filter(e => e.laborGroupId === g.id)
      .reduce((s, e) => s + Number(e.labourAmountOwed || 0), 0);
    const paid = app.laborPayments
      .filter(p => p.laborGroupId === g.id)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const advance = app.laborPayments
      .filter(p => p.laborGroupId === g.id && p.paymentType === 'advance')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const balance = owed - paid;
    const status = balance < -0.5 ? 'overpaid' : balance > 0.5 ? 'pending' : 'settled';
    return { ...g, owed, paid, advance, balance, status };
  });

  return (
    <div className="px-4 py-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Labour Balance Sheet</h2>
        <button onClick={() => { setForm(emptyForm); setShowModal(true); }} className="flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl">
          <Plus size={14} /> Add Payment
        </button>
      </div>

      <div className="space-y-3 mb-5">
        {groupBalance.map(g => {
          const statusStyle = g.status === 'overpaid' ? 'bg-blue-100 text-blue-700'
            : g.status === 'pending' ? 'bg-red-100 text-red-700'
            : 'bg-green-100 text-green-700';
          return (
            <div key={g.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Users size={18} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{g.name}</p>
                    {g.advance > 0 && <p className="text-xs text-gray-400">Advance: ₹{fmt(g.advance)}</p>}
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${statusStyle}`}>{g.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg py-2">
                  <p className="text-[10px] text-gray-400 mb-0.5">Owed</p>
                  <p className="text-sm font-bold text-gray-800">₹{fmt(g.owed)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg py-2">
                  <p className="text-[10px] text-gray-400 mb-0.5">Paid</p>
                  <p className="text-sm font-bold text-green-700">₹{fmt(g.paid)}</p>
                </div>
                <div className={`rounded-lg py-2 ${g.balance > 0.5 ? 'bg-red-50' : g.balance < -0.5 ? 'bg-blue-50' : 'bg-green-50'}`}>
                  <p className="text-[10px] text-gray-400 mb-0.5">Balance</p>
                  <p className={`text-sm font-bold ${g.balance > 0.5 ? 'text-red-600' : g.balance < -0.5 ? 'text-blue-600' : 'text-green-600'}`}>
                    {g.balance > 0.5 ? '-' : g.balance < -0.5 ? '+' : ''}₹{fmt(Math.abs(g.balance))}
                  </p>
                </div>
              </div>
              {g.status === 'pending' && (
                <button
                  onClick={() => openPayModal(g.id, g.balance)}
                  className="mt-3 w-full py-2 bg-green-600 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                >
                  <Plus size={13} /> Pay ₹{fmt(g.balance)} to {g.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Filter size={12} className="text-amber-700" />
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Filter</span>
          <span className="ml-auto text-xs text-gray-400">{sorted.length} payment{sorted.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className={inputCls} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          <input type="date" className={inputCls} value={filterTo}   onChange={e => setFilterTo(e.target.value)} />
          <select className={selectCls} value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
            <option value="">All Groups</option>
            {app.laborGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className={selectCls} value={filterPayType} onChange={e => setFilterPayType(e.target.value)}>
            <option value="">All Types</option>
            <option value="regular">Regular</option>
            <option value="advance">Advance</option>
            <option value="installment">Installment</option>
          </select>
        </div>
      </div>
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Payment History</h2>
      {sorted.length === 0 ? (
        <EmptyState icon={<Users size={36} className="text-gray-200" />} msg="No payments in this range" />
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
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-red-600">₹{fmt(p.amount)}</p>
                    <button onClick={() => setViewing({ p, group, account })}
                      className="flex items-center gap-1 text-blue-600 text-xs font-bold px-2.5 py-1.5 border border-blue-200 rounded-lg bg-blue-50 active:scale-95 transition-transform">
                      <Eye size={13}/> View
                    </button>
                    <button onClick={() => { if (confirm('Delete?')) app.deleteItem('laborPayments', p.id); }} className="text-gray-300 hover:text-red-400 p-1"><Trash2 size={15}/></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewing && (
        <ReceiptViewer
          title="Labour Payment Voucher"
          busy={vBusy}
          onClose={() => setViewing(null)}
          onDownload={async () => { setVBusy(true); try { const pdf = buildFinancePDF('labor', viewing.p, { groupName: viewing.group?.name, accountName: viewing.account?.name }, app.companyInfo||{}); await shareOrDownloadPDF(pdf, `Labour-${viewing.p.date}-${(viewing.p.id||'').slice(-5)}.pdf`); } finally { setVBusy(false); } }}
          onShare={async () => { setVBusy(true); try { const pdf = buildFinancePDF('labor', viewing.p, { groupName: viewing.group?.name, accountName: viewing.account?.name }, app.companyInfo||{}); await shareOrDownloadPDF(pdf, `Labour-${viewing.p.date}.pdf`); } finally { setVBusy(false); } }}
        >
          <ReceiptHTML
            docTitle="Labour Payment Voucher"
            docColor="bg-indigo-100 text-indigo-800"
            rows={[
              ['Date', fmtDate(viewing.p.date)],
              ['Labour Group', viewing.group?.name],
              ['Payment Type', (viewing.p.paymentType||'').replace(/^\w/, c => c.toUpperCase())],
              ['Bank Account', viewing.account?.name],
              ['Notes', viewing.p.notes],
            ]}
            amount={fmt(viewing.p.amount)}
            amountColor="text-green-700"
            refId={`LBR-${(viewing.p.id||'').slice(-8).toUpperCase()}`}
            ci={app.companyInfo}
          />
        </ReceiptViewer>
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
  const [filterFrom, setFilterFrom] = useState(() => monthRange().from);
  const [filterTo, setFilterTo]     = useState(() => monthRange().to);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchFor, setDispatchFor] = useState(null);
  const [dForm, setDForm] = useState({ date: todayISO(), quantity: '', notes: '' });

  const isSuperAdmin = app.currentUser?.id === 'u_superadmin';

  function setOF(k, v) { setOrderForm(f => ({ ...f, [k]: v })); }
  function setPF(k, v) { setPayForm(f => ({ ...f, [k]: v })); }
  function setDF(k, v) { setDForm(f => ({ ...f, [k]: v })); }

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

  function saveDispatch() {
    if (!dForm.quantity || Number(dForm.quantity) <= 0) return alert('Quantity required.');
    app.addItem('orderDispatches', { ...dForm, orderId: dispatchFor.id });
    setDForm({ date: todayISO(), quantity: '', notes: '' });
    setShowDispatchModal(false);
  }

  function computeOrder(order) {
    const dispatches = (app.orderDispatches || []).filter(d => d.orderId === order.id);
    const payments   = (app.orderPayments   || []).filter(p => p.orderId === order.id);
    const totalOrdered   = Number(order.quantity || 0);
    const totalDispatched = dispatches.reduce((s, d) => s + Number(d.quantity || 0), 0);
    const received = payments.filter(p => p.direction === 'received').reduce((s, p) => s + Number(p.amount || 0), 0);
    const balance  = Number(order.totalAmount || 0) - received;
    const materialStatus = totalDispatched === 0 ? 'yet_to_dispatch'
      : totalDispatched < totalOrdered ? 'partial' : 'full';
    const autoStatus = materialStatus === 'full' && balance <= 0 ? 'completed'
      : materialStatus !== 'yet_to_dispatch' ? 'in_progress' : 'pending';
    const effectiveStatus = order.manualStatus || autoStatus;
    return { dispatches, payments, totalDispatched, received, balance, materialStatus, autoStatus, effectiveStatus };
  }

  const [viewing, setViewing] = useState(null);
  const [vBusy, setVBusy] = useState(false);
  const [viewingConsolidated, setViewingConsolidated] = useState(null);
  const [consolidatedBusy, setConsolidatedBusy] = useState(false);
  const sorted = [...app.orders]
    .filter(o => {
      const d = o.deliveryDate || new Date(parseInt(o.id)).toISOString().slice(0,10);
      return (!filterFrom || d >= filterFrom) && (!filterTo || d <= filterTo);
    })
    .filter(o => !filterStatus || computeOrder(o).effectiveStatus === filterStatus)
    .filter(o => !filterCustomer || o.customerName.toLowerCase().includes(filterCustomer.toLowerCase()))
    .sort((a, b) => (b.id > a.id ? 1 : -1));
  const statusColors = { pending: 'bg-amber-50 text-amber-700', in_progress: 'bg-blue-50 text-blue-700', completed: 'bg-green-50 text-green-700' };
  const matColors = { yet_to_dispatch: 'bg-gray-100 text-gray-500', partial: 'bg-blue-50 text-blue-700', full: 'bg-green-50 text-green-700' };
  const matLabels = { yet_to_dispatch: 'Yet to Dispatch', partial: 'Partial', full: 'Fully Dispatched' };

  return (
    <div className="px-4 py-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Filter size={12} className="text-amber-700" />
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Filter</span>
          <span className="ml-auto text-xs text-gray-400">{sorted.length} order{sorted.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className={inputCls} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          <input type="date" className={inputCls} value={filterTo}   onChange={e => setFilterTo(e.target.value)} />
          <select className={`${selectCls} col-span-2`} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <input type="search" className={`${inputCls} col-span-2`} placeholder="Search by customer name…" value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} />
        </div>
      </div>
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
        <EmptyState icon={<ShoppingBag size={36} className="text-gray-200" />} msg="No orders in this range" />
      ) : (
        <div className="space-y-3">
          {sorted.map(order => {
            const product = app.products.find(p => p.id === order.productId);
            const { dispatches, payments, totalDispatched, received, balance, materialStatus, effectiveStatus } = computeOrder(order);
            return (
              <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">

                {/* Header row */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center flex-wrap gap-1.5 mb-1">
                      {order.orderNumber && <span className="text-xs text-gray-400">#{order.orderNumber}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[effectiveStatus] || 'bg-gray-100 text-gray-600'}`}>
                        {effectiveStatus.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${matColors[materialStatus]}`}>
                        <Truck size={9} className="inline mr-0.5" />{matLabels[materialStatus]}
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

                {/* Product + delivery info */}
                <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-50 pt-2 mb-2">
                  <span>{product?.name || 'Unknown'} · Ordered: {fmt(order.quantity)} units</span>
                  {order.deliveryDate && <span>Delivery: {fmtDate(order.deliveryDate)}</span>}
                </div>

                {/* Dispatch summary bar */}
                <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-600">Material Dispatched</span>
                    <span className="text-xs font-bold text-gray-800">{fmt(totalDispatched)} / {fmt(order.quantity)} units</span>
                  </div>
                  {Number(order.quantity) > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-amber-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (totalDispatched / Number(order.quantity)) * 100)}%` }} />
                    </div>
                  )}
                  {dispatches.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {dispatches.slice().reverse().slice(0, 3).map(d => (
                        <div key={d.id} className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>{fmtDate(d.date)}{d.notes ? ` · ${d.notes}` : ''}</span>
                          <span className="font-semibold text-gray-700">+{fmt(d.quantity)} units</span>
                        </div>
                      ))}
                      {dispatches.length > 3 && <p className="text-[10px] text-gray-400">{dispatches.length - 3} more earlier…</p>}
                    </div>
                  )}
                </div>

                {/* Consolidated Bill button — completed orders only */}
                {effectiveStatus === 'completed' && (
                  <button
                    onClick={() => setViewingConsolidated({ order, dispatches, payments, product })}
                    className="w-full flex items-center justify-center gap-1.5 bg-amber-700 text-white text-xs font-semibold px-3 py-2 rounded-lg mb-2 active:scale-95 transition-transform"
                  >
                    <FileText size={13} /> Consolidated Delivery Invoice
                  </button>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => { setDispatchFor(order); setDForm({ date: todayISO(), quantity: '', notes: '' }); setShowDispatchModal(true); }}
                    className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-200"
                  >
                    <Truck size={12} /> Add Dispatch
                  </button>
                  <button
                    onClick={() => { setPayForm(f => ({ ...f, orderId: order.id })); setShowPayModal(true); }}
                    className="flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-green-200"
                  >
                    <ArrowDownCircle size={12} /> Add Payment
                  </button>
                  <button onClick={() => { if (confirm('Delete order?')) app.deleteItem('orders', order.id); }} className="ml-auto text-gray-300 hover:text-red-400 p-1">
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Super Admin manual override */}
                {isSuperAdmin && (
                  <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-1.5 mb-2">
                    <ShieldCheck size={12} className="text-purple-600 flex-shrink-0" />
                    <span className="text-xs text-purple-700 font-semibold">Override Status:</span>
                    <select
                      className="flex-1 text-xs border border-purple-200 rounded-lg px-2 py-1 bg-white"
                      value={order.manualStatus || ''}
                      onChange={e => app.updateItem('orders', order.id, { manualStatus: e.target.value || '' })}
                    >
                      <option value="">Auto (computed)</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                )}

                {/* Payment history */}
                {payments.length > 0 && (
                  <div className="pt-2 border-t border-gray-50 space-y-1">
                    {payments.slice(-3).map(p => {
                      const pAcc = app.bankAccounts.find(b => b.id === p.bankAccountId);
                      const prod = app.products.find(pr => pr.id === order.productId);
                      return (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{fmtDate(p.date)}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={p.direction === 'received' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                              {p.direction === 'received' ? '+' : '-'}₹{fmt(p.amount)}
                            </span>
                            <button onClick={() => setViewing({ p, order, prod, pAcc })}
                              className="flex items-center gap-0.5 text-blue-600 text-[10px] font-bold px-1.5 py-1 border border-blue-200 rounded-md bg-blue-50 active:scale-95">
                              <Eye size={10}/> View
                            </button>
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

      {viewing && (() => {
        const pType = viewing.p.direction === 'received' ? 'payment_received' : 'payment_paid';
        const fname = `Receipt-${viewing.p.date}-${(viewing.p.id||'').slice(-5)}.pdf`;
        const mkPdf = () => buildFinancePDF(pType, viewing.p, { orderNumber: viewing.order.orderNumber, customerName: viewing.order.customerName, productName: viewing.prod?.name, accountName: viewing.pAcc?.name }, app.companyInfo||{});
        return (
          <ReceiptViewer
            title={viewing.p.direction === 'received' ? 'Payment Receipt' : 'Payment Order'}
            busy={vBusy}
            onClose={() => setViewing(null)}
            onDownload={async () => { setVBusy(true); try { await shareOrDownloadPDF(mkPdf(), fname); } finally { setVBusy(false); } }}
            onShare={async () => { setVBusy(true); try { await shareOrDownloadPDF(mkPdf(), fname); } finally { setVBusy(false); } }}
          >
            <ReceiptHTML
              docTitle={viewing.p.direction === 'received' ? 'Payment Receipt' : 'Payment Order'}
              docColor={viewing.p.direction === 'received' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
              rows={[
                ['Date', fmtDate(viewing.p.date)],
                ['Order #', viewing.order.orderNumber],
                ['Customer', viewing.order.customerName],
                ['Product', viewing.prod?.name],
                ['Bank Account', viewing.pAcc?.name],
                ['Notes', viewing.p.notes],
              ]}
              amount={fmt(viewing.p.amount)}
              amountColor={viewing.p.direction === 'received' ? 'text-green-700' : 'text-red-600'}
              refId={`RCT-${(viewing.p.id||'').slice(-8).toUpperCase()}`}
              ci={app.companyInfo}
            />
          </ReceiptViewer>
        );
      })()}

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

      {showDispatchModal && dispatchFor && (
        <Modal title={`Add Dispatch — ${dispatchFor.customerName}`} onClose={() => setShowDispatchModal(false)}>
          <div className="bg-amber-50 rounded-lg px-3 py-2 mb-3 text-xs text-amber-800">
            <p className="font-semibold">{app.products.find(p => p.id === dispatchFor.productId)?.name}</p>
            <p>Ordered: {fmt(dispatchFor.quantity)} units · Already dispatched: {fmt((app.orderDispatches||[]).filter(d=>d.orderId===dispatchFor.id).reduce((s,d)=>s+Number(d.quantity||0),0))} units</p>
          </div>
          <Field label="Date" required><input type="date" className={inputCls} value={dForm.date} onChange={e => setDF('date', e.target.value)} /></Field>
          <Field label="Quantity Dispatched" required><input type="number" className={inputCls} placeholder="0" min="1" value={dForm.quantity} onChange={e => setDF('quantity', e.target.value)} /></Field>
          <Field label="Notes"><textarea className={inputCls} rows={2} placeholder="e.g. 1st batch, truck no..." value={dForm.notes} onChange={e => setDF('notes', e.target.value)} /></Field>
          <SaveBtn onClick={saveDispatch} label="Save Dispatch" />
        </Modal>
      )}

      {viewingConsolidated && (() => {
        const { order: co, dispatches: cd, payments: cp, product: cprod } = viewingConsolidated;
        const receivedPmts = cp.filter(p => p.direction === 'received');
        const totalDisp    = cd.reduce((s, d) => s + Number(d.quantity || 0), 0);
        const totalRcvd    = receivedPmts.reduce((s, p) => s + Number(p.amount || 0), 0);
        const orderVal     = Number(co.totalAmount || 0);
        const bal          = orderVal - totalRcvd;
        const unitPrice    = Number(co.unitPrice || 0);
        const invoiceNo    = `CINV-${(co.id || '').slice(-8).toUpperCase()}`;
        const mkPdf = () => buildConsolidatedOrderPDF(co, cd, cp, cprod, app.bankAccounts, app.companyInfo || {});
        const fname = `${invoiceNo}-${co.customerName || 'order'}.pdf`;
        return (
          <ReceiptViewer
            title={`Delivery Invoice — ${co.customerName}`}
            busy={consolidatedBusy}
            onClose={() => setViewingConsolidated(null)}
            onDownload={async () => { setConsolidatedBusy(true); try { await shareOrDownloadPDF(mkPdf(), fname); } finally { setConsolidatedBusy(false); } }}
            onShare={async () => { setConsolidatedBusy(true); try { await shareOrDownloadPDF(mkPdf(), fname); } finally { setConsolidatedBusy(false); } }}
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-3">
              {/* Letterhead */}
              <div className="bg-amber-800 px-4 pt-4 pb-3">
                <p className="font-bold text-white text-base">{(app.companyInfo?.name || 'UrbanMud Bricks and Blocks').toUpperCase()}</p>
                <p className="text-amber-200 text-xs mt-0.5 whitespace-pre-line">{app.companyInfo?.address || 'Bhaktharahalli, Poojeana Agrahara,\nnear Hoskote, Bangalore - 562114'}</p>
              </div>
              {/* Doc meta */}
              <div className="flex justify-between items-start px-4 py-3 border-b border-gray-100 bg-amber-50">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Delivery Invoice</p>
                  <p className="text-sm font-bold text-amber-700">{invoiceNo}</p>
                  <p className="text-xs text-gray-500">Order Ref: {co.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Date: {new Date().toISOString().slice(0,10)}</p>
                  {co.deliveryDate && <p className="text-xs text-gray-500">Delivery: {fmtDate(co.deliveryDate)}</p>}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">COMPLETED</span>
                </div>
              </div>
              {/* Bill To */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Bill To</p>
                <p className="text-sm font-bold text-gray-800">{co.customerName}</p>
                {co.customerPhone && <p className="text-xs text-gray-500">{co.customerPhone}</p>}
              </div>
              {/* Dispatch table */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-700 mb-2">DELIVERY DETAILS</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-amber-700 text-white">
                        <th className="p-1.5 text-left">#</th>
                        <th className="p-1.5 text-left">Date</th>
                        <th className="p-1.5 text-left">Item</th>
                        <th className="p-1.5 text-right">Qty</th>
                        <th className="p-1.5 text-right">Rate</th>
                        <th className="p-1.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cd.map((d, i) => (
                        <tr key={d.id} className={i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}>
                          <td className="p-1.5 text-gray-400">{i+1}</td>
                          <td className="p-1.5 text-gray-600">{fmtDate(d.date)}</td>
                          <td className="p-1.5 font-medium text-gray-800">{cprod?.name || 'Product'}<span className="text-gray-400 ml-1">({cprod?.unit || 'units'})</span></td>
                          <td className="p-1.5 text-right font-semibold">{fmt(d.quantity)}</td>
                          <td className="p-1.5 text-right text-gray-500">₹{fmt(unitPrice)}</td>
                          <td className="p-1.5 text-right font-bold text-gray-800">₹{fmt(Number(d.quantity) * unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-amber-100 font-bold text-amber-800">
                        <td colSpan={3} className="p-1.5">Total Delivered</td>
                        <td className="p-1.5 text-right">{fmt(totalDisp)}</td>
                        <td className="p-1.5"></td>
                        <td className="p-1.5 text-right">₹{fmt(totalDisp * unitPrice)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              {/* Payment table */}
              {receivedPmts.length > 0 && (
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-700 mb-2">PAYMENT HISTORY</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-green-600 text-white">
                          <th className="p-1.5 text-left">#</th>
                          <th className="p-1.5 text-left">Date</th>
                          <th className="p-1.5 text-left">Mode / Account</th>
                          <th className="p-1.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receivedPmts.map((p, i) => {
                          const acc = app.bankAccounts.find(b => b.id === p.bankAccountId);
                          return (
                            <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-green-50/30'}>
                              <td className="p-1.5 text-gray-400">{i+1}</td>
                              <td className="p-1.5 text-gray-600">{fmtDate(p.date)}</td>
                              <td className="p-1.5 text-gray-700">{acc?.name || '—'}{p.notes ? ` · ${p.notes}` : ''}</td>
                              <td className="p-1.5 text-right font-bold text-green-700">₹{fmt(p.amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-green-100 font-bold text-green-800">
                          <td colSpan={3} className="p-1.5">Total Received</td>
                          <td className="p-1.5 text-right">₹{fmt(totalRcvd)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
              {/* Financial Summary */}
              <div className="px-4 py-3 border-b border-gray-100 space-y-2">
                <p className="text-xs font-bold text-gray-700 mb-1">FINANCIAL SUMMARY</p>
                {[['Order Value', `₹${fmt(orderVal)}`],['Total Dispatched', `${fmt(totalDisp)} ${cprod?.unit || 'units'}`],['Total Received', `₹${fmt(totalRcvd)}`],['Balance Due', `₹${fmt(Math.max(0, bal))}`]].map(([l,v],i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-500">{l}</span>
                    <span className={`font-bold ${l==='Total Received'?'text-green-700':l==='Balance Due'?bal<=0?'text-green-700':'text-red-600':'text-gray-800'}`}>{v}</span>
                  </div>
                ))}
              </div>
              {/* Status stamp */}
              <div className={`mx-4 my-3 py-2 rounded-xl text-center font-bold text-sm ${bal<=0?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                {bal<=0 ? '✓ PAID IN FULL' : `BALANCE DUE: ₹${fmt(bal)}`}
              </div>
              {/* Signatory */}
              <div className="flex justify-end px-4 pb-4">
                <div className="w-1/3 text-center">
                  {app.companyInfo?.signature && <img src={app.companyInfo.signature} alt="Signature" className="h-10 mx-auto mb-1 object-contain" />}
                  <div className="border-t border-gray-400 pt-1.5">
                    <p className="text-[10px] font-bold text-gray-600">Authorised Signatory</p>
                    <p className="text-[9px] text-gray-400">For {app.companyInfo?.name || 'UrbanMud Bricks and Blocks'}</p>
                  </div>
                </div>
              </div>
            </div>
          </ReceiptViewer>
        );
      })()}
    </div>
  );
}

/* ── EXPENSES ─────────────────────────────────────────────── */
function ExpensesTab() {
  const app = useApp();
  const [showModal, setShowModal] = useState(false);
  const [capturing, setCapturing]     = useState(false);
  const [viewing, setViewing]         = useState(null);
  const [vBusy, setVBusy]             = useState(false);
  const [form, setForm] = useState(freshExpenseForm);
  const fileRef = useRef(null);
  const [filterFrom, setFilterFrom]   = useState(() => monthRange().from);
  const [filterTo, setFilterTo]       = useState(() => monthRange().to);
  const [filterCat, setFilterCat]     = useState('');
  const [filterAccount, setFilterAccount] = useState('');
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

  function save() {
    if (!form.categoryId || !form.amount) return alert('Category and amount required.');
    if (!form.billMode) return alert('Bill is mandatory. Upload a bill photo or choose "No Bill (URD)".');
    if (form.billMode === 'urd' && !form.urdSupplierName) return alert('Please enter supplier name for URD bill.');
    app.addItem('expenses', form);
    setForm(f => ({ ...freshExpenseForm(), date: f.date }));
    setShowModal(false);
  }

  const sorted = [...app.expenses]
    .filter(e => (!filterFrom || e.date >= filterFrom) && (!filterTo || e.date <= filterTo))
    .filter(e => !filterCat || e.categoryId === filterCat)
    .filter(e => !filterAccount || e.bankAccountId === filterAccount)
    .sort((a, b) => b.date.localeCompare(a.date));
  const totalFiltered = sorted.reduce((s, e) => s + Number(e.amount || 0), 0);
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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Filter size={12} className="text-amber-700" />
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Filter</span>
          <span className="ml-auto text-xs text-gray-400">{sorted.length} · ₹{fmt(totalFiltered)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className={inputCls} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          <input type="date" className={inputCls} value={filterTo}   onChange={e => setFilterTo(e.target.value)} />
          <select className={selectCls} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All Categories</option>
            {app.expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={selectCls} value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
            <option value="">All Accounts</option>
            {app.bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>
      {sorted.length === 0 ? (
        <EmptyState icon={<Receipt size={36} className="text-gray-200" />} msg="No expenses in this range" />
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
                  <div className="flex items-center gap-2 ml-2">
                    <p className="text-base font-bold text-red-600">₹{fmt(e.amount)}</p>
                    <button onClick={() => setViewing(e)}
                      className="flex items-center gap-1 text-blue-600 text-xs font-bold px-2.5 py-1.5 border border-blue-200 rounded-lg bg-blue-50 active:scale-95 transition-transform">
                      <Eye size={13}/> View
                    </button>
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
                  <div/>
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

      {viewing && (() => {
        const vCat = app.expenseCategories.find(c => c.id === viewing.categoryId);
        const vAcc = app.bankAccounts.find(b => b.id === viewing.bankAccountId);
        const fname = `Expense-${viewing.date}-${(viewing.id||'').slice(-5)}.pdf`;
        const mkPdf = () => buildFinancePDF('expense', viewing, { categoryName: vCat?.name, accountName: vAcc?.name }, app.companyInfo||{});
        return (
          <ReceiptViewer
            title="Expense Receipt"
            busy={vBusy}
            onClose={() => setViewing(null)}
            onDownload={async () => { setVBusy(true); try { await shareOrDownloadPDF(mkPdf(), fname); } finally { setVBusy(false); } }}
            onShare={async () => { setVBusy(true); try { await shareOrDownloadPDF(mkPdf(), fname); } finally { setVBusy(false); } }}
          >
            <ReceiptHTML
              docTitle="Expense Voucher"
              docColor="bg-red-100 text-red-800"
              rows={[
                ['Date', fmtDate(viewing.date)],
                ['Category', vCat?.name],
                ['Description', viewing.description],
                ['Bank Account', vAcc?.name],
                ['GST Amount', viewing.hasGST && viewing.gstAmount ? `₹${fmt(viewing.gstAmount)}` : null],
                ['Notes', viewing.notes],
              ]}
              amount={fmt(viewing.amount)}
              amountColor="text-red-600"
              refId={`EXP-${(viewing.id||'').slice(-8).toUpperCase()}`}
              ci={app.companyInfo}
            />
            {viewing.billMode === 'uploaded' && viewing.billImage && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-2">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-700">Original Bill Photo</p>
                  <button onClick={async () => { setVBusy(true); try { await shareOrDownloadPhoto(viewing.billImage, `BillPhoto-${viewing.date}.jpg`); } finally { setVBusy(false); } }}
                    disabled={vBusy}
                    className="flex items-center gap-1.5 text-purple-600 text-xs font-bold px-3 py-1.5 border border-purple-200 rounded-xl bg-purple-50 disabled:opacity-50">
                    <Share2 size={12}/> Share Photo
                  </button>
                </div>
                <img src={`data:image/jpeg;base64,${viewing.billImage}`} alt="Bill" className="w-full" />
              </div>
            )}
            {viewing.billMode === 'urd' && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 mt-2">
                <p className="text-sm font-bold text-amber-800 mb-1">URD Self Invoice</p>
                <p className="text-xs text-amber-600 mb-1">Supplier: {viewing.urdSupplierName}</p>
                {viewing.urdSupplierAddress && <p className="text-xs text-amber-600 mb-3">{viewing.urdSupplierAddress}</p>}
                <button onClick={async () => { setVBusy(true); try { const pdf = buildExpenseURDPDF(viewing, { categoryName: vCat?.name }, app.companyInfo||{}); await shareOrDownloadPDF(pdf, `ExpenseURD-${viewing.date}-${(viewing.id||'').slice(-5)}.pdf`); } finally { setVBusy(false); } }}
                  disabled={vBusy}
                  className="w-full py-2.5 bg-amber-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]">
                  <Download size={14}/> Download URD Self Invoice
                </button>
              </div>
            )}
          </ReceiptViewer>
        );
      })()}
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
