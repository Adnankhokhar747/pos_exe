import type { Invoice } from '../api/types';
import { escapeHtml, formatMoney } from './template-helpers';

export interface ReceiptTemplateOptions {
  invoice: Invoice;
  branchName: string;
  headerText?: string | null;
  footerText?: string | null;
  paperWidthMm: number;
}

export function renderReceiptHtml({ invoice, branchName, headerText, footerText, paperWidthMm }: ReceiptTemplateOptions): string {
  const isNarrow = paperWidthMm <= 58;
  const baseFontSize = isNarrow ? '11px' : '12px';
  const titleFontSize = isNarrow ? '13px' : '15px';
  const lines = invoice.lines ?? [];
  const payments = invoice.payments ?? [];

  const lineRows = lines
    .map((line) => {
      const name = escapeHtml(line.product?.name ?? line.productId);
      const qty = Number(line.quantity);
      const unitPrice = formatMoney(line.unitPrice);
      const lineTotal = formatMoney(line.lineTotal);
      const discount = Number(line.discountValue);
      return `
        <tr><td colspan="2" style="padding-top:4px;">${name}</td></tr>
        <tr>
          <td>${qty} x ${unitPrice}</td>
          <td style="text-align:right;">${lineTotal}</td>
        </tr>
        ${discount > 0 ? `<tr><td style="padding-left:8px;">Discount</td><td style="text-align:right;">-${formatMoney(discount)}</td></tr>` : ''}
      `;
    })
    .join('');

  const paymentRows = payments
    .map((payment) => `<tr><td>${escapeHtml(payment.method)}</td><td style="text-align:right;">${formatMoney(payment.amount)}</td></tr>`)
    .join('');

  const changeRow = payments.find((p) => p.changeAmount && Number(p.changeAmount) > 0);

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${paperWidthMm}mm auto; margin: 0; }
  body { margin: 0; padding: 6px; font-family: 'Courier New', monospace; font-size: ${baseFontSize}; color: #000; }
  .center { text-align: center; }
  .title { font-size: ${titleFontSize}; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .totals td { padding: 1px 0; }
  .grand-total { font-weight: bold; font-size: ${isNarrow ? '12px' : '14px'}; }
</style>
</head>
<body>
  <div class="center title">${escapeHtml(branchName)}</div>
  ${headerText ? `<div class="center">${escapeHtml(headerText)}</div>` : ''}
  <hr />
  <div>Invoice: ${escapeHtml(invoice.invoiceNo)}</div>
  <div>Date: ${new Date(invoice.createdAt).toLocaleString()}</div>
  ${invoice.customer ? `<div>Customer: ${escapeHtml(invoice.customer.name)}</div>` : ''}
  <hr />
  <table>
    ${lineRows}
  </table>
  <hr />
  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right;">${formatMoney(invoice.subtotal)}</td></tr>
    ${Number(invoice.discountTotal) > 0 ? `<tr><td>Discount</td><td style="text-align:right;">-${formatMoney(invoice.discountTotal)}</td></tr>` : ''}
    ${invoice.couponCode ? `<tr><td>Coupon (${escapeHtml(invoice.couponCode)})</td><td style="text-align:right;">-${formatMoney(invoice.couponDiscountAmount)}</td></tr>` : ''}
    <tr><td>Tax</td><td style="text-align:right;">${formatMoney(invoice.taxTotal)}</td></tr>
    <tr class="grand-total"><td>Total</td><td style="text-align:right;">${formatMoney(invoice.grandTotal)}</td></tr>
  </table>
  <hr />
  <table class="totals">
    ${paymentRows}
    ${changeRow ? `<tr><td>Change</td><td style="text-align:right;">${formatMoney(changeRow.changeAmount as string)}</td></tr>` : ''}
  </table>
  ${
    Number(invoice.loyaltyPointsEarned) > 0 || Number(invoice.loyaltyPointsRedeemed) > 0
      ? `<hr /><div>Loyalty points earned: ${invoice.loyaltyPointsEarned}${
          Number(invoice.loyaltyPointsRedeemed) > 0 ? ` &middot; redeemed: ${invoice.loyaltyPointsRedeemed}` : ''
        }</div>`
      : ''
  }
  <hr />
  ${footerText ? `<div class="center">${escapeHtml(footerText)}</div>` : '<div class="center">Thank you for your purchase!</div>'}
</body>
</html>
`;
}
