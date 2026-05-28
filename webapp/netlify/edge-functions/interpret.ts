// Netlify Edge Function – Deno runtime, streams Groq interpretation
// Uses Groq API (OpenAI-compatible) with Llama 3.3 70B

const MODEL = 'llama-3.3-70b-versatile'
const MAX_TOKENS = 7500

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

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
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
              { role: 'user', content: buildPrompt(chartData) },
            ],
            max_tokens: MAX_TOKENS,
            temperature: 0.75,
            stream: true,
          }),
        })

        if (!res.ok || !res.body) {
          const errText = await res.text()
          let userMsg = `\n\n[Lỗi API: ${errText}]`
          try {
            const errJson = JSON.parse(errText)
            const errMsg: string = errJson?.error?.message ?? ''
            if (errMsg.toLowerCase().includes('invalid api key') || errMsg.toLowerCase().includes('auth')) {
              userMsg = '\n\n[Lỗi: GROQ_API_KEY không hợp lệ. Vui lòng kiểm tra lại cấu hình trên Netlify.]'
            } else if (errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('quota')) {
              userMsg = '\n\n[Lỗi: Đã vượt quá giới hạn API. Vui lòng thử lại sau vài phút.]'
            }
          } catch { /* keep original */ }
          controller.enqueue(encoder.encode(userMsg))
          controller.close()
          return
        }

        let buf = ''
        const reader = res.body.getReader()

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
                const text: string = json?.choices?.[0]?.delta?.content ?? ''
                if (text) controller.enqueue(encoder.encode(text))
              } catch { /* ignore malformed SSE lines */ }
            }
          }
        } finally {
          reader.releaseLock()
        }
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

// ─── System instruction ───────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Bạn là Tử Vi sư Việt Nam chuyên nghiệp. Nguyên tắc phân tích: (1) xét cung thủ + cung chiếu đối diện; (2) tam hợp/xung ảnh hưởng Mệnh; (3) Tứ Hóa tác động riêng từng cung; (4) tổ hợp sao tương tác nhau; (5) trạng thái Miếu/Bình/Hãm; (6) Tuần/Triệt làm yếu sao; (7) Đại Hạn kết hợp bản Mệnh. Nhận diện và gọi tên Cách Cục (Tử Phủ triều viên, Song Lộc, Không Kiếp giáp Mệnh, Nhật Nguyệt đồng chiếu...). Viết tiếng Việt, dẫn chứng sao và trạng thái cụ thể.`

// ─── Prompt builder ────────────────────────────────────────────────────────

