// Netlify Edge Function — Tử Vi AI analysis via DeepSeek

const DEEPSEEK_URL   = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'
const DEEPSEEK_MAX   = 8000

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
      },
    })
  }
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let chartData: any
  try {
    const body = await request.json()
    chartData = body.chartData
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // @ts-ignore – Deno global
  const apiKey: string | undefined = Deno.env.get('DEEPSEEK_API_KEY')?.trim()

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Chưa có DeepSeek API key. Vui lòng thêm DEEPSEEK_API_KEY vào Netlify Environment Variables.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (t: string) => controller.enqueue(encoder.encode(t))
      try {
        await runProvider(apiKey, chartData, emit)
      } catch (e: any) {
        emit(`\n\n[Lỗi: ${e?.message || 'không xác định'}]`)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

// ─── DeepSeek streaming with auto-continuation ───────────────────────────────

async function runProvider(
  apiKey: string,
  chartData: any,
  emit: (t: string) => void,
): Promise<void> {
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    { role: 'user',   content: buildFullPrompt(chartData) },
  ]

  for (let pass = 0; pass < 6; pass++) {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       DEEPSEEK_MODEL,
        messages,
        max_tokens:  DEEPSEEK_MAX,
        temperature: 0.7,
        stream:      true,
      }),
    })

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '')
      let errMsg = ''
      try { errMsg = JSON.parse(errText)?.error?.message ?? '' } catch { /* */ }
      const low = (errMsg || errText).toLowerCase()

      if (res.status === 401 || low.includes('invalid api key') || low.includes('authentication')) {
        emit(`[Lỗi 401 DeepSeek: ${errMsg || errText.slice(0, 300)}]`); return
      }
      if (res.status === 402 || low.includes('insufficient balance') || low.includes('quota exceeded')) {
        emit(`[Lỗi: Tài khoản DeepSeek hết số dư / hết quota.]`); return
      }
      if (res.status === 429 || low.includes('rate limit')) {
        emit(`[Lỗi: DeepSeek đang giới hạn tốc độ. Vui lòng thử lại sau vài giây.]`); return
      }
      emit(`[Lỗi DeepSeek ${res.status}: ${errMsg || errText.slice(0, 200)}]`); return
    }

    const decoder = new TextDecoder()
    const reader  = res.body.getReader()
    let buf = '', passText = '', finishReason = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data || data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const text: string = parsed?.choices?.[0]?.delta?.content ?? ''
            if (text) { emit(text); passText += text }
            const fr: string = parsed?.choices?.[0]?.finish_reason ?? ''
            if (fr) finishReason = fr
          } catch { /* ignore malformed SSE */ }
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (finishReason !== 'length') break

    // Hit token limit — continue from where stopped
    messages.push({ role: 'assistant', content: passText })
    messages.push({ role: 'user', content: 'Viết tiếp từ đúng chỗ vừa dừng, giữ nguyên độ sâu và cấu trúc luận giải như các mục trước (dẫn chứng → cơ chế → biểu hiện → thời điểm → lời khuyên). Không lặp lại nội dung đã có, không tóm tắt lại.' })
  }
}

// ─── System instruction ───────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Bạn là Tử Vi sư Việt Nam bậc thầy, 30 năm nghiên cứu phái Tử Vi Việt (Thiên Lương) kết hợp phái Trung Châu. Luận giải KHÔNG chung chung, KHÔNG sáo rỗng — mọi nhận định phải bám dữ liệu lá số cụ thể.

