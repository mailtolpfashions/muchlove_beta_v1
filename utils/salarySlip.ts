import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatCurrency } from './format';
import { BUSINESS_NAME, BUSINESS_ADDRESS, BUSINESS_CONTACT } from '@/constants/app';
import type { SalaryBreakdown } from './salary';

interface SlipParams {
  employeeName: string;
  employeeMobile?: string;
  month: number;   // 0-indexed
  year: number;
  baseSalary: number;
  effectiveFrom: string;
  breakdown: SalaryBreakdown;
}

function buildSalarySlipHtml(params: SlipParams): string {
  const { employeeName, employeeMobile, month, year, baseSalary, effectiveFrom, breakdown: b } = params;
  const monthName = new Date(year, month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const effDate = new Date(effectiveFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const generatedOn = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const deductionRows: string[] = [];
  if (b.totalPermissionHours > 0 && b.excessPermissionHours > 0) {
    deductionRows.push(`<tr><td>Permission (${b.totalPermissionHours.toFixed(1)}h, free: ${b.freePermissionHours}h, ${b.permissionPenaltyDays} day ded.)</td><td class="right bold" style="color:#DC2626;">-${formatCurrency(b.permissionDeduction)}</td></tr>`);
  }
  if (b.lateCount > 0 && b.latePenaltyDays > 0) {
    deductionRows.push(`<tr><td>Late Penalty (${b.lateCount} lates → ${b.latePenaltyDays} day ded.)</td><td class="right bold" style="color:#DC2626;">-${formatCurrency(b.lateDeduction)}</td></tr>`);
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Roboto, sans-serif; background: #FFF5F7; color: #1A1A2E; padding: 0; margin: 0; }

  .slip-wrapper {
    max-width: 700px; margin: 0 auto; background: #FFFFFF;
    border-radius: 0; overflow: visible;
  }

  /* ── Header band ── */
  .header {
    background: linear-gradient(135deg, #E91E63, #AD1457);
    color: #FFFFFF; padding: 32px 32px 40px; position: relative;
  }
  .header::after {
    content: ''; position: absolute; bottom: 0px; left: 0; right: 0;
    height: 20px; background: #FFFFFF; border-radius: 20px 20px 0 0;
  }
  .header h1 { font-size: 26px; font-weight: 800; letter-spacing: 1px; margin-bottom: 4px; }
  .header .business-name { font-size: 14px; opacity: 0.9; font-weight: 500; }
  .header .business-detail { font-size: 12px; opacity: 0.75; margin-top: 2px; }

  /* ── Meta strip ── */
  .meta-strip {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding: 12px 32px 16px; background: #FFFFFF; flex-wrap: wrap; gap: 8px;
  }
  .meta-strip .meta-block { }
  .meta-strip .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9CA3AF; font-weight: 700; }
  .meta-strip .value { font-size: 15px; font-weight: 600; color: #1A1A2E; margin-top: 2px; white-space: nowrap; }

  /* ── Info cards ── */
  .info-row {
    display: flex; gap: 16px; padding: 0 32px 20px; flex-wrap: wrap;
  }
  .info-card {
    flex: 1; min-width: 140px; background: #FFF5F7; border-radius: 12px;
    padding: 14px 16px; border-left: 4px solid #E91E63;
  }
  .info-card .info-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
    color: #E91E63; font-weight: 700; margin-bottom: 4px;
  }
  .info-card .info-value { font-size: 14px; font-weight: 600; color: #1A1A2E; }
  .info-card .info-sub { font-size: 11px; color: #9CA3AF; margin-top: 2px; }

  /* ── Net payable highlight ── */
  .net-section { padding: 0 32px 20px; }
  .net-box {
    background: #D1FAE5; border-radius: 12px; padding: 16px 20px;
    display: flex; justify-content: space-between; align-items: center;
    border: 1px solid #A7F3D0;
  }
  .net-box .net-label { font-size: 16px; font-weight: 700; color: #059669; }
  .net-box .net-value { font-size: 24px; font-weight: 800; color: #059669; }

  /* ── Summary cards row ── */
  .summary-row {
    display: flex; gap: 12px; padding: 0 32px 20px; flex-wrap: wrap;
  }
  .summary-card {
    flex: 1; min-width: 90px; background: #FFF5F7; border-radius: 10px;
    padding: 10px 12px; border-left: 3px solid #E91E63; text-align: center;
  }
  .summary-card .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #E91E63; font-weight: 700; }
  .summary-card .val { font-size: 16px; font-weight: 800; color: #1A1A2E; margin-top: 2px; }

  /* ── Section title ── */
  .section-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
    color: #E91E63; font-weight: 700; margin-bottom: 6px;
  }

  /* ── Items table ── */
  .table-section { padding: 0 32px 16px; }
  .table-section table { width: 100%; border-collapse: collapse; }
  .table-section thead th {
    background: linear-gradient(135deg, #FCE4EC, #FFF0F5);
    color: #AD1457; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px;
    font-weight: 700; padding: 10px 12px; text-align: left;
  }
  .table-section thead th.right { text-align: right; }
  .table-section tbody td {
    padding: 9px 12px; font-size: 13px; color: #1A1A2E;
    border-bottom: 1px solid #FFF0F5;
  }
  .table-section tbody td.right { text-align: right; }
  .table-section tbody td.bold { font-weight: 700; }
  .table-section tbody tr:last-child td { border-bottom: none; }
  .table-section tbody td:first-child { font-weight: 500; }

  /* ── Totals section ── */
  .totals-section { padding: 0 32px 20px; }
  .totals-box {
    background: #FFF5F7; border-radius: 12px; padding: 16px 20px;
    border: 1px solid #F3D5DE;
  }
  .totals-row {
    display: flex; justify-content: space-between; padding: 4px 0;
    font-size: 13px; color: #6B7280;
  }
  .totals-row.deduct .totals-value { color: #DC2626; font-weight: 700; }
  .totals-row.grand {
    margin-top: 8px; padding-top: 10px;
    border-top: 2px solid #E91E63;
    font-size: 18px; font-weight: 800; color: #E91E63;
  }

  /* ── Footer ── */
  .footer {
    text-align: center; padding: 20px 32px 28px;
    border-top: 1px solid #FFF0F5;
  }
  .footer .thanks { font-size: 13px; font-weight: 700; color: #E91E63; margin-bottom: 4px; }
  .footer .sub { font-size: 10px; color: #9CA3AF; }
</style>
</head>
<body>
  <div class="slip-wrapper">

    <!-- Header -->
    <div class="header">
      <h1>SALARY SLIP</h1>
      <div class="business-name">${BUSINESS_NAME}</div>
      <div class="business-detail">${BUSINESS_ADDRESS} &nbsp;|&nbsp; ${BUSINESS_CONTACT}</div>
    </div>

    <!-- Meta strip -->
    <div class="meta-strip">
      <div class="meta-block">
        <div class="label">Pay Period</div>
        <div class="value">${monthName}</div>
      </div>
      <div class="meta-block">
        <div class="label">Generated</div>
        <div class="value">${generatedOn}</div>
      </div>
    </div>

    <!-- Employee info cards -->
    <div class="info-row">
      <div class="info-card">
        <div class="info-label">Employee</div>
        <div class="info-value">${employeeName}</div>
        ${employeeMobile ? `<div class="info-sub">${employeeMobile}</div>` : ''}
      </div>
      <div class="info-card">
        <div class="info-label">Base Salary</div>
        <div class="info-value">${formatCurrency(baseSalary)}/month</div>
        <div class="info-sub">Effective from ${effDate}</div>
      </div>
    </div>

    <!-- Net Payable -->
    <div class="net-section">
      <div class="net-box">
        <span class="net-label">Net Payable</span>
        <span class="net-value">${formatCurrency(b.netSalary)}</span>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="summary-row">
      <div class="summary-card">
        <div class="lbl">Working Days</div>
        <div class="val">${b.workingDays}</div>
      </div>
      <div class="summary-card">
        <div class="lbl">Present</div>
        <div class="val" style="color:#059669;">${b.presentDays}</div>
      </div>
      <div class="summary-card">
        <div class="lbl">Absent</div>
        <div class="val" style="color:#DC2626;">${b.absentDays}</div>
      </div>
      <div class="summary-card">
        <div class="lbl">Leaves</div>
        <div class="val" style="color:#EA580C;">${b.approvedLeaves}</div>
      </div>
      <div class="summary-card">
        <div class="lbl">Weekly Off</div>
        <div class="val">${b.weeklyOffs} days</div>
      </div>
    </div>

    <!-- Earnings table -->
    <div class="table-section">
      <div class="section-label">Earnings</div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Per Day Rate</td><td class="right">${formatCurrency(b.perDayRate)}</td></tr>
          <tr><td>Present Days</td><td class="right" style="color:#059669;">${b.presentDays} days</td></tr>
          ${b.halfDays > 0 ? `<tr><td>Half Days (×0.5)</td><td class="right" style="color:#D97706;">${b.halfDays}</td></tr>` : ''}
          ${b.compLeavesUsed > 0 ? `<tr><td>Comp Leave Used</td><td class="right" style="color:#7C3AED;">${b.compLeavesUsed} days</td></tr>` : ''}
          ${b.earnedLeavesUsed > 0 ? `<tr><td>Earned Leave Used</td><td class="right" style="color:#059669;">${b.earnedLeavesUsed} days</td></tr>` : ''}
          <tr><td class="bold">Earned Days</td><td class="right bold" style="color:#059669;">${b.earnedDays} days</td></tr>
          <tr><td class="bold">Earned Salary</td><td class="right bold" style="color:#059669;">${formatCurrency(b.earnedSalary)}</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Attendance summary table -->
    <div class="table-section">
      <div class="section-label">Attendance Summary</div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="right">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Absent</td><td class="right" style="color:#DC2626;">${b.absentDays} days</td></tr>
          <tr><td>Leaves Taken</td><td class="right" style="color:#EA580C;">${b.approvedLeaves} days</td></tr>
          <tr><td>Comp Earned</td><td class="right" style="color:#7C3AED;">${b.compLeavesEarned} days</td></tr>
          <tr><td>Weekly Offs</td><td class="right">${b.weeklyOffs} days</td></tr>
        </tbody>
      </table>
    </div>

    ${deductionRows.length > 0 || b.totalDeduction > 0 ? `
    <!-- Deductions -->
    <div class="totals-section">
      <div class="section-label" style="margin-bottom:6px;">Deductions</div>
      <div class="totals-box">
        ${b.totalPermissionHours > 0 && b.excessPermissionHours > 0 ? `
        <div class="totals-row deduct">
          <span class="totals-label">Permission (${b.totalPermissionHours.toFixed(1)}h, free: ${b.freePermissionHours}h, ${b.permissionPenaltyDays} day ded.)</span>
          <span class="totals-value">-${formatCurrency(b.permissionDeduction)}</span>
        </div>` : ''}
        ${b.lateCount > 0 && b.latePenaltyDays > 0 ? `
        <div class="totals-row deduct">
          <span class="totals-label">Late Penalty (${b.lateCount} lates → ${b.latePenaltyDays} day ded.)</span>
          <span class="totals-value">-${formatCurrency(b.lateDeduction)}</span>
        </div>` : ''}
        <div class="totals-row grand">
          <span class="totals-label">Total Deduction</span>
          <span class="totals-value" style="color:#DC2626;">-${formatCurrency(b.totalDeduction)}</span>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <div class="thanks">${BUSINESS_NAME}</div>
      <div class="sub">This is a system-generated salary slip.</div>
    </div>

  </div>
</body>
</html>`;
}

export async function shareSalarySlip(params: SlipParams): Promise<void> {
  const html = buildSalarySlipHtml(params);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
}
