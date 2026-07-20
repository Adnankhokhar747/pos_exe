import type { LabOrder } from '../api/types';
import { escapeHtml, formatMoney } from './template-helpers';

export interface LabReportTemplateOptions {
  order: LabOrder;
  branchName: string;
  headerText?: string | null;
  footerText?: string | null;
}

function flagLabel(flag: string): string {
  switch (flag) {
    case 'normal':        return 'Normal';
    case 'low':           return 'Low &darr;';
    case 'high':          return 'High &uarr;';
    case 'critical_low':  return 'Crit Low &darr;&darr;';
    case 'critical_high': return 'Crit High &uarr;&uarr;';
    case 'abnormal':      return 'Abnormal';
    default:              return 'Pending';
  }
}

function flagClass(flag: string): string {
  if (flag === 'critical_low' || flag === 'critical_high') return 'flag-critical';
  if (flag === 'low' || flag === 'high')                    return 'flag-hl';
  if (flag === 'abnormal')                                  return 'flag-abnormal';
  if (flag === 'normal')                                    return 'flag-normal';
  return 'flag-pending';
}

export function renderLabReportHtml({
  order,
  branchName,
  headerText,
  footerText,
}: LabReportTemplateOptions): string {
  const items = order.items ?? [];
  const date = new Date(order.createdAt).toLocaleString();

  const priorityClass =
    order.priority === 'stat'   ? 'priority-stat' :
    order.priority === 'urgent' ? 'priority-urgent' : '';

  const itemRows = items.map(item => {
    const hasResult = !!item.result && item.result.resultFlag !== 'pending';
    const resultVal = item.result?.resultValue ?? '—';
    const flag      = item.result?.resultFlag ?? 'pending';
    const remarks   = item.result?.remarks ?? '';

    return `
    <tr>
      <td><strong>${escapeHtml(item.testCode)}</strong></td>
      <td>${escapeHtml(item.testName)}</td>
      <td class="${hasResult && flag !== 'normal' ? 'result-abnormal' : ''}">${escapeHtml(resultVal)}</td>
      <td>${escapeHtml(item.normalRange ?? '—')}</td>
      <td>${escapeHtml(item.unit ?? '—')}</td>
      <td><span class="flag ${flagClass(flag)}">${flagLabel(flag)}</span></td>
      <td>${escapeHtml(remarks)}</td>
    </tr>`;
  }).join('');

  const priceRows = items.map(item => `
    <tr>
      <td>${escapeHtml(item.testName)}</td>
      <td style="text-align:right;">${formatMoney(item.price)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 14mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; }

  /* ── Header ── */
  .page-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1a4f8a; padding-bottom: 10px; margin-bottom: 14px; }
  .clinic-name { font-size: 20px; font-weight: bold; color: #1a4f8a; }
  .clinic-sub { color: #555; font-size: 11px; margin-top: 3px; }
  .report-meta { text-align: right; }
  .report-title { font-size: 17px; font-weight: bold; color: #1a4f8a; letter-spacing: 1px; }
  .report-no { font-size: 12px; margin-top: 3px; }
  .report-date { color: #666; font-size: 11px; margin-top: 2px; }

  /* ── Patient info box ── */
  .info-box { background: #f4f7fb; border: 1px solid #d0dbe9; border-radius: 4px; padding: 10px 14px; margin-bottom: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 5px 32px; }
  .info-row { display: flex; gap: 6px; align-items: baseline; }
  .info-label { color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; min-width: 58px; flex-shrink: 0; }
  .info-value { font-weight: 600; font-size: 12px; }
  .priority-stat   { color: #c62828; font-weight: bold; }
  .priority-urgent { color: #e65100; font-weight: bold; }

  /* ── Results table ── */
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.8px; color: #1a4f8a; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  .results-table th { background: #1a4f8a; color: #fff; text-align: left; padding: 7px 8px; font-size: 11px; font-weight: 600; }
  .results-table td { border-bottom: 1px solid #e4e9f0; padding: 6px 8px; font-size: 12px; vertical-align: middle; }
  .results-table tr:nth-child(even) td { background: #f7f9fc; }
  .result-abnormal { color: #c62828; font-weight: bold; }

  /* ── Flag badges ── */
  .flag { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 10px; font-weight: bold; white-space: nowrap; }
  .flag-normal   { background: #e8f5e9; color: #2e7d32; }
  .flag-hl       { background: #fff3e0; color: #e65100; }
  .flag-critical { background: #ffebee; color: #c62828; }
  .flag-abnormal { background: #fce4ec; color: #880e4f; }
  .flag-pending  { background: #f5f5f5; color: #757575; }

  /* ── Billing summary ── */
  .billing-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }
  .billing-table { border-collapse: collapse; min-width: 220px; }
  .billing-table td { padding: 3px 8px; font-size: 12px; border: none; }
  .billing-table .total-row td { font-weight: bold; font-size: 13px; border-top: 2px solid #1a4f8a; padding-top: 6px; }

  /* ── Signatures ── */
  .sig-section { display: flex; justify-content: space-between; margin-top: 48px; }
  .sig-block { text-align: center; min-width: 160px; }
  .sig-line { border-top: 1px solid #555; padding-top: 5px; font-size: 11px; color: #555; }

  /* ── Footer ── */
  .page-footer { margin-top: 20px; border-top: 1px solid #d0dbe9; padding-top: 8px; color: #777; font-size: 10px; }

  /* ── Status stamp ── */
  .status-stamp { display: inline-block; border: 2px solid; padding: 2px 10px; border-radius: 4px; font-weight: bold; font-size: 11px; letter-spacing: 1px; vertical-align: middle; margin-left: 8px; }
  .stamp-completed { border-color: #2e7d32; color: #2e7d32; }
  .stamp-pending   { border-color: #f57c00; color: #f57c00; }
  .stamp-other     { border-color: #555; color: #555; }
</style>
</head>
<body>

  <!-- ── Page header ── -->
  <div class="page-header">
    <div>
      <div class="clinic-name">${escapeHtml(branchName)}</div>
      ${headerText ? `<div class="clinic-sub">${escapeHtml(headerText)}</div>` : ''}
    </div>
    <div class="report-meta">
      <div class="report-title">LAB REPORT</div>
      <div class="report-no">Order # <strong>${escapeHtml(order.orderNumber)}</strong>
        <span class="status-stamp ${order.status === 'completed' ? 'stamp-completed' : order.status === 'pending' || order.status === 'processing' ? 'stamp-pending' : 'stamp-other'}">
          ${escapeHtml(order.status.replace(/_/g, ' ').toUpperCase())}
        </span>
      </div>
      <div class="report-date">${escapeHtml(date)}</div>
    </div>
  </div>

  <!-- ── Patient / order info ── -->
  <div class="info-box">
    <div class="info-row">
      <span class="info-label">Patient</span>
      <span class="info-value">${escapeHtml(order.patient?.name ?? '—')}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Doctor</span>
      <span class="info-value">${escapeHtml(order.doctor?.name ?? '—')}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Priority</span>
      <span class="info-value ${priorityClass}">${escapeHtml(order.priority.toUpperCase())}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Date</span>
      <span class="info-value">${escapeHtml(new Date(order.createdAt).toLocaleDateString())}</span>
    </div>
    ${order.notes ? `
    <div class="info-row" style="grid-column: 1 / -1;">
      <span class="info-label">Notes</span>
      <span class="info-value" style="font-weight:400;">${escapeHtml(order.notes)}</span>
    </div>` : ''}
  </div>

  <!-- ── Test results ── -->
  <div class="section-title">Test Results</div>
  <table class="results-table">
    <thead>
      <tr>
        <th style="width:70px;">Code</th>
        <th>Test Name</th>
        <th style="width:110px;">Result</th>
        <th style="width:120px;">Normal Range</th>
        <th style="width:55px;">Unit</th>
        <th style="width:110px;">Flag</th>
        <th>Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="7" style="text-align:center;color:#999;padding:16px;">No test items found.</td></tr>'}
    </tbody>
  </table>

  <!-- ── Billing ── -->
  <div class="billing-wrap">
    <table class="billing-table">
      ${priceRows}
      <tr class="total-row">
        <td>Total</td>
        <td style="text-align:right;">${formatMoney(order.totalAmount)}</td>
      </tr>
    </table>
  </div>

  <!-- ── Signature area ── -->
  <div class="sig-section">
    <div class="sig-block">
      <div class="sig-line">Lab Technician</div>
    </div>
    <div class="sig-block">
      <div class="sig-line">${escapeHtml(order.doctor?.name ?? 'Authorized By')}</div>
    </div>
  </div>

  ${footerText ? `<div class="page-footer">${escapeHtml(footerText)}</div>` : ''}

</body>
</html>`;
}
