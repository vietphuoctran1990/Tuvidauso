import { useState, useCallback } from 'react'
import { generateLaSo } from 'tuvi-neo'
import type { LaSoResult } from 'tuvi-neo'
import { STAR_INFO, PALACE_INFO, TRANG_SINH_INFO } from './starInfo'
import { exportChartPDF, exportAnalysisPDF } from './pdfExport'
import './App.css'

// ── Constants ──────────────────────────────────────────────────────────────
const D_CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tị', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi']
const T_CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý']

const CHI_GRID: Record<number, [number, number]> = {
  5: [1,1], 6: [1,2], 7: [1,3], 8: [1,4],
  4: [2,1],                               9: [2,4],
  3: [3,1],                              10: [3,4],
  2: [4,1], 1: [4,2], 0: [4,3],         11: [4,4],
}

const HANH: Record<number, { name: string; color: string }> = {
  1: { name: 'Kim',  color: '#fbbf24' },
  2: { name: 'Thủy', color: '#60a5fa' },
  3: { name: 'Mộc',  color: '#4ade80' },
  4: { name: 'Hỏa',  color: '#f87171' },
  5: { name: 'Thổ',  color: '#fb923c' },
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  'M': { label: 'Miếu',  color: '#a855f7' },
  'V': { label: 'Vượng', color: '#22d3ee' },
  'Đ': { label: 'Đắc',   color: '#4ade80' },
  'B': { label: 'Bình',  color: '#9ca3af' },
  'H': { label: 'Hàm',   color: '#f87171' },
}

const GIO_CHI = D_CHI.map((chi, i) => {
  const h1 = (i * 2 - 1 + 24) % 24
  const h2 = (i * 2 + 1) % 24
  return { value: i, label: `Giờ ${chi} (${String(h1).padStart(2,'0')}h–${String(h2).padStart(2,'0')}h)` }
})

type Tab = 'laso' | 'daihan' | 'tieuHan' | 'ai'

interface FormData {
  name: string; gender: 'male'|'female'; isLunar: boolean
  year: number; month: number; day: number; gioIndex: number
}

interface SelectedStar { name: string; status?: string; hanh?: number }

// ── Utilities ──────────────────────────────────────────────────────────────
function findPalaceByPos(result: LaSoResult, pos: number) {
  const chiName = D_CHI[pos - 1]
  return result.Cac_cung.find((c: any) => c.TieuHan === chiName)
}

function getDaiHan(result: LaSoResult) {
  const raw = result.getRawData() as any
  const stars = raw.boSao.filter((s: any) => s.type === 'D').sort((a: any, b: any) => a.id - b.id)
  return stars.map((s: any) => ({
    startAge: s.id, endAge: s.id + 9,
    chiName: D_CHI[s.pos - 1] ?? '',
    cung: findPalaceByPos(result, s.pos),
  }))
}

function getTieuHan(result: LaSoResult, birthYear: number) {
  const raw = result.getRawData() as any
  const stars = raw.boSao.filter((s: any) => s.type === 'V').sort((a: any, b: any) => a.id - b.id)
  return stars.map((s: any, i: number) => ({
    age: i,
    yearChi: D_CHI[s.id - 1] ?? '',
    chiName: D_CHI[s.pos - 1] ?? '',
    cung: findPalaceByPos(result, s.pos),
    years: [birthYear + i, birthYear + i + 12, birthYear + i + 24, birthYear + i + 36],
  }))
}

function getDanNap(result: LaSoResult): string {
  const raw = result.getRawData() as any
  return raw.dnan ? 'Thuận (Nam trên Dương, Nữ trên Âm)' : 'Nghịch (Nam trên Âm, Nữ trên Dương)'
}

