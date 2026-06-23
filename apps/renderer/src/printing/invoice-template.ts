import type { Invoice } from '../api/types';
import { escapeHtml, formatMoney } from './template-helpers';

export interface InvoiceTemplateOptions {
  invoice: Invoice;
  branchName: string;
  headerText?: string | null;
  footerText?: string | null;
}

export function renderInvoiceHtml({ invoice, branchName, headerText, footerText }: InvoiceTemplateOptions): string {
  const lines = invoice.lines ?? [];
  const payments = invoice.payments ?? [];

  const lineRows = lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.product?.name ?? line.productId)}</td>
        <td style="text-align:right;">${Number(line.quantity)}</td>
        <td style="text-align:right;">${formatMoney(line.unitPrice)}</td>
        <td style="text-align:right;">${formatMoney(line.discountValue)}</td>
        <td style="text-align:right;">${formatMoney(line.taxAmount)}</td>
        <td style="text-align:right;">${formatMoney(line.lineTotal)}</td>
      </tr>`,
    )
    .join('');

  const paymentRows = payments
    .map((payment) => `<tr><td>${escapeHtml(payment.method)}</td><td style="text-align:right;">${formatMoney(payment.amount)}</td></tr>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; }
  h1 { font-size: 22px; margin-bottom: 0; }
  .muted { color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; }
  th { background: #f0f0f0; text-align: left; }
  .totals-table { width: 280px; margin-left: auto; margin-top: 12px; }
  .totals-table td { border: none; padding: 2px 4px; }
  .grand-total { font-weight: bold; font-size: 14px; border-top: 2px solid #111; }
  .header-row { display: flex; justify-content: space-between; align-items: flex-start; }
</style>
</head>
<body>
  <div class="header-row">
    <div>
      <h1>${escapeHtml(branchName)}</h1>
      ${headerText ? `<div class="muted">${escapeHtml(headerText)}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div><strong>Invoice</strong> ${escapeHtml(invoice.invoiceNo)}</div>
      <div class="muted">${new Date(invoice.createdAt).toLocaleString()}</div>
      <div class="muted">Status: ${escapeHtml(invoice.status)}</div>
    </div>
  </div>

  ${
    invoice.customer
      ? `<p><strong>Customer:</strong> ${escapeHtml(invoice.customer.name)}${invoice.customer.phone ? ` &middot; ${escapeHtml(invoice.customer.phone)}` : ''}</p>`
      : ''
  }

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:right;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Discount</th>
        <th style="text-align:right;">Tax</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
    </tbody>
  </table>

  <table class="totals-table">
    <tr><td>Subtotal</td><td style="text-align:right;">${formatMoney(invoice.subtotal)}</td></tr>
    ${Number(invoice.discountTotal) > 0 ? `<tr><td>Discount</td><td style="text-align:right;">-${formatMoney(invoice.discountTotal)}</td></tr>` : ''}
    ${invoice.couponCode ? `<tr><td>Coupon (${escapeHtml(invoice.couponCode)})</td><td style="text-align:right;">-${formatMoney(invoice.couponDiscountAmount)}</td></tr>` : ''}
    <tr><td>Tax</td><td style="text-align:right;">${formatMoney(invoice.taxTotal)}</td></tr>
    <tr class="grand-total"><td>Total</td><td style="text-align:right;">${formatMoney(invoice.grandTotal)}</td></tr>
  </table>

  <table class="totals-table">
    ${paymentRows}
  </table>

  ${footerText ? `<p class="muted">${escapeHtml(footerText)}</p>` : ''}
</body>
</html>
`;
}
