

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { renderToStaticMarkup } from "react-dom/server";
import { Invoice, InvoiceData } from "@/components/invoice";
import { PaymentReceipt } from "@/components/payment-receipt";
import type { Outflow, Payment, Customer, StorageLocation, CropType, PaymentReceiptData, CropBatch, StorageArea } from "./data";
import { getAuth } from "firebase/auth";
import { format } from "date-fns";

function toDate(dateValue: any): Date {
    if (!dateValue) return new Date();
    if (dateValue && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
        return new Date(dateValue.seconds * 1000 + dateValue.nanoseconds / 1000000);
    }
    return new Date(dateValue);
}

export async function generateInflowPdf(batch: CropBatch & { cropType: CropType }, customer: Customer, location: StorageLocation, allAreas: StorageArea[]) {
  const user = getAuth().currentUser;

  if (!user || !batch.cropType) {
    console.error("User not authenticated or cropType missing");
    return;
  }
  
  const getAreaName = (areaId: string) => allAreas.find(a => a.id === areaId)?.name || areaId;

  const invoiceData: InvoiceData = {
    type: 'Inflow',
    receiptNumber: `IN${format(new Date(), 'yyyyMMdd')}${batch.id.slice(0, 4).toUpperCase()}`,
    date: toDate(batch.dateAdded),
    paymentMethod: 'Pending',
    customer: {
      name: customer.name,
      mobile: customer.mobileNumber,
    },
    user: {
      name: user.displayName || 'N/A',
      email: user.email || 'N/A'
    },
    items: batch.areaAllocations.map(alloc => ({
        description: batch.cropType.name,
        quantity: alloc.quantity,
        unit: 'bags',
        storageArea: getAreaName(alloc.areaId),
        total: (batch.labourCharge || 0) * (alloc.quantity / batch.quantity), // Distribute labour charge pro-rata
    })),
    location: location,
    labourCharge: batch.labourCharge,
    total: batch.labourCharge,
    notes: `This receipt confirms the inflow of ${batch.quantity} bags of ${batch.cropType.name}.`,
  };

  const invoiceElement = document.createElement("div");
  invoiceElement.style.position = "absolute";
  invoiceElement.style.left = "-9999px";
  invoiceElement.style.top = "-9999px";
  invoiceElement.style.width = "800px";
  invoiceElement.innerHTML = renderToStaticMarkup(Invoice({ data: invoiceData }));
  document.body.appendChild(invoiceElement);

  try {
    const canvas = await html2canvas(invoiceElement, {
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
    
    const fileName = `inflow-receipt-${invoiceData.receiptNumber}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error("Error generating PDF:", error);
  } finally {
    document.body.removeChild(invoiceElement);
  }
}

export async function generateInvoicePdf(outflow: Outflow, customer: Customer, location: StorageLocation, cropType: CropType, allAreas: StorageArea[]) {
  const user = getAuth().currentUser;

  if (!user) {
    console.error("User not authenticated");
    return;
  }
  
  const invoiceData: InvoiceData = {
    type: 'Outflow',
    receiptNumber: `OUT${format(new Date(outflow.date), 'yyyyMMdd')}${outflow.id.slice(0, 4).toUpperCase()}`,
    date: toDate(outflow.date),
    paymentMethod: outflow.balanceDue > 0 ? 'Pending' : 'Paid',
    customer: {
      name: customer.name,
      mobile: customer.mobileNumber,
    },
    user: {
      name: user.displayName || 'N/A',
      email: user.email || 'N/A'
    },
    items: [{
      description: `Storage for ${cropType.name}`,
      quantity: outflow.quantityWithdrawn,
      unit: 'bags',
      storageArea: 'Multiple',
      unitPrice: outflow.quantityWithdrawn > 0 ? outflow.storageCost / outflow.quantityWithdrawn : 0,
      total: outflow.storageCost,
    }],
    location: location,
    labourCharge: outflow.labourCharge,
    subTotal: outflow.storageCost,
    total: outflow.totalBill,
    amountPaid: outflow.amountPaid,
    balanceDue: outflow.balanceDue,
    notes: `Thank you for your business! This bill covers ${outflow.storageDuration} months of storage.`,
  };

  const invoiceElement = document.createElement("div");
  invoiceElement.style.position = "absolute";
  invoiceElement.style.left = "-9999px";
  invoiceElement.style.top = "-9999px";
  invoiceElement.style.width = "800px";
  invoiceElement.innerHTML = renderToStaticMarkup(Invoice({ data: invoiceData }));
  document.body.appendChild(invoiceElement);

  try {
    const canvas = await html2canvas(invoiceElement, {
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
    
    const fileName = `outflow-invoice-${invoiceData.receiptNumber}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error("Error generating PDF:", error);
  } finally {
    document.body.removeChild(invoiceElement);
  }
}

export async function generatePaymentReceiptPdf(payment: Payment, outflow: Outflow, customer: Customer) {

  const receiptData: PaymentReceiptData = {
    paymentId: payment.id.slice(0, 8).toUpperCase(),
    paymentDate: toDate(payment.date),
    paymentMethod: payment.paymentMethod,
    amountPaid: payment.amount,
    notes: payment.notes,
    customer: {
      name: customer.name,
      mobile: customer.mobileNumber,
    },
    outflowId: outflow.id.slice(0, 8).toUpperCase(),
    outflowDate: toDate(outflow.date),
    totalBill: outflow.totalBill,
    previousBalance: outflow.balanceDue + payment.amount, // Recalculate previous balance
    newBalance: outflow.balanceDue, // The current balance IS the new balance
  };


  const receiptElement = document.createElement("div");
  receiptElement.style.position = "absolute";
  receiptElement.style.left = "-9999px";
  receiptElement.style.top = "-9999px";
  receiptElement.style.width = "800px";
  receiptElement.innerHTML = renderToStaticMarkup(PaymentReceipt({ data: receiptData }));
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
    
    const fileName = `payment-receipt-${receiptData.paymentId}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error("Error generating PDF:", error);
  } finally {
    document.body.removeChild(receiptElement);
  }
}
