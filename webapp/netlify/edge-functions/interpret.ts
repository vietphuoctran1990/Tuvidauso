// Netlify Edge Function — Tử Vi AI analysis
// Supports two providers selectable per request:
//   • "deepseek"  → DeepSeek API  (DEEPSEEK_API_KEY env var)
//   • "glm"       → Zhipu AI GLM  (GLM_API_KEY env var)
// Both use OpenAI-compatible streaming with multi-turn continuation.

const PROVIDERS = {
  deepseek: {
    url:      'https://api.deepseek.com/v1/chat/completions',
    model:    'deepseek-chat',
    maxTok:   8000,
    envKey:   'DEEPSEEK_API_KEY',
    label:    'DeepSeek',
  },
  glm: {
    url:      'https://zenmux.ai/api/v1/chat/completions',
    model:    'glm-5.2',
    maxTok:   8000,
    envKey:   'GLM_API_KEY',
    label:    'GLM',
  },
} as const

type ProviderKey = keyof typeof PROVIDERS

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
  let providerKey: ProviderKey = 'deepseek'
  try {
    const body = await request.json()
    chartData = body.chartData
    if (body.provider === 'glm') providerKey = 'glm'
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const cfg = PROVIDERS[providerKey]
  // @ts-ignore – Deno global
  const apiKey: string | undefined = Deno.env.get(cfg.envKey)?.trim()

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: `Chưa có API key cho ${cfg.label}. Vui lòng thêm ${cfg.envKey} vào Netlify Environment Variables.` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (t: string) => controller.enqueue(encoder.encode(t))
      try {
        await runProvider(cfg, apiKey, chartData, emit)
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

// ─── JWT generation for Zhipu AI (GLM) ───────────────────────────────────────
// GLM API key format: "{id}.{secret}" — must be converted to a signed JWT.

async function glmBearerToken(apiKey: string): Promise<string> {
  const dot = apiKey.indexOf('.')
  if (dot < 0) return apiKey // not the expected format — use as-is
  const id = apiKey.slice(0, dot)
  const secret = apiKey.slice(dot + 1)
  const now = Date.now()
  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const header  = b64url({ alg: 'HS256', typ: 'JWT', sign_type: 'SIGN' })
  const payload = b64url({ api_key: id, exp: now + 3_600_000, timestamp: now })
  const input   = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input))
  const b64sig = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${input}.${b64sig}`
}

// ─── OpenAI-compatible streaming with auto-continuation ───────────────────────

async function runProvider(
  cfg: typeof PROVIDERS[ProviderKey],
  apiKey: string,
  chartData: any,
  emit: (t: string) => void,
): Promise<void> {
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    { role: 'user',   content: buildFullPrompt(chartData) },
  ]

  const bearerToken = apiKey

  for (let pass = 0; pass < 4; pass++) {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        model:       cfg.model,
        messages,
        max_tokens:  cfg.maxTok,
        temperature: 0.75,
        stream:      true,
      }),
    })

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '')
      let errMsg = ''
      try { errMsg = JSON.parse(errText)?.error?.message ?? '' } catch { /* */ }
      const low = (errMsg || errText).toLowerCase()

      if (res.status === 401 || low.includes('invalid api key') || low.includes('authentication')) {
        emit(`[Lỗi 401 ${cfg.label}: ${errMsg || errText.slice(0, 300)}]`); return
      }
      if (res.status === 402 || low.includes('insufficient balance') || low.includes('quota exceeded')) {
        emit(`[Lỗi: Tài khoản ${cfg.label} hết số dư / hết quota.]`); return
      }
      if (res.status === 429 || low.includes('rate limit')) {
        emit(`[Lỗi: ${cfg.label} đang giới hạn tốc độ. Vui lòng thử lại sau vài giây.]`); return
      }
      emit(`[Lỗi ${cfg.label} ${res.status}: ${errMsg || errText.slice(0, 200)}]`); return
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
    messages.push({ role: 'user', content: 'Tiếp tục viết các mục còn lại từ chỗ vừa dừng. Không lặp lại nội dung đã có.' })
  }
}

// ─── System instruction ───────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Bạn là Tử Vi sư Việt Nam chuyên nghiệp. Nguyên tắc luận giải:
(1) Xét cung thủ + cung chiếu đối diện (tam phương tứ chính).
(2) Tam hợp/xung ảnh hưởng cung Mệnh.
(3) Tứ Hóa (Lộc/Quyền/Khoa/Kỵ) tác động riêng từng cung, xét hóa nhập và hóa xuất.
(4) Tự Hóa (自化) — sao tự hóa theo Can chính cung: Tự Hóa Kỵ hao tổn nội tại, Tự Hóa Lộc dễ phát tán ra ngoài.
(5) Tổ hợp sao tương tác nhau (Tử Phủ, Sát Phá Tham, Cơ Nguyệt Đồng Lương...).
(6) Trạng thái Miếu/Vượng/Đắc > Bình > Hãm quyết định sức mạnh sao.
(7) Tuần/Triệt làm yếu sao trong cung đó.
(8) Đại Hạn + Tiểu Hạn kết hợp bản Mệnh — xét Tứ Hóa riêng của từng hạn.
Nhận diện Cách Cục (Tử Phủ triều viên, Song Lộc, Lộc Mã Giao Trì, Không Kiếp giáp Mệnh...).
Viết tiếng Việt sâu sắc, dẫn chứng tên sao + trạng thái + cung cụ thể.`

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
