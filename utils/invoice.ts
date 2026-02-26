import { Sale } from '@/types';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatCurrency, formatDate } from './format';
import { BUSINESS_NAME, BUSINESS_ADDRESS, BUSINESS_CONTACT } from '@/constants/app';

export const buildInvoiceHtml = (sale: Sale): string => {
  const {
    id,
    customerName,
    employeeName,
    createdAt,
    items,
    subscriptionItems,
    subtotal,
    discountAmount,
    total,
    paymentMethod,
  } = sale;

  // Separate regular items from combo items
  const regularItems = items.filter(item => item.itemCode !== 'COMBO');
  const comboItems = items.filter(item => item.itemCode !== 'COMBO' ? false : true);

  // Group combo items by combo name (extracted from parentheses)
  const comboGroups: Record<string, typeof items> = {};
  comboItems.forEach(item => {
    const match = item.itemName.match(/\(([^)]+)\)$/);
    const comboName = match ? match[1] : 'Combo';
    if (!comboGroups[comboName]) comboGroups[comboName] = [];
    comboGroups[comboName].push(item);
  });

  const regularItemsHtml = regularItems
    .map(
      (item) => `
    <tr>
      <td>${item.itemName}</td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.price)}</td>
      <td>${formatCurrency(item.price * item.quantity)}</td>
    </tr>
  `
    )
    .join('');

  const comboGroupsHtml = Object.entries(comboGroups)
    .map(([comboName, groupItems]) => {
      const comboTotal = groupItems.reduce((s, i) => s + i.price, 0);
      const origTotal = groupItems.reduce((s, i) => s + (i.originalPrice ?? i.price), 0);
      const savings = origTotal - comboTotal;
      const itemNames = groupItems.map(i => {
        const nameMatch = i.itemName.match(/^(.+?)\s*\(/);
        return nameMatch ? nameMatch[1] : i.itemName;
      }).join(' + ');

      return `
    <tr class="combo-row">
      <td>
        <div style="font-weight:600;">${comboName} <span class="combo-badge">COMBO</span></div>
        <div style="font-size:11px;color:#9CA3AF;margin-top:2px;">${itemNames}</div>
        ${savings > 0 ? `<div style="font-size:11px;color:#10B981;font-weight:600;margin-top:2px;">You save ${formatCurrency(savings)}</div>` : ''}
      </td>
      <td>1</td>
      <td>
        ${formatCurrency(comboTotal)}
        ${origTotal > comboTotal ? `<div style="font-size:11px;color:#9CA3AF;text-decoration:line-through;">${formatCurrency(origTotal)}</div>` : ''}
      </td>
      <td>
        ${formatCurrency(comboTotal)}
        ${origTotal > comboTotal ? `<div style="font-size:11px;color:#9CA3AF;text-decoration:line-through;">${formatCurrency(origTotal)}</div>` : ''}
      </td>
    </tr>
  `;
    })
    .join('');

  const saleItemsHtml = regularItemsHtml + comboGroupsHtml;

  const subscriptionItemsHtml = subscriptionItems
    .map(
      (item) => `
    <tr>
      <td>${item.planName} (Subscription)</td>
      <td>1</td>
      <td>${formatCurrency(item.discountedPrice)}</td>
      <td>${formatCurrency(item.discountedPrice)}</td>
    </tr>
  `
    )
    .join('');

  return `
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Roboto, sans-serif; background: #FFF5F7; color: #1A1A2E; padding: 0; margin: 0; }

          .invoice-wrapper {
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

          /* ── Invoice meta strip ── */
          .meta-strip {
            display: flex; justify-content: space-between; align-items: flex-start;
            padding: 12px 32px 16px; background: #FFFFFF; flex-wrap: wrap; gap: 8px;
          }
          .meta-strip .meta-block { }
          .meta-strip .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9CA3AF; font-weight: 700; }
          .meta-strip .value { font-size: 15px; font-weight: 600; color: #1A1A2E; margin-top: 2px; white-space: nowrap; }

          /* ── Customer / Billed by cards ── */
          .info-row {
            display: flex; gap: 16px; padding: 0 32px 20px; flex-wrap: wrap;
          }
          .info-card {
            flex: 1; min-width: 180px; background: #FFF5F7; border-radius: 12px;
            padding: 14px 16px; border-left: 4px solid #E91E63;
          }
          .info-card .info-label {
            font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
            color: #E91E63; font-weight: 700; margin-bottom: 4px;
          }
          .info-card .info-value { font-size: 14px; font-weight: 600; color: #1A1A2E; }

          /* ── Items table ── */
          .items-section { padding: 0 32px 16px; }
          .items-section table { width: 100%; border-collapse: collapse; }
          .items-section thead th {
            background: linear-gradient(135deg, #FCE4EC, #FFF0F5);
            color: #AD1457; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px;
            font-weight: 700; padding: 10px 12px; text-align: left;
          }
          .items-section thead th:not(:first-child) { text-align: right; }
          .items-section tbody td {
            padding: 10px 12px; font-size: 13px; color: #1A1A2E;
            border-bottom: 1px solid #FFF0F5;
          }
          .items-section tbody td:not(:first-child) { text-align: right; }
          .items-section tbody tr:last-child td { border-bottom: none; }
          .items-section tbody td:first-child { font-weight: 500; }

          /* ── Combo badge ── */
          .combo-badge {
            display: inline-block; background: #D1FAE5; color: #10B981;
            font-size: 9px; font-weight: 700; padding: 2px 6px;
            border-radius: 4px; letter-spacing: 0.5px; vertical-align: middle;
            margin-left: 4px;
          }

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
          .totals-row.discount .totals-value { color: #10B981; font-weight: 600; }
          .totals-row.grand {
            margin-top: 8px; padding-top: 10px;
            border-top: 2px solid #E91E63;
            font-size: 18px; font-weight: 800; color: #E91E63;
          }
          .totals-row .totals-label { }
          .totals-row .totals-value { }

          /* ── Payment badge ── */
          .payment-section { padding: 0 32px 24px; display: flex; justify-content: flex-end; }
          .payment-badge {
            display: inline-flex; align-items: center; gap: 6px;
            background: ${paymentMethod === 'cash' ? '#D1FAE5' : '#FCE4EC'};
            color: ${paymentMethod === 'cash' ? '#10B981' : '#E91E63'};
            font-size: 12px; font-weight: 700; padding: 6px 14px;
            border-radius: 20px; letter-spacing: 0.5px;
          }
          .payment-badge .dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: ${paymentMethod === 'cash' ? '#10B981' : '#E91E63'};
          }

          /* ── Footer ── */
          .footer {
            text-align: center; padding: 20px 32px 28px;
            border-top: 1px solid #FFF0F5;
          }
          .footer .thanks {
            font-size: 16px; font-weight: 700; color: #E91E63; margin-bottom: 4px;
          }
          .footer .sub { font-size: 11px; color: #9CA3AF; }
        </style>
      </head>
      <body>
        <div class="invoice-wrapper">

          <!-- Header -->
          <div class="header">
            <h1>INVOICE</h1>
            <div class="business-name">${BUSINESS_NAME}</div>
            <div class="business-detail">${BUSINESS_ADDRESS} &nbsp;|&nbsp; ${BUSINESS_CONTACT}</div>
          </div>

          <!-- Meta strip -->
          <div class="meta-strip">
            <div class="meta-block">
              <div class="label">Invoice No</div>
              <div class="value">#${id.slice(0, 8).toUpperCase()}</div>
            </div>
            <div class="meta-block">
              <div class="label">Date</div>
              <div class="value">${formatDate(createdAt)}</div>
            </div>
          </div>

          <!-- Customer / Billed by -->
          <div class="info-row">
            <div class="info-card">
              <div class="info-label">Customer</div>
              <div class="info-value">${customerName}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Billed By</div>
              <div class="info-value">${employeeName}</div>
            </div>
          </div>

          <!-- Items table -->
          <div class="items-section">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${saleItemsHtml}
                ${subscriptionItemsHtml}
              </tbody>
            </table>
          </div>

          <!-- Totals -->
          <div class="totals-section">
            <div class="totals-box">
              <div class="totals-row">
                <span class="totals-label">Subtotal</span>
                <span class="totals-value">${formatCurrency(subtotal)}</span>
              </div>
              ${discountAmount > 0 ? `
              <div class="totals-row discount">
                <span class="totals-label">Discount</span>
                <span class="totals-value">- ${formatCurrency(discountAmount)}</span>
              </div>
              ` : ''}
              <div class="totals-row grand">
                <span class="totals-label">Total</span>
                <span class="totals-value">${formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <!-- Payment badge -->
          <div class="payment-section">
            <div class="payment-badge">
              <span class="dot"></span>
              Paid via ${paymentMethod === 'gpay' ? 'Online/UPI' : paymentMethod === 'cash' ? 'Cash' : paymentMethod || 'N/A'}
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="thanks">Thank you for visiting! 💕</div>
            <div class="sub">${BUSINESS_NAME}</div>
          </div>

        </div>
      </body>
    </html>
  `;
};

