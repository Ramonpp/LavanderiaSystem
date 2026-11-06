import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

type ReportFormat = 'pdf' | 'png'

function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement('a')
  link.download = fileName
  link.href = dataUrl
  link.click()
}

export async function exportReportWindow(
  reportWindow: Window,
  fileName: string,
  format: ReportFormat,
) {
  await reportWindow.document.fonts?.ready

  reportWindow.document.querySelectorAll<HTMLElement>('.no-print').forEach((element) => {
    element.style.display = 'none'
  })

  const canvas = await html2canvas(reportWindow.document.body, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    windowWidth: reportWindow.document.documentElement.scrollWidth,
    windowHeight: reportWindow.document.documentElement.scrollHeight,
  })

  if (format === 'png') {
    downloadDataUrl(canvas.toDataURL('image/png'), `${fileName}.png`)
    reportWindow.close()
    return
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 6
  const contentWidth = pageWidth - margin * 2
  const contentHeight = pageHeight - margin * 2
  const imageHeight = (canvas.height * contentWidth) / canvas.width
  const image = canvas.toDataURL('image/png')

  let offset = 0
  let remainingHeight = imageHeight

  pdf.addImage(image, 'PNG', margin, margin, contentWidth, imageHeight)
  remainingHeight -= contentHeight

  while (remainingHeight > 0) {
    offset -= contentHeight
    pdf.addPage()
    pdf.addImage(image, 'PNG', margin, margin + offset, contentWidth, imageHeight)
    remainingHeight -= contentHeight
  }

  pdf.save(`${fileName}.pdf`)
  reportWindow.close()
}
