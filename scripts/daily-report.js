#!/usr/bin/env node
/**
 * Urbanmud Manufacturing Business Report
 * Covers: Production, Sales/Invoices (GST), Orders, Quotes, Receivables,
 *         Materials, Labour, Expenses, P&L, Bank — Daily/Weekly/Monthly/Quarterly/Yearly
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const nodemailer               = require('nodemailer');
const XLSX                     = require('xlsx');
const PDFDocument              = require('pdfkit');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT secret is missing');
const serviceAccount = JSON.parse(raw);
if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

// ── Helpers ───────────────────────────────────────────────────────────────
function todayIST() {
  return new Date(Date.now() + 5.5*60*60*1000).toISOString().slice(0,10);
}
function fmtDate(d) {
  if (!d) return '—';
  const [y,m,day] = String(d).slice(0,10).split('-');
  return day ? `${day}/${m}/${y}` : '—';
}
function cur(n) { return '₹' + Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2}); }
function num(n) { return Number(n||0); }
function pct(v,t) { return t > 0 ? Math.round((v/t)*100) : 0; }

function calcInvTotals(inv) {
  const items = inv.items || [];
  const sub   = items.reduce((s,i) => s + num(i.quantity)*num(i.unitPrice), 0);
  const disc  = inv.discountType === 'pct' ? sub*(num(inv.discountValue)/100) : num(inv.discountValue);
  const taxable = sub - disc;
  const taxAmt  = taxable * (num(inv.taxRate||18)/100);
  return { total: taxable+taxAmt, taxAmt, taxable, halfTax: taxAmt/2 };
}

function getPeriodType(fromDate, toDate) {
  if (fromDate === toDate) return 'Daily';
  const diff = Math.round((new Date(toDate)-new Date(fromDate))/(86400000));
  if (diff <= 8)  return 'Weekly';
  if (diff <= 35) return 'Monthly';
  if (diff <= 100) return 'Quarterly';
  return 'Yearly';
}

async function loadDoc(id) {
  const snap = await db.collection('mfg_data').doc(id).get();
  return snap.exists ? snap.data() : {};
}

// ── HTML email helpers ────────────────────────────────────────────────────
const TH = c => `<th style="padding:7px 10px;background:#f3f4f6;text-align:left;font-size:11px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb">${c}</th>`;
const TD = (c,right) => `<td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;${right?'text-align:right;font-weight:600':''}">${c??'—'}</td>`;

function htmlTable(headers, rows, empty) {
  if (!rows||!rows.length) return `<p style="color:#9ca3af;font-size:12px;padding:6px 0">${empty||'No data for this period'}</p>`;
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:4px">
  <thead><tr>${headers.map(TH).join('')}</tr></thead>
  <tbody>${rows.map(r=>`<tr>${r.map((c,i)=>TD(c,i===r.length-1)).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function sec(title, color, icon, content) {
  return `<div style="margin-top:22px"><h3 style="color:${color};margin:0 0 10px;font-size:14px">${icon} ${title}</h3>${content}</div>`;
}

function kpi(label, value, color) {
  return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center">
    <p style="margin:0;font-size:10px;color:#6b7280">${label}</p>
    <p style="margin:3px 0 0;font-size:17px;font-weight:700;color:${color}">${value}</p></div>`;
}

// ── Excel builder ─────────────────────────────────────────────────────────
function buildExcel(periodLabel, { fromDate, toDate,
  todayProd, todayMat, todayIncoming, todayLabor, todayExp,
  allOrders, allOrderPayments, allOrderDispatches, allInvoices,
  allQuotes, invInRange, labourBalances, stockData, byAccount,
  products, factories, materialTypes, laborGroups, bankAccounts, expenseCategories,
  totalBilled, totalInvCollected, totalGST, totalIncome, totalMatCost, totalLabor, totalExpense, netPL,
  outstandingByCustomer,
}) {
  const wb = XLSX.utils.book_new();
  const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  const pName = id => products.find(p=>p.id===id)?.name||'—';
  const fName = id => factories.find(f=>f.id===id)?.name||'—';
  const mName = id => materialTypes.find(m=>m.id===id)?.name||'—';
  const mUnit = id => materialTypes.find(m=>m.id===id)?.unit||'';
  const gName = id => laborGroups.find(g=>g.id===id)?.name||'—';
  const aName = id => bankAccounts.find(b=>b.id===id)?.name||'—';
  const cName = id => expenseCategories.find(c=>c.id===id)?.name||'—';

  // 1. Summary
  const totalOut = totalMatCost+totalLabor+totalExpense;
  add('Summary',[
    ['URBANMUD MANUFACTURING REPORT', periodLabel],
    ['Period', `${fmtDate(fromDate)} to ${fmtDate(toDate)}`],[],
    ['KEY PERFORMANCE INDICATORS','Value'],
    ['Units Produced (Period)', todayProd.reduce((s,e)=>s+num(e.quantity),0)],
    ['Revenue Billed (Invoices)', totalBilled],
    ['Revenue Collected', totalIncome+totalInvCollected],
    ['Total Outflow', totalOut],
    ['Net P&L', netPL],
    ['GST Collected', totalGST],
    ['CGST', totalGST/2],['SGST', totalGST/2],
    ['Outstanding Receivables (All-time)', outstandingByCustomer.reduce((s,c)=>s+c.balance,0)],
    ['Labour Due (All-time)', labourBalances.reduce((s,g)=>s+g.balance,0)],[],
    ['OUTFLOW BREAKDOWN',''],
    ['Material Purchases', totalMatCost],
    ['Labour Payments', totalLabor],
    ['Other Expenses', totalExpense],
  ]);

  // 2. Production
  add('Production',[
    ['Date','Factory','Product','Qty (pcs)','Labour Group','Notes'],
    ...todayProd.map(e=>[fmtDate(e.date),fName(e.factoryId),pName(e.productId),num(e.quantity),gName(e.laborGroupId),e.notes||'']),
  ]);

  // 3. Tax Invoices
  add('Invoices',[
    ['Invoice No','Date','Customer','Status','Taxable (₹)','CGST (₹)','SGST (₹)','Total (₹)','Paid (₹)','Balance (₹)'],
    ...invInRange.map(inv=>[
      inv.invoiceNumber||'—', fmtDate(inv.date), inv.customerName||'—', inv.status||'draft',
      inv.taxable, inv.halfTax, inv.halfTax, inv.total, num(inv.paidAmount), Math.max(0,inv.total-num(inv.paidAmount)),
    ]),
    [],[`Total (${invInRange.length} invoices)`,'','','',
      invInRange.reduce((s,i)=>s+i.taxable,0), totalGST/2, totalGST/2, totalBilled, totalInvCollected,
      invInRange.reduce((s,i)=>s+Math.max(0,i.total-num(i.paidAmount)),0)],
  ]);

  // 4. Outstanding Receivables
  add('Receivables',[
    ['Customer','Pending Invoices','Balance Due (₹)'],
    ...outstandingByCustomer.map(c=>[c.name, c.count, c.balance]),
    [],['TOTAL','',outstandingByCustomer.reduce((s,c)=>s+c.balance,0)],
  ]);

  // 5. Orders
  add('Orders',[
    ['Order No','Date','Customer','Product','Total Qty','Dispatched','Pending Qty','Total Amt','Received','Pending Amt','Delivery Date','Status'],
    ...allOrders.map(o=>{
      const disp = allOrderDispatches.filter(d=>d.orderId===o.id).reduce((s,d)=>s+num(d.quantity),0);
      const recd = allOrderPayments.filter(p=>p.orderId===o.id&&p.direction==='received').reduce((s,p)=>s+num(p.amount),0);
      return [o.orderNumber||'—',fmtDate(o.date),o.customerName||'—',pName(o.productId),
        num(o.quantity),disp,Math.max(0,num(o.quantity)-disp),
        num(o.totalAmount),recd,Math.max(0,num(o.totalAmount)-recd),
        fmtDate(o.deliveryDate),o.status||'—'];
    }),
  ]);

  // 6. Quotes
  add('Quotes',[
    ['Quote No','Date','Customer','Status','Valid Until','Total (₹)'],
    ...allQuotes.map(q=>[q.quoteNumber||'—',fmtDate(q.date),q.customerName||'—',q.status||'draft',fmtDate(q.validUntil),num(q.totalAmount)]),
  ]);

  // 7. Incoming Payments
  add('Incoming',[
    ['Date','Customer','Product','Order No','Received (₹)','Bank Account','Notes'],
    ...todayIncoming.map(p=>{
      const o=allOrders.find(x=>x.id===p.orderId)||{};
      return [fmtDate(p.date),o.customerName||'—',pName(o.productId),o.orderNumber||'—',num(p.amount),aName(p.bankAccountId),p.notes||''];
    }),
  ]);

  // 8. Material Purchases
  add('Mat Purchases',[
    ['Date','Material','Qty','Unit','Rate/Unit (₹)','Total (₹)','Supplier','Bill No','Bank Acct','Notes'],
    ...todayMat.map(p=>[fmtDate(p.date),mName(p.materialTypeId),num(p.quantity),mUnit(p.materialTypeId),
      num(p.ratePerUnit),num(p.totalAmount),p.supplier||'—',p.billNumber||'—',aName(p.bankAccountId),p.notes||'']),
    [],['TOTAL','','','','',totalMatCost],
  ]);

  // 9. Material Stock (all-time)
  add('Stock',[
    ['Material','Unit','Purchased','Consumed (kg)','Remaining','% Left','Status'],
    ...stockData.map(s=>[s.name,s.unit,s.purchasedQty,Math.round(s.consumedKg),s.remainingDisplay,s.pct+'%',s.pct<20?'⚠ Low Stock':'OK']),
  ]);

  // 10. Labour
  add('Labour',[
    ['--- PAYMENTS IN PERIOD ---'],
    ['Date','Group','Type','Bank Acct','Notes','Amount (₹)'],
    ...todayLabor.map(p=>[fmtDate(p.date),gName(p.laborGroupId),p.paymentType||'regular',aName(p.bankAccountId),p.notes||'—',num(p.amount)]),
    [],['--- ALL-TIME BALANCES ---'],
    ['Group','Owed (₹)','Paid (₹)','Balance Due (₹)'],
    ...labourBalances.map(g=>[g.name,g.owed,g.paid,g.balance]),
  ]);

  // 11. Expenses
  add('Expenses',[
    ['Date','Category','Description','Bank Acct','Notes','Amount (₹)'],
    ...todayExp.map(e=>[fmtDate(e.date),cName(e.categoryId),e.description||'—',aName(e.bankAccountId),e.notes||'—',num(e.amount)]),
    [],['TOTAL','','','','',totalExpense],
  ]);

  // 12. P&L
  add('P&L',[
    ['P&L SUMMARY', periodLabel],[],
    ['INCOME',''],
    ['Order Payments Received', totalIncome],
    ['Invoice Collections', totalInvCollected],
    ['Total Income', totalIncome+totalInvCollected],[],
    ['COGS / EXPENSES',''],
    ['Material Purchases', totalMatCost],
    ['Labour Payments', totalLabor],
    ['Other Expenses', totalExpense],
    ['Total Outflow', totalOut],[],
    ['NET P&L', netPL],[],
    ['GST SUMMARY',''],
    ['Taxable Value', invInRange.reduce((s,i)=>s+i.taxable,0)],
    ['CGST (9%)', totalGST/2],['SGST (9%)', totalGST/2],
    ['Total GST', totalGST],
  ]);

  // 13. Bank Accounts
  add('Bank Accounts',[
    ['Account','In (₹)','Out (₹)','Net (₹)'],
    ...byAccount.map(a=>[a.name, a.income, a.out, a.net]),
  ]);

  return XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
}


// ── PDF builder ──────────────────────────────────────────────────────────
function buildReportPDF(periodType, rangeLabel, {
  todayProd, todayMat, todayIncoming, todayLabor, todayExp,
  allOrders, allOrderDispatches, allOrderPayments,
  invInRange, labourBalances, stockData, byAccount, outstandingByCustomer,
  allQuotes, products, factories, materialTypes, laborGroups, bankAccounts, expenseCategories,
  totalBilled, totalInvCollected, totalGST, totalIncome, totalMatCost, totalLabor, totalExpense, netPL,
  totalUnits, byProduct, companyInfo,
}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size:'A4', margins:{top:40,bottom:50,left:40,right:40}, bufferPages:true });
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const ML=40, PW=515;
    const AMBER='#92400e', DARK='#1f2937', GRAY='#6b7280';
    const GREEN='#15803d', RED='#dc2626', BG='#fef3c7', LINE='#fde68a';

    const coName = (companyInfo?.name||'UrbanMud Bricks and Blocks').toUpperCase();
    const coAddr = (companyInfo?.address||'Bhaktharahalli, near Hoskote, Bangalore - 562114').replace(/\n/g,', ');
    const coExtra = [companyInfo?.phone?'Ph: '+companyInfo.phone:'', companyInfo?.gstin?'GSTIN: '+companyInfo.gstin:''].filter(Boolean).join('  ');
    const numN = n => num(n);
    const rp   = n => 'Rs.'+numN(n).toLocaleString('en-IN',{maximumFractionDigits:2});
    const fd   = d => fmtDate(d);
    const pName = id => products.find(p=>p.id===id)?.name||'—';
    const fName = id => factories.find(f=>f.id===id)?.name||'—';
    const mName = id => materialTypes.find(m=>m.id===id)?.name||'—';
    const mUnit = id => materialTypes.find(m=>m.id===id)?.unit||'';
    const gName = id => laborGroups.find(g=>g.id===id)?.name||'—';
    const aName = id => bankAccounts.find(b=>b.id===id)?.name||'—';
    const cName = id => expenseCategories.find(c=>c.id===id)?.name||'—';

    function drawBanner() {
      const y = doc.y;
      doc.rect(ML,y,PW,54).fill(AMBER);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#fff').text(coName,ML+8,y+7,{width:PW-165,lineBreak:false});
      doc.font('Helvetica').fontSize(7).fillColor('#fcd34d').text(coAddr+(coExtra?' | '+coExtra:''),ML+8,y+23,{width:PW-165});
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#fff').text(`${periodType.toUpperCase()} REPORT`,ML+PW-155,y+7,{width:150,align:'right',lineBreak:false});
      doc.font('Helvetica').fontSize(7.5).fillColor('#fcd34d').text(rangeLabel,ML+PW-155,y+22,{width:150,align:'right'});
      const ts = new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});
      doc.text('Generated: '+ts,ML+PW-155,y+33,{width:150,align:'right'});
      doc.y = y+62;
    }

    function ensureSpace(h) { if (doc.y+h>760){doc.addPage();drawBanner();} }

    function secTitle(title,n) {
      ensureSpace(32);
      const y=doc.y+5;
      doc.rect(ML,y,PW,20).fill('#fffbeb');
      doc.rect(ML,y,4,20).fill(AMBER);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(AMBER).text(`${n}. ${title}`,ML+10,y+5,{width:PW-18,lineBreak:false});
      doc.y=y+26;
    }

    function table(headers, widths, rows, empty) {
      const HH=18, TW=widths.reduce((s,w)=>s+w,0);
      doc.font('Helvetica').fontSize(7);
      const rowH = rows.map(row => {
        let mx=15;
        row.forEach((cell,ci)=>{ const h=doc.heightOfString(String(cell??''),{width:widths[ci]-6}); mx=Math.max(mx,Math.ceil(h)+7); });
        return mx;
      });
      ensureSpace(HH+(rowH.slice(0,2).reduce((s,h)=>s+h,0)||18)+4);
      let y=doc.y;
      const drawHead=sy=>{
        doc.rect(ML,sy,TW,HH).fill(BG);
        doc.font('Helvetica-Bold').fontSize(7).fillColor(DARK);
        let x=ML; headers.forEach((h,i)=>{ doc.text(h,x+3,sy+5,{width:widths[i]-6,lineBreak:false}); x+=widths[i]; });
        doc.moveTo(ML,sy+HH).lineTo(ML+TW,sy+HH).strokeColor('#cbd5e1').lineWidth(0.4).stroke();
        return sy+HH;
      };
      y=drawHead(y);
      if(!rows.length){
        doc.font('Helvetica').fontSize(8).fillColor('#9ca3af').text(empty||'No data',ML+4,y+4); y+=18;
      } else {
        rows.forEach((row,ri)=>{
          const RH=rowH[ri];
          if(y+RH>760){doc.y=y;doc.addPage();drawBanner();y=drawHead(doc.y);}
          if(ri%2===1) doc.rect(ML,y,TW,RH).fill('#f8fafc');
          let rx=ML;
          row.forEach((cell,ci)=>{
            const last=ci===row.length-1;
            doc.font('Helvetica').fontSize(7).fillColor(DARK).text(String(cell??''),rx+3,y+4,{width:widths[ci]-6,lineBreak:true,align:last?'right':'left'});
            rx+=widths[ci];
          });
          doc.moveTo(ML,y+RH).lineTo(ML+TW,y+RH).strokeColor(LINE).lineWidth(0.25).stroke();
          y+=RH;
        });
      }
      doc.y=y+6;
    }

    function kpiStrip(kpis) {
      ensureSpace(70);
      const ky=doc.y+3, kw=PW/3;
      doc.rect(ML,ky,PW,62).fillAndStroke('#fffbeb','#fde68a').lineWidth(0.5);
      kpis.forEach((k,i)=>{
        const kx=ML+(i%3)*kw+8, kyy=ky+Math.floor(i/3)*31+6;
        doc.font('Helvetica').fontSize(7).fillColor(GRAY).text(k[0],kx,kyy,{width:kw-16,lineBreak:false});
        doc.font('Helvetica-Bold').fontSize(10).fillColor(k[2]).text(k[1],kx,kyy+10,{width:kw-16,lineBreak:false});
      });
      doc.y=ky+70;
    }

    // ── Start document ───────────────────────────────────────────────────
    drawBanner();

    // KPI Strip
    const totalOut = totalMatCost+totalLabor+totalExpense;
    kpiStrip([
      ['Units Produced', totalUnits+' pcs', DARK],
      ['Revenue Billed', rp(totalBilled), '#1d4ed8'],
      ['Revenue Collected', rp(totalIncome+totalInvCollected), GREEN],
      ['Total Outflow', rp(totalOut), RED],
      ['Net P&L', (netPL>=0?'+':'')+rp(netPL), netPL>=0?GREEN:RED],
      ['GST Collected', rp(totalGST), '#7c3aed'],
    ]);

    // 1. Production
    secTitle('PRODUCTION DETAILS',1);
    table(
      ['Date','Factory','Product','Qty (pcs)','Labour Group','Notes'],
      [55,95,120,65,90,90],
      todayProd.map(e=>[fd(e.date),fName(e.factoryId),pName(e.productId),numN(e.quantity),gName(e.laborGroupId),e.notes||'']),
      'No production in this period'
    );
    if(Object.keys(byProduct).length>0){
      table(
        ['Product','Units','Factories'],
        [200,100,215],
        Object.values(byProduct).map(p=>[p.name, p.qty+' pcs', p.fcts.join(', ')]),
        ''
      );
    }

    // 2. Tax Invoices & GST
    secTitle('SALES — TAX INVOICES & GST',2);
    // GST Summary box
    ensureSpace(52);
    const gsy=doc.y;
    doc.rect(ML,gsy,PW,46).fill('#eff6ff');
    const gw=PW/4;
    [['Total Taxable',rp(invInRange.reduce((s,i)=>s+i.taxable,0))],['CGST (9%)',rp(totalGST/2)],['SGST (9%)',rp(totalGST/2)],['Total GST',rp(totalGST)]].forEach(([l,v],i)=>{
      const gx=ML+i*gw+6, gy2=gsy+8;
      doc.font('Helvetica').fontSize(7).fillColor(GRAY).text(l,gx,gy2,{lineBreak:false});
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#1d4ed8').text(v,gx,gy2+13,{lineBreak:false});
    });
    doc.y=gsy+54;
    table(
      ['Invoice No','Date','Customer','Status','Taxable','CGST','SGST','Total','Paid','Balance'],
      [60,50,100,45,55,50,50,60,55,50],
      invInRange.map(inv=>{
        const bal=Math.max(0,inv.total-num(inv.paidAmount));
        return [inv.invoiceNumber||'—',fd(inv.date),inv.customerName||'—',inv.status||'draft',
          rp(inv.taxable),rp(inv.halfTax),rp(inv.halfTax),rp(inv.total),rp(inv.paidAmount),bal>0?rp(bal):'Paid'];
      }),
      'No invoices in this period'
    );

    // 3. Outstanding Receivables
    if(outstandingByCustomer.length>0){
      secTitle('OUTSTANDING RECEIVABLES (All-time)',3);
      table(
        ['Customer','Pending Invoices','Balance Due'],
        [280,115,120],
        outstandingByCustomer.map(c=>[c.name, c.count+' invoice'+(c.count>1?'s':''), rp(c.balance)]),
        ''
      );
      ensureSpace(20);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(RED).text('Total Outstanding: '+rp(outstandingByCustomer.reduce((s,c)=>s+c.balance,0)),ML+PW-200,doc.y,{width:200,align:'right'});
      doc.moveDown(0.5);
    }

    // 4. Orders Pipeline
    secTitle('ORDERS PIPELINE',4);
    const ordersWithStatus = allOrders.map(o=>{
      const disp=allOrderDispatches.filter(d=>d.orderId===o.id).reduce((s,d)=>s+num(d.quantity),0);
      const recd=allOrderPayments.filter(p=>p.orderId===o.id&&p.direction==='received').reduce((s,p)=>s+num(p.amount),0);
      return {...o,pendingQty:Math.max(0,num(o.quantity)-disp),pendingAmt:Math.max(0,num(o.totalAmount)-recd)};
    });
    table(
      ['Customer','Product','Total','Dispatched','Pending Qty','Total Amt','Received','Pending Amt'],
      [100,100,50,60,65,65,65,60],
      ordersWithStatus.map(o=>[o.customerName||'—',pName(o.productId),num(o.quantity)+' pcs',
        (num(o.quantity)-o.pendingQty)+' pcs',o.pendingQty>0?o.pendingQty+' pcs':'—',
        rp(o.totalAmount),rp(num(o.totalAmount)-o.pendingAmt),o.pendingAmt>0?rp(o.pendingAmt):'Settled']),
      'No orders'
    );

    // 5. Quotes Pipeline
    if(allQuotes.length>0){
      secTitle('QUOTES PIPELINE',5);
      const qByStatus = ['draft','sent','accepted','rejected','expired'].map(st=>({st,count:allQuotes.filter(q=>q.status===st).length})).filter(x=>x.count>0);
      ensureSpace(22);
      doc.font('Helvetica').fontSize(8).fillColor(DARK);
      qByStatus.forEach(q=>doc.text(`${q.st.toUpperCase()}: ${q.count}  `,ML,doc.y,{continued:true}));
      doc.text('',{continued:false}); doc.moveDown(0.4);
      table(
        ['Quote No','Date','Customer','Status','Total'],
        [75,55,200,65,120],
        allQuotes.slice(0,15).map(q=>[q.quoteNumber||'—',fd(q.date),q.customerName||'—',q.status||'draft',rp(q.totalAmount)]),
        ''
      );
    }

    // 6. Incoming Payments
    secTitle('SALES COLLECTIONS — INCOMING PAYMENTS',6);
    table(
      ['Date','Customer','Product','Order No','Bank Account','Amount'],
      [50,115,110,65,95,80],
      todayIncoming.map(p=>{const o=allOrders.find(x=>x.id===p.orderId)||{};return[fd(p.date),o.customerName||'—',pName(o.productId),o.orderNumber||'—',aName(p.bankAccountId),rp(p.amount)];}),
      'No incoming payments'
    );

    // 7. Material Purchases
    secTitle('MATERIAL PURCHASES',7);
    table(
      ['Date','Material','Qty','Rate','Supplier','Bill No','Amount'],
      [50,90,55,60,90,65,105],
      todayMat.map(p=>[fd(p.date),mName(p.materialTypeId),numN(p.quantity)+' '+mUnit(p.materialTypeId),p.ratePerUnit?rp(p.ratePerUnit):'—',p.supplier||'—',p.billNumber||'—',rp(p.totalAmount)]),
      'No material purchases'
    );

    // 8. Material Stock
    secTitle('MATERIAL STOCK & CONSUMPTION (All-time)',8);
    table(
      ['Material','Purchased','Consumed (kg)','Remaining','% Left','Alert'],
      [130,90,90,90,55,60],
      stockData.map(s=>[s.name,s.purchasedQty+' '+s.unit,Math.round(s.consumedKg)+'kg',s.remainingDisplay,s.pct+'%',s.pct<20?'⚠ LOW':'OK']),
      'No materials'
    );

    // 9. Labour Payments + Balances
    secTitle('LABOUR PAYMENTS (Period)',9);
    table(
      ['Date','Labour Group','Type','Bank Account','Notes','Amount'],
      [50,100,65,95,110,95],
      todayLabor.map(p=>[fd(p.date),gName(p.laborGroupId),p.paymentType||'regular',aName(p.bankAccountId),p.notes||'—',rp(p.amount)]),
      'No labour payments'
    );
    if(labourBalances.length>0){
      ensureSpace(20); doc.font('Helvetica-Bold').fontSize(8).fillColor(AMBER).text('Labour Balances (All-time)',ML,doc.y); doc.moveDown(0.3);
      table(
        ['Labour Group','Total Owed','Total Paid','Balance Due'],
        [180,110,110,115],
        labourBalances.map(g=>[g.name,rp(g.owed),rp(g.paid),g.balance>0?rp(g.balance):'Settled']),
        ''
      );
    }

    // 10. Expenses
    secTitle('OTHER EXPENSES',10);
    table(
      ['Date','Category','Description','Bank Account','Amount'],
      [50,90,130,100,145],
      todayExp.map(e=>[fd(e.date),cName(e.categoryId),e.description||'—',aName(e.bankAccountId),rp(e.amount)]),
      'No expenses'
    );

    // 11. P&L
    secTitle('FINANCIAL SUMMARY — P&L',11);
    ensureSpace(160);
    const sy=doc.y, SW=340;
    const plRows=[
      ['Order Payments Received', rp(totalIncome), GREEN],
      ['Invoice Collections', rp(totalInvCollected), GREEN],
      ['Less: Material Purchases', '('+rp(totalMatCost)+')', RED],
      ['Less: Labour Payments', '('+rp(totalLabor)+')', RED],
      ['Less: Other Expenses', '('+rp(totalExpense)+')', RED],
    ];
    let ry=sy;
    plRows.forEach(([l,v,c])=>{
      doc.font('Helvetica').fontSize(9).fillColor(DARK).text(l,ML+6,ry+4,{width:SW-115,lineBreak:false});
      doc.font('Helvetica-Bold').fontSize(9).fillColor(c).text(v,ML+SW-110,ry+4,{width:105,align:'right',lineBreak:false});
      ry+=22;
    });
    doc.moveTo(ML,ry).lineTo(ML+SW,ry).strokeColor('#d1d5db').lineWidth(1).stroke(); ry+=4;
    doc.rect(ML,ry,SW,30).fill(netPL>=0?'#f0fdf4':'#fef2f2');
    doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('NET P&L',ML+6,ry+9,{lineBreak:false});
    doc.font('Helvetica-Bold').fontSize(13).fillColor(netPL>=0?GREEN:RED).text((netPL>=0?'+':'')+rp(netPL),ML+SW-110,ry+7,{width:105,align:'right',lineBreak:false});
    doc.y=ry+38;

    // 12. Bank Accounts
    if(byAccount.length>0){
      secTitle('BY BANK ACCOUNT',12);
      table(
        ['Account','Incoming','Outgoing','Net'],
        [200,105,105,105],
        byAccount.map(a=>[a.name,rp(a.income),rp(a.out),(a.net>=0?'+':'')+rp(a.net)]),
        ''
      );
    }

    // Footer
    const range=doc.bufferedPageRange();
    for(let i=0;i<range.count;i++){
      doc.switchToPage(range.start+i);
      const sb=doc.page.margins.bottom; doc.page.margins.bottom=0;
      doc.font('Helvetica').fontSize(7).fillColor(GRAY);
      doc.moveTo(ML,doc.page.height-22).lineTo(ML+PW,doc.page.height-22).strokeColor('#fde68a').lineWidth(0.4).stroke();
      doc.text(`Page ${i+1} of ${range.count}  ·  Urbanmud ${periodType} Report  ·  ${rangeLabel}  ·  CONFIDENTIAL`,
        ML,doc.page.height-17,{width:PW,align:'center',lineBreak:false});
      doc.page.margins.bottom=sb;
    }
    doc.flushPages(); doc.end();
  });
}


// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const today    = todayIST();
  const fromDate = (process.env.REPORT_FROM_DATE||'').trim() || today;
  const toDate   = (process.env.REPORT_TO_DATE  ||'').trim() || today;
  const periodType  = getPeriodType(fromDate, toDate);
  const rangeLabel  = fromDate === toDate ? fmtDate(fromDate) : `${fmtDate(fromDate)} to ${fmtDate(toDate)}`;
  const periodLabel = `${periodType} Report — ${rangeLabel}`;
  console.log(`Generating ${periodType} report: ${fromDate} → ${toDate}`);

  const inRange = d => { const s=(d||'').slice(0,10); return s>=fromDate && s<=toDate; };

  // Load all Firestore docs
  const [master, production, materials, finance, sales] = await Promise.all([
    loadDoc('master'), loadDoc('production'), loadDoc('materials'),
    loadDoc('finance'), loadDoc('sales'),
  ]);

  const users             = master.users             || [];
  const products          = master.products          || [];
  const factories         = master.factories         || [];
  const materialTypes     = master.materialTypes     || [];
  const laborGroups       = master.laborGroups       || [];
  const bankAccounts      = master.bankAccounts      || [];
  const expenseCategories = master.expenseCategories || [];
  const companyInfo       = master.companyInfo       || {};

  const allProdEntries    = production.productionEntries || [];
  const allMatPurchases   = materials.materialPurchases  || [];
  const allOrderPayments  = finance.orderPayments        || [];
  const allOrderDispatches= finance.orderDispatches      || [];
  const allOrders         = finance.orders               || [];
  const allLaborPayments  = finance.laborPayments        || [];
  const allExpenses       = finance.expenses             || [];
  const allInvoices       = sales.invoices               || [];
  const allQuotes         = sales.quotes                 || [];
  const allEnquiries      = sales.enquiries              || [];

  // Filter to date range
  const todayProd     = allProdEntries .filter(e => inRange(e.date));
  const todayMat      = allMatPurchases.filter(p => inRange(p.date));
  const todayLabor    = allLaborPayments.filter(p => inRange(p.date));
  const todayExp      = allExpenses.filter(e => inRange(e.date));
  const todayIncoming = allOrderPayments.filter(p => inRange(p.date) && p.direction==='received');

  // Helper lookups
  const pName = id => products.find(p=>p.id===id)?.name||'—';
  const fName = id => factories.find(f=>f.id===id)?.name||'—';
  const mName = id => materialTypes.find(m=>m.id===id)?.name||'—';
  const mUnit = id => materialTypes.find(m=>m.id===id)?.unit||'';
  const gName = id => laborGroups.find(g=>g.id===id)?.name||'—';
  const aName = id => bankAccounts.find(b=>b.id===id)?.name||'—';
  const cName = id => expenseCategories.find(c=>c.id===id)?.name||'—';

  // ── Invoices ────────────────────────────────────────────────────────────
  const invInRange = allInvoices.filter(inv=>inRange(inv.date)).map(inv=>({...inv,...calcInvTotals(inv)}));
  const totalBilled        = invInRange.reduce((s,i)=>s+i.total,0);
  const totalInvCollected  = invInRange.reduce((s,i)=>s+num(i.paidAmount),0);
  const totalGST           = invInRange.reduce((s,i)=>s+i.taxAmt,0);

  // Outstanding receivables (all-time)
  const allInvCalc = allInvoices.map(inv=>({...inv,...calcInvTotals(inv)}));
  const outstandingByCustomer = Object.values(allInvCalc.reduce((acc,inv)=>{
    const bal = Math.max(0,inv.total-num(inv.paidAmount));
    if(bal<=0) return acc;
    const key=inv.customerName||'Unknown';
    if(!acc[key]) acc[key]={name:key,balance:0,count:0};
    acc[key].balance+=bal; acc[key].count++;
    return acc;
  },{})).sort((a,b)=>b.balance-a.balance);

  // ── Quotes pipeline ─────────────────────────────────────────────────────
  const quotesByStatus = ['draft','sent','accepted','rejected','expired'].map(st=>({
    st, count:allQuotes.filter(q=>q.status===st).length,
  })).filter(x=>x.count>0);
  const conversionRate = allQuotes.length>0 ? Math.round((allQuotes.filter(q=>q.status==='accepted').length/allQuotes.length)*100) : 0;

  // ── Orders pipeline ─────────────────────────────────────────────────────
  const ordersWithStatus = allOrders.map(o=>{
    const disp=allOrderDispatches.filter(d=>d.orderId===o.id).reduce((s,d)=>s+num(d.quantity),0);
    const recd=allOrderPayments.filter(p=>p.orderId===o.id&&p.direction==='received').reduce((s,p)=>s+num(p.amount),0);
    return {...o,dispatched:disp,pendingQty:Math.max(0,num(o.quantity)-disp),pendingAmt:Math.max(0,num(o.totalAmount)-recd)};
  });
  const pendingOrders = ordersWithStatus.filter(o=>o.pendingQty>0||o.pendingAmt>0);

  // ── Labour balances (all-time) ──────────────────────────────────────────
  const labourBalances = laborGroups.map(g=>{
    const owed=allProdEntries.filter(e=>e.laborGroupId===g.id).reduce((s,e)=>s+num(e.labourAmountOwed),0);
    const paid=allLaborPayments.filter(p=>p.laborGroupId===g.id).reduce((s,p)=>s+num(p.amount),0);
    return {...g,owed,paid,balance:Math.max(0,owed-paid)};
  }).filter(g=>g.owed>0||g.paid>0);

  // ── Material stock (all-time) ───────────────────────────────────────────
  const stockData = materialTypes.map(mat=>{
    const purchased = allMatPurchases.filter(p=>p.materialTypeId===mat.id).reduce((s,p)=>s+num(p.quantity),0);
    const kgPU = num(mat.weightKgPerUnit||(mat.unit?.toLowerCase()==='trucks'?30000:mat.unit?.toLowerCase()==='bags'?50:1));
    const purchasedKg = purchased*kgPU;
    const muConsumedKg = allProdEntries.flatMap(e=>e.materialsUsed||[]).filter(mu=>mu.materialTypeId===mat.id).reduce((s,mu)=>s+num(mu.kgUsed),0);
    const bagConsumedKg = mat.unit?.toLowerCase()==='bags' ? allProdEntries.reduce((s,e)=>s+num(e.cementBags),0)*50 : 0;
    const consumedKg = muConsumedKg || bagConsumedKg;
    const remainingKg = Math.max(0,purchasedKg-consumedKg);
    const pctLeft = purchasedKg>0?Math.round((remainingKg/purchasedKg)*100):0;
    const remainingDisplay = kgPU>1 ? `${Math.round(remainingKg/kgPU)} ${mat.unit} (${Math.round(remainingKg)}kg)` : `${Math.round(remainingKg)}kg`;
    return {...mat,purchasedQty:purchased,purchasedKg,consumedKg,remainingKg,remainingDisplay,pct:pctLeft};
  }).filter(m=>m.purchasedKg>0);

  // ── Production summary ──────────────────────────────────────────────────
  const totalUnits = todayProd.reduce((s,e)=>s+num(e.quantity),0);
  const byProduct = {};
  todayProd.forEach(e=>{
    if(!byProduct[e.productId]) byProduct[e.productId]={name:pName(e.productId),qty:0,fcts:[]};
    byProduct[e.productId].qty+=num(e.quantity);
    const fn=fName(e.factoryId);
    if(!byProduct[e.productId].fcts.includes(fn)) byProduct[e.productId].fcts.push(fn);
  });

  // ── Financials ──────────────────────────────────────────────────────────
  const totalIncome   = todayIncoming.reduce((s,p)=>s+num(p.amount),0);
  const totalMatCost  = todayMat.reduce((s,p)=>s+num(p.totalAmount),0);
  const totalLabor    = todayLabor.reduce((s,p)=>s+num(p.amount),0);
  const totalExpense  = todayExp.reduce((s,e)=>s+num(e.amount),0);
  const totalOut      = totalMatCost+totalLabor+totalExpense;
  const netPL         = totalIncome+totalInvCollected-totalOut;

  // ── By bank account ─────────────────────────────────────────────────────
  const byAccount = bankAccounts.map(acc=>{
    const income = todayIncoming.filter(p=>p.bankAccountId===acc.id).reduce((s,p)=>s+num(p.amount),0);
    const mat    = todayMat.filter(p=>p.bankAccountId===acc.id).reduce((s,p)=>s+num(p.totalAmount),0);
    const labor  = todayLabor.filter(p=>p.bankAccountId===acc.id).reduce((s,p)=>s+num(p.amount),0);
    const exp    = todayExp.filter(e=>e.bankAccountId===acc.id).reduce((s,e)=>s+num(e.amount),0);
    return {...acc,income,out:mat+labor+exp,net:income-mat-labor-exp};
  }).filter(a=>a.income>0||a.out>0);

  const data = {
    fromDate, toDate, todayProd, todayMat, todayIncoming, todayLabor, todayExp,
    allOrders, allOrderPayments, allOrderDispatches, allInvoices, allQuotes, allEnquiries,
    invInRange, labourBalances, stockData, byAccount, outstandingByCustomer,
    products, factories, materialTypes, laborGroups, bankAccounts, expenseCategories, companyInfo,
    totalBilled, totalInvCollected, totalGST, totalIncome, totalMatCost, totalLabor, totalExpense,
    totalOut, netPL, totalUnits, byProduct,
  };

  // ── HTML Email body ──────────────────────────────────────────────────────
  const co = companyInfo.name || 'UrbanMud Bricks and Blocks';

  const kpiCards = [
    ['🧱 Units Produced',  totalUnits+' pcs',                              '#92400e'],
    ['📄 Revenue Billed',  cur(totalBilled),                               '#1d4ed8'],
    ['💰 Collected',       cur(totalIncome+totalInvCollected),             '#15803d'],
    ['📤 Total Outflow',   cur(totalOut),                                  '#dc2626'],
    ['📊 Net P&L',         (netPL>=0?'+':'')+cur(netPL),  netPL>=0?'#15803d':'#dc2626'],
    ['🔖 GST Collected',   cur(totalGST),                                  '#7c3aed'],
  ].map(([l,v,c])=>kpi(l,v,c)).join('');

  // Production table
  const prodRows = todayProd.map(e=>[fName(e.factoryId),pName(e.productId),`${num(e.quantity)} pcs`,gName(e.laborGroupId),e.notes||'—']);
  const prodSumRows = Object.values(byProduct).map(p=>[p.name,`${p.qty} pcs`,p.fcts.join(', ')]);

  // Invoices table
  const invRows = invInRange.map(inv=>{
    const bal=Math.max(0,inv.total-num(inv.paidAmount));
    return [inv.invoiceNumber||'—',fmtDate(inv.date),inv.customerName||'—',inv.status||'draft',cur(inv.taxable),cur(inv.halfTax),cur(inv.halfTax),cur(inv.total),bal>0?cur(bal):'<span style="color:green">Paid</span>'];
  });

  // Outstanding
  const recvRows = outstandingByCustomer.map(c=>[c.name,c.count+' invoice'+(c.count>1?'s':''),cur(c.balance)]);

  // Orders
  const orderRows = pendingOrders.map(o=>[
    o.customerName||'—', pName(o.productId),
    o.pendingQty>0?`${o.pendingQty} pcs pending`:'Dispatched',
    o.pendingAmt>0?cur(o.pendingAmt):'Settled',
    fmtDate(o.deliveryDate),
  ]);

  // Quotes
  const quoteStatusLine = quotesByStatus.map(q=>`<span style="background:#f3f4f6;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${q.st.toUpperCase()}: ${q.count}</span>`).join(' ');

  // Material purchases
  const matRows = todayMat.map(p=>[mName(p.materialTypeId),`${num(p.quantity)} ${mUnit(p.materialTypeId)}`,p.ratePerUnit?cur(p.ratePerUnit):'—',cur(p.totalAmount),p.supplier||'—',p.billNumber||'—']);

  // Stock
  const stockRows = stockData.map(s=>[
    s.name, `${s.purchasedQty} ${s.unit}`, `${Math.round(s.consumedKg)}kg`, s.remainingDisplay,
    `<span style="color:${s.pct<20?'#dc2626':'#15803d'};font-weight:700">${s.pct}% ${s.pct<20?'⚠ LOW':'✓'}</span>`,
  ]);

  // Labour
  const laborRows = todayLabor.map(p=>[gName(p.laborGroupId),p.paymentType||'regular',aName(p.bankAccountId),cur(p.amount)]);
  const laborBalRows = labourBalances.map(g=>[g.name,cur(g.owed),cur(g.paid),`<span style="color:${g.balance>0?'#dc2626':'#15803d'};font-weight:700">${g.balance>0?cur(g.balance):'Settled'}</span>`]);

  // Expenses
  const expRows = todayExp.map(e=>[cName(e.categoryId),e.description||'—',aName(e.bankAccountId),cur(e.amount)]);

  // Bank
  const bankRows = byAccount.map(a=>[a.name,`<span style="color:#15803d">${cur(a.income)}</span>`,`<span style="color:#dc2626">${cur(a.out)}</span>`,`<span style="font-weight:700;color:${a.net>=0?'#15803d':'#dc2626'}">${a.net>=0?'+':''}${cur(a.net)}</span>`]);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:720px;margin:0 auto;background:#f9fafb;color:#1a1a1a;padding:16px}table{width:100%;border-collapse:collapse}td,th{vertical-align:top}</style>
</head><body>

<div style="background:linear-gradient(135deg,#92400e,#451a03);padding:28px 32px;border-radius:12px 12px 0 0">
  <h1 style="color:#fff;margin:0;font-size:21px">🏭 ${co}</h1>
  <p style="color:#fcd34d;margin:4px 0 0;font-size:14px">${periodType} Report &nbsp;|&nbsp; ${rangeLabel}</p>
  <p style="color:#fde68a;margin:4px 0 0;font-size:11px">Generated: ${new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</p>
</div>

<div style="background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px">${kpiCards}</div>

  ${sec('1. Production Details','#92400e','🏭',
    htmlTable(['Factory','Product','Quantity','Labour Group','Notes'],prodRows,'No production in this period') +
    (prodSumRows.length>1?'<p style="font-size:11px;color:#6b7280;margin:10px 0 4px">Product-wise Summary</p>'+htmlTable(['Product','Total Units','Factories'],prodSumRows):'')
  )}

  ${sec('2. Sales — Tax Invoices & GST','#1d4ed8','📄',
    `<div style="background:#eff6ff;border-radius:8px;padding:14px;margin-bottom:12px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
      <div><p style="margin:0;font-size:10px;color:#6b7280">Taxable Value</p><p style="margin:4px 0 0;font-weight:700;color:#1d4ed8">${cur(invInRange.reduce((s,i)=>s+i.taxable,0))}</p></div>
      <div><p style="margin:0;font-size:10px;color:#6b7280">CGST (9%)</p><p style="margin:4px 0 0;font-weight:700;color:#1d4ed8">${cur(totalGST/2)}</p></div>
      <div><p style="margin:0;font-size:10px;color:#6b7280">SGST (9%)</p><p style="margin:4px 0 0;font-weight:700;color:#1d4ed8">${cur(totalGST/2)}</p></div>
      <div><p style="margin:0;font-size:10px;color:#6b7280">Total GST</p><p style="margin:4px 0 0;font-weight:700;color:#7c3aed">${cur(totalGST)}</p></div>
    </div>` +
    htmlTable(['Invoice No','Date','Customer','Status','Taxable','CGST','SGST','Total','Balance'],invRows,'No invoices in this period')
  )}

  ${outstandingByCustomer.length>0 ? sec('3. Outstanding Receivables (All-time)','#dc2626','⚠️',
    htmlTable(['Customer','Pending Invoices','Balance Due'],recvRows) +
    `<p style="text-align:right;font-weight:700;color:#dc2626;font-size:13px">Total Outstanding: ${cur(outstandingByCustomer.reduce((s,c)=>s+c.balance,0))}</p>`
  ) : ''}

  ${sec('4. Orders Pipeline','#f59e0b','📦',
    `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;text-align:center">
      <div style="background:#fef3c7;border-radius:8px;padding:10px"><p style="margin:0;font-size:10px;color:#b45309">Total Orders</p><p style="margin:4px 0 0;font-weight:700;color:#92400e;font-size:16px">${allOrders.length}</p></div>
      <div style="background:#fef3c7;border-radius:8px;padding:10px"><p style="margin:0;font-size:10px;color:#b45309">Pending Dispatch</p><p style="margin:4px 0 0;font-weight:700;color:#92400e;font-size:16px">${pendingOrders.reduce((s,o)=>s+o.pendingQty,0)} pcs</p></div>
      <div style="background:#fef2f2;border-radius:8px;padding:10px"><p style="margin:0;font-size:10px;color:#991b1b">Pending Collection</p><p style="margin:4px 0 0;font-weight:700;color:#dc2626;font-size:16px">${cur(pendingOrders.reduce((s,o)=>s+o.pendingAmt,0))}</p></div>
    </div>` +
    htmlTable(['Customer','Product','Pending Qty','Pending Amt','Delivery Date'],orderRows,'All orders are settled')
  )}

  ${allQuotes.length>0 ? sec('5. Quotes Pipeline','#7c3aed','💬',
    `<p style="margin:0 0 10px">${quoteStatusLine} &nbsp; <span style="font-size:11px;color:#6b7280">Conversion Rate: <strong>${conversionRate}%</strong></span></p>` +
    htmlTable(['Quote No','Date','Customer','Status','Total'],allQuotes.slice(0,10).map(q=>[q.quoteNumber||'—',fmtDate(q.date),q.customerName||'—',q.status||'draft',cur(q.totalAmount)]),'')
  ) : ''}

  ${sec('6. Incoming Payments','#15803d','💰',
    htmlTable(['Date','Customer','Product','Order No','Bank Account','Amount'],
      todayIncoming.map(p=>{const o=allOrders.find(x=>x.id===p.orderId)||{};return[fmtDate(p.date),o.customerName||'—',pName(o.productId),o.orderNumber||'—',aName(p.bankAccountId),cur(p.amount)];}),
      'No incoming payments')
  )}

  ${sec('7. Material Purchases','#1d4ed8','📦',
    htmlTable(['Material','Quantity','Rate','Total Amount','Supplier','Bill No'],matRows,'No material purchases') +
    `<p style="text-align:right;font-size:12px;font-weight:700;color:#dc2626">Total: ${cur(totalMatCost)}</p>`
  )}

  ${sec('8. Material Stock & Consumption (All-time)','#b45309','🏗️',
    htmlTable(['Material','Purchased','Consumed','Remaining','Status'],stockRows,'No material data')
  )}

  ${sec('9. Labour Payments','#065f46','👷',
    htmlTable(['Group','Type','Bank Account','Amount'],laborRows,'No labour payments') +
    (labourBalances.length>0?'<p style="font-size:11px;color:#6b7280;margin:12px 0 4px;font-weight:600">All-time Labour Balances</p>'+htmlTable(['Group','Owed','Paid','Balance'],laborBalRows):'')
  )}

  ${sec('10. Other Expenses','#7c3aed','💸',
    htmlTable(['Category','Description','Bank Account','Amount'],expRows,'No expenses') +
    `<p style="text-align:right;font-size:12px;font-weight:700;color:#dc2626">Total: ${cur(totalExpense)}</p>`
  )}

  <div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
    <p style="font-weight:700;font-size:14px;margin:0 0 12px;color:#374151">📋 ${periodType} P&L Summary</p>
    <table><tbody>
      <tr><td style="padding:4px 0;color:#6b7280;font-size:13px">Order Payments Received</td><td style="text-align:right;font-weight:600;color:#15803d">${cur(totalIncome)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;font-size:13px">Invoice Collections</td><td style="text-align:right;font-weight:600;color:#15803d">${cur(totalInvCollected)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;font-size:13px">Material Purchases</td><td style="text-align:right;font-weight:600;color:#dc2626">(${cur(totalMatCost)})</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;font-size:13px">Labour Payments</td><td style="text-align:right;font-weight:600;color:#dc2626">(${cur(totalLabor)})</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;font-size:13px">Other Expenses</td><td style="text-align:right;font-weight:600;color:#dc2626">(${cur(totalExpense)})</td></tr>
      <tr style="border-top:2px solid #e5e7eb"><td style="padding:10px 0 4px;font-weight:700;color:#374151;font-size:14px">Net P&L</td>
        <td style="text-align:right;font-weight:800;font-size:18px;color:${netPL>=0?'#15803d':'#dc2626'}">${netPL>=0?'+':''}${cur(netPL)}</td></tr>
    </tbody></table>
  </div>

  ${byAccount.length>0 ? sec('11. By Bank Account','#4b5563','🏦',
    htmlTable(['Account','Incoming','Outgoing','Net'],bankRows,'')
  ) : ''}

  <p style="color:#9ca3af;font-size:11px;margin-top:20px;text-align:center">
    📎 <strong>PDF</strong> — printable A4 letterhead &nbsp;|&nbsp; 📎 <strong>Excel</strong> — 13 sheets of full transaction detail<br>
    Auto-generated by Urbanmud Ops &nbsp;·&nbsp; ${periodLabel}
  </p>
</div>
</body></html>`;

  // ── Build attachments ───────────────────────────────────────────────────
  const excelBuffer = buildExcel(periodLabel, {...data, outstandingByCustomer});

  let pdfBuffer = null;
  try {
    pdfBuffer = await buildReportPDF(periodType, rangeLabel, {...data, outstandingByCustomer});
    console.log('PDF generated:', Math.round(pdfBuffer.length/1024), 'KB');
  } catch(pdfErr) {
    console.warn('PDF generation failed (email will be sent without PDF):', pdfErr.message);
  }

  // ── Send email ───────────────────────────────────────────────────────────
  const configuredEmails = (master.reportEmails||[]).filter(Boolean);
  const adminEmails = users.filter(u=>u.role==='admin'&&u.email).map(u=>u.email);
  const fallbackList = (process.env.REPORT_TO||process.env.GMAIL_USER||'').split(',').map(e=>e.trim()).filter(Boolean);
  const allEmails = [...new Set([...configuredEmails,...adminEmails,...fallbackList])];
  console.log('Sending to:', allEmails.join(', '));

  const suffix = fromDate===toDate?fromDate:`${fromDate}_to_${toDate}`;
  await transporter.sendMail({
    from: `"Urbanmud Reports" <${process.env.GMAIL_USER}>`,
    to: allEmails.join(', '),
    subject: `[${periodType}] Urbanmud Report — ${rangeLabel}`,
    html,
    attachments: [
      pdfBuffer && { filename:`Urbanmud_${periodType}_Report_${suffix}.pdf`, content:pdfBuffer, contentType:'application/pdf' },
      { filename:`Urbanmud_${periodType}_Data_${suffix}.xlsx`, content:excelBuffer, contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    ].filter(Boolean),
  });

  console.log(`✅ ${periodType} report sent! PDF + Excel (13 sheets) attached.`);
}

main().catch(err => { console.error(err); process.exit(1); });
