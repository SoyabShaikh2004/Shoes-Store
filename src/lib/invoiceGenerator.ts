import jsPDF from 'jspdf';

export interface InvoiceOrderData {
  orderId: string;
  date: string;
  items: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    selectedColor?: string;
    selectedSize?: number;
    brand?: string;
    category?: string;
  }>;
  totalAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  transactionId?: string;
  utrNumber?: string;
  paidToUPI?: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    pincode: string;
    email?: string;
  };
  estimatedDelivery?: string;
}

export function generateTaxInvoicePDF(order: InvoiceOrderData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.getPageWidth();
  const margin = 14;
  let y = 14;

  // --- BRAND HEADER ---
  // Top Banner Accent
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Company Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39); // Gray 900
  doc.text('STEPSTYLE FOOTWEAR', margin, y + 6);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128); // Gray 500
  doc.text('Premium Athletic & Lifestyle Footwear India Pvt Ltd', margin, y + 11);
  doc.text('GSTIN: 27AAECS1234F1Z8 | CIN: U52100MH2023PTC392811 | State Code: 27 (MH)', margin, y + 15);
  doc.text('Plot 42, StepStyle Hub, Industrial Area, Andheri East, Mumbai 400069', margin, y + 19);

  // TAX INVOICE Badge
  doc.setFillColor(238, 242, 255); // Indigo 50
  doc.roundedRect(pageWidth - margin - 52, y, 52, 22, 2, 2, 'F');
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(pageWidth - margin - 52, y, 52, 22, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(67, 56, 202); // Indigo 700
  doc.text('TAX INVOICE', pageWidth - margin - 46, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(55, 65, 81);
  doc.text(`Inv No: INV-${order.orderId}`, pageWidth - margin - 49, y + 13);
  doc.text(`Date: ${new Date(order.date).toLocaleDateString('en-IN')}`, pageWidth - margin - 49, y + 18);

  y += 28;

  // Horizontal separator line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // --- BILL TO / SHIP TO & ORDER DETAILS ---
  const colWidth = (pageWidth - margin * 2) / 2;

  // Customer Details (Left Box)
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, y, colWidth - 3, 30, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(31, 41, 55);
  doc.text('BILLED & SHIPPED TO:', margin + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text(order.customer.name || 'Valued Customer', margin + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  const addrText = doc.splitTextToSize(
    `${order.customer.address || 'Address provided upon order'}, Pincode: ${order.customer.pincode || 'N/A'}`,
    colWidth - 12
  );
  doc.text(addrText, margin + 4, y + 17);
  doc.text(`Mobile: +91 ${order.customer.phone || 'N/A'}`, margin + 4, y + 26);

  // Payment & Dispatch Info (Right Box)
  const rightX = margin + colWidth + 3;
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(rightX, y, colWidth - 3, 30, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(31, 41, 55);
  doc.text('PAYMENT & LOGISTICS:', rightX + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text(`Order Ref: #${order.orderId}`, rightX + 4, y + 12);
  doc.text(`Payment Mode: ${order.paymentMethod}`, rightX + 4, y + 16);
  doc.text(`Payment Status: ${order.paymentStatus}`, rightX + 4, y + 20);
  if (order.utrNumber && order.utrNumber !== 'N/A') {
    doc.text(`UTR / UPI Ref: ${order.utrNumber}`, rightX + 4, y + 24);
  } else if (order.transactionId) {
    doc.text(`Txn ID: ${order.transactionId}`, rightX + 4, y + 24);
  }
  doc.text(`Est. Delivery: ${order.estimatedDelivery || '3-5 Business Days'}`, rightX + 4, y + 28);

  y += 36;

  // --- ITEM TABLE HEADER ---
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
  doc.setDrawColor(209, 213, 219);
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(55, 65, 81);
  doc.text('SR', margin + 3, y + 5.5);
  doc.text('DESCRIPTION OF GOODS', margin + 12, y + 5.5);
  doc.text('HSN', margin + 92, y + 5.5);
  doc.text('SIZE/COLOR', margin + 106, y + 5.5);
  doc.text('QTY', margin + 134, y + 5.5);
  doc.text('RATE (₹)', margin + 146, y + 5.5);
  doc.text('TOTAL (₹)', pageWidth - margin - 18, y + 5.5);

  y += 8;

  // --- ITEM TABLE ROWS ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55);

  let subtotalCalculated = 0;

  order.items.forEach((item, index) => {
    const lineTotal = item.price * (item.quantity || 1);
    subtotalCalculated += lineTotal;

    // Alternating zebra row
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, pageWidth - margin * 2, 9, 'F');
    }

    doc.setDrawColor(243, 244, 246);
    doc.line(margin, y + 9, pageWidth - margin, y + 9);

    doc.text(`${index + 1}`, margin + 3, y + 6);

    const title = item.name.length > 40 ? item.name.substring(0, 38) + '...' : item.name;
    doc.text(title, margin + 12, y + 6);
    doc.text('6404', margin + 92, y + 6); // Footwear HSN code
    doc.text(
      `UK ${item.selectedSize || 'Standard'} | ${item.selectedColor || 'Classic'}`,
      margin + 106,
      y + 6
    );
    doc.text(`${item.quantity || 1}`, margin + 136, y + 6);
    doc.text(`${item.price.toLocaleString('en-IN')}`, margin + 146, y + 6);
    doc.text(`${lineTotal.toLocaleString('en-IN')}`, pageWidth - margin - 18, y + 6);

    y += 9;
  });

  y += 4;

  // --- TAX CALCULATION BREAKDOWN ---
  // In India, Footwear <= 1000 has 12% GST, > 1000 has 18% GST.
  // Standard 18% GST (9% CGST + 9% SGST)
  const taxableBase = Math.round((order.totalAmount / 1.18) * 100) / 100;
  const totalGst = Math.round((order.totalAmount - taxableBase) * 100) / 100;
  const cgst = Math.round((totalGst / 2) * 100) / 100;
  const sgst = Math.round((totalGst / 2) * 100) / 100;

  const summaryX = pageWidth - margin - 75;

  doc.setFillColor(249, 250, 251);
  doc.roundedRect(summaryX, y, 75, 34, 2, 2, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(summaryX, y, 75, 34, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text('Taxable Value:', summaryX + 4, y + 6);
  doc.text(`₹${taxableBase.toLocaleString('en-IN')}`, pageWidth - margin - 6, y + 6, { align: 'right' });

  doc.text('CGST (9.0%):', summaryX + 4, y + 12);
  doc.text(`₹${cgst.toLocaleString('en-IN')}`, pageWidth - margin - 6, y + 12, { align: 'right' });

  doc.text('SGST (9.0%):', summaryX + 4, y + 18);
  doc.text(`₹${sgst.toLocaleString('en-IN')}`, pageWidth - margin - 6, y + 18, { align: 'right' });

  doc.text('Shipping & Handling:', summaryX + 4, y + 24);
  doc.text('FREE (₹0)', pageWidth - margin - 6, y + 24, { align: 'right' });

  // TOTAL ROW
  doc.setDrawColor(199, 210, 254);
  doc.line(summaryX, y + 26, pageWidth - margin, y + 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(67, 56, 202);
  doc.text('Grand Total:', summaryX + 4, y + 31);
  doc.text(`₹${order.totalAmount.toLocaleString('en-IN')}`, pageWidth - margin - 6, y + 31, {
    align: 'right',
  });

  y += 42;

  // --- TERMS & AUTHORIZED SIGNATORY ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  doc.text('DECLARATION & TERMS:', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(107, 114, 128);
  doc.text('1. All footwear covered under 30-Day StepStyle fit & replacement guarantee.', margin, y + 4);
  doc.text('2. Computer-generated tax invoice under Central Goods and Services Tax Act, 2017.', margin, y + 8);
  doc.text('3. For support, warranty claims or size changes: +91 8830422747 | support@stepstyle.in', margin, y + 12);

  // Digital Signatory Box
  const sigX = pageWidth - margin - 60;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(31, 41, 55);
  doc.text('For StepStyle Footwear India Pvt Ltd', sigX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text('[Digitally Signed & Verified]', sigX, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(75, 85, 99);
  doc.text('Authorized Signatory', sigX, y + 13);

  // Bottom footer accent
  doc.setFillColor(79, 70, 229);
  doc.rect(0, doc.getPageHeight() - 4, pageWidth, 4, 'F');

  // Trigger Save
  doc.save(`StepStyle_Invoice_${order.orderId}.pdf`);
}
