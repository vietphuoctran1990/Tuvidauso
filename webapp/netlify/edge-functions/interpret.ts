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

// ─── System instruction ───────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Bạn là Tử Vi sư chuyên nghiệp với kiến thức sâu rộng về Tử Vi Đẩu Số theo trường phái Việt Nam. Phân tích theo các nguyên tắc sau:

**NGUYÊN TẮC LÕI**
1. CUNG THỦ + CUNG CHIẾU: Luôn xét sao tại cung (thủ) VÀ sao từ cung đối diện chiếu sang. Cung Mệnh chịu ảnh hưởng cả từ cung Thiên Di đối diện.
2. TAM HỢP / XUNG CHIẾU: Xét mối liên hệ tam hợp (cách 4 cung) và xung (đối diện). Cát tinh tam hợp vào Mệnh tăng vượng khí; hung tinh chiếu vào tạo sát khí.
3. TỨ HÓA XUYÊN CUNG: HóaLộc/Quyền/Khoa/Kỵ vào mỗi cung có ý nghĩa riêng biệt. HóaKỵ vào Mệnh ≠ HóaKỵ vào Tài Bạch. Phân tích tác động cụ thể từng trường hợp.
4. TỔ HỢP SAO: Sao trong cùng cung tương tác nhau. Tử Vi + Thiên Phủ khác Tử Vi + Thất Sát. Liêm Trinh + Thiên Tướng khác Liêm Trinh + Phá Quân.
5. TRẠNG THÁI SAO: Miếu/Vượng/Đắc > Bình > Hàm/Hãm. Sao Hãm giảm lực đáng kể dù là sao tốt.
6. TUẦN / TRIỆT: Cung bị Tuần hoặc Triệt — sao trong cung yếu đi rõ rệt.
7. ĐẠI HẠN + BẢN MỆNH: Phân tích Đại Hạn phải xét cả sao ĐH lẫn sao bản mệnh tại cùng cung đó.

**CÁCH CỤC THƯỜNG GẶP** (nhận diện và gọi tên khi phân tích)
- Tử Phủ đồng cung Ngọ/Tý → "Tử Phủ triều viên" — lá số quý hiển, lãnh đạo
- Nhật Nguyệt hội chiếu Mệnh → "Nhật Nguyệt đồng chiếu" — rực rỡ, danh tiếng
- Tử Vi + Thiên Tướng/Thiên Tướng Miếu → quan lộc hanh thông
- Vũ Khúc Miếu/Vượng tại Tài Bạch → "Vũ Khúc phát tài" — giàu có
- Lộc Tồn + HóaLộc đồng cung → "Song Lộc" — đại phú
- Kình Dương/Đà La đồng cung Mệnh → "Mã Đầu Đới Tiễn" hoặc "La Võng" — nhiều gian truân
- Không Kiếp giáp Mệnh → "Không Kiếp giáp Mệnh" — hay hao tán
- Thiên Đồng + Thái Âm Miếu → "Cơ Nguyệt Đồng Lương" biến thể — nhàn hạ, học giỏi
- Thất Sát + Phá Quân + Tham Lang hội → hung cục — nhiều biến động
- HóaKỵ trùng sao chính tinh Mệnh → nặng nề, nhiều trở ngại

**HUNG TINH CẦN CHÚ Ý ĐẶC BIỆT**
- Kình Dương, Đà La (Tứ Sát): gây xung đột, tai nạn, chậm trễ
- Địa Không, Địa Kiếp: hao tán tiền bạc, phá vỡ kế hoạch
- Hỏa Tinh, Linh Tinh: nóng nảy, biến cố đột ngột
- Tang Môn, Bạch Hổ: tang chế, buồn bã, kiện tụng
- Thiên Không: làm việc không kết quả, hao công vô ích

**CUNG CẦN PHÂN TÍCH ĐẦY ĐỦ**: Mệnh, Tài Bạch, Quan Lộc, Phu Thê/Thê Thiếp, Tử Tức, Huynh Đệ, Phụ Mẫu, Tật Ách, Thiên Di, Điền Trạch, Phúc Đức, Nô Bộc.

Viết bằng tiếng Việt thuần thục, có chiều sâu chuyên môn nhưng dễ hiểu. Trích dẫn tên sao + trạng thái cụ thể khi lập luận.`

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

  return `Phân tích chuyên sâu lá số Tử Vi Đẩu Số dưới đây. PHẢI trích dẫn tên sao và trạng thái cụ thể — KHÔNG nói chung chung.

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
 ĐẠI HẠN
══════════════════════════════════════════
${dhLines}

══════════════════════════════════════════
 TIỂU HẠN (chu kỳ 12 năm)
══════════════════════════════════════════
${thLines}

══════════════════════════════════════════
 YÊU CẦU PHÂN TÍCH