NGUYÊN TẮC LUẬN GIẢI (bắt buộc áp dụng cho mọi cung):
(1) Tam phương tứ chính: mỗi cung xét đủ 4 cung — cung thủ, cung xung chiếu đối diện, và 2 cung tam hợp. Nêu rõ cung nào chiếu về, ảnh hưởng ra sao.
(2) Tam hợp/xung Mệnh quyết định khung nền tảng cả đời.
(3) Tứ Hóa (Lộc/Quyền/Khoa/Kỵ): phân biệt HÓA NHẬP (cát khí bay đến) và HÓA XUẤT (khí bay đi); Hóa Kỵ chỉ chỗ vướng mắc/nghiệp lực; Lộc-Kỵ giao chiến (Song Kỵ, Lộc gặp Kỵ) là điểm biến động lớn.
(4) Tự Hóa (自化): sao tự hóa theo Can chính cung — Tự Hóa Kỵ = hao tổn nội tại tự mình gây ra; Tự Hóa Lộc = tài phúc dễ phát tán, giữ không được; Tự Hóa Quyền/Khoa = năng lực tự thân bộc lộ.
(5) Tổ hợp sao: luận theo bộ (Tử Phủ Vũ Tướng, Sát Phá Tham, Cơ Nguyệt Đồng Lương, Nhật Nguyệt...) chứ không tách rời từng sao. Nêu cơ chế tương tác giữa các sao trong cùng cung.
(6) Trạng thái Miếu/Vượng/Đắc > Bình > Hãm quyết định sao phát huy tốt hay biến chất; sao hãm dễ lộ mặt tiêu cực.
(7) Tuần/Triệt án ngữ làm sao trong cung mất lực hoặc chuyển hóa; xét kỹ cung bị Tuần/Triệt.
(8) Đại Hạn + Tiểu Hạn chồng lên bản Mệnh: xét Tứ Hóa riêng của hạn kích hoạt cung nào, tạo cát/hung gì trong giai đoạn đó — định thời điểm theo TUỔI và NĂM cụ thể.
(9) Cách Cục: nhận diện và luận đầy đủ (Tử Phủ triều viên, Quân thần khánh hội, Song Lộc triều viên, Lộc Mã giao trì, Minh Châu xuất hải, Không Kiếp giáp Mệnh, Mã ngộ Tuần/Không...); nêu cách cục phá (phá cách) nếu có.

