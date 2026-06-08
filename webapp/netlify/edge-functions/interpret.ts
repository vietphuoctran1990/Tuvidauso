// Netlify Edge Function – DeepSeek V3 AI analysis
//
// API key priority: request body `deepseekKey` (user-entered in app) → DEEPSEEK_API_KEY env var

const DEEPSEEK_MODEL = 'deepseek-v4-flash'
const DEEPSEEK_MAX_TOKENS = 8000

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
  let bodyKey: string | undefined
  try {
    const body = await request.json()
    chartData = body.chartData
    bodyKey = body.deepseekKey
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // @ts-ignore – Deno global
  const envKey: string | undefined = Deno.env.get('DEEPSEEK_API_KEY')
  const apiKey = bodyKey?.trim() || envKey?.trim()

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Chưa có DeepSeek API key. Vui lòng nhập key trong ứng dụng.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (t: string) => controller.enqueue(encoder.encode(t))
      try {
        await runDeepSeek(apiKey, chartData, emit)
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

// ─── DeepSeek streaming with auto-continuation when output is cut off ────────

async function runDeepSeek(apiKey: string, chartData: any, emit: (t: string) => void): Promise<void> {
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    { role: 'user', content: buildFullPrompt(chartData) },
  ]

  for (let pass = 0; pass < 4; pass++) {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        max_tokens: DEEPSEEK_MAX_TOKENS,
        temperature: 0.75,
        stream: true,
      }),
    })

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '')
      let errMsg = ''
      try { errMsg = JSON.parse(errText)?.error?.message ?? '' } catch { /* */ }
      const low = errMsg.toLowerCase()
      if (res.status === 401 || low.includes('invalid api key') || low.includes('authentication')) {
        emit('[Lỗi: API key không hợp lệ. Vào ứng dụng → nhấn "Đổi API key" để cập nhật.]')
        return
      }
      if (res.status === 402 || low.includes('insufficient balance')) {
        emit('[Lỗi: Tài khoản DeepSeek hết số dư. Vui lòng nạp thêm tại platform.deepseek.com.]')
        return
      }
      if (res.status === 429 || low.includes('rate limit') || low.includes('quota')) {
        emit('[Lỗi: Đã vượt giới hạn API. Vui lòng thử lại sau vài giây.]')
        return
      }
      emit(`[Lỗi DeepSeek ${res.status}: ${errMsg || errText}]`)
      return
    }

    const decoder = new TextDecoder()
    const reader = res.body.getReader()
    let buf = ''
    let passText = ''
    let finishReason = ''

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

    // Natural stop — done
    if (finishReason !== 'length') break

    // Hit token limit — ask to continue from where it stopped
    messages.push({ role: 'assistant', content: passText })
    messages.push({ role: 'user', content: 'Tiếp tục viết các mục còn lại từ chỗ vừa dừng. Không lặp lại nội dung đã có.' })
  }
}

// ─── System instruction ───────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Bạn là Tử Vi sư Việt Nam chuyên nghiệp. Nguyên tắc: (1) xét cung thủ + cung chiếu đối diện; (2) tam hợp/xung ảnh hưởng Mệnh; (3) Tứ Hóa tác động riêng từng cung; (4) Tự Hóa (自化) — sao tự hóa theo Can chính cung: tự hóa Lộc/Quyền/Khoa dễ phát tán ra ngoài, tự hóa Kỵ hao tổn nội tại, cần luận kỹ; (5) tổ hợp sao tương tác nhau; (6) trạng thái Miếu/Vượng/Đắc > Bình > Hãm; (7) Tuần/Triệt làm yếu sao; (8) Đại Hạn kết hợp bản Mệnh. Nhận diện và gọi tên Cách Cục (Tử Phủ triều viên, Song Lộc, Không Kiếp giáp Mệnh, Nhật Nguyệt đồng chiếu, Mã Đầu Đới Tiễn...). Viết tiếng Việt sâu sắc, dẫn chứng tên sao + trạng thái cụ thể.`

// ─── Full prompt (17 sections) ────────────────────────────────────────────────

function fmtTuHoa(th: any): string {
  if (!th) return '—'
  return `Can ${th.can}: ${th.loc.star}→Lộc[${th.loc.palace}] | ${th.quyen.star}→Quyền[${th.quyen.palace}] | ${th.khoa.star}→Khoa[${th.khoa.palace}] | ${th.ky.star}→Kỵ[${th.ky.palace}]`
}

