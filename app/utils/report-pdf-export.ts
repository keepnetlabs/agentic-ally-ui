/**
 * Report PDF Export
 * Uses html2canvas-pro (oklch support) + jsPDF
 * Captures each .a4-page element separately for proper pagination
 */
import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

/**
 * Export report to PDF by capturing each .a4-page as a separate PDF page.
 * html2canvas-pro supports oklch natively — no color stripping needed.
 */
export async function exportReportToPdf(
  pagesContainer: HTMLElement,
  filename: string
): Promise<void> {
  const pages = pagesContainer.querySelectorAll('.a4-page')
  if (!pages.length) throw new Error('No pages found')

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i] as HTMLElement

    const canvas = await html2canvas(page, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const imgHeight = (canvas.height * A4_WIDTH_MM) / canvas.width

    if (i > 0) doc.addPage()
    doc.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, Math.min(imgHeight, A4_HEIGHT_MM))
  }

  doc.save(filename)
}
