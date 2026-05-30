// Netlify Edge Function – DeepSeek V3 AI analysis
//
// API key priority: request body `deepseekKey` (user-entered in app) → DEEPSEEK_API_KEY env var

const DEEPSEEK_MODEL = 'deepseek-chat'
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

// ─── DeepSeek streaming ───────────────────────────────────────────────────────

async function runDeepSeek(apiKey: string, chartData: any, emit: (t: string) => void): Promise<void> {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: buildFullPrompt(chartData) },
      ],
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
        } catch { /* ignore malformed SSE */ }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ─── System instruction ───────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Bạn là Tử Vi sư Việt Nam chuyên nghiệp. Nguyên tắc: (1) xét cung thủ + cung chiếu đối diện; (2) tam hợp/xung ảnh hưởng Mệnh; (3) Tứ Hóa tác động riêng từng cung; (4) tổ hợp sao tương tác nhau; (5) trạng thái Miếu/Vượng/Đắc > Bình > Hãm; (6) Tuần/Triệt làm yếu sao; (7) Đại Hạn kết hợp bản Mệnh. Nhận diện và gọi tên Cách Cục (Tử Phủ triều viên, Song Lộc, Không Kiếp giáp Mệnh, Nhật Nguyệt đồng chiếu, Mã Đầu Đới Tiễn...). Viết tiếng Việt sâu sắc, dẫn chứng tên sao + trạng thái cụ thể.`

// ─── Full prompt (17 sections) ────────────────────────────────────────────────

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
