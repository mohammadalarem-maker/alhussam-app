import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

/**
 * Exports a given HTML element to a PDF file.
 * We use html-to-image because it handles modern CSS (like oklch) much better than html2canvas.
 * 
 * @param elementId The ID of the HTML element to export
 * @param fileName The name of the resulting PDF file
 */
export const exportToPDF = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID ${elementId} not found`);
    return;
  }

  try {
    // Hide buttons or strictly 'print-hidden' elements during capture
    const buttons = element.querySelectorAll('button, .print\\:hidden');
    const originalDisplays: string[] = [];
    buttons.forEach((el) => {
      const htmlEl = el as HTMLElement;
      originalDisplays.push(htmlEl.style.display);
      htmlEl.style.display = 'none';
    });

    const dataUrl = await toPng(element, {
      quality: 0.95,
      backgroundColor: '#ffffff',
      pixelRatio: 2, // Equivalent to scale in html2canvas
    });

    // Restore original displays
    buttons.forEach((el, i) => {
      (el as HTMLElement).style.display = originalDisplays[i];
    });

    // Get image dimensions to set PDF page size
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => (img.onload = resolve));

    const pdf = new jsPDF({
      orientation: img.width > img.height ? 'l' : 'p',
      unit: 'px',
      format: [img.width, img.height]
    });

    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();

    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
};
