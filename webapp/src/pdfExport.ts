async function captureLight(el: HTMLElement, opts?: { padding?: number }) {
  const { default: html2canvas } = await import('html2canvas')

  return html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    allowTaint: true,
    onclone: (clonedDoc, clonedEl) => {
      // Force light theme so all CSS variables resolve to light colours
      clonedDoc.documentElement.setAttribute('data-theme', 'light')
      clonedDoc.documentElement.style.background = '#ffffff'

      // Clean up the element itself
      clonedEl.style.background = '#ffffff'
      clonedEl.style.boxShadow = 'none'
      clonedEl.style.border = 'none'
      if (opts?.padding) clonedEl.style.padding = `${opts.padding}px`
    },
  })
}

export async function exportChartPDF(el: HTMLElement, name: string) {
  const [canvas, { jsPDF }] = await Promise.all([captureLight(el), import('jspdf')])
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()

  // White page background
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, pw, ph, 'F')

  const margin = 8
  const maxW = pw - margin * 2
  const maxH = ph - margin * 2
  const ratio = canvas.width / canvas.height
  let w = maxW, h = maxW / ratio
  if (h > maxH) { h = maxH; w = maxH * ratio }

  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - w) / 2, (ph - h) / 2, w, h)
  pdf.save(`${name || 'la-so'}-tu-vi.pdf`)
}

export async function exportAnalysisPDF(el: HTMLElement, name: string) {
  const [canvas, { jsPDF }] = await Promise.all([
    captureLight(el, { padding: 16 }),
    import('jspdf'),
  ])
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  const margin = 10
  const printW = pw - margin * 2
  const imgH = (canvas.height * printW) / canvas.width
  const imgData = canvas.toDataURL('image/png')

  let heightLeft = imgH
  let position = margin

  // White page background + first page
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, pw, ph, 'F')
  pdf.addImage(imgData, 'PNG', margin, position, printW, imgH)
  heightLeft -= (ph - margin)

  while (heightLeft > 0) {
    position -= (ph - margin * 2)
    pdf.addPage()
    pdf.setFillColor(255, 255, 255)
    pdf.rect(0, 0, pw, ph, 'F')
    pdf.addImage(imgData, 'PNG', margin, position, printW, imgH)
    heightLeft -= (ph - margin * 2)
  }

  pdf.save(`${name || 'phan-tich'}-tu-vi.pdf`)
}
