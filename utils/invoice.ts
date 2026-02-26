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

  const saleItemsHtml = items
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
            border-radius: 0; overflow: hidden;
          }

          /* ── Header band ── */
          .header {
            background: linear-gradient(135deg, #E91E63, #AD1457);
            color: #FFFFFF; padding: 28px 32px; position: relative;
          }
          .header::after {
            content: ''; position: absolute; bottom: -20px; left: 0; right: 0;
            height: 40px; background: #FFFFFF; border-radius: 20px 20px 0 0;
          }
          .header h1 { font-size: 26px; font-weight: 800; letter-spacing: 1px; margin-bottom: 2px; }
          .header .business-name { font-size: 14px; opacity: 0.9; font-weight: 500; }
          .header .business-detail { font-size: 12px; opacity: 0.75; margin-top: 2px; }

          /* ── Invoice meta strip ── */
          .meta-strip {
            display: flex; justify-content: space-between; align-items: flex-start;
            padding: 16px 32px 12px; background: #FFFFFF; flex-wrap: wrap; gap: 8px;
          }
          .meta-strip .meta-block { }
          .meta-strip .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9CA3AF; font-weight: 700; }
          .meta-strip .value { font-size: 14px; font-weight: 600; color: #1A1A2E; margin-top: 2px; }

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
