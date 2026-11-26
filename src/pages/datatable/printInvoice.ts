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

  const pct = (mrp: number, price: number) => (mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0);

  // One row per product: name | qty | MRP (line total) | final price (line total) with its discount %.
  const rows = summary.lines
    .map((l) => {
      const price = l.item.price ?? 0;
      const mrp = Math.max(l.item.mrp ?? 0, price);
      const off = pct(mrp, price);
      return `<tr>
        <td class="item">
          <div class="name">${esc(l.item.name ?? 'Product')}</div>
          ${l.item.size ? `<div class="size">${esc(l.item.size)}</div>` : ''}
        </td>
        <td class="qty">${l.quantity}</td>
        <td class="num mrp">${esc(currency(mrp * l.quantity))}</td>
        <td class="num final">${esc(currency(price * l.quantity))}${off ? `<div class="off">${off}% off</div>` : ''}</td>
      </tr>`;
    })
    .join('');

  const mrpTotal = summary.lines.reduce(
    (sum, l) => sum + Math.max(l.item.mrp ?? 0, l.item.price ?? 0) * l.quantity,
    0,
  );
  const extraCharges = summary.charges.filter((c) => c.label !== 'Discount');
  const couponDiscount = summary.charges
    .filter((c) => c.label === 'Discount')
    .reduce((sum, c) => sum + Math.abs(c.amount), 0);
  // Everything knocked off the MRP: product discounts plus any cart discount.
  const discount = mrpTotal - summary.itemsTotal + couponDiscount;
  const discountPct = pct(mrpTotal, mrpTotal - discount);

  const line = (label: string, value: string, cls = '') =>
    `<div class="row ${cls}"><span>${label}</span><span>${value}</span></div>`;
  const summaryRows = [
    line(`Total items <small>(${summary.unitCount} ${summary.unitCount === 1 ? 'unit' : 'units'})</small>`, String(summary.lines.length)),
    line('MRP total', esc(currency(mrpTotal))),
    mrpTotal > summary.itemsTotal ? line('Product discount', `−${esc(currency(mrpTotal - summary.itemsTotal))}`) : '',
    couponDiscount > 0 ? line('Extra discount', `−${esc(currency(couponDiscount))}`) : '',
    ...extraCharges.map((c) => line(esc(c.label), esc(currency(c.amount)))),
    discount > 0
      ? line(`Total discount${discountPct ? ` (${discountPct}%)` : ''}`, `−${esc(currency(discount))}`, 'strong')
      : '',
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

  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Items table: no fills (light on thermal ink), just clean rules. */
  table.bill { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .bill th { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
             padding: 4px 2px; text-align: left; border-top: 1px solid #000; border-bottom: 1px solid #000; }
  .bill td { padding: 5px 2px; vertical-align: top; }
  .bill tbody tr + tr td { border-top: 1px dotted #000; }
  .bill tbody tr:last-child td { border-bottom: 1px solid #000; }
  .bill .name { font-weight: 600; font-size: 10.5px; line-height: 1.25; overflow-wrap: anywhere; }
  .bill .size { font-size: 9px; margin-top: 1px; }
  .bill .qty, .bill th.qty { text-align: center; }
  .num, .bill th.num { text-align: right; white-space: nowrap; }
  .mrp { font-size: 9.5px; }
  .final { font-size: 10.5px; font-weight: 700; }
  .off { font-size: 8.5px; font-weight: 400; font-style: italic; margin-top: 1px; }

  /* Summary: label/value rows, then the payable amount between double rules. */
  .summary { margin-top: 6px; }
  .summary .row { display: flex; justify-content: space-between; align-items: center; padding: 1px 0; font-size: 10.5px; }
  .summary .row small { font-size: 9px; }
  .summary .row span:last-child { white-space: nowrap; }
  .summary .row.strong { font-weight: 700; }
  .payable { margin-top: 6px; display: flex; justify-content: space-between; align-items: center; gap: 6px;
             border-top: 3px double #000; border-bottom: 3px double #000; padding: 5px 0; }
  .payable .label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .payable .amount { font-size: 16px; font-weight: 800; white-space: nowrap; }
  .saved { text-align: center; font-size: 10px; margin-top: 5px; }

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

  <table class="bill">
    <colgroup><col><col style="width:8mm"><col style="width:15mm"><col style="width:17mm"></colgroup>
    <thead><tr><th>Items</th><th class="qty">Qty</th><th class="num">MRP</th><th class="num">Price</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="summary">${summaryRows}</div>
  <div class="payable">
    <div class="label">Payable amount</div>
    <div class="amount">${esc(currency(summary.grandTotal))}/-</div>
  </div>
  ${discount > 0 ? `<div class="saved">You saved ${esc(currency(discount))} on this order</div>` : ''}
  <div class="rule"></div>

  <div class="payment">Mode of payment: <b>${esc(paymentMode)}</b></div>
  <div class="rule"></div>

  <div class="foot">Thank you for shopping with Petwork!<br>This is a computer-generated invoice.</div>
</body></html>`;
}

/**
 * Product names that would wrap past 3 lines are shortened in the middle: the start fills two lines
 * and ends with "…", and the third line starts with "…" and shows how the name ends.
 */
function shortenLongNames(doc: Document) {
  doc.querySelectorAll<HTMLElement>('.bill .name').forEach((el) => {
    const full = el.textContent?.trim() ?? '';
    const lineHeight = parseFloat(doc.defaultView!.getComputedStyle(el).lineHeight) || 13;
    const linesOf = (node: HTMLElement) => Math.round(node.getBoundingClientRect().height / lineHeight);
    if (linesOf(el) <= 3) return;

    const head = doc.createElement('div');
    const tail = doc.createElement('div');
    el.replaceChildren(head, tail);

    // Word boundaries, or characters when a single word is too long to split on.
    const words = full.split(/\s+/);
    const parts = words.length > 3 ? words : [...full];
    const sep = parts === words ? ' ' : '';
    // Largest n where `render(n)` still fits in `maxLines` (assumes fewer parts always fit better).
    const fit = (node: HTMLElement, maxLines: number, render: (n: number) => string, max: number) => {
      let lo = 1;
      let hi = max;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        node.textContent = render(mid);
        if (linesOf(node) <= maxLines) lo = mid;
        else hi = mid - 1;
      }
      node.textContent = render(lo);
      return lo;
    };

    const headCount = fit(head, 2, (n) => `${parts.slice(0, n).join(sep)}…`, parts.length - 1);
    fit(tail, 1, (n) => `…${parts.slice(parts.length - n).join(sep)}`, parts.length - headCount);
  });
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
    shortenLongNames(doc);
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