// ── Build chart data for AI ────────────────────────────────────────────────
function buildChartData(result: LaSoResult, form: FormData, daiHan: any[], tieuHan: any[]) {
  const currentYear = new Date().getFullYear()
  const age = currentYear - form.year
  const currentDH = daiHan.find(dh => age >= dh.startAge && age <= dh.endAge)
  const currentTH = tieuHan.find(th => th.years.includes(currentYear))
  return {
    form: {
      name: form.name || 'Không tên',
      gender: form.gender === 'male' ? 'Nam' : 'Nữ',
      year: form.year, month: form.month, day: form.day,
      isLunar: form.isLunar, gioIndex: form.gioIndex,
    },
    info: {
      nam: result.Info.Nam, gio: result.Info.Gio,
      amDuong: result.Info.AmDuong, cuc: result.Info.Cuc,
      chuMenh: result.Info.ChuMenh, chuThan: result.Info.ChuThan,
      thanCu: result.Info.ThanCu,
    },
    danNap: getDanNap(result),
    palaces: result.Cac_cung.map((c: any) => ({
      name: c.Name, tieuHan: c.TieuHan,
      canCung: T_CAN[c.CanCung] ?? '',
      isLife: c.Name === 'Mệnh', isBody: c.Than === 1,
      trangSinh: c.TrangSinh, tuan: c.Tuan === 1, triet: c.Triet === 1,
      locNhap: c.LocNhap, quyenNhap: c.QuyenNhap, khoaNhap: c.KhoaNhap, kyNhap: c.KyNhap,
      chinhTinh: (c.ChinhTinh ?? []).map((s: any) => ({ name: s.Name, status: s.Status })),
      saotot:    (c.Saotot   ?? []).map((s: any) => ({ name: s.Name, status: s.Status })),
      saoxau:    (c.Saoxau   ?? []).map((s: any) => ({ name: s.Name })),
    })),
    daiHan: daiHan.map(dh => ({
      startAge: dh.startAge, endAge: dh.endAge,
      cungName: dh.cung?.Name ?? '', chiName: dh.chiName,
      trangSinh: dh.cung?.TrangSinh ?? '',
      locNhap: dh.cung?.LocNhap, quyenNhap: dh.cung?.QuyenNhap,
      khoaNhap: dh.cung?.KhoaNhap, kyNhap: dh.cung?.KyNhap,
      chinhTinh: (dh.cung?.ChinhTinh ?? []).map((s: any) => s.Name),
      saotot:    (dh.cung?.Saotot   ?? []).slice(0, 8).map((s: any) => s.Name),
      saoxau:    (dh.cung?.Saoxau   ?? []).slice(0, 5).map((s: any) => s.Name),
    })),
    tieuHan: tieuHan.map(th => ({
      yearChi: th.yearChi, chiName: th.chiName,
      cungName: th.cung?.Name ?? '', years: th.years,
      locNhap: th.cung?.LocNhap, kyNhap: th.cung?.KyNhap,
      chinhTinh: (th.cung?.ChinhTinh ?? []).map((s: any) => s.Name),
    })),
    currentYear,
    currentDH: currentDH ? {
      startAge: currentDH.startAge, endAge: currentDH.endAge,
      cungName: currentDH.cung?.Name ?? '',
      startYear: form.year + currentDH.startAge - 1,
      endYear:   form.year + currentDH.startAge + 8,
    } : null,
    currentTH: currentTH ? {
      yearChi: currentTH.yearChi, cungName: currentTH.cung?.Name ?? '',
    } : null,
  }
}

// ── Markdown renderer ───────────────────────────────────────────────────────
function MdText({ text }: { text: string }) {
  const lines = text.split('\n')
  const els: React.ReactNode[] = []
  let listBuf: string[] = []

  const flushList = (key: number) => {
    if (listBuf.length) {
      els.push(
        <ul key={`ul-${key}`} className="md-ul">
          {listBuf.map((li, i) => <li key={i} dangerouslySetInnerHTML={{ __html: bold(li) }} />)}
        </ul>
      )
      listBuf = []
    }
  }

  lines.forEach((line, i) => {
    const t = line.trim()
    if (t.startsWith('## ')) { flushList(i); els.push(<h2 key={i} className="md-h2">{t.slice(3)}</h2>) }
    else if (t.startsWith('# ')) { flushList(i); els.push(<h1 key={i} className="md-h1">{t.slice(2)}</h1>) }
    else if (t.startsWith('- ') || t.startsWith('• ')) { listBuf.push(t.slice(2)) }
    else if (t === '') { flushList(i); els.push(<div key={i} className="md-gap" />) }
    else { flushList(i); els.push(<p key={i} dangerouslySetInnerHTML={{ __html: bold(t) }} />) }
  })
  flushList(lines.length)
  return <div className="md-body">{els}</div>
}

