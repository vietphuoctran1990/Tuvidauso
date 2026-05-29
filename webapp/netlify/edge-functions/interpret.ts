// Netlify Edge Function – Deno runtime, streams Groq interpretation
// Uses Groq API (OpenAI-compatible) with Llama 3.3 70B.
// Strategy: 2-pass chunked generation to stay under the 12K TPM free-tier limit.
//   Groq reserves (input + max_tokens) against TPM on every request, so each
//   pass keeps a lean input and a modest max_tokens; the two passes together
//   stay comfortably below 12K within the rolling 60-second window.

const MODEL = 'llama-3.3-70b-versatile'
const MAX_TOKENS_PER_PASS = 3600

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

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // @ts-ignore – Deno global
  const apiKey: string | undefined = Deno.env.get('GROQ_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GROQ_API_KEY chưa được cấu hình trên Netlify.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let chartData: any
  try {
    const body = await request.json()
    chartData = body.chartData
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const encoder = new TextEncoder()
  const chart = buildChartBlock(chartData)

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (t: string) => controller.enqueue(encoder.encode(t))
      try {
        // Pass 1 — bản mệnh (sections 1–9)
        await runPass(apiKey, chart, PASS_1_SECTIONS, emit)
        emit('\n\n')
        // Pass 2 — vận hạn & kết luận (sections 10–17)
        await runPass(apiKey, chart, PASS_2_SECTIONS, emit)
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

// ─── One Groq streaming pass (with one rate-limit retry) ────────────────────

async function runPass(
  apiKey: string,
  chart: string,
  sections: string,
  emit: (t: string) => void,
  isRetry = false,
): Promise<void> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: `${chart}\n\nViết các mục sau, mỗi mục 6–9 câu, văn phong tử vi sư, dẫn sao + trạng thái cụ thể (đừng nói chung chung). Giữ nguyên tiêu đề có emoji:\n\n${sections}` },
      ],
      max_tokens: MAX_TOKENS_PER_PASS,
      temperature: 0.75,
      stream: true,
    }),
  })

  if (!res.ok || !res.body) {
    const errText = await res.text()
    let errMsg = ''
    try { errMsg = JSON.parse(errText)?.error?.message ?? '' } catch { /* */ }
    const low = errMsg.toLowerCase()

    // Rate limited → wait the suggested time and retry once
    if ((res.status === 429 || low.includes('rate limit')) && !isRetry) {
      const wait = parseRetrySeconds(errMsg, res.headers.get('retry-after'))
      emit(`\n\n_⏳ Đang chờ giới hạn API reset (~${wait}s) rồi viết tiếp..._\n\n`)
      await sleep(wait * 1000)
      return runPass(apiKey, chart, sections, emit, true)
    }
    if (low.includes('invalid api key') || low.includes('auth')) {
      emit('\n\n[Lỗi: GROQ_API_KEY không hợp lệ. Vui lòng kiểm tra cấu hình trên Netlify.]')
      return
    }
    emit(`\n\n[Lỗi API: ${errMsg || errText}]`)
    return
  }

  const decoder = new TextDecoder()
  const reader = res.body.getReader()
  let buf = ''
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
          const text: string = JSON.parse(data)?.choices?.[0]?.delta?.content ?? ''
          if (text) emit(text)
        } catch { /* ignore malformed SSE lines */ }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function parseRetrySeconds(msg: string, header: string | null): number {
  const h = header ? parseFloat(header) : NaN
  if (!isNaN(h) && h > 0) return Math.min(Math.ceil(h) + 1, 30)
  const m = msg.match(/try again in ([\d.]+)s/i)
  if (m) return Math.min(Math.ceil(parseFloat(m[1])) + 1, 30)
  return 12
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── System instruction ─────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Bạn là Tử Vi sư Việt Nam chuyên nghiệp. Nguyên tắc: (1) xét cung thủ + cung chiếu đối diện; (2) tam hợp/xung ảnh hưởng Mệnh; (3) Tứ Hóa tác động riêng từng cung; (4) tổ hợp sao tương tác nhau; (5) trạng thái Miếu/Vượng/Đắc > Bình > Hãm; (6) Tuần/Triệt làm yếu sao; (7) Đại Hạn kết hợp bản Mệnh. Nhận diện và gọi tên Cách Cục (Tử Phủ triều viên, Song Lộc, Không Kiếp giáp Mệnh, Nhật Nguyệt đồng chiếu, Mã Đầu Đới Tiễn...). Viết tiếng Việt sâu sắc, dẫn chứng tên sao + trạng thái cụ thể.`

// ─── Section groups (split across the 2 passes) ─────────────────────────────

const PASS_1_SECTIONS = `## 🌟 TỔNG QUAN LÁ SỐ
## ⭐ CÁCH CỤC & HÌNH THÁI
## 👤 TÍNH CÁCH & BẢN CHẤT
## 💼 SỰ NGHIỆP (Quan Lộc)
## 💰 TÀI CHÍNH (Tài Bạch)
## 💑 TÌNH DUYÊN (Phu Thê)
## 👨‍👩‍👧 GIA ĐÌNH (Phụ Mẫu / Huynh Đệ / Tử Tức)
## 🏠 NHÀ CỬA (Điền Trạch)
## 🍀 PHÚC ĐỨC & TÂM LINH`

const PASS_2_SECTIONS = `## ✈️ XÃ HỘI & DI CHUYỂN (Thiên Di / Nô Bộc)
## 🏥 SỨC KHỎE (Tật Ách)
## 🔗 TỨ HÓA & TƯƠNG TÁC ĐẶC BIỆT
## 📅 ĐẠI HẠN HIỆN TẠI
## 📆 VẬN NĂM (kèm phân tích từng quý)
## 📊 LỘ TRÌNH TOÀN BỘ ĐẠI HẠN (đỉnh cao & đáy của đời)
## ⚠️ TUỔI & GIAI ĐOẠN CẦN ĐỀ PHÒNG
## 💡 KẾT LUẬN & LỜI KHUYÊN`

// ─── Lean chart block (shared by both passes, ~1.5K tokens) ─────────────────

function buildChartBlock(d: any): string {
  const { form, info, danNap, palaces, daiHan, tieuHan, currentYear, currentDH, currentTH } = d
  const age = currentYear - form.year

  const palaceLines = palaces.map((p: any) => {
    const chinh = p.chinhTinh.map((s: any) => `${s.name}(${s.status || '-'})`).join(',') || 'Trống'
    const tot = p.saotot.map((s: any) => s.name).join(',') || '-'
    const xau = p.saoxau.map((s: any) => s.name).join(',') || '-'
    const hoa = [
      p.locNhap   && `Lộc←${p.locNhap}`,
      p.quyenNhap && `Quyền←${p.quyenNhap}`,
      p.khoaNhap  && `Khoa←${p.khoaNhap}`,
      p.kyNhap    && `Kỵ←${p.kyNhap}`,
    ].filter(Boolean).join(',')
    const flags = [p.isLife && 'MỆNH', p.isBody && 'THÂN', p.tuan && 'Tuần', p.triet && 'Triệt']
      .filter(Boolean).join('/')
    return `${p.name}(${p.canCung})${flags ? `[${flags}]` : ''}: ${chinh} |cát:${tot} |hung:${xau}${hoa ? ` |hóa:${hoa}` : ''}`
  }).join('\n')

  const dhLines = daiHan.map((dh: any, i: number) => {
    const cur = age >= dh.startAge && age <= dh.endAge
    const hoa = [dh.locNhap && 'Lộc', dh.quyenNhap && 'Quyền', dh.khoaNhap && 'Khoa', dh.kyNhap && 'Kỵ']
      .filter(Boolean).join(',')
    return `ĐH${i + 1}(${dh.startAge}-${dh.endAge}t,${dh.cungName})${cur ? '◄nay' : ''}: ${dh.chinhTinh.join(',') || 'Trống'}${dh.saoxau.length ? ` hung:${dh.saoxau.join(',')}` : ''}${hoa ? ` hóa:${hoa}` : ''}`
  }).join('\n')

  const thNow = tieuHan.find((th: any) => th.years.includes(currentYear))
  const thLine = thNow
    ? `Năm ${currentYear} (${thNow.yearChi}) → cung ${thNow.cungName}: ${thNow.chinhTinh.join(',') || 'Trống'}${thNow.saoxau?.length ? ` hung:${thNow.saoxau.join(',')}` : ''}`
    : ''

  return `[LÁ SỐ] ${form.name} | ${form.gender} | ${form.day}/${form.month}/${form.year}${form.isLunar ? ' ÂL' : ''} | ${info.nam} | giờ ${info.gio} | ${info.amDuong} | Cục ${info.cuc} | ${danNap}
Chủ Mệnh ${info.chuMenh}, Chủ Thân ${info.chuThan}, ${info.thanCu}. Tuổi ${age} (năm ${currentYear}).

[12 CUNG]
${palaceLines}

[ĐẠI HẠN]
${dhLines}

[VẬN NĂM]${currentDH ? ` ĐH hiện tại: ${currentDH.startAge}-${currentDH.endAge}t, cung ${currentDH.cungName}.` : ''}
${thLine}`
}
