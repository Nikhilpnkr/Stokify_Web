

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { renderToStaticMarkup } from "react-dom/server";
import { Invoice, InvoiceData } from "@/components/invoice";
import { PaymentReceipt, PaymentReceiptData } from "@/components/payment-receipt";

function toDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    // Firestore Timestamp object
    if (dateValue && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
        return new Date(dateValue.seconds * 1000 + dateValue.nanoseconds / 1000000);
    }
    // ISO string or already a Date object
    return new Date(dateValue);
}

export async function generateInvoicePdf(data: InvoiceData) {
  // Ensure the date is a Date object, not a string or Timestamp from Firestore
  const processedData = {
    ...data,
    date: toDate(data.date),
  };

  const invoiceElement = document.createElement("div");
  // Position off-screen
  invoiceElement.style.position = "absolute";
  invoiceElement.style.left = "-9999px";
  invoiceElement.style.top = "-9999px";
  invoiceElement.style.width = "800px"; // A4-like width
  invoiceElement.innerHTML = renderToStaticMarkup(Invoice({ data: processedData }));
  document.body.appendChild(invoiceElement);

  try {
    const canvas = await html2canvas(invoiceElement, {
      scale: 2, // Higher scale for better quality
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    
    const fileName = `${data.type.toLowerCase()}-receipt-${data.receiptNumber}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error("Error generating PDF:", error);
  } finally {
    // Clean up the temporary element
    document.body.removeChild(invoiceElement);
  }
}

export async function generatePaymentReceiptPdf(data: PaymentReceiptData) {
  const processedData = {
    ...data,
    paymentDate: toDate(data.paymentDate),
    outflowDate: toDate(data.outflowDate),
  };

  const receiptElement = document.createElement("div");
  receiptElement.style.position = "absolute";
  receiptElement.style.left = "-9999px";
  receiptElement.style.top = "-9999px";
  receiptElement.style.width = "800px";
  receiptElement.innerHTML = renderToStaticMarkup(PaymentReceipt({ data: processedData }));
  document.body.appendChild(receiptElement);

  try {
    const canvas = await html2canvas(receiptElement, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    
    const fileName = `payment-receipt-${data.paymentId}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error("Error generating PDF:", error);
  } finally {
    document.body.removeChild(receiptElement);
  }
}