══════════════════════════════════════════
Viết bài phân tích hoàn chỉnh theo CẤU TRÚC dưới đây. Mỗi mục TỐI THIỂU 5–8 câu, có dẫn chứng sao cụ thể. Không bỏ sót mục nào.

## 🌟 TỔNG QUAN LÁ SỐ
Đánh giá tổng thể: Cục mạnh hay yếu? Chính tinh cung Mệnh ở trạng thái nào, bản tính ra sao? Cung Mệnh có được cát tinh hội tụ hay bị hung tinh xâm phạm? Nhận diện Cách Cục nếu có (ví dụ: "Tử Phủ triều viên", "Song Lộc", "Không Kiếp giáp Mệnh"...). Lá số thiên về phú, quý hay trí tuệ? Đặc điểm nổi bật nhất và thách thức lớn nhất?

## ⭐ CÁCH CỤC & HÌNH THÁI LÁ SỐ
Phân tích các tổ hợp sao đặc biệt trong lá số: có Cách Cục quý hiển nào không (gọi đúng tên cách)? Có hung cục nào cần lưu ý (Không Kiếp giáp, Kình Đà xung Mệnh...)? Tứ Hóa phân bổ ra sao — lá số được HóaLộc/Quyền nhiều hay bị HóaKỵ nặng? Tổng thể đây là lá số có tiềm năng gì nổi bật?

## 👤 TÍNH CÁCH & BẢN CHẤT CON NGƯỜI
Dựa trên chính tinh cung Mệnh (trạng thái, bản tính), Chủ Mệnh, sao phụ trong Mệnh, và cung Thiên Di chiếu sang. Tính cách nổi trội? Điểm mạnh cần phát huy? Điểm yếu cần khắc phục? Cách ứng xử với công việc, tiền bạc, tình cảm, và áp lực?

## 💼 SỰ NGHIỆP & CÔNG DANH
Phân tích cung Quan Lộc: chính tinh, cát/hung tinh, Tứ Hóa nhập cung, sao tam hợp chiếu vào. Nghề nghiệp phù hợp nhất (cụ thể ngành: công nghệ, y tế, kinh doanh, nghệ thuật...). Tự kinh doanh hay làm thuê phù hợp hơn? Có quý nhân phù trợ không? Thời điểm sự nghiệp thuận lợi nhất và giai đoạn dễ thất bại?

## 💰 TÀI CHÍNH & TÀI LỘC
Phân tích cung Tài Bạch: có Song Lộc, Lộc Tồn, hay bị Kình Đà, Không Kiếp xâm phạm? Tứ Hóa trong Tài Bạch là gì? Khả năng tích lũy, đầu tư, kinh doanh? Rủi ro hao tán tài chính? Nguồn thu nhập chính từ đâu (lương bổng, kinh doanh, đầu tư, thừa kế)? Giai đoạn tài vượng và tài suy trong cuộc đời?

## 💑 TÌNH DUYÊN & HÔN NHÂN
Phân tích cung Phu Thê: chính tinh nói lên đặc điểm người bạn đời, sao cát/hung ảnh hưởng hôn nhân. HóaKỵ hay HóaLộc nhập Phu Thê có ý nghĩa gì? Hôn nhân thuận hay trắc trở? Có Đào Hoa, Hàm Trì không (tình cảm phong phú)? Tuổi nào kết hôn tốt nhất? Đặc điểm người bạn đời phù hợp và loại người cần tránh?

## 👨‍👩‍👧 GIA ĐÌNH & NGƯỜI THÂN
**Cha mẹ (Phụ Mẫu):** Sao gì tại cung — quan hệ, sự hỗ trợ từ cha mẹ, có hưởng ơn cha mẹ không?
**Anh chị em (Huynh Đệ):** Sao gì — tương trợ hay xung khắc với anh chị em?
**Con cái (Tử Tức):** Sao gì — duyên với con, số con, con cái có hiếu hay không?
Xét Tứ Hóa nhập các cung này để bổ sung phân tích.

## 🏠 NHÀ CỬA & BẤT ĐỘNG SẢN
Phân tích cung Điền Trạch: có sao gì? Có khả năng tích lũy bất động sản không? Nhà cửa ổn định hay hay dời chỗ? Hưởng tài sản từ gia đình hay tự tạo lập? HóaLộc hay HóaKỵ nhập Điền Trạch ảnh hưởng thế nào? Lĩnh vực bất động sản có phù hợp để đầu tư không?

## 🍀 PHÚC ĐỨC & TÂM LINH
Phân tích cung Phúc Đức: sao gì tại cung — phúc phần dày hay mỏng? Có được tổ tiên ấm trợ không? Tâm hồn thiên về vật chất hay tinh thần? Cuộc sống có bình an nội tâm không? Đây là cung ẩn náu của vận mệnh — nếu Phúc Đức tốt thì dù gian nan vẫn thoát được. Có nghiệp nặng cần hóa giải không?

