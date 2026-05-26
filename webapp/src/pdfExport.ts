// ── Chart PDF: html2canvas at high resolution (visual grid — image is correct) ──

async function captureLight(el: HTMLElement) {
  const { default: html2canvas } = await import('html2canvas')
  return html2canvas(el, {
    scale: 3,                    // higher = sharper, 3× for retina
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    allowTaint: true,
    onclone: (clonedDoc, clonedEl) => {
      clonedDoc.documentElement.setAttribute('data-theme', 'light')
      clonedDoc.documentElement.style.background = '#ffffff'
      clonedEl.style.background = '#ffffff'
      clonedEl.style.boxShadow = 'none'
      clonedEl.style.border = 'none'
    },
  })
}

export async function exportChartPDF(el: HTMLElement, name: string) {
  const [canvas, { jsPDF }] = await Promise.all([captureLight(el), import('jspdf')])
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
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

// ── Analysis PDF: browser-native print → crisp vector text ──────────────────
//
// html2canvas rasterises text → blurry in PDF.
// Opening a print window lets the browser render text as real PDF vectors.

export function exportAnalysisPrint(el: HTMLElement, name: string): void {
  const inner = el.innerHTML

  const win = window.open('', '_blank')
  if (!win) {
    alert(
      'Trình duyệt đã chặn cửa sổ popup.\n' +
      'Vui lòng cho phép popup từ trang này (biểu tượng trên thanh địa chỉ) rồi thử lại.',
    )
    return
  }

  const title = `${name || 'Phân tích'} — Tử Vi Đẩu Số`

  win.document.write(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Lora:ital,wght@0,600;0,700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.85;
      color: #111;
      background: #fff;
      padding: 14mm 18mm 18mm;
    }

    /* ── Page header ── */
    .ph {
      text-align: center;
      margin-bottom: 22px;
      padding-bottom: 12px;
      border-bottom: 2px solid #7c3aed;
    }
    .ph-title {
      font-family: 'Lora', Georgia, serif;
      font-size: 17pt;
      font-weight: 700;
      color: #1e0a3c;
      margin-bottom: 3px;
    }
    .ph-sub {
      font-size: 9pt;
      color: #888;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* ── Markdown elements ── */
    .md-h1 {
      font-family: 'Lora', Georgia, serif;
      font-size: 14pt;
      font-weight: 700;
      color: #1e0a3c;
      margin: 20px 0 7px;
      padding-bottom: 5px;
      border-bottom: 1.5px solid #ded5f0;
      page-break-after: avoid;
    }
    .md-h2 {
      font-family: 'Lora', Georgia, serif;
      font-size: 11.5pt;
      font-weight: 700;
      color: #4a2878;
      margin: 14px 0 5px;
      page-break-after: avoid;
    }
    p { margin: 0 0 7px; }
    strong { font-weight: 600; color: #1e0a3c; }
    .md-ul { margin: 3px 0 8px 20px; }
    .md-ul li { margin-bottom: 4px; }
    .md-gap { height: 5px; }
    hr { border: none; border-top: 1px solid #e8e0f4; margin: 10px 0; }

    /* Hide streaming cursor & any UI buttons */
    .cursor-blink,
    button { display: none !important; }

    @page { margin: 14mm 18mm; size: A4; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="ph">
    <div class="ph-title">${title}</div>
    <div class="ph-sub">Tử Vi Đẩu Số · Gemini AI</div>
  </div>
  ${inner}
  <script>
    // Wait for fonts, then open print dialog automatically
    (document.fonts ? document.fonts.ready : Promise.resolve())
      .then(function() { setTimeout(function() { window.print() }, 400) })
  </script>
</body>
</html>`)

  win.document.close()
}
