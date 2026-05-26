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
              systemInstruction: {
                parts: [{ text: SYSTEM_INSTRUCTION }],
              },
              contents,
              generationConfig: {
                maxOutputTokens: MAX_OUTPUT_TOKENS,
                temperature: 0.75,
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

// ─── System instruction (set AI role/expertise) ───────────────────────────

const SYSTEM_INSTRUCTION = `Bạn là Tử Vi sư chuyên nghiệp với kiến thức sâu rộng về Tử Vi Đẩu Số theo trường phái Việt Nam. Bạn phân tích lá số theo đúng nguyên tắc:

1. XEM CUNG THỦ VÀ CUNG CHIẾU: Luôn xét cả sao tại cung (thủ) và sao đối chiếu từ cung đối diện (chiếu). Cung Mệnh chịu ảnh hưởng cả từ cung Thiên Di đối diện.

2. TAM HỢP / TỨ CHÍNH: Phân tích mối liên hệ tam hợp (cách nhau 4 cung) và xung chiếu (đối diện). Sao tốt tam hợp chiếu vào cung Mệnh tăng cường vượng khí, sao xấu chiếu vào tạo sát khí.

3. TỨ HÓA XUYÊN CUNG: Khi Hóa Lộc/Quyền/Khoa/Kỵ rơi vào cung nào, phân tích tác động đặc biệt lên lĩnh vực đó. HóaKỵ vào Mệnh khác hoàn toàn HóaKỵ vào Tài Bạch.

4. TỔ HỢP SAO: Các sao trong cùng một cung tương tác với nhau. Tử Vi gặp Thiên Phủ khác Tử Vi gặp Thất Sát. Liêm Trinh đồng cung Thiên Tướng khác Liêm Trinh đồng cung Phá Quân.

5. TRẠNG THÁI SAO: Sao ở Miếu/Vượng/Đắc mạnh hơn Bình/Hàm/Hãm rất nhiều. Tử Vi Hãm không thể vượng bằng Vũ Khúc Miếu.

6. TUẦN/TRIỆT: Cung có Tuần hoặc Triệt là cung yếu, sao trong cung đó giảm sức mạnh đáng kể.

7. ĐẠI HẠN KẾT HỢP BẢN MỆNH: Khi phân tích Đại Hạn, phải xét cả sao Đại Hạn LẪN sao bản mệnh trong cùng cung đó. Đại Hạn qua cung tốt của bản mệnh thì vượng hơn cung xấu.

Viết bằng tiếng Việt thuần thục, rõ ràng, có chiều sâu chuyên môn nhưng dễ hiểu. Trích dẫn tên sao cụ thể khi phân tích để người đọc thấy cơ sở lập luận.`

// ─── Prompt builder ────────────────────────────────────────────────────────

function buildPrompt(d: any): string {
  const { form, info, danNap, palaces, daiHan, tieuHan, currentYear, currentDH, currentTH } = d
  const age = currentYear - form.year

  // Find key palaces for cross-reference hints
  const palaceMap: Record<string, any> = {}
  palaces.forEach((p: any) => { palaceMap[p.name] = p })

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
      const chinh = dh.chinhTinh.join(', ') || 'Trống'
      const hoa = [
        dh.locNhap   && `HóaLộc(từ ${dh.locNhap})`,
        dh.quyenNhap && `HóaQuyền(từ ${dh.quyenNhap})`,
        dh.khoaNhap  && `HóaKhoa(từ ${dh.khoaNhap})`,
        dh.kyNhap    && `HóaKỵ(từ ${dh.kyNhap})`,
      ].filter(Boolean).join(', ')
      return `• ĐH${i + 1} [Tuổi ${dh.startAge}–${dh.endAge} | Năm ${sy}–${ey}]${cur ? ' ◄ ĐANG CHẠY' : ''}
    Cung: ${dh.cungName} (${dh.chiName}) | Trạng sinh: ${dh.trangSinh}
    Chính tinh ĐH: ${chinh}
    Cát: ${dh.saotot.join(', ') || '-'}  |  Hung: ${dh.saoxau.join(', ') || '-'}
    Tứ Hóa ĐH: ${hoa || 'Không'}`
    })
    .join('\n')

  const thLines = tieuHan
    .map((th: any) => {
      const cur = th.years.includes(currentYear)
      const hoa = [
        th.locNhap && `HóaLộc(${th.locNhap})`,
        th.kyNhap  && `HóaKỵ(${th.kyNhap})`,
      ].filter(Boolean).join(', ')
      return `• Năm ${th.yearChi}${cur ? ' ◄ NĂM NAY' : ''}: Cung ${th.cungName}(${th.chiName}) | CT=[${th.chinhTinh.join(', ') || 'Trống'}]${hoa ? ' | ' + hoa : ''}`
    })
    .join('\n')

  return `Phân tích chuyên sâu lá số Tử Vi Đẩu Số dưới đây. Dựa trên từng sao thực tế trong lá số để lập luận — KHÔNG nói chung chung, PHẢI trích dẫn tên sao và trạng thái cụ thể.

══════════════════════════════════════════
 THÔNG TIN LÁ SỐ
══════════════════════════════════════════
Họ tên: ${form.name}  |  ${form.gender}  |  Sinh: ${form.day}/${form.month}/${form.year} ${form.isLunar ? '(Âm lịch)' : '(Dương lịch)'}
Năm sinh: ${info.nam}  |  Giờ: ${info.gio}  |  ${info.amDuong}  |  Cục: ${info.cuc}
Đại Nạp: ${danNap}
Chủ Mệnh: ${info.chuMenh}  |  Chủ Thân: ${info.chuThan}  |  ${info.thanCu}
Tuổi hiện tại: ${age}  (năm ${currentYear})

══════════════════════════════════════════
 12 CUNG
══════════════════════════════════════════
${palaceLines}

══════════════════════════════════════════
 ĐẠI HẠN (mỗi giai đoạn 10 năm)
══════════════════════════════════════════
${dhLines}

══════════════════════════════════════════
 TIỂU HẠN (chu kỳ 12 năm)
══════════════════════════════════════════
${thLines}

══════════════════════════════════════════
 YÊU CẦU PHÂN TÍCH
══════════════════════════════════════════
Viết bài phân tích chuyên sâu theo cấu trúc dưới đây. Mỗi mục TỐI THIỂU 5–8 câu phân tích CỤ THỂ, có dẫn chứng từ sao trong lá số. Áp dụng đúng các nguyên tắc cung thủ–cung chiếu, tam hợp, Tứ Hóa xuyên cung, tổ hợp sao.

## 🌟 TỔNG QUAN LÁ SỐ
Đánh giá tổng thể: Cục mạnh hay yếu? Chính tinh cung Mệnh ở trạng thái nào? Cung Mệnh có được cát tinh hội tụ hay bị hung tinh xâm phạm? Lá số thiên về phú quý, trí tuệ hay sự nghiệp? Điểm mạnh và thách thức lớn nhất của lá số này là gì?

## 👤 TÍNH CÁCH & BẢN CHẤT CON NGƯỜI
Phân tích dựa trên chính tinh cung Mệnh (trạng thái, bản tính), ảnh hưởng Chủ Mệnh, cùng các sao phụ trong cung Mệnh. Xét thêm cung Thiên Di (đối diện) chiếu vào Mệnh. Tính cách nổi trội là gì? Điểm mạnh cần phát huy? Điểm yếu cần khắc phục? Cách ứng xử trong công việc và các mối quan hệ?

## 💼 SỰ NGHIỆP & CÔNG DANH
Phân tích cung Quan Lộc: chính tinh, cát/hung tinh, Tứ Hóa nhập cung. Xét tam hợp chiếu vào Quan Lộc. Nghề nghiệp phù hợp nhất (cụ thể ngành nghề, không nói chung). Khả năng thăng tiến, tự kinh doanh hay đi làm thuê phù hợp hơn? Thời điểm sự nghiệp thuận lợi nhất trong đời?

## 💰 TÀI CHÍNH & TÀI LỘC
Phân tích cung Tài Bạch: có Lộc Tồn, Thiên Lộc hay bị Kình Đà xâm phạm không? Tứ Hóa nào nhập Tài Bạch? HóaLộc hay HóaKỵ trong Tài Bạch tác động ra sao? Khả năng tích lũy, đầu tư, kinh doanh? Rủi ro tài chính cần đề phòng? Giai đoạn nào trong cuộc đời tài vượng nhất?

## 💑 TÌNH DUYÊN & HÔN NHÂN
Phân tích cung Phu Thê (hoặc Thê Thiếp): chính tinh tại cung nói lên đặc điểm người bạn đời, sao cát hung ảnh hưởng hôn nhân thế nào? HóaKỵ hay HóaLộc nhập Phu Thê có ý nghĩa gì? Hôn nhân thuận lợi hay trắc trở? Tuổi nào nên kết hôn? Loại người bạn đời phù hợp và không phù hợp?

## 👨‍👩‍👧 GIA ĐÌNH & NGƯỜI THÂN
**Cha mẹ (cung Phụ Mẫu):** Quan hệ với cha mẹ, sự hỗ trợ từ gia đình gốc như thế nào?
**Anh chị em (cung Huynh Đệ):** Mối quan hệ anh chị em, có tương trợ nhau không?
**Con cái (cung Tử Tức):** Số con, chất lượng con cái, mối duyên với con?

## 🏥 SỨC KHỎE & THÂN THỂ
Phân tích cung Tật Ách: chính tinh và hung tinh tại đây báo hiệu bệnh tật gì? Bộ phận cơ thể nào dễ có vấn đề? (Liêm Trinh → tim/huyết áp, Thái Âm → thận/nội tiết, v.v.) Tuổi nào cần chú ý sức khỏe nhất? Lời khuyên phòng bệnh cụ thể?

## 🔗 TỨ HÓA & CÁC TƯƠNG TÁC QUAN TRỌNG
Liệt kê và phân tích TẤT CẢ Tứ Hóa (Lộc/Quyền/Khoa/Kỵ) trong lá số: rơi vào cung nào, từ sao nào hóa ra, tác động cụ thể lên lĩnh vực đó. Có trường hợp HóaKỵ xung về Mệnh/Tài/Quan không? Tổ hợp sao đặc biệt nào đáng chú ý (cát hội hay hung hội)?

## 📅 ĐẠI HẠN HIỆN TẠI ${currentDH ? `(Tuổi ${currentDH.startAge}–${currentDH.endAge} | Năm ${currentDH.startYear}–${currentDH.endYear}) — Cung ${currentDH.cungName}` : ''}
Đây là giai đoạn then chốt: cung Đại Hạn có sao gì? Trạng sinh của Đại Hạn? Đại Hạn hội hợp hay xung khắc với bản Mệnh? Tứ Hóa của Đại Hạn tác động thế nào lên các cung quan trọng (Mệnh, Tài, Quan, Phu Thê)? Cơ hội lớn nhất và rủi ro lớn nhất giai đoạn này? Nên tập trung vào lĩnh vực nào? Điều gì cần tuyệt đối tránh?

## 🔮 VẬN NĂM ${currentYear}${currentTH ? ` — Tiểu Hạn Cung ${currentTH.cungName}` : ''}
Tiểu Hạn năm nay đi vào cung nào, sao gì? Kết hợp Đại Hạn + Tiểu Hạn + bản Mệnh tạo ra vận khí năm nay như thế nào? Quý nào trong năm tốt nhất? Tháng âm lịch nào cần cẩn thận? Nên hành động hay nên giữ thủ? Lĩnh vực nào nổi bật (tình cảm, sự nghiệp, hay tài chính)?

## 📊 TOÀN BỘ LỘ TRÌNH ĐẠI HẠN
Nhận xét từng Đại Hạn trong cuộc đời (không bỏ sót Đại Hạn nào), đặc biệt làm rõ: Đại Hạn nào là đỉnh cao? Đại Hạn nào là đáy? Giai đoạn nào cần đầu tư mạnh? Giai đoạn nào cần thận trọng? Sau ${currentYear} còn những "thời vàng" nào?

## 💡 KẾT LUẬN & LỜI KHUYÊN CHIẾN LƯỢC
Tóm tắt bức tranh tổng thể cuộc đời theo lá số. 3–5 điểm mạnh quan trọng nhất cần phát huy. 3–5 điểm yếu và cách hóa giải theo Tử Vi (có thể đề xuất màu sắc, hướng, nghề nghiệp phù hợp). Thời điểm vàng trong cuộc đời cần nắm bắt. Lời khuyên thiết thực và cụ thể nhất dành riêng cho người này.`
}
