/**
 * Renders tabular report rows as a paginated, printable PDF. jsPDF is loaded
 * on demand so it only costs a download when someone actually exports.
 */
export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  rows: Record<string, unknown>[];
}

export async function downloadPdf({ title, subtitle, filename, rows }: PdfReportOptions): Promise<void> {
  if (rows.length === 0) return;
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);

  const headers = Object.keys(rows[0]);
  // Wide reports get a landscape page so columns are not crushed.
  const doc = new jsPDF({ orientation: headers.length > 5 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header block: wordmark, title, context line, generated timestamp.
  doc.setFillColor(168, 72, 27);
  doc.rect(margin, margin - 4, 22, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TF', margin + 11, margin + 10.5, { align: 'center' });

  doc.setTextColor(18, 21, 28);
  doc.setFontSize(16);
  doc.text(title, margin + 32, margin + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(88, 96, 110);
  const generated = `Generated ${new Date().toLocaleString()}`;
  doc.text(subtitle ? `${subtitle} · ${generated}` : generated, margin, margin + 38);

  autoTable(doc, {
    startY: margin + 52,
    margin: { left: margin, right: margin },
    head: [headers],
    body: rows.map((r) => headers.map((h) => String(r[h] ?? ''))),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: [18, 21, 28], lineColor: [222, 226, 232] },
    headStyles: { fillColor: [235, 238, 242], textColor: [88, 96, 110], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 156, 166);
      doc.text(`TeamForge · ${title}`, margin, doc.internal.pageSize.getHeight() - 20);
      doc.text(`Page ${page}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
    }
  });

  doc.save(filename);
}
