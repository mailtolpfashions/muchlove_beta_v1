import { Sale } from '@/types';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatCurrency, formatDate } from './format';

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
          body { font-family: sans-serif; margin: 20px; }
          h1 { text-align: center; color: #333; }
          .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); font-size: 16px; line-height: 24px; color: #555; }
          .invoice-box table { width: 100%; line-height: inherit; text-align: left; }
          .invoice-box table td { padding: 5px; vertical-align: top; }
          .invoice-box table tr td:nth-child(n+2) { text-align: right; }
          .invoice-box table tr.top table td { padding-bottom: 20px; }
          .invoice-box table tr.top table td.title { font-size: 24px; line-height: 30px; color: #333; }
          .invoice-box table tr.information table td { padding-bottom: 40px; }
          .invoice-box table tr.heading td { background: #eee; border-bottom: 1px solid #ddd; font-weight: bold; }
          .invoice-box table tr.details td { padding-bottom: 20px; }
          .invoice-box table tr.item td { border-bottom: 1px solid #eee; }
          .invoice-box table tr.item.last td { border-bottom: none; }
          .invoice-box table tr.total td:nth-child(2) { border-top: 2px solid #eee; font-weight: bold; }
          .text-center { text-align: center !important; }
          .meta { font-size: 0.9em; color: #777; }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <h1>Invoice</h1>
          <table cellpadding="0" cellspacing="0">
            <tr class="top">
              <td colspan="4">
                <table>
                  <tr>
                    <td class="title">
                      Much Love Beauty Salon<br>
                      <span style="font-size: 16px; line-height: 20px;">Kundrathur, Chennai - 69</span><br>
                      <span style="font-size: 16px; line-height: 20px;">Contact : 9092890546</span>
                    </td>
                    <td>
                      Invoice #: ${id.slice(0, 8).toUpperCase()}<br>
                      Created: ${formatDate(createdAt)}<br>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr class="information">
              <td colspan="4">
                <table>
                  <tr>
                    <td>
                      Customer:<br>
                      ${customerName}
                    </td>
                    <td>
                      Billed by:<br>
                      ${employeeName}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr class="heading">
              <td>Item</td>
              <td>Quantity</td>
              <td>Price</td>
              <td class="text-right">Total</td>
            </tr>
            ${saleItemsHtml}
            ${subscriptionItemsHtml}
            <tr class="total">
              <td colspan="3" style="text-align:right;">Subtotal:</td>
              <td style="text-align:right;">${formatCurrency(subtotal)}</td>
            </tr>
            <tr class="total">
                <td colspan="3" style="text-align:right;">Discount:</td>
                <td style="text-align:right;">-${formatCurrency(discountAmount)}</td>
            </tr>
            <tr class="total">
                <td colspan="3" style="text-align:right; font-weight:bold;">Total:</td>
                <td style="text-align:right; font-weight:bold;">${formatCurrency(total)}</td>
            </tr>
             <tr class="total">
                <td colspan="3" style="text-align:right;">Payment Method:</td>
                <td style="text-align:right;">${paymentMethod || 'N/A'}</td>
            </tr>
          </table>
          <br />
          <p class="text-center meta">Thank you for your business!</p>
        </div>
      </body>
    </html>
  `;
};

export const openInvoice = async (sale: Sale) => {
  const html = buildInvoiceHtml(sale);
  try {
    const { uri } = await Print.printToFileAsync({ html });
    console.log('File has been saved to:', uri);
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    console.error('Failed to open invoice:', error);
    throw new Error('Could not open invoice.');
  }
};
