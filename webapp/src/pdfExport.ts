const BG = '#040112'

async function capture(el: HTMLElement) {
  const { default: html2canvas } = await import('html2canvas')
  return html2canvas(el, {
    scale: 2,
    backgroundColor: BG,
    useCORS: true,
    logging: false,
    allowTaint: true,
  })
}

export async function exportChartPDF(el: HTMLElement, name: string) {
  const [canvas, { jsPDF }] = await Promise.all([capture(el), import('jspdf')])
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  pdf.setFillColor(4, 1, 18)
  pdf.rect(0, 0, pw, ph, 'F')

  const margin = 6
  const maxW = pw - margin * 2
  const maxH = ph - margin * 2
  const ratio = canvas.width / canvas.height
  let w = maxW, h = maxW / ratio
  if (h > maxH) { h = maxH; w = maxH * ratio }

  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h)
  pdf.save(`${name || 'la-so'}-tu-vi.pdf`)
}

export async function exportAnalysisPDF(el: HTMLElement, name: string) {
  const [canvas, { jsPDF }] = await Promise.all([capture(el), import('jspdf')])
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  const imgW = pw
  const imgH = (canvas.height * pw) / canvas.width
  const imgData = canvas.toDataURL('image/jpeg', 0.92)

  let heightLeft = imgH
  let position = 0
  pdf.setFillColor(4, 1, 18)
  pdf.rect(0, 0, pw, ph, 'F')
  pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH)
  heightLeft -= ph

  while (heightLeft > 0) {
    position -= ph
    pdf.addPage()
    pdf.setFillColor(4, 1, 18)
    pdf.rect(0, 0, pw, ph, 'F')
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH)
    heightLeft -= ph
  }

  pdf.save(`${name || 'phan-tich'}-tu-vi.pdf`)
}