function bold(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

// ── Star Detail Modal ───────────────────────────────────────────────────────
function StarModal({ star, onClose }: { star: SelectedStar; onClose: () => void }) {
  const info = STAR_INFO[star.name]
  const h = star.hanh ? HANH[star.hanh] : null
  const st = star.status && STATUS_LABEL[star.status] ? STATUS_LABEL[star.status] : null
  const isMieu = star.status && ['M','V','Đ'].includes(star.status)
  const isHam  = star.status && star.status === 'H'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="star-modal" onClick={e => e.stopPropagation()}>
        <div className="star-modal-header">
          <div>
            <div className="star-modal-name" style={h ? { color: h.color } : undefined}>{star.name}</div>
            <div className="star-modal-meta">
              {h && <span style={{ color: h.color }}>● {h.name}</span>}
              {st && <span style={{ color: st.color }}>· {st.label}</span>}
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="star-modal-body">
          {info ? (
            <>
              <p className="sc-role">{info.role}</p>
              <p className="sc-meaning">{info.meaning}</p>
              {isMieu && info.mieuEffect && <p className="sc-effect good">✦ {info.mieuEffect}</p>}
              {isHam  && info.hamEffect  && <p className="sc-effect bad">⚠ {info.hamEffect}</p>}
            </>
          ) : (
            <p className="panel-desc">Chưa có thông tin chi tiết cho sao này trong cơ sở dữ liệu.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── AI Interpretation Tab ───────────────────────────────────────────────────
function InterpretTab({ result, form, daiHan, tieuHan }: {
  result: LaSoResult; form: FormData; daiHan: any[]; tieuHan: any[]
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadAnalysis() {
    const el = document.querySelector('.interpret-result') as HTMLElement
    if (!el) return
    setDownloading(true)
    try { await exportAnalysisPDF(el, form.name) } finally { setDownloading(false) }
  }

  async function startAnalysis() {
    setLoading(true); setDone(false); setText(''); setError('')
    const chartData = buildChartData(result, form, daiHan, tieuHan)
    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartData }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        setError(err.error || 'Lỗi kết nối API.')
        setLoading(false)
        return
      }
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done: rdDone, value } = await reader.read()
        if (rdDone) break
        setText(prev => prev + decoder.decode(value))
      }
      setDone(true)
    } catch (e: any) {
      setError(e.message || 'Lỗi không xác định.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="interpret-tab">
      {!text && !loading && !error && (
        <div className="interpret-start">
          <div className="is-icon">🤖</div>
          <h2>Phân Tích Lá Số</h2>
          <p>
            Claude AI sẽ phân tích toàn diện lá số của <strong>{form.name || 'bạn'}</strong> —
            tính cách, sự nghiệp, tài chính, tình duyên, sức khỏe,
            đại hạn hiện tại, tiểu hạn năm nay và lời khuyên thiết thực.
          </p>
          <button className="btn-analyze" onClick={startAnalysis}>✨ Bắt đầu phân tích lá số</button>
          <p className="is-note">Thời gian: khoảng 30–60 giây · Phân tích dựa trên Claude AI</p>
        </div>
      )}

      {loading && !text && (
        <div className="interpret-loading">
          <div className="spin-container"><span className="spin-sym">☯</span></div>
          <p>Đang phân tích lá số tử vi...</p>
          <p className="load-sub">AI đang đọc các sao và tổng hợp kết quả</p>
        </div>
      )}

      {text && (
        <div className="interpret-result">
          <MdText text={text} />
          {loading && <span className="cursor-blink">▌</span>}
        </div>
      )}

      {error && (
        <div className="interpret-error">
          <strong>Lỗi:</strong> {error}<br />
          {error.includes('ANTHROPIC_API_KEY') && (
            <span>Vui lòng thêm <code>ANTHROPIC_API_KEY</code> vào Environment Variables trên Netlify.</span>
          )}
        </div>
      )}

      {(done || error) && (
        <div className="interpret-actions">
          <button className="btn-reanalyze" onClick={startAnalysis}>🔄 Phân tích lại</button>
          {done && (
            <button className="btn-export" onClick={handleDownloadAnalysis} disabled={downloading}>
              {downloading ? '⏳ Đang tạo PDF...' : '📄 Tải PDF phân tích'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── StarBadge ───────────────────────────────────────────────────────────────
function StarBadge({ name, status, hanh, isHoa, onClick }: {
  name: string; status?: string; hanh?: number; isHoa?: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  const h = hanh ? HANH[hanh] : null
  const s = status && STATUS_LABEL[status] ? STATUS_LABEL[status] : null
  return (
    <span
      className={`star-badge star-clickable ${isHoa ? 'star-hoa' : ''}`}
      style={h ? { color: h.color } : undefined}
      title={STAR_INFO[name]?.meaning ?? name}
      onClick={onClick}
    >
      {name}
      {s && <sup className="star-status" style={{ color: s.color }}>{s.label}</sup>}
    </span>
  )
}

// ── Palace Cell ─────────────────────────────────────────────────────────────
function PalaceCell({ cung, isSelected, onClick, onStarClick }: {
  cung: any; isSelected: boolean; onClick: () => void
  onStarClick: (name: string, status?: string, hanh?: number) => void
}) {
  const chiIdx = D_CHI.indexOf(cung.TieuHan)
  const [row, col] = CHI_GRID[chiIdx] ?? [0, 0]
  const canName = T_CAN[cung.CanCung] ?? ''
  const isLife = cung.Name === 'Mệnh'
  const isBody = cung.Than === 1
  const hoaStars = new Set<string>([cung.LocNhap, cung.QuyenNhap, cung.KhoaNhap, cung.KyNhap].filter(Boolean))
  const primaryElem = cung.ChinhTinh?.[0]?.NguHanh ?? 0

  const starClick = (s: any) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onStarClick(s.Name, s.Status, s.NguHanh)
  }

  return (
    <div
      className={`palace-cell elem-${primaryElem}${isLife ? ' palace-life' : ''}${isBody ? ' palace-body' : ''}${isSelected ? ' palace-selected' : ''}`}
      style={{ gridRow: row, gridColumn: col }}
      onClick={onClick}
    >
      <div className="pc-header">
        <span className="pc-name">{cung.Name}</span>
        <span className="pc-chi">{canName} {cung.TieuHan}</span>
      </div>

      <div className="pc-tags">
        {cung.TrangSinh && <span className="tag ts">{cung.TrangSinh}</span>}
        {cung.Tuan === 1 && <span className="tag tuan">Tuần</span>}
        {cung.Triet === 1 && <span className="tag triet">Triệt</span>}
        {isBody && <span className="tag than">THÂN</span>}
      </div>

      {(cung.LocNhap || cung.QuyenNhap || cung.KhoaNhap || cung.KyNhap) && (
        <div className="pc-hoa">
          {cung.LocNhap && <span className="hoa loc">Lộc·{cung.LocNhap}</span>}
          {cung.QuyenNhap && <span className="hoa quyen">Quyền·{cung.QuyenNhap}</span>}
          {cung.KhoaNhap && <span className="hoa khoa">Khoa·{cung.KhoaNhap}</span>}
          {cung.KyNhap && <span className="hoa ky">Kỵ·{cung.KyNhap}</span>}
        </div>
      )}

      {cung.ChinhTinh?.length > 0 && (
        <div className="pc-stars chinh">
          {cung.ChinhTinh.map((s: any, i: number) => (
            <StarBadge key={i} name={s.Name} status={s.Status} hanh={s.NguHanh} isHoa={hoaStars.has(s.Name)} onClick={starClick(s)} />
          ))}
        </div>
      )}
      {cung.Saotot?.length > 0 && (
        <div className="pc-stars tot">
          {cung.Saotot.map((s: any, i: number) => (
            <StarBadge key={i} name={s.Name} status={s.Status} hanh={s.NguHanh} isHoa={hoaStars.has(s.Name)} onClick={starClick(s)} />
          ))}
        </div>
      )}
      {cung.Saoxau?.length > 0 && (
        <div className="pc-stars xau">
          {cung.Saoxau.map((s: any, i: number) => (
            <StarBadge key={i} name={s.Name} status={s.Status} hanh={s.NguHanh} isHoa={hoaStars.has(s.Name)} onClick={starClick(s)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Chart Center ─────────────────────────────────────────────────────────────
function ChartCenter({ info, form }: { info: any; form: FormData }) {
  return (
    <div className="chart-center">
      <div className="cc-title">TỬ VI ĐẨU SỐ</div>
      <div className="cc-name">{form.name || 'Vô danh'}</div>
      <div className="cc-gender">{form.gender === 'male' ? 'Nam' : 'Nữ'} · {info.AmDuong}</div>
      <hr className="cc-hr" />
      {[['Năm sinh', info.Nam], ['Giờ sinh', info.Gio], ['Lịch', form.isLunar ? 'Âm lịch' : 'Dương lịch']].map(([l, v]) => (
        <div className="cc-row" key={l}><span className="cc-l">{l}</span><span className="cc-v">{v}</span></div>
      ))}
      <hr className="cc-hr" />
      {[['Cục', info.Cuc], ['Chủ Mệnh', info.ChuMenh], ['Chủ Thân', info.ChuThan], ['Thân cư', info.ThanCu]].map(([l, v]) => (
        <div className="cc-row" key={l}><span className="cc-l">{l}</span><span className={`cc-v ${l === 'Cục' ? 'cc-cuc' : ''}`}>{v}</span></div>
      ))}
      <div className="cc-hint">Chạm vào cung hoặc sao để xem chú giải</div>
    </div>
  )
}

// ── Palace Detail Panel ─────────────────────────────────────────────────────
function PalacePanel({ cung, onClose }: { cung: any; onClose: () => void }) {
  const info = PALACE_INFO[cung.Name]
  const tsInfo = TRANG_SINH_INFO[cung.TrangSinh] ?? ''
  const allStars = [
    ...(cung.ChinhTinh ?? []).map((s: any) => ({ ...s, cat: true, kind: 'Chính tinh' })),
    ...(cung.Saotot ?? []).map((s: any) => ({ ...s, cat: true, kind: 'Cát tinh' })),
    ...(cung.Saoxau ?? []).map((s: any) => ({ ...s, cat: false, kind: 'Hung tinh' })),
  ]

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="palace-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Cung {cung.Name}</h2>
            <span className="panel-chi">{T_CAN[cung.CanCung]} {cung.TieuHan}</span>
            {cung.Than === 1 && <span className="tag than ml">THÂN</span>}
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {info && (
          <div className="panel-section">
            <h3>Ý nghĩa cung</h3>
            <p className="panel-desc">{info.meaning}</p>
            <div className="aspect-tags">
              {info.aspects.map(a => <span key={a} className="aspect-tag">{a}</span>)}
            </div>
          </div>
        )}

        {cung.TrangSinh && (
          <div className="panel-section">
            <h3>Trường Sinh: <span className="hl">{cung.TrangSinh}</span></h3>
            {tsInfo && <p className="panel-desc">{tsInfo}</p>}
          </div>
        )}

        {(cung.LocNhap || cung.QuyenNhap || cung.KhoaNhap || cung.KyNhap) && (
          <div className="panel-section">
            <h3>Tứ Hóa trong cung</h3>
            <div className="hoa-list">
              {cung.LocNhap && <div className="hoa-item loc"><span className="hoa-title">Hóa Lộc · {cung.LocNhap}</span><p>{STAR_INFO['Hóa lộc']?.meaning}</p></div>}
              {cung.QuyenNhap && <div className="hoa-item quyen"><span className="hoa-title">Hóa Quyền · {cung.QuyenNhap}</span><p>{STAR_INFO['Hóa quyền']?.meaning}</p></div>}
              {cung.KhoaNhap && <div className="hoa-item khoa"><span className="hoa-title">Hóa Khoa · {cung.KhoaNhap}</span><p>{STAR_INFO['Hóa khoa']?.meaning}</p></div>}
              {cung.KyNhap && <div className="hoa-item ky"><span className="hoa-title">Hóa Kỵ · {cung.KyNhap}</span><p>{STAR_INFO['Hóa kỵ']?.meaning}</p></div>}
            </div>
          </div>
        )}

        {(cung.Tuan === 1 || cung.Triet === 1) && (
          <div className="panel-section">
            <h3>Cảnh báo</h3>
            {cung.Tuan === 1 && <p className="warn">⚠ Cung này có <b>Tuần</b> — các sao trong cung bị giảm sức mạnh.</p>}
            {cung.Triet === 1 && <p className="warn">⚠ Cung này có <b>Triệt</b> — các sao bị cô lập, khó phát huy.</p>}
          </div>
        )}

        <div className="panel-section">
          <h3>Các sao trong cung ({allStars.length} sao)</h3>
          <div className="star-list">
            {allStars.map((s: any, i: number) => {
              const si = STAR_INFO[s.Name]
              const h = HANH[s.NguHanh]
              const st = STATUS_LABEL[s.Status]
              return (
                <div key={i} className={`star-card ${s.cat ? 'star-card-tot' : 'star-card-xau'}`}>
                  <div className="sc-header">
                    <span className="sc-name" style={h ? { color: h.color } : undefined}>{s.Name}</span>
                    <div className="sc-meta">
                      <span className="sc-kind">{s.kind}</span>
                      {h && <span className="sc-hanh" style={{ color: h.color }}>{h.name}</span>}
                      {st && <span className="sc-status" style={{ color: st.color }}>{st.label}</span>}
                    </div>
                  </div>
                  {si && (
                    <>
                      <p className="sc-role">{si.role}</p>
                      <p className="sc-meaning">{si.meaning}</p>
                      {s.Status && s.Status !== 'B' && s.Status !== 'N' && (
                        <p className={`sc-effect ${['M','V','Đ'].includes(s.Status) ? 'good' : 'bad'}`}>
                          {['M','V','Đ'].includes(s.Status) ? `✦ ${si.mieuEffect}` : `⚠ ${si.hamEffect}`}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Đại Hạn Tab ─────────────────────────────────────────────────────────────
function DaiHanTab({ result, form, onStarClick, onPalaceClick }: {
  result: LaSoResult; form: FormData
  onStarClick: (name: string, status?: string, hanh?: number) => void
  onPalaceClick: (cung: any) => void
}) {
  const list = getDaiHan(result)
  const danNap = getDanNap(result)
  const currentYear = new Date().getFullYear()
  const birthYear = form.year

  return (
    <div className="tab-content">
      <div className="tab-intro">
        <h2>Đại Hạn (Vận 10 năm)</h2>
        <p>Đại Hạn là chu kỳ 10 năm, mỗi chu kỳ ảnh hưởng bởi một cung khác nhau. Hướng vận: <b>{danNap}</b></p>
      </div>
      <div className="dh-grid">
        {list.map((dh: any, i: number) => {
          const startYear = birthYear + dh.startAge - 1
          const endYear = startYear + 9
          const isCurrent = currentYear >= startYear && currentYear <= endYear
          const cung = dh.cung
          return (
            <div key={i} className={`dh-card ${isCurrent ? 'dh-current' : ''}`}>
              <div className="dh-card-header">
                <span className="dh-num">Đại Hạn {i + 1}</span>
                {isCurrent && <span className="dh-now-badge">HIỆN TẠI</span>}
              </div>
              <div className="dh-age">Tuổi {dh.startAge}–{dh.endAge}</div>
              <div className="dh-year">({startYear}–{endYear})</div>
              {cung && (
                <>
                  <div className="dh-cung" onClick={() => onPalaceClick(cung)} title="Xem chi tiết cung">
                    Cung <b className="dh-cung-name">{cung.Name}</b> · {dh.chiName}
                  </div>
                  <div className="dh-trangsinh">{cung.TrangSinh}</div>
                  {(cung.LocNhap || cung.QuyenNhap || cung.KhoaNhap || cung.KyNhap) && (
                    <div className="dh-hoa">
                      {cung.LocNhap && <span className="hoa loc">Lộc</span>}
                      {cung.QuyenNhap && <span className="hoa quyen">Quyền</span>}
                      {cung.KhoaNhap && <span className="hoa khoa">Khoa</span>}
                      {cung.KyNhap && <span className="hoa ky">Kỵ</span>}
                    </div>
                  )}
                  <div className="dh-stars">
                    {cung.ChinhTinh?.map((s: any, j: number) => (
                      <span key={j} className="dh-star chinh star-clickable"
                        style={{ color: HANH[s.NguHanh]?.color }}
                        onClick={() => onStarClick(s.Name, s.Status, s.NguHanh)}
                        title={STAR_INFO[s.Name]?.meaning ?? s.Name}
                      >
                        {s.Name}{s.Status && s.Status !== 'N' ? <sup>{STATUS_LABEL[s.Status]?.label}</sup> : ''}
                      </span>
                    ))}
                    {cung.Saotot?.slice(0, 5).map((s: any, j: number) => (
                      <span key={j} className="dh-star tot star-clickable"
                        style={{ color: HANH[s.NguHanh]?.color }}
                        onClick={() => onStarClick(s.Name, s.Status, s.NguHanh)}
                        title={STAR_INFO[s.Name]?.meaning ?? s.Name}
                      >
                        {s.Name}
                      </span>
                    ))}
                    {cung.Saoxau?.slice(0, 4).map((s: any, j: number) => (
                      <span key={j} className="dh-star xau star-clickable"
                        onClick={() => onStarClick(s.Name, undefined, s.NguHanh)}
                        title={STAR_INFO[s.Name]?.meaning ?? s.Name}
                      >
                        {s.Name}
                      </span>
                    ))}
                    {(cung.Saotot?.length + cung.Saoxau?.length) > 9 && (
                      <span className="dh-more">+{cung.Saotot.length + cung.Saoxau.length - 9} sao</span>
                    )}
                  </div>
                  {(cung.Tuan === 1 || cung.Triet === 1) && (
                    <div className="dh-warn">
                      {cung.Tuan === 1 && <span>⚠ Tuần</span>}
                      {cung.Triet === 1 && <span>⚠ Triệt</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tiểu Hạn Tab ────────────────────────────────────────────────────────────
function TieuHanTab({ result, form, onStarClick, onPalaceClick }: {
  result: LaSoResult; form: FormData
  onStarClick: (name: string, status?: string, hanh?: number) => void
  onPalaceClick: (cung: any) => void
}) {
  const list = getTieuHan(result, form.year)
  const currentYear = new Date().getFullYear()

  return (
    <div className="tab-content">
      <div className="tab-intro">
        <h2>Tiểu Hạn (Vận theo năm)</h2>
        <p>Tiểu Hạn xác định cung chủ vận của từng năm, lặp lại theo chu kỳ 12 năm.</p>
      </div>
      <div className="th-table-wrap">
        <table className="th-table">
          <thead>
            <tr>
              <th>Năm Địa Chi</th><th>Cung vận</th><th>Tứ Hóa</th><th>Chính tinh</th><th>Năm dương lịch</th>
            </tr>
          </thead>
          <tbody>
            {list.map((th: any, i: number) => {
              const isCurrent = th.years.includes(currentYear)
              const cung = th.cung
              return (
                <tr key={i} className={isCurrent ? 'th-current' : ''}>
                  <td>
                    <span className="th-yechi">{th.yearChi}</span>
                    {isCurrent && <span className="th-now">▶ Năm nay</span>}
                  </td>
                  <td>
                    <b className="th-cung-name" onClick={() => cung && onPalaceClick(cung)} title="Xem chi tiết cung">
                      {cung?.Name ?? '?'}
                    </b>
                    <span className="th-chi"> · {th.chiName}</span>
                    {cung?.Than === 1 && <span className="tag than ml">THÂN</span>}
                  </td>
                  <td>
                    {cung?.LocNhap && <span className="hoa loc">Lộc</span>}
                    {cung?.QuyenNhap && <span className="hoa quyen">Quyền</span>}
                    {cung?.KhoaNhap && <span className="hoa khoa">Khoa</span>}
                    {cung?.KyNhap && <span className="hoa ky">Kỵ</span>}
                  </td>
                  <td>
                    <div className="th-stars">
                      {cung?.ChinhTinh?.map((s: any, j: number) => (
                        <span key={j} className="th-star star-clickable"
                          style={{ color: HANH[s.NguHanh]?.color }}
                          onClick={() => onStarClick(s.Name, s.Status, s.NguHanh)}
                          title={STAR_INFO[s.Name]?.meaning ?? s.Name}
                        >
                          {s.Name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="th-years">
                    {th.years.map((y: number) => (
                      <span key={y} className={`th-yr ${y === currentYear ? 'th-yr-now' : ''}`}>{y}</span>
                    ))}
                    <span className="th-yr-etc">…</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [form, setForm] = useState<FormData>({
    name: '', gender: 'male', isLunar: false,
    year: 1990, month: 1, day: 1, gioIndex: 0,
  })
  const [result, setResult] = useState<LaSoResult | null>(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(true)
  const [tab, setTab] = useState<Tab>('laso')
  const [selectedCung, setSelectedCung] = useState<any>(null)
  const [selectedStar, setSelectedStar] = useState<SelectedStar | null>(null)
  const [downloadingChart, setDownloadingChart] = useState(false)

  async function handleDownloadChart() {
    const el = document.querySelector('.chart-grid') as HTMLElement
    if (!el) return
    setDownloadingChart(true)
    try { await exportChartPDF(el, form.name) } finally { setDownloadingChart(false) }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : ['year','month','day','gioIndex'].includes(name) ? Number(value) : value,
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    try {
      const laso = generateLaSo({
        name: form.name || 'Vô danh', gender: form.gender,
        birth: { isLunar: form.isLunar, year: form.year, month: form.month, day: form.day, hour: form.gioIndex * 2 },
      })
      setResult(laso); setShowForm(false); setTab('laso')
      setSelectedCung(null); setSelectedStar(null)
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi tính lá số.')
    }
  }

  const handlePalaceClick = useCallback((cung: any) => {
    setSelectedStar(null)
    setSelectedCung((prev: any) => prev?.Name === cung.Name && prev?.TieuHan === cung.TieuHan ? null : cung)
  }, [])

  const handleStarClick = useCallback((name: string, status?: string, hanh?: number) => {
    setSelectedCung(null)
    setSelectedStar({ name, status, hanh })
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-cosmos" />
        <div className="header-inner">
          <div className="sym-ring">
            <div className="sym-ring-inner"><span className="h-sym">☯</span></div>
          </div>
          <h1>Tử Vi Đẩu Số</h1>
          <p className="h-sub">Lá số tử vi · Tính theo phương pháp cổ truyền Việt Nam</p>
        </div>
      </header>

      <main className="app-main">
        {result && (
          <div className="form-toggle-row">
            <button className="btn-toggle" onClick={() => setShowForm(v => !v)}>
              {showForm ? '▲ Ẩn form' : '▼ Sửa thông tin'}
            </button>
          </div>
        )}

        {showForm && (
          <section className="form-wrap">
            <form className="birth-form" onSubmit={handleSubmit}>
              <h2>Nhập thông tin sinh</h2>
              <div className="form-group">
                <label>Họ và tên</label>
                <input name="name" type="text" placeholder="Nguyễn Văn A" value={form.name} onChange={handleChange} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Giới tính</label>
                  <select name="gender" value={form.gender} onChange={handleChange}>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Loại lịch</label>
                  <select name="isLunar" value={form.isLunar ? 'true' : 'false'}
                    onChange={e => setForm(p => ({ ...p, isLunar: e.target.value === 'true' }))}>
                    <option value="false">Dương lịch</option>
                    <option value="true">Âm lịch</option>
                  </select>
                </div>
              </div>
              <div className="form-row three">
                <div className="form-group">
                  <label>Năm sinh</label>
                  <input name="year" type="number" min={1900} max={2100} value={form.year} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Tháng</label>
                  <input name="month" type="number" min={1} max={12} value={form.month} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Ngày</label>
                  <input name="day" type="number" min={1} max={31} value={form.day} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label>Giờ sinh</label>
                <select name="gioIndex" value={form.gioIndex} onChange={handleChange}>
                  {GIO_CHI.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <button type="submit" className="submit-btn">✨ Xem lá số tử vi</button>
              {error && <div className="error-msg">{error}</div>}
            </form>
          </section>
        )}

        {result && (
          <section className="chart-section">
            <div className="tabs">
              {([['laso','🗺 Lá Số'],['daihan','📅 Đại Hạn'],['tieuHan','🔄 Tiểu Hạn'],['ai','🤖 Phân tích lá số']] as [Tab,string][]).map(([t,l]) => (
                <button key={t} className={`tab-btn ${tab === t ? 'tab-active' : ''} ${t === 'ai' ? 'tab-ai' : ''}`} onClick={() => setTab(t)}>{l}</button>
              ))}
            </div>

            {tab === 'laso' && (
              <>
                <div className="chart-grid">
                  {result.Cac_cung.map((cung: any, i: number) => (
                    <PalaceCell key={i} cung={cung}
                      isSelected={selectedCung?.TieuHan === cung.TieuHan}
                      onClick={() => handlePalaceClick(cung)}
                      onStarClick={handleStarClick}
                    />
                  ))}
                  <ChartCenter info={result.Info} form={form} />
                </div>
                <div className="legend">
                  <div className="lg-group">
                    <b>Ngũ hành:</b>
                    {Object.entries(HANH).map(([k,v]) => <span key={k} style={{ color: v.color }}>● {v.name}</span>)}
                  </div>
                  <div className="lg-group">
                    <b>Trạng thái:</b>
                    {Object.entries(STATUS_LABEL).map(([k,v]) => <span key={k} style={{ color: v.color }}>{k}={v.label}</span>)}
                  </div>
                  <div className="lg-group">
                    <span className="hoa loc">Lộc</span>
                    <span className="hoa quyen">Quyền</span>
                    <span className="hoa khoa">Khoa</span>
                    <span className="hoa ky">Kỵ</span>
                    <span className="tag tuan">Tuần</span>
                    <span className="tag triet">Triệt</span>
                  </div>
                </div>
                <div className="export-row">
                  <button className="btn-export" onClick={handleDownloadChart} disabled={downloadingChart}>
                    {downloadingChart ? '⏳ Đang tạo PDF...' : '📄 Tải PDF lá số'}
                  </button>
                </div>
              </>
            )}

            {tab === 'daihan' && (
              <DaiHanTab result={result} form={form} onStarClick={handleStarClick} onPalaceClick={handlePalaceClick} />
            )}
            {tab === 'tieuHan' && (
              <TieuHanTab result={result} form={form} onStarClick={handleStarClick} onPalaceClick={handlePalaceClick} />
            )}
            {tab === 'ai' && (
              <InterpretTab result={result} form={form} daiHan={getDaiHan(result)} tieuHan={getTieuHan(result, form.year)} />
            )}
          </section>
        )}
      </main>

      {selectedCung && <PalacePanel cung={selectedCung} onClose={() => setSelectedCung(null)} />}
      {selectedStar && <StarModal star={selectedStar} onClose={() => setSelectedStar(null)} />}

      <footer className="app-footer">
        Tử Vi Đẩu Số · Created by TVP
      </footer>
    </div>
  )
}
