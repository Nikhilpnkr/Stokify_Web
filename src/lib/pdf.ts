
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { renderToStaticMarkup } from "react-dom/server";
import { Invoice, InvoiceData } from "@/components/invoice";

export async function generateInvoicePdf(data: InvoiceData) {
  const invoiceElement = document.createElement("div");
  // Position off-screen
  invoiceElement.style.position = "absolute";
  invoiceElement.style.left = "-9999px";
  invoiceElement.style.top = "-9999px";
  invoiceElement.style.width = "800px"; // A4-like width
  invoiceElement.innerHTML = renderToStaticMarkup(Invoice({ data }));
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