function buildPrompt(d: any): string {
  const { form, info, danNap, palaces, daiHan, tieuHan, currentYear, currentDH, currentTH } = d
  const age = currentYear - form.year

  const palaceLines = palaces
    .map((p: any) => {
      const chinh = p.chinhTinh.map((s: any) => `${s.name}(${s.status || '-'})`).join(', ') || 'Trống'
      const tot = p.saotot.map((s: any) => s.name).join(', ') || '-'
      const xau = p.saoxau.map((s: any) => s.name).join(', ') || '-'
      const hoa = [
        p.locNhap   && `HóaLộc(từ ${p.locNhap})`,
        p.quyenNhap && `HóaQuyền(từ ${p.quyenNhap})`,
        p.khoaNhap  && `HóaKhoa(từ ${p.khoaNhap})`,
        p.kyNhap    && `HóaKỵ(từ ${p.kyNhap})`,
      ].filter(Boolean).join(', ')
      const flags = [
        p.isLife  && '★MỆNH',
        p.isBody  && '◆THÂN',
        p.tuan    && '⊘Tuần',
        p.triet   && '⊗Triệt',
      ].filter(Boolean).join(' ')
      return `▸ ${p.name} [${p.canCung} ${p.tieuHan}]${flags ? '  ' + flags : ''}
    Chính tinh: ${chinh}
    Cát tinh: ${tot}  |  Hung tinh: ${xau}
    Tứ Hóa nhập: ${hoa || 'Không'}  |  Trạng sinh: ${p.trangSinh}`
    })
    .join('\n')

  const dhLines = daiHan
    .map((dh: any, i: number) => {
      const sy = form.year + dh.startAge - 1
      const ey = sy + 9
      const cur = age >= dh.startAge && age <= dh.endAge
      const hoa = [
        dh.locNhap   && `HóaLộc(từ ${dh.locNhap})`,
        dh.quyenNhap && `HóaQuyền(từ ${dh.quyenNhap})`,
        dh.khoaNhap  && `HóaKhoa(từ ${dh.khoaNhap})`,
        dh.kyNhap    && `HóaKỵ(từ ${dh.kyNhap})`,
      ].filter(Boolean).join(', ')
      return `• ĐH${i + 1} [Tuổi ${dh.startAge}–${dh.endAge} | ${sy}–${ey}]${cur ? ' ◄ ĐANG CHẠY' : ''}
    Cung: ${dh.cungName}(${dh.chiName}) | Trạng sinh: ${dh.trangSinh}
    Chính tinh: ${dh.chinhTinh.join(', ') || 'Trống'}
    Cát: ${dh.saotot.join(', ') || '-'}  |  Hung: ${dh.saoxau.join(', ') || '-'}
    Tứ Hóa: ${hoa || 'Không'}`
    })
    .join('\n')

  const thLines = tieuHan
    .map((th: any) => {
      const cur = th.years.includes(currentYear)
      const hoa = [
        th.locNhap   && `HóaLộc(${th.locNhap})`,
        th.quyenNhap && `HóaQuyền(${th.quyenNhap})`,
        th.khoaNhap  && `HóaKhoa(${th.khoaNhap})`,
        th.kyNhap    && `HóaKỵ(${th.kyNhap})`,
      ].filter(Boolean).join(', ')
      return `• Năm ${th.yearChi}${cur ? ' ◄ NĂM NAY' : ''}: Cung ${th.cungName}(${th.chiName})
    CT=[${th.chinhTinh.join(', ') || 'Trống'}] | Cát=[${th.saotot?.join(', ') || '-'}] | Hung=[${th.saoxau?.join(', ') || '-'}]
    Tứ Hóa: ${hoa || 'Không'}`
    })
    .join('\n')

  return `Phân tích lá số Tử Vi dưới đây. Dẫn chứng tên sao + trạng thái cụ thể, không nói chung chung.

[LÁ SỐ]
${form.name} | ${form.gender} | ${form.day}/${form.month}/${form.year}${form.isLunar ? ' ÂL' : ''} | Năm ${info.nam} | Giờ ${info.gio} | ${info.amDuong} | Cục ${info.cuc} | Đại Nạp: ${danNap}
Chủ Mệnh: ${info.chuMenh} | Chủ Thân: ${info.chuThan} | ${info.thanCu} | Tuổi ${age} (${currentYear})

[12 CUNG]
${palaceLines}

[ĐẠI HẠN]
${dhLines}

[TIỂU HẠN]
${thLines}

Viết đầy đủ 17 mục sau, mỗi mục ≥5 câu, dẫn sao cụ thể:

## 🌟 TỔNG QUAN LÁ SỐ
## ⭐ CÁCH CỤC & HÌNH THÁI
## 👤 TÍNH CÁCH & BẢN CHẤT
## 💼 SỰ NGHIỆP (Quan Lộc)
## 💰 TÀI CHÍNH (Tài Bạch)
## 💑 TÌNH DUYÊN (Phu Thê)
## 👨‍👩‍👧 GIA ĐÌNH (Phụ Mẫu / Huynh Đệ / Tử Tức)
## 🏠 NHÀ CỬA (Điền Trạch)
## 🍀 PHÚC ĐỨC & TÂM LINH
## ✈️ XÃ HỘI & DI CHUYỂN (Thiên Di / Nô Bộc)
## 🏥 SỨC KHỎE (Tật Ách)
## 🔗 TỨ HÓA & TƯƠNG TÁC ĐẶC BIỆT
## 📅 ĐẠI HẠN HIỆN TẠI ${currentDH ? `(${currentDH.startAge}–${currentDH.endAge} tuổi — ${currentDH.cungName})` : ''}
## 📆 VẬN NĂM ${currentYear}${currentTH ? ` (Tiểu Hạn ${currentTH.cungName})` : ''}
## 📊 LỘ TRÌNH TOÀN BỘ ĐẠI HẠN
## ⚠️ TUỔI & GIAI ĐOẠN CẦN ĐỀ PHÒNG
## 💡 KẾT LUẬN & LỜI KHUYÊN`
}
