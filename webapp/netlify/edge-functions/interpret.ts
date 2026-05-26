// Netlify Edge Function – Deno runtime, streams Gemini interpretation
// Uses Google Gemini 3.5 Flash

const MODEL = 'gemini-3.5-flash'
const MAX_OUTPUT_TOKENS = 8192
const MAX_CONTINUATIONS = 3

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
  const apiKey: string | undefined = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY chưa được cấu hình trên Netlify.' }),
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

  // Gemini multi-turn conversation format
  const contents: { role: string; parts: { text: string }[] }[] = [
    { role: 'user', parts: [{ text: buildPrompt(chartData) }] },
  ]

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?key=${apiKey}&alt=sse`

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: {
                maxOutputTokens: MAX_OUTPUT_TOKENS,
                temperature: 0.7,
              },
            }),
          })

          if (!res.ok || !res.body) {
            const errText = await res.text()
            let userMsg = `\n\n[Lỗi API: ${errText}]`
            try {
              const errJson = JSON.parse(errText)
              const errMsg: string = errJson?.error?.message ?? ''
              if (errMsg.toLowerCase().includes('api key not valid') || errMsg.toLowerCase().includes('api_key_invalid')) {
                userMsg = '\n\n[Lỗi: GEMINI_API_KEY không hợp lệ. Vui lòng kiểm tra lại cấu hình trên Netlify.]'
              } else if (errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
                userMsg = '\n\n[Lỗi: Đã vượt quá giới hạn API. Vui lòng thử lại sau vài phút.]'
              }
            } catch { /* keep original */ }
            controller.enqueue(encoder.encode(userMsg))
            break
          }

          // Stream SSE response, collect text and finishReason
          let buf = ''
          let turnText = ''
          let finishReason = ''
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
                  const candidate = json?.candidates?.[0]
                  const text: string = candidate?.content?.parts?.[0]?.text ?? ''
                  if (text) {
                    turnText += text
                    controller.enqueue(encoder.encode(text))
                  }
                  if (candidate?.finishReason) {
                    finishReason = candidate.finishReason
                  }
                } catch { /* ignore malformed SSE lines */ }
              }
            }
          } finally {
            reader.releaseLock()
          }

          // STOP = finished naturally
          if (finishReason !== 'MAX_TOKENS') break

          // Model was cut off — continue conversation
          if (turn < MAX_CONTINUATIONS) {
            contents.push({ role: 'model', parts: [{ text: turnText }] })
            contents.push({
              role: 'user',
              parts: [{ text: 'Hãy tiếp tục viết phần còn lại của bài phân tích từ chỗ vừa dừng lại. Không lặp lại nội dung đã viết.' }],
            })
          }
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

// ─── Prompt builder ────────────────────────────────────────────────────────

function buildPrompt(d: any): string {
  const { form, info, danNap, palaces, daiHan, tieuHan, currentYear, currentDH, currentTH } = d
  const age = currentYear - form.year

  const palaceLines = palaces
    .map((p: any) => {
      const chinh = p.chinhTinh.map((s: any) => `${s.name}(${s.status || '-'})`).join(', ') || 'Không có'
      const tot = p.saotot.map((s: any) => s.name).join(', ')
      const xau = p.saoxau.map((s: any) => s.name).join(', ')
      const hoa = [
        p.locNhap   && `HóaLộc(${p.locNhap})`,
        p.quyenNhap && `HóaQuyền(${p.quyenNhap})`,
        p.khoaNhap  && `HóaKhoa(${p.khoaNhap})`,
        p.kyNhap    && `HóaKỵ(${p.kyNhap})`,
      ].filter(Boolean).join(' ')
      const flags = [p.isLife && 'MỆNH', p.isBody && 'THÂN', p.tuan && 'Tuần', p.triet && 'Triệt'].filter(Boolean).join(',')
      return `• ${p.name}(${p.canCung} ${p.tieuHan})${flags ? ` [${flags}]` : ''}: CT=${chinh}${tot ? ` | Cát=${tot}` : ''}${xau ? ` | Hung=${xau}` : ''}${hoa ? ` | ${hoa}` : ''} | TS=${p.trangSinh}`
    })
    .join('\n')

  const dhLines = daiHan
    .map((dh: any, i: number) => {
      const sy = form.year + dh.startAge - 1
      const ey = sy + 9
      const cur = age >= dh.startAge && age <= dh.endAge
      return `• ĐH${i + 1} Tuổi${dh.startAge}-${dh.endAge}(${sy}-${ey})${cur ? '←HIỆN TẠI' : ''}: ${dh.cungName}(${dh.chiName}) CT=[${dh.chinhTinh.join(',')}] Cát=[${dh.saotot.join(',')}] Hung=[${dh.saoxau.join(',')}] TS=${dh.trangSinh}${dh.locNhap ? ` Lộc=${dh.locNhap}` : ''}${dh.kyNhap ? ` Kỵ=${dh.kyNhap}` : ''}`
    })
    .join('\n')

  const thLines = tieuHan
    .map((th: any) => {
      const cur = th.years.includes(currentYear)
      return `• Năm${th.yearChi}${cur ? '←NĂM NAY' : ''}: ${th.cungName}(${th.chiName}) CT=[${th.chinhTinh.join(',')}]${th.locNhap ? ` Lộc=${th.locNhap}` : ''}${th.kyNhap ? ` Kỵ=${th.kyNhap}` : ''}`
    })
    .join('\n')

  return `Bạn là chuyên gia Tử Vi Đẩu Số uyên thâm. Hãy phân tích toàn diện lá số sau và viết bài giải thích đầy đủ, SÂU SẮC, DỄ HIỂU bằng tiếng Việt cho người không chuyên. Mỗi mục phải phân tích cụ thể dựa trên các sao thực tế trong lá số, KHÔNG nói chung chung.

