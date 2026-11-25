import { currency, type CartSummary } from './cartSummary';
import logoUrl from '../../assets/petwork-logo-bw.png';

const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function invoiceNumber(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `INV-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function invoiceHtml(summary: CartSummary, paymentMode: string): string {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(now);
  const number = invoiceNumber(now);
  const logo = new URL(logoUrl, window.location.href).href;

  const rows = summary.lines
    .map((l) => {
      const price = l.item.price ?? 0;
      const mrp = l.item.mrp !== undefined && l.item.mrp > price ? ` <s>${esc(currency(l.item.mrp))}</s>` : '';
      return `<tr>
        <td><div class="name">${esc(l.item.name ?? 'Product')}${l.item.size ? ` (${esc(l.item.size)})` : ''}</div>
            <div class="sub">${l.quantity} × ${esc(currency(price))}${mrp}</div></td>
        <td class="num">${esc(currency(price * l.quantity))}</td>
      </tr>`;
    })
    .join('');

  // "Total price" is what the order would cost at MRP (plus any delivery/other charges);
  // the final price is what the customer actually pays. The gap is the discount shown.
  const mrpTotal = summary.lines.reduce(
    (sum, l) => sum + Math.max(l.item.mrp ?? 0, l.item.price ?? 0) * l.quantity,
    0,
  );
  const extraCharges = summary.charges.filter((c) => c.label !== 'Discount');
  const couponDiscount = summary.charges
    .filter((c) => c.label === 'Discount')
    .reduce((sum, c) => sum + Math.abs(c.amount), 0);
  const productSavings = mrpTotal - summary.itemsTotal;
  const totalPrice = mrpTotal + extraCharges.reduce((sum, c) => sum + c.amount, 0);
  const saved = Math.max(0, totalPrice - summary.grandTotal);

  const breakdown = [
    `<tr><td>Total price (MRP)</td><td class="num">${esc(currency(mrpTotal))}</td></tr>`,
    productSavings > 0 ? `<tr><td>Product discount</td><td class="num">−${esc(currency(productSavings))}</td></tr>` : '',
    couponDiscount > 0 ? `<tr><td>Extra discount</td><td class="num">−${esc(currency(couponDiscount))}</td></tr>` : '',
    ...extraCharges.map((c) => `<tr><td>${esc(c.label)}</td><td class="num">${esc(currency(c.amount))}</td></tr>`),
  ].join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice ${esc(number)}</title>
<style>
  /* 80mm thermal roll: ~72mm printable width. The page height is set to the receipt's length
     just before printing (see printInvoice), since browsers don't accept "auto" here. */
  @page { size: 80mm 200mm; margin: 3mm 4mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { width: 72mm; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.35; }
  .rule { border-top: 1px dashed #000; margin: 6px 0; }
  .rule.solid { border-top: 1.5px solid #000; }

  .head { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
  .head img { width: 40mm; height: auto; display: block; }
  .head .title { text-align: right; }
  .head h1 { margin: 0; font-size: 14px; letter-spacing: 0.1em; font-weight: 800; }
  .head .no { font-size: 9px; }

  .meta { font-size: 10.5px; }

  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; text-transform: uppercase; text-align: left; padding: 2px 0; border-bottom: 1px solid #000; }
  .items td { padding: 4px 0; vertical-align: top; }
  .items tr + tr td { border-top: 1px dotted #000; }
  .name { font-weight: 700; }
  .sub { font-size: 10px; }
  .num { text-align: right; white-space: nowrap; padding-left: 6px; }
  s { font-size: 9.5px; }

  .totals td { padding: 1px 0; }
  .final { text-align: center; margin-top: 6px; }
  .final .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
  .final .was { font-size: 13px; text-decoration: line-through; text-decoration-thickness: 1.5px; }
  .final .now { font-size: 20px; font-weight: 800; line-height: 1.15; }
  .final .save { display: inline-block; margin-top: 3px; padding: 1px 8px; border: 1.5px solid #000; border-radius: 999px;
                 font-weight: 700; font-size: 10.5px; }

  .payment { text-align: center; font-size: 11.5px; }
  .payment b { text-transform: uppercase; }
  .foot { text-align: center; font-size: 9.5px; }
  tr { page-break-inside: avoid; }
</style></head>
<body>
  <div class="head">
    <img src="${esc(logo)}" alt="Petwork">
    <div class="title"><h1>INVOICE</h1><div class="no">${esc(number)}</div></div>
  </div>
  <div class="rule solid"></div>

  <div class="meta">Date: ${esc(date)}</div>
  <div class="rule"></div>

  <table class="items">
    <thead><tr><th>Item</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sub" style="margin-top:2px">${summary.lines.length} ${summary.lines.length === 1 ? 'product' : 'products'} · ${summary.unitCount} ${summary.unitCount === 1 ? 'unit' : 'units'}</div>
  <div class="rule"></div>

  <table class="totals">${breakdown}</table>
  <div class="final">
    <div class="label">Final price</div>
    ${saved > 0 ? `<div class="was">${esc(currency(totalPrice))}</div>` : ''}
    <div class="now">${esc(currency(summary.grandTotal))}</div>
    ${saved > 0 ? `<div class="save">You saved ${esc(currency(saved))}</div>` : ''}
  </div>
  <div class="rule"></div>

  <div class="payment">Mode of payment: <b>${esc(paymentMode)}</b></div>
  <div class="rule"></div>

  <div class="foot">Thank you for shopping with Petwork!<br>This is a computer-generated invoice.</div>
</body></html>`;
}

/**
 * Opens the browser's print dialog with the invoice. It is laid out in a hidden frame, so the app
 * itself never changes and nothing but the invoice is printed.
 */
export function printInvoice(summary: CartSummary, paymentMode = 'Cash on delivery') {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });

  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return;
    // Removed once the dialog closes (afterprint), with a fallback for browsers that skip that event.
    const cleanup = () => setTimeout(() => frame.remove(), 500);
    win.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 60_000);

    // Make the page exactly as long as the receipt (content + 3mm top/bottom margins + a little slack
    // so the last line never spills onto a second page).
    const doc = win.document;
    const contentMm = (doc.body.getBoundingClientRect().height * 25.4) / 96;
    const pageStyle = doc.createElement('style');
    pageStyle.textContent = `@page { size: 80mm ${Math.ceil(contentMm + 6 + 2)}mm; margin: 3mm 4mm; }`;
    doc.head.appendChild(pageStyle);

    win.focus();
    win.print();
  };

  frame.srcdoc = invoiceHtml(summary, paymentMode);
  document.body.appendChild(frame);
}