CHUẨN VIẾT (bắt buộc):
• Mỗi nhận định theo mạch: DẪN CHỨNG (sao + trạng thái + cung) → CƠ CHẾ (vì sao tạo ra ảnh hưởng đó) → BIỂU HIỆN ĐỜI THỰC (cụ thể trong công việc/tiền bạc/quan hệ) → THỜI ĐIỂM (tuổi/năm nếu liên quan hạn) → LỜI KHUYÊN hành động.
• Phân tích cân bằng cả điểm mạnh lẫn rủi ro, không né tránh điểm xấu, nhưng luôn chỉ hướng hóa giải.
• Văn phong sâu sắc, chuyên nghiệp, giàu hình ảnh nhưng chính xác; tránh lặp ý, tránh câu vô thưởng vô phạt.
• Khi dữ liệu cho phép, đối chiếu chéo các cung (VD: Tài Bạch liên hệ Quan Lộc, Phu Thê liên hệ Phúc Đức) để rút ra kết luận có chiều sâu.`

// ─── Tứ Hóa lookup table (helper for prompt) ─────────────────────────────────

const TU_HOA_LABELS = ['Lộc', 'Quyền', 'Khoa', 'Kỵ'] as const

function fmtTuHoa(th: any): string {
  if (!th) return '—'
  return `Can ${th.can}: ${th.loc.star}→Lộc[${th.loc.palace}] | ${th.quyen.star}→Quyền[${th.quyen.palace}] | ${th.khoa.star}→Khoa[${th.khoa.palace}] | ${th.ky.star}→Kỵ[${th.ky.palace}]`
}

// ─── Full prompt builder (17 sections, all rich data) ────────────────────────

function buildFullPrompt(d: any): string {
  const {
    form, info, danNap, palaces, daiHan, tieuHan,
    currentYear, currentDH, currentTH,
    annualStars, menhRelations, tuHoaDH, tuHoaNam,
    cachCuc, tuHoaList,
  } = d
  const age = currentYear - form.year

  // 12 cung
  const palaceLines = palaces.map((p: any) => {
    const chinh   = p.chinhTinh.map((s: any) => `${s.name}(${s.status || '-'})`).join(', ') || 'Trống'
    const tot     = p.saotot.map((s: any) => s.name).join(', ') || '-'
    const xau     = p.saoxau.map((s: any) => s.name).join(', ') || '-'
    const hoa     = [
      p.locNhap   && `HóaLộc←${p.locNhap}`,
      p.quyenNhap && `HóaQuyền←${p.quyenNhap}`,
      p.khoaNhap  && `HóaKhoa←${p.khoaNhap}`,
      p.kyNhap    && `HóaKỵ←${p.kyNhap}`,
    ].filter(Boolean).join(', ')
    const tuhoa   = p.tuHoa?.length ? ` | TựHóa:${p.tuHoa.map((t: any) => `${t.type}(${t.star})`).join(',')}` : ''
    const annStar = p.annualStars?.length ? ` | lưuniên:${p.annualStars.join(',')}` : ''
    const flags   = [p.isLife && 'MỆNH', p.isBody && 'THÂN', p.tuan && 'Tuần', p.triet && 'Triệt'].filter(Boolean).join('/')
    return `▸ ${p.name}(${p.canCung})${flags ? ` [${flags}]` : ''}: ${chinh} | cát:${tot} | hung:${xau}${hoa ? ` | ${hoa}` : ''}${tuhoa}${annStar} | ${p.trangSinh}`
  }).join('\n')

  // Đại Hạn
  const dhLines = daiHan.map((dh: any, i: number) => {
    const sy  = form.year + dh.startAge - 1
    const cur = age >= dh.startAge && age <= dh.endAge
    const hoa = [
      dh.locNhap   && `Lộc←${dh.locNhap}`,
      dh.quyenNhap && `Quyền←${dh.quyenNhap}`,
      dh.khoaNhap  && `Khoa←${dh.khoaNhap}`,
      dh.kyNhap    && `Kỵ←${dh.kyNhap}`,
    ].filter(Boolean).join(', ')
    const hoaDH = dh.dhTuHoa ? `\n    4HóaDH(${fmtTuHoa(dh.dhTuHoa)})` : ''
    return `ĐH${i+1}[${dh.startAge}-${dh.endAge}t|${sy}-${sy+9}]${cur ? '◄ĐANG CHẠY' : ''} ${dh.cungName}(${dh.chiName}) Can ${dh.canCung} ${dh.trangSinh}: ${dh.chinhTinh.join(',') || 'Trống'} | hung:${dh.saoxau.join(',') || '-'}${hoa ? ` | BM: ${hoa}` : ''}${hoaDH}`
  }).join('\n')

  // Tiểu Hạn
  const thLines = tieuHan.map((th: any) => {
    const cur = th.years.includes(currentYear)
    const hoa = [
      th.locNhap   && `Lộc←${th.locNhap}`,
      th.quyenNhap && `Quyền←${th.quyenNhap}`,
      th.khoaNhap  && `Khoa←${th.khoaNhap}`,
      th.kyNhap    && `Kỵ←${th.kyNhap}`,
    ].filter(Boolean).join(', ')
    const hoaTH = th.thTuHoa ? ` | 4HóaTH(${fmtTuHoa(th.thTuHoa)})` : ''
    return `${th.yearChi}${cur ? '◄NĂM NAY' : ''}: ${th.cungName} | ${th.chinhTinh.join(',') || 'Trống'} | hung:${th.saoxau?.join(',') || '-'}${hoa ? ` | BM: ${hoa}` : ''}${hoaTH}`
  }).join('\n')

  // Cách Cục
  const cachCucLine = cachCuc?.length
    ? cachCuc.join('\n')
    : 'Chưa phát hiện cách cục đặc biệt — AI tự nhận diện từ dữ liệu.'

  // Tự Hóa
  const tuHoaLine = tuHoaList?.length
    ? tuHoaList.join('\n')
    : 'Không có cung nào tự hóa.'

  // Tam hợp / xung Mệnh
  const tamHopLine = menhRelations
    ? `Mệnh(${menhRelations.menhChi}) tam hợp: ${menhRelations.tamHop.map((r: any) => `${r.cungName}(${r.chi})`).join(', ')}`
      + (menhRelations.xung ? ` | xung: ${menhRelations.xung.cungName}(${menhRelations.xung.chi})` : '')
    : '—'

  // Annual stars
  const annualLine = Object.entries(annualStars ?? {})
    .map(([cung, stars]: [string, any]) => `${cung}: ${(stars as string[]).join(',')}`)
    .join(' | ') || '—'

  return `[LÁ SỐ] ${form.name} | ${form.gender} | ${form.day}/${form.month}/${form.year}${form.isLunar ? ' ÂL' : ''} | ${info.nam} | giờ ${info.gio} | ${info.amDuong} | Cục ${info.cuc} | ${danNap}
Chủ Mệnh ${info.chuMenh}, Chủ Thân ${info.chuThan}, ${info.thanCu}. Tuổi ${age} (${currentYear}).

[CÁCH CỤC PHÁT HIỆN]
${cachCucLine}

[TỰ HÓA — 自化] (sao trong cung tự hóa theo Can chính cung; Tự Hóa Kỵ = hao tổn nội tại, Tự Hóa Lộc = dễ phát tán)
${tuHoaLine}