=== LÁ SỐ ===
Họ tên: ${form.name} | ${form.gender} | Sinh: ${form.day}/${form.month}/${form.year} ${form.isLunar ? '(Âm lịch)' : '(Dương lịch)'}
Năm Can Chi: ${info.nam} | Giờ: ${info.gio} | ${info.amDuong} | Cục: ${info.cuc}
Đại Nạp: ${danNap} | Chủ Mệnh: ${info.chuMenh} | Chủ Thân: ${info.chuThan} | ${info.thanCu}
Tuổi hiện tại: ${age} (năm ${currentYear})

=== 12 CUNG ===
${palaceLines}

=== ĐẠI HẠN ===
${dhLines}

=== TIỂU HẠN (chu kỳ 12 năm) ===
${thLines}

---
Viết bài phân tích theo đúng cấu trúc này, KHÔNG bỏ sót mục nào, mỗi mục tối thiểu 3-5 câu cụ thể:

## 🌟 TỔNG QUAN LÁ SỐ
(Nhận xét tổng thể: lá số mạnh hay yếu, điểm nổi bật nhất, vận mệnh tổng quát)

## 👤 TÍNH CÁCH & CON NGƯỜI
(Dựa trên sao cung Mệnh: tính cách, điểm mạnh, điểm yếu, cách ứng xử)

## 💼 SỰ NGHIỆP & CÔNG DANH
(Từ cung Quan Lộc: nghề nghiệp phù hợp, cơ hội thăng tiến, cách phát triển)

## 💰 TÀI CHÍNH & TÀI LỘC
(Từ cung Tài Bạch: khả năng kiếm tiền, cách giữ tiền, thời điểm tài vượng)

## 💑 TÌNH DUYÊN & HÔN NHÂN
(Từ cung Phu Thê: loại người bạn đời phù hợp, thuận lợi/khó khăn, lời khuyên)

## 👨‍👩‍👧 GIA ĐÌNH
(Cung Phụ Mẫu, Tử Tức, Huynh Đệ: quan hệ gia đình, con cái, anh chị em)

## 🏥 SỨC KHỎE
(Cung Tật Ách: các bệnh cần đề phòng, cách giữ gìn sức khỏe)

## 📅 ĐẠI HẠN HIỆN TẠI (Tuổi ${currentDH ? `${currentDH.startAge}–${currentDH.endAge}, ${currentDH.startYear}–${currentDH.endYear}` : age}, Cung ${currentDH?.cungName ?? ''})
(Vận khí giai đoạn này: cơ hội, thách thức, lĩnh vực phát triển, điều cần tránh)

## 🔮 VẬN NĂM ${currentYear} (Tiểu Hạn${currentTH ? ` – Cung ${currentTH.cungName}` : ''})
(Năm nay vận khí ra sao, tháng nào tốt, việc gì nên làm/tránh)

## 📊 XU HƯỚNG CÁC ĐẠI HẠN TIẾP THEO
(Nhận xét ngắn gọn từng giai đoạn sắp tới: nên chuẩn bị gì)

## 💡 KẾT LUẬN & LỜI KHUYÊN
(Tóm tắt điểm mạnh cần phát huy, điểm yếu cần khắc phục, thời điểm vàng trong cuộc đời, lời khuyên thiết thực)`
}
