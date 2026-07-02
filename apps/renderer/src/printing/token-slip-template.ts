import type { Appointment } from '../api/types';
import { escapeHtml } from './template-helpers';

export interface TokenSlipTemplateOptions {
  appointment: Appointment;
  branchName: string;
  paperWidthMm: number;
  queuePosition?: number | null;
}

export function renderTokenSlipHtml({
  appointment,
  branchName,
  paperWidthMm,
  queuePosition,
}: TokenSlipTemplateOptions): string {
  const isNarrow = paperWidthMm <= 58;
  const baseFontSize = isNarrow ? '11px' : '12px';
  const appointmentDate = new Date(appointment.appointmentDate).toLocaleDateString();
  const appointmentTime = appointment.arrivedAt
    ? new Date(appointment.arrivedAt).toLocaleTimeString()
    : new Date(appointment.bookedAt).toLocaleTimeString();

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${paperWidthMm}mm auto; margin: 0; }
  body { margin: 0; padding: 6px; font-family: 'Courier New', monospace; font-size: ${baseFontSize}; color: #000; }
  .center { text-align: center; }
  .title { font-size: ${isNarrow ? '13px' : '15px'}; font-weight: bold; }
  .token { font-size: ${isNarrow ? '40px' : '52px'}; font-weight: bold; text-align: center; padding: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  td { padding: 1px 0; }
</style>
</head>
<body>
  <div class="center title">${escapeHtml(branchName)}</div>
  <div class="center">${escapeHtml(appointment.doctor.name)}${appointment.doctor.roomNumber ? ` &middot; Room ${escapeHtml(appointment.doctor.roomNumber)}` : ''}</div>
  <hr />
  <div class="center">TOKEN</div>
  <div class="token">${appointment.tokenNumber}</div>
  <hr />
  <table>
    <tr><td>Patient</td><td style="text-align:right;">${escapeHtml(appointment.patient.name)}</td></tr>
    <tr><td>Date</td><td style="text-align:right;">${appointmentDate}</td></tr>
    <tr><td>Time</td><td style="text-align:right;">${appointmentTime}</td></tr>
    ${queuePosition != null ? `<tr><td>Queue Position</td><td style="text-align:right;">${queuePosition}</td></tr>` : ''}
  </table>
  <hr />
  <div class="center">Please wait for your token to be called.</div>
</body>
</html>
`;
}
