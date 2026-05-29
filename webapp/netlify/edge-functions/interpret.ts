// Netlify Edge Function – multi-provider AI with automatic fallback
//
// Provider order:
//   1. Google Gemini 2.5 Flash  (GEMINI_API_KEY)  – generous free TPM, full prompt, rich output
//   2. Groq Llama 3.3 70B       (GROQ_API_KEY)    – 2-pass chunked to fit 12K TPM free tier
//
// If the primary provider errors for any reason (rate limit, invalid key, network)
// the stream transparently continues with the fallback provider.

const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_MAX_TOKENS = 12000

const GROQ_MODEL = 'llama-3.3-70b-versatile'
const GROQ_MAX_TOKENS_PER_PASS = 3600

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

  // @ts-ignore – Deno global
  const geminiRaw: string | undefined = Deno.env.get('GEMINI_API_KEY')
  // @ts-ignore
  const groqKey: string | undefined = Deno.env.get('GROQ_API_KEY')

  // Support multiple Gemini keys separated by commas: GEMINI_API_KEY=key1,key2,key3
  const geminiKeys: string[] = geminiRaw
    ? geminiRaw.split(',').map(k => k.trim()).filter(Boolean)
    : []

  if (geminiKeys.length === 0 && !groqKey) {
    return new Response(
      JSON.stringify({ error: 'Chưa cấu hình API key. Thêm GEMINI_API_KEY hoặc GROQ_API_KEY vào Netlify Environment Variables.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let chartData: any
  let provider: 'gemini' | 'groq' | undefined
  try {
    const body = await request.json()
    chartData = body.chartData
    provider = body.provider
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const encoder = new TextEncoder()
  const chart = buildChartBlock(chartData)

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (t: string) => controller.enqueue(encoder.encode(t))
      try {
        if (provider === 'groq') {
          // Groq-only mode
          if (!groqKey) { emit('[Lỗi: Chưa cấu hình GROQ_API_KEY trên Netlify.]'); return }
          await runGroqPass(groqKey, chart, PASS_1_SECTIONS, emit)
          emit('\n\n')
          await runGroqPass(groqKey, chart, PASS_2_SECTIONS, emit)
        } else {
          // Gemini mode — try each key in order, fallback to Groq if all fail
          if (geminiKeys.length === 0 && !groqKey) {
            emit('[Lỗi: Chưa cấu hình API key. Thêm GEMINI_API_KEY hoặc GROQ_API_KEY vào Netlify.]')
            return
          }
          let geminiOk = false
          let allQuota = true
          let anyInvalidKey = false
          for (let i = 0; i < geminiKeys.length; i++) {
            const result = await runGemini(geminiKeys[i], chartData, emit)
            if (result === 'ok') { geminiOk = true; break }
            if (result !== 'quota') allQuota = false
            if (result === 'invalid_key') anyInvalidKey = true
            // any failure → silently try next key
          }
          if (!geminiOk) {
            if (groqKey) {
              // Fallback to Groq — only show message if Gemini keys were configured
              if (geminiKeys.length > 0) {
                const reason = allQuota
                  ? 'Gemini đã hết quota hôm nay'
                  : anyInvalidKey
                    ? 'Một số Gemini key không hợp lệ'
                    : 'Gemini tạm thời không khả dụng'
                emit(`_⚡ ${reason}, chuyển sang Groq AI..._\n\n`)
              }
              await runGroqPass(groqKey, chart, PASS_1_SECTIONS, emit)
              emit('\n\n')
              await runGroqPass(groqKey, chart, PASS_2_SECTIONS, emit)
            } else {
              const hint = anyInvalidKey
                ? 'Kiểm tra lại Gemini API key trong Netlify Environment Variables.'
                : 'Tất cả Gemini key đã hết quota. Thêm GROQ_API_KEY để dự phòng hoặc thêm Gemini key mới.'
              emit(`[Lỗi: ${hint}]`)
            }
          }
        }
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

// ─── Gemini streaming ────────────────────────────────────────────────────────
// Returns 'ok' | 'quota' | 'invalid_key' | 'error'
// All failures are silent — caller decides what to show after all keys tried.

type GeminiResult = 'ok' | 'quota' | 'invalid_key' | 'error'

async function runGemini(apiKey: string, chartData: any, emit: (t: string) => void): Promise<GeminiResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?key=${apiKey}&alt=sse`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: buildFullPrompt(chartData) }] }],
        generationConfig: { maxOutputTokens: GEMINI_MAX_TOKENS, temperature: 0.75 },
      }),
    })
  } catch {
    return 'error'
  }

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => '')
    const msg = (() => { try { return JSON.parse(txt)?.error?.message ?? txt } catch { return txt } })()
    const low = msg.toLowerCase()
    if (res.status === 429 || low.includes('quota') || low.includes('rate limit') || low.includes('spending cap')) {
      return 'quota'
    }
    if (res.status === 400 && (low.includes('api key not valid') || low.includes('api_key_invalid'))) {
      return 'invalid_key'
    }
    // Any other error (5xx, network issue, etc.) — silent, try next key
    return 'error'
  }

  const decoder = new TextDecoder()
  const reader = res.body.getReader()
  let buf = ''
  let hadText = false
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
          const json = JSON.parse(data)
          const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
          if (text) { emit(text); hadText = true }
          const finish: string = json?.candidates?.[0]?.finishReason ?? ''
          if (finish && finish !== 'STOP' && finish !== 'MAX_TOKENS') return hadText ? 'ok' : 'error'
        } catch { /* skip malformed SSE */ }
      }
    }
  } finally {
    reader.releaseLock()
  }
  return hadText ? 'ok' : 'error'
}

// ─── Groq streaming pass (with one rate-limit retry) ─────────────────────────

async function runGroqPass(
  apiKey: string,
  chart: string,
  sections: string,
  emit: (t: string) => void,
  isRetry = false,
): Promise<void> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: `${chart}\n\nViết các mục sau, mỗi mục 6–9 câu, dẫn sao + trạng thái cụ thể:\n\n${sections}` },
      ],
      max_tokens: GROQ_MAX_TOKENS_PER_PASS,
      temperature: 0.75,
      stream: true,
    }),
  })

  if (!res.ok || !res.body) {
    const errText = await res.text()
    let errMsg = ''
    try { errMsg = JSON.parse(errText)?.error?.message ?? '' } catch { /* */ }
    const low = errMsg.toLowerCase()

    if ((res.status === 429 || low.includes('rate limit')) && !isRetry) {
      const wait = parseRetrySeconds(errMsg, res.headers.get('retry-after'))
      emit(`\n\n_⏳ Đang chờ giới hạn API (~${wait}s) rồi viết tiếp..._\n\n`)
      await sleep(wait * 1000)
      return runGroqPass(apiKey, chart, sections, emit, true)
    }
    if (low.includes('invalid api key') || low.includes('auth')) {
      emit('\n\n[Lỗi: GROQ_API_KEY không hợp lệ.]')
      return
    }
    emit(`\n\n[Lỗi Groq: ${errMsg || errText}]`)
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
        } catch { /* ignore */ }
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

// ─── System instruction (shared) ─────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Bạn là Tử Vi sư Việt Nam chuyên nghiệp. Nguyên tắc: (1) xét cung thủ + cung chiếu đối diện; (2) tam hợp/xung ảnh hưởng Mệnh; (3) Tứ Hóa tác động riêng từng cung; (4) tổ hợp sao tương tác nhau; (5) trạng thái Miếu/Vượng/Đắc > Bình > Hãm; (6) Tuần/Triệt làm yếu sao; (7) Đại Hạn kết hợp bản Mệnh. Nhận diện và gọi tên Cách Cục (Tử Phủ triều viên, Song Lộc, Không Kiếp giáp Mệnh, Nhật Nguyệt đồng chiếu, Mã Đầu Đới Tiễn...). Viết tiếng Việt sâu sắc, dẫn chứng tên sao + trạng thái cụ thể.`

// ─── Full prompt for Gemini (rich, 17 sections) ───────────────────────────────

function buildFullPrompt(d: any): string {
  const { form, info, danNap, palaces, daiHan, tieuHan, currentYear, currentDH, currentTH } = d
  const age = currentYear - form.year

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
    return `▸ ${p.name}(${p.canCung})${flags ? ` [${flags}]` : ''}: ${chinh} | cát:${tot} | hung:${xau}${hoa ? ` | ${hoa}` : ''} | ${p.trangSinh}`
  }).join('\n')

  const dhLines = daiHan.map((dh: any, i: number) => {
    const sy = form.year + dh.startAge - 1
    const cur = age >= dh.startAge && age <= dh.endAge
    const hoa = [
      dh.locNhap && `Lộc←${dh.locNhap}`, dh.quyenNhap && `Quyền←${dh.quyenNhap}`,
      dh.khoaNhap && `Khoa←${dh.khoaNhap}`, dh.kyNhap && `Kỵ←${dh.kyNhap}`,
    ].filter(Boolean).join(', ')
    return `ĐH${i + 1}[${dh.startAge}-${dh.endAge}t|${sy}-${sy + 9}]${cur ? '◄NẠY' : ''} ${dh.cungName}(${dh.chiName}) ${dh.trangSinh}: ${dh.chinhTinh.join(',') || 'Trống'} | hung:${dh.saoxau.join(',') || '-'}${hoa ? ` | ${hoa}` : ''}`
  }).join('\n')

  const thLines = tieuHan.map((th: any) => {
    const cur = th.years.includes(currentYear)
    const hoa = [
      th.locNhap && `Lộc←${th.locNhap}`, th.quyenNhap && `Quyền←${th.quyenNhap}`,
      th.khoaNhap && `Khoa←${th.khoaNhap}`, th.kyNhap && `Kỵ←${th.kyNhap}`,
    ].filter(Boolean).join(', ')
    return `${th.yearChi}${cur ? '◄NĂM NAY' : ''}: ${th.cungName} | ${th.chinhTinh.join(',') || 'Trống'} | hung:${th.saoxau?.join(',') || '-'}${hoa ? ` | ${hoa}` : ''}`
  }).join('\n')

  return `[LÁ SỐ] ${form.name} | ${form.gender} | ${form.day}/${form.month}/${form.year}${form.isLunar ? ' ÂL' : ''} | ${info.nam} | giờ ${info.gio} | ${info.amDuong} | Cục ${info.cuc} | ${danNap}
Chủ Mệnh ${info.chuMenh}, Chủ Thân ${info.chuThan}, ${info.thanCu}. Tuổi ${age} (${currentYear}).

[12 CUNG]
${palaceLines}

[ĐẠI HẠN]
${dhLines}

[TIỂU HẠN]
${thLines}

Viết bài phân tích hoàn chỉnh 17 mục dưới đây — mỗi mục tối thiểu 6–8 câu, dẫn chứng sao và trạng thái cụ thể, không nói chung chung:

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
## 🔗 TỨ HÓA & TƯƠNG TÁC ĐẶC BIỆT
## 📅 ĐẠI HẠN HIỆN TẠI ${currentDH ? `(${currentDH.startAge}–${currentDH.endAge} tuổi — ${currentDH.cungName})` : ''}
## 📆 VẬN NĂM ${currentYear}${currentTH ? ` — Tiểu Hạn ${currentTH.cungName}` : ''}
## 📊 LỘ TRÌNH TOÀN BỘ ĐẠI HẠN
## ⚠️ TUỔI & GIAI ĐOẠN CẦN ĐỀ PHÒNG
## 💡 KẾT LUẬN & LỜI KHUYÊN CHIẾN LƯỢC`
}

// ─── Compact chart block for Groq 2-pass (~1.5K tokens) ─────────────────────

function buildChartBlock(d: any): string {
  const { form, info, danNap, palaces, daiHan, tieuHan, currentYear, currentDH } = d
  const age = currentYear - form.year

  const palaceLines = palaces.map((p: any) => {
    const chinh = p.chinhTinh.map((s: any) => `${s.name}(${s.status || '-'})`).join(',') || 'Trống'
    const hoa = [p.locNhap && `Lộc←${p.locNhap}`, p.quyenNhap && `Quyền←${p.quyenNhap}`,
      p.khoaNhap && `Khoa←${p.khoaNhap}`, p.kyNhap && `Kỵ←${p.kyNhap}`].filter(Boolean).join(',')
    const flags = [p.isLife && 'MỆNH', p.isBody && 'THÂN', p.tuan && 'Tuần', p.triet && 'Triệt'].filter(Boolean).join('/')
    return `${p.name}(${p.canCung})${flags ? `[${flags}]` : ''}: ${chinh} |cát:${p.saotot.map((s: any) => s.name).join(',') || '-'} |hung:${p.saoxau.map((s: any) => s.name).join(',') || '-'}${hoa ? ` |${hoa}` : ''}`
  }).join('\n')

  const dhLines = daiHan.map((dh: any, i: number) => {
    const cur = age >= dh.startAge && age <= dh.endAge
    const hoa = [dh.locNhap && 'Lộc', dh.quyenNhap && 'Quyền', dh.khoaNhap && 'Khoa', dh.kyNhap && 'Kỵ'].filter(Boolean).join(',')
    return `ĐH${i + 1}(${dh.startAge}-${dh.endAge}t,${dh.cungName})${cur ? '◄nay' : ''}: ${dh.chinhTinh.join(',') || 'Trống'}${dh.saoxau.length ? ` hung:${dh.saoxau.join(',')}` : ''}${hoa ? ` hóa:${hoa}` : ''}`
  }).join('\n')

  const thNow = tieuHan.find((th: any) => th.years.includes(currentYear))
  const thLine = thNow
    ? `Năm ${currentYear}(${thNow.yearChi})→${thNow.cungName}: ${thNow.chinhTinh.join(',') || 'Trống'}${thNow.saoxau?.length ? ` hung:${thNow.saoxau.join(',')}` : ''}`
    : ''

  return `[LÁ SỐ] ${form.name}|${form.gender}|${form.day}/${form.month}/${form.year}${form.isLunar ? ' ÂL' : ''}|${info.nam}|giờ ${info.gio}|${info.amDuong}|Cục ${info.cuc}|${danNap}
Chủ Mệnh ${info.chuMenh}, Chủ Thân ${info.chuThan}, ${info.thanCu}. Tuổi ${age}(${currentYear}).
[12 CUNG]\n${palaceLines}
[ĐẠI HẠN]\n${dhLines}
[VẬN NĂM]${currentDH ? ` ĐH: ${currentDH.startAge}-${currentDH.endAge}t, ${currentDH.cungName}.` : ''} ${thLine}`
}

// ─── Groq section groups (2-pass split) ──────────────────────────────────────

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
## 📊 LỘ TRÌNH TOÀN BỘ ĐẠI HẠN
## ⚠️ TUỔI & GIAI ĐOẠN CẦN ĐỀ PHÒNG
## 💡 KẾT LUẬN & LỜI KHUYÊN`