## ✈️ XÃ HỘI, QUÝ NHÂN & DI CHUYỂN
**Thiên Di (di chuyển, xuất ngoại):** Sao gì — có lợi khi đi xa hay ở nhà tốt hơn? Có cơ hội xuất ngoại, định cư nước ngoài không?
**Nô Bộc/Giao Du (bạn bè, cộng sự):** Bạn bè có trung thành không? Dễ bị lừa hay được quý nhân giúp đỡ? Nên cẩn thận với kiểu người nào?

## 🏥 SỨC KHỎE & THÂN THỂ
Phân tích cung Tật Ách: chính tinh và hung tinh báo hiệu bệnh gì? (Tham Lang → tiêu hóa/gan, Vũ Khúc → phổi/xương, Liêm Trinh → tim/huyết áp, Thái Âm → thận/nội tiết, Thiên Cơ → thần kinh...) Bộ phận cơ thể dễ tổn thương? Có tai nạn không (Kình, Đà, Hỏa, Linh)? Tuổi nào cần chú ý sức khỏe đặc biệt? Lời khuyên phòng bệnh cụ thể?

## 🔗 TỨ HÓA & TƯƠNG TÁC ĐẶC BIỆT
Liệt kê và phân tích TẤT CẢ Tứ Hóa (Lộc/Quyền/Khoa/Kỵ) của bản mệnh: từ sao nào hóa, rơi vào cung nào, tác động thực tế? Có HóaKỵ xung chiếu về Mệnh/Tài/Quan/Phu Thê không? Có "Song Lộc" hay "Lộc Quyền hội" quý cách không? Tứ Hóa tổng thể đang nói lên điều gì về vận mệnh người này?

## 📅 ĐẠI HẠN HIỆN TẠI ${currentDH ? `(Tuổi ${currentDH.startAge}–${currentDH.endAge} | ${currentDH.startYear}–${currentDH.endYear}) — Cung ${currentDH.cungName}` : ''}
Cung Đại Hạn có sao gì, trạng sinh ra sao? Đại Hạn hội hợp hay xung khắc bản Mệnh? Tứ Hóa Đại Hạn nhập vào các cung nào, tạo ra cục tốt hay xấu? Cơ hội lớn nhất giai đoạn này là gì? Rủi ro và lĩnh vực cần đề phòng? Nên đầu tư, thay đổi công việc, hay giữ ổn định? Phân tích sơ qua từng năm trong Đại Hạn (từng 2–3 năm một)?

## 📆 PHÂN TÍCH VẬN THÁNG NĂM ${currentYear}${currentTH ? ` — Tiểu Hạn Cung ${currentTH.cungName}` : ''}
Tiểu Hạn năm nay đóng tại cung nào, sao gì (cả cát lẫn hung)? Tứ Hóa Tiểu Hạn là gì? Kết hợp Đại Hạn + Tiểu Hạn + bản Mệnh → vận khí năm nay tổng thể thế nào? Phân tích theo quý: Quý 1 (tháng 1–3), Quý 2 (tháng 4–6), Quý 3 (tháng 7–9), Quý 4 (tháng 10–12) — quý nào thuận, quý nào cần cẩn thận? Lĩnh vực nổi bật năm nay: tình cảm, sự nghiệp hay tài chính?

## 📊 LỘ TRÌNH TOÀN BỘ ĐẠI HẠN
Nhận xét TẤT CẢ Đại Hạn trong cuộc đời (không bỏ sót). Với mỗi Đại Hạn: cung tốt hay xấu, cơ hội hay thách thức chủ đạo? Đại Hạn nào là ĐỈNH CAO? Đại Hạn nào là ĐÁY? Sau năm ${currentYear}, còn "thời vàng" nào cần chuẩn bị? Giai đoạn nào nên mạo hiểm đầu tư, giai đoạn nào nên giữ thủ?

## ⚠️ TUỔI & GIAI ĐOẠN CẦN ĐỀ PHÒNG
Dựa trên hung tinh trong lá số và các Đại Hạn xấu: những tuổi nào (hoặc giai đoạn nào) trong cuộc đời người này dễ gặp biến cố nhất? Cụ thể là loại biến cố gì (sức khỏe, tài chính, tình cảm, sự nghiệp)? Cách phòng tránh hoặc hóa giải?

## 💡 KẾT LUẬN & LỜI KHUYÊN CHIẾN LƯỢC
Bức tranh tổng thể cuộc đời theo lá số. 4–5 điểm mạnh quan trọng nhất cần phát huy. 4–5 điểm yếu và cách hóa giải theo Tử Vi. Thời điểm vàng không được bỏ lỡ. Lời khuyên nghề nghiệp, tài chính, tình cảm và sức khỏe thiết thực nhất — dành riêng cho người này dựa trên chính lá số của họ.`
}