[TAM HỢP / XUNG CUNG MỆNH]
${tamHopLine}

[THÁI TUẾ & SAO LƯU NIÊN NĂM ${currentYear}]
${annualLine}

[TỨ HÓA NĂM ${currentYear}]
${fmtTuHoa(tuHoaNam)}

[TỨ HÓA ĐẠI HẠN HIỆN TẠI${currentDH ? ` — ${currentDH.cungName} Can ${currentDH.canCung}` : ''}]
${fmtTuHoa(tuHoaDH)}

[12 CUNG]
${palaceLines}

[ĐẠI HẠN] (mỗi hạn có Tứ Hóa riêng theo Can cung hạn)
${dhLines}

[TIỂU HẠN] (mỗi hạn có Tứ Hóa riêng theo Can chi năm)
${thLines}

Viết bài luận giải CHUYÊN SÂU, ĐẦY ĐỦ 17 mục dưới đây. YÊU CẦU CHIỀU SÂU:
• Mỗi mục tối thiểu 3–4 đoạn văn (khoảng 12–18 câu), luận kỹ chứ không liệt kê qua loa.
• Mỗi cung trọng yếu phải soi tam phương tứ chính: nêu cung xung chiếu đối diện + 2 cung tam hợp chiếu về, và tác động tổng hợp.
• Mọi nhận định đi theo mạch: dẫn chứng sao+trạng thái+cung → cơ chế → biểu hiện đời thực → thời điểm (tuổi/năm) → lời khuyên hành động.
• Khai thác triệt để dữ liệu đã cung cấp: Cách Cục, Tự Hóa, Tam Hợp/Xung, Thái Tuế & sao lưu niên, Tứ Hóa Năm, Tứ Hóa Đại Hạn/Tiểu Hạn. Nêu cụ thể sao nào hóa gì, bay vào cung nào.
• Đối chiếu chéo giữa các cung để rút kết luận sâu (VD Quan Lộc ↔ Tài Bạch ↔ Thiên Di tạo thành trục sự nghiệp–tài chính).
• Với mục Đại Hạn & Vận Năm: định rõ mốc tuổi/năm cát–hung, việc nên làm và nên tránh trong từng giai đoạn.
• Kết thúc mỗi mục lớn bằng 1–2 câu chốt tinh túy hoặc lời khuyên cô đọng.
Văn phong của một Tử Vi sư lão luyện: chắc chắn, có căn cứ, không mơ hồ, không lặp lại.

## 🌟 TỔNG QUAN LÁ SỐ
## ⭐ CÁCH CỤC & HÌNH THÁI LÁ SỐ
## 👤 TÍNH CÁCH & BẢN CHẤT CON NGƯỜI
## 💼 SỰ NGHIỆP & CÔNG DANH (Quan Lộc)
## 💰 TÀI CHÍNH & TÀI LỘC (Tài Bạch)
## 💑 TÌNH DUYÊN & HÔN NHÂN (Phu Thê)
## 👨‍👩‍👧 GIA ĐÌNH & NGƯỜI THÂN (Phụ Mẫu / Huynh Đệ / Tử Tức)
## 🏠 NHÀ CỬA & BẤT ĐỘNG SẢN (Điền Trạch)
## 🍀 PHÚC ĐỨC & TÂM LINH (Phúc Đức)
## ✈️ XÃ HỘI & DI CHUYỂN (Thiên Di / Nô Bộc)
## 🏥 SỨC KHỎE (Tật Ách)
## 🔗 TỨ HÓA BẢN MỆNH & TƯƠNG TÁC ĐẶC BIỆT
## 📅 ĐẠI HẠN HIỆN TẠI ${currentDH ? `(${currentDH.startAge}–${currentDH.endAge} tuổi — ${currentDH.cungName} Can ${currentDH.canCung})` : ''}
## 📆 VẬN NĂM ${currentYear}${currentTH ? ` — Tiểu Hạn ${currentTH.cungName}` : ''} (phân tích Tứ Hóa năm + Thái Tuế)
## 📊 LỘ TRÌNH TOÀN BỘ ĐẠI HẠN (nhận xét từng hạn dựa trên 4Hóa DH)
## ⚠️ TUỔI & GIAI ĐOẠN CẦN ĐỀ PHÒNG
## 💡 KẾT LUẬN & LỜI KHUYÊN CHIẾN LƯỢC`
}