function buildFullPrompt(d: any): string {
  const { form, info, danNap, palaces, daiHan, tieuHan, currentYear, currentDH, currentTH,
          annualStars, menhRelations, tuHoaDH, tuHoaNam, cachCuc, tuHoaList } = d
  const age = currentYear - form.year

  // 12 cung — include annual stars per palace
  const palaceLines = palaces.map((p: any) => {
    const chinh = p.chinhTinh.map((s: any) => `${s.name}(${s.status || '-'})`).join(', ') || 'Trống'
    const tot = p.saotot.map((s: any) => s.name).join(', ') || '-'
    const xau = p.saoxau.map((s: any) => s.name).join(', ') || '-'
    const hoa = [
      p.locNhap   && `HóaLộc←${p.locNhap}`,
      p.quyenNhap && `HóaQuyền←${p.quyenNhap}`,
      p.khoaNhap  && `HóaKhoa←${p.khoaNhap}`,
      p.kyNhap    && `HóaKỵ←${p.kyNhap}`,
    ].filter(Boolean).join(', ')
    const flags = [p.isLife && 'MỆNH', p.isBody && 'THÂN', p.tuan && 'Tuần', p.triet && 'Triệt'].filter(Boolean).join('/')
    const annStar = p.annualStars?.length ? ` | lưuniên:${p.annualStars.join(',')}` : ''
    const tuHoa = p.tuHoa?.length ? ` | TựHóa:${p.tuHoa.map((t: any) => `${t.type}(${t.star})`).join(',')}` : ''
    return `▸ ${p.name}(${p.canCung})${flags ? ` [${flags}]` : ''}: ${chinh} | cát:${tot} | hung:${xau}${hoa ? ` | ${hoa}` : ''}${tuHoa}${annStar} | ${p.trangSinh}`
  }).join('\n')

  // Đại Hạn — include each hạn's own Tứ Hóa (from canCung)
  const dhLines = daiHan.map((dh: any, i: number) => {
    const sy = form.year + dh.startAge - 1
    const cur = age >= dh.startAge && age <= dh.endAge
    const hoaBM = [
      dh.locNhap && `Lộc←${dh.locNhap}`, dh.quyenNhap && `Quyền←${dh.quyenNhap}`,
      dh.khoaNhap && `Khoa←${dh.khoaNhap}`, dh.kyNhap && `Kỵ←${dh.kyNhap}`,
    ].filter(Boolean).join(', ')
    const hoaDH = dh.dhTuHoa ? `\n    4HóaDH(${fmtTuHoa(dh.dhTuHoa)})` : ''
    return `ĐH${i + 1}[${dh.startAge}-${dh.endAge}t|${sy}-${sy + 9}]${cur ? '◄ĐANG CHẠY' : ''} ${dh.cungName}(${dh.chiName}) Can ${dh.canCung} ${dh.trangSinh}: ${dh.chinhTinh.join(',') || 'Trống'} | hung:${dh.saoxau.join(',') || '-'}${hoaBM ? ` | BM: ${hoaBM}` : ''}${hoaDH}`
  }).join('\n')

  // Tiểu Hạn — include each hạn's Tứ Hóa
  const thLines = tieuHan.map((th: any) => {
    const cur = th.years.includes(currentYear)
    const hoaBM = [
      th.locNhap && `Lộc←${th.locNhap}`, th.quyenNhap && `Quyền←${th.quyenNhap}`,
      th.khoaNhap && `Khoa←${th.khoaNhap}`, th.kyNhap && `Kỵ←${th.kyNhap}`,
    ].filter(Boolean).join(', ')
    const hoaTH = th.thTuHoa ? ` | 4HóaTH(${fmtTuHoa(th.thTuHoa)})` : ''
    return `${th.yearChi}${cur ? '◄NĂM NAY' : ''}: ${th.cungName} | ${th.chinhTinh.join(',') || 'Trống'} | hung:${th.saoxau?.join(',') || '-'}${hoaBM ? ` | BM: ${hoaBM}` : ''}${hoaTH}`
  }).join('\n')

  // Cách Cục
  const cachCucLine = cachCuc?.length
    ? cachCuc.join('\n')
    : 'Chưa phát hiện cách cục đặc biệt rõ ràng — AI tự nhận diện từ dữ liệu.'

  // Tự Hóa (self-transformation)
  const tuHoaLine = tuHoaList?.length
    ? tuHoaList.join('\n')
    : 'Không có cung nào tự hóa.'

  // Tam hợp / xung Mệnh
  const tamHopLine = menhRelations
    ? `Mệnh(${menhRelations.menhChi}) tam hợp: ${menhRelations.tamHop.map((r: any) => `${r.cungName}(${r.chi})`).join(', ')}` +
      (menhRelations.xung ? ` | xung: ${menhRelations.xung.cungName}(${menhRelations.xung.chi})` : '')
    : ''

  // Annual stars summary
  const annualLine = Object.entries(annualStars ?? {})
    .map(([cung, stars]: [string, any]) => `${cung}: ${(stars as string[]).join(',')}`)
    .join(' | ') || '—'

  return `[LÁ SỐ] ${form.name} | ${form.gender} | ${form.day}/${form.month}/${form.year}${form.isLunar ? ' ÂL' : ''} | ${info.nam} | giờ ${info.gio} | ${info.amDuong} | Cục ${info.cuc} | ${danNap}
Chủ Mệnh ${info.chuMenh}, Chủ Thân ${info.chuThan}, ${info.thanCu}. Tuổi ${age} (${currentYear}).

[CÁCH CỤC PHÁT HIỆN]
${cachCucLine}

[TỰ HÓA — 自化] (sao trong cung tự hóa theo Can của chính cung; tự hóa Kỵ làm hao tổn nội tại, tự hóa Lộc dễ phát tán)
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

Viết bài phân tích hoàn chỉnh 17 mục — mỗi mục tối thiểu 6–8 câu, dẫn chứng tên sao + trạng thái + cung cụ thể. Dùng đầy đủ dữ liệu Cách Cục, Tự Hóa, Tam Hợp/Xung, Thái Tuế, Tứ Hóa Năm và Tứ Hóa Đại Hạn đã cung cấp:

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