export const openInvoice = async (sale: Sale) => {
  const html = buildInvoiceHtml(sale);
  try {
    await Print.printAsync({ html });
  } catch (error) {
    console.error('Failed to open invoice:', error);
    throw new Error('Could not open invoice.');
  }
};

export const shareInvoice = async (sale: Sale) => {
  const html = buildInvoiceHtml(sale);
  try {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    console.error('Failed to share invoice:', error);
    throw new Error('Could not share invoice.');
  }
};

/* ── Sales Report PDF ── */

export interface SalesReportFilters {
  dateLabel: string;
  paymentLabel?: string;
  typeLabel?: string;
}

export const buildSalesReportHtml = (sales: Sale[], filters: SalesReportFilters): string => {
  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
  const totalDiscount = sales.reduce((s, sale) => s + sale.discountAmount, 0);
  const cashSales = sales.filter(s => s.paymentMethod === 'cash');
  const onlineSales = sales.filter(s => s.paymentMethod === 'gpay');
  const cashTotal = cashSales.reduce((s, sale) => s + sale.total, 0);
  const onlineTotal = onlineSales.reduce((s, sale) => s + sale.total, 0);

  const filterChips = [
    filters.dateLabel,
    filters.paymentLabel && filters.paymentLabel !== 'All' ? filters.paymentLabel : null,
    filters.typeLabel && filters.typeLabel !== 'All' ? filters.typeLabel : null,
  ].filter(Boolean).map(f => `<span class="chip">${f}</span>`).join('');

  const rowsHtml = sales.map((sale, idx) => {
    const isCash = sale.paymentMethod === 'cash';
    const itemNames = [
      ...sale.items.map(i => i.itemName),
      ...sale.subscriptionItems.map(si => `${si.planName} (sub)`),
    ].join(', ');

    return `
      <tr${idx % 2 === 1 ? ' class="alt"' : ''}>
        <td class="num">${idx + 1}</td>
        <td>${sale.customerName}</td>
        <td class="items-col">${itemNames}</td>
        <td class="right">${formatCurrency(sale.subtotal)}</td>
        <td class="right discount-col">${sale.discountAmount > 0 ? '- ' + formatCurrency(sale.discountAmount) : '–'}</td>
        <td class="right bold">${formatCurrency(sale.total)}</td>
        <td><span class="pay-badge ${isCash ? 'cash' : 'online'}">${isCash ? 'Cash' : 'UPI'}</span></td>
        <td class="meta-col">${sale.employeeName}</td>
        <td class="meta-col">${formatDateTime(sale.createdAt)}</td>
      </tr>
    `;
  }).join('');

  return `
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Roboto, sans-serif; background: #FFF5F7; color: #1A1A2E; padding: 0; margin: 0; }
          .wrapper { max-width: 1100px; margin: 0 auto; background: #FFF; }

          .header {
            background: linear-gradient(135deg, #E91E63, #AD1457);
            color: #FFF; padding: 28px 32px 36px; position: relative;
          }
          .header::after {
            content: ''; position: absolute; bottom: 0; left: 0; right: 0;
            height: 16px; background: #FFF; border-radius: 16px 16px 0 0;
          }
          .header h1 { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
          .header .biz { font-size: 13px; opacity: 0.85; margin-top: 2px; }
          .header .generated { font-size: 10px; opacity: 0.65; margin-top: 6px; }

          .filters-row { padding: 8px 32px 12px; display: flex; gap: 6px; flex-wrap: wrap; }
          .chip {
            display: inline-block; background: #FCE4EC; color: #AD1457;
            font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 10px;
          }

          .summary-row {
            display: flex; gap: 12px; padding: 0 32px 20px; flex-wrap: wrap;
          }
          .summary-card {
            flex: 1; min-width: 140px; background: #FFF5F7; border-radius: 10px;
            padding: 12px 14px; border-left: 3px solid #E91E63;
          }
          .summary-card .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #E91E63; font-weight: 700; }
          .summary-card .val { font-size: 18px; font-weight: 800; color: #1A1A2E; margin-top: 2px; }
          .summary-card .sub { font-size: 10px; color: #9CA3AF; margin-top: 2px; }

          .table-section { padding: 0 32px 20px; }
          table { width: 100%; border-collapse: collapse; }
          thead th {
            background: linear-gradient(135deg, #FCE4EC, #FFF0F5);
            color: #AD1457; font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px;
            font-weight: 700; padding: 8px 6px; text-align: left; white-space: nowrap;
          }
          thead th.right { text-align: right; }
          tbody td {
            padding: 7px 6px; font-size: 11px; color: #1A1A2E;
            border-bottom: 1px solid #FFF0F5; vertical-align: top;
          }
          tbody tr.alt td { background: #FEFBFC; }
          tbody td.num { color: #9CA3AF; font-weight: 500; width: 28px; }
          tbody td.right { text-align: right; }
          tbody td.bold { font-weight: 700; }
          tbody td.items-col { max-width: 200px; color: #6B7280; font-size: 10px; }
          tbody td.meta-col { font-size: 10px; color: #6B7280; white-space: nowrap; }
          tbody td.discount-col { color: #10B981; }

          .pay-badge {
            display: inline-block; font-size: 8px; font-weight: 700;
            padding: 2px 7px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.3px;
          }
          .pay-badge.cash { background: #D1FAE5; color: #10B981; }
          .pay-badge.online { background: #EDE9FE; color: #7C3AED; }

          .footer {
            text-align: center; padding: 16px 32px 24px;
            border-top: 1px solid #FFF0F5;
          }
          .footer .thanks { font-size: 13px; font-weight: 700; color: #E91E63; }
          .footer .sub { font-size: 10px; color: #9CA3AF; margin-top: 2px; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <h1>SALES REPORT</h1>
            <div class="biz">${BUSINESS_NAME} &nbsp;|&nbsp; ${BUSINESS_ADDRESS}</div>
            <div class="generated">Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          </div>

          <div class="filters-row">${filterChips}</div>

          <div class="summary-row">
            <div class="summary-card">
              <div class="lbl">Total Sales</div>
              <div class="val">${sales.length}</div>
            </div>
            <div class="summary-card">
              <div class="lbl">Revenue</div>
              <div class="val">${formatCurrency(totalRevenue)}</div>
              ${totalDiscount > 0 ? `<div class="sub">Discounts: ${formatCurrency(totalDiscount)}</div>` : ''}
            </div>
            <div class="summary-card">
              <div class="lbl">Cash</div>
              <div class="val">${formatCurrency(cashTotal)}</div>
              <div class="sub">${cashSales.length} txn${cashSales.length !== 1 ? 's' : ''}</div>
            </div>
            <div class="summary-card">
              <div class="lbl">Online / UPI</div>
              <div class="val">${formatCurrency(onlineTotal)}</div>
              <div class="sub">${onlineSales.length} txn${onlineSales.length !== 1 ? 's' : ''}</div>
            </div>
          </div>

          <div class="table-section">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th class="right">Subtotal</th>
                  <th class="right">Discount</th>
                  <th class="right">Total</th>
                  <th>Payment</th>
                  <th>Billed By</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <div class="thanks">${BUSINESS_NAME}</div>
            <div class="sub">This is a system-generated report.</div>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const shareSalesReport = async (sales: Sale[], filters: SalesReportFilters) => {
  const html = buildSalesReportHtml(sales, filters);
  try {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    console.error('Failed to share sales report:', error);
    throw new Error('Could not share sales report.');
  }
};

export const openSalesReport = async (sales: Sale[], filters: SalesReportFilters) => {
  const html = buildSalesReportHtml(sales, filters);
  try {
    await Print.printAsync({ html });
  } catch (error) {
    console.error('Failed to open sales report:', error);
    throw new Error('Could not open sales report.');
  }
};
