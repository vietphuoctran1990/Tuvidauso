import { useState } from 'react'
import { generateLaSo } from 'tuvi-neo'
import type { LaSoResult } from 'tuvi-neo'
import './App.css'

const D_CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tị', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi']
const T_CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý']

// D_CHI index → CSS grid position (1-indexed row, 1-indexed col)
const CHI_GRID: Record<number, [number, number]> = {
  5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4],
  4: [2, 1],                                    9: [2, 4],
  3: [3, 1],                                   10: [3, 4],
  2: [4, 1], 1: [4, 2], 0: [4, 3],            11: [4, 4],
}

// Element index → color/name
const HANH: Record<number, { name: string; color: string; bg: string }> = {
  1: { name: 'Kim', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  2: { name: 'Thủy', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  3: { name: 'Mộc', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  4: { name: 'Hỏa', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  5: { name: 'Thổ', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  'M': { label: 'Miếu', color: '#a855f7' },
  'V': { label: 'Vượng', color: '#22d3ee' },
  'Đ': { label: 'Đắc', color: '#4ade80' },
  'B': { label: 'Bình', color: '#9ca3af' },
  'H': { label: 'Hàm', color: '#f87171' },
}

const GIO_CHI = [
  { value: 0, label: 'Giờ Tý (23h–1h)' },
  { value: 1, label: 'Giờ Sửu (1h–3h)' },
  { value: 2, label: 'Giờ Dần (3h–5h)' },
  { value: 3, label: 'Giờ Mão (5h–7h)' },
  { value: 4, label: 'Giờ Thìn (7h–9h)' },
  { value: 5, label: 'Giờ Tị (9h–11h)' },
  { value: 6, label: 'Giờ Ngọ (11h–13h)' },
  { value: 7, label: 'Giờ Mùi (13h–15h)' },
  { value: 8, label: 'Giờ Thân (15h–17h)' },
  { value: 9, label: 'Giờ Dậu (17h–19h)' },
  { value: 10, label: 'Giờ Tuất (19h–21h)' },
  { value: 11, label: 'Giờ Hợi (21h–23h)' },
]

interface FormData {
  name: string
  gender: 'male' | 'female'
  isLunar: boolean
  year: number
  month: number
  day: number
  gioIndex: number
}

function StarItem({ name, status, hanh, isHoa }: {
  name: string; status?: string; hanh?: number; isHoa?: boolean
}) {
  const h = hanh ? HANH[hanh] : null
  const s = status && STATUS_LABEL[status] ? STATUS_LABEL[status] : null
  return (
    <span
      className={`star-item ${isHoa ? 'star-hoa' : ''}`}
      style={h ? { color: h.color } : undefined}
      title={h ? h.name : ''}
    >
      {name}
      {s && <sup style={{ color: s.color, fontSize: '9px', marginLeft: '1px' }}>{s.label}</sup>}
    </span>
  )
}

function PalaceCell({ cung }: { cung: any }) {
  const chiIdx = D_CHI.indexOf(cung.TieuHan)
  const [row, col] = CHI_GRID[chiIdx] ?? [0, 0]
  const canName = T_CAN[cung.CanCung] ?? ''
  const isLife = cung.Name === 'Mệnh'
  const isBody = cung.Than === 1

  const hoaStars = new Set<string>()
  if (cung.LocNhap) hoaStars.add(cung.LocNhap)
  if (cung.QuyenNhap) hoaStars.add(cung.QuyenNhap)
  if (cung.KhoaNhap) hoaStars.add(cung.KhoaNhap)
  if (cung.KyNhap) hoaStars.add(cung.KyNhap)

  return (
    <div
      className={`palace-cell ${isLife ? 'palace-life' : ''} ${isBody ? 'palace-body' : ''}`}
      style={{ gridRow: row, gridColumn: col }}
    >
      {/* Header */}
      <div className="pc-header">
        <span className="pc-cung-name">{cung.Name}</span>
        <span className="pc-chi">{canName} {cung.TieuHan}</span>
      </div>

      {/* Tags row */}
      <div className="pc-tags">
        {cung.TrangSinh && <span className="tag-trangsinh">{cung.TrangSinh}</span>}
        {cung.Tuan === 1 && <span className="tag-tuan">Tuần</span>}
        {cung.Triet === 1 && <span className="tag-triet">Triệt</span>}
        {isBody && <span className="tag-than">THÂN</span>}
      </div>

      {/* Tứ Hóa inline */}
      {(cung.LocNhap || cung.QuyenNhap || cung.KhoaNhap || cung.KyNhap) && (
        <div className="pc-tuahoa">
          {cung.LocNhap && <span className="hoa hoa-loc" title={`Hóa Lộc: ${cung.LocNhap}`}>Lộc·{cung.LocNhap}</span>}
          {cung.QuyenNhap && <span className="hoa hoa-quyen" title={`Hóa Quyền: ${cung.QuyenNhap}`}>Quyền·{cung.QuyenNhap}</span>}
          {cung.KhoaNhap && <span className="hoa hoa-khoa" title={`Hóa Khoa: ${cung.KhoaNhap}`}>Khoa·{cung.KhoaNhap}</span>}
          {cung.KyNhap && <span className="hoa hoa-ky" title={`Hóa Kỵ: ${cung.KyNhap}`}>Kỵ·{cung.KyNhap}</span>}
        </div>
      )}

      {/* Main stars */}
      {cung.ChinhTinh?.length > 0 && (
        <div className="pc-stars pc-stars-chinh">
          {cung.ChinhTinh.map((s: any, i: number) => (
            <StarItem key={i} name={s.Name} status={s.Status} hanh={s.NguHanh} isHoa={hoaStars.has(s.Name)} />
          ))}
        </div>
      )}

      {/* Auspicious stars */}
      {cung.Saotot?.length > 0 && (
        <div className="pc-stars pc-stars-tot">
          {cung.Saotot.map((s: any, i: number) => (
            <StarItem key={i} name={s.Name} status={s.Status} hanh={s.NguHanh} isHoa={hoaStars.has(s.Name)} />
          ))}
        </div>
      )}

      {/* Inauspicious stars */}
      {cung.Saoxau?.length > 0 && (
        <div className="pc-stars pc-stars-xau">
          {cung.Saoxau.map((s: any, i: number) => (
            <StarItem key={i} name={s.Name} status={s.Status} hanh={s.NguHanh} isHoa={hoaStars.has(s.Name)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ChartCenter({ info, form }: { info: any; form: FormData }) {
  return (
    <div className="chart-center">
      <div className="center-title">TỬ VI ĐẨU SỐ</div>
      <div className="center-name">{form.name || 'Vô danh'}</div>
      <div className="center-gender">{form.gender === 'male' ? 'Nam' : 'Nữ'} · {info.AmDuong}</div>
      <div className="center-divider" />
      <div className="center-row">
        <span className="cl">Năm sinh</span>
        <span className="cv">{info.Nam}</span>
      </div>
      <div className="center-row">
        <span className="cl">Giờ sinh</span>
        <span className="cv">{info.Gio}</span>
      </div>
      <div className="center-row">
        <span className="cl">Lịch</span>
        <span className="cv">{form.isLunar ? 'Âm lịch' : 'Dương lịch'}</span>
      </div>
      <div className="center-divider" />
      <div className="center-row">
        <span className="cl">Cục</span>
        <span className="cv cuc">{info.Cuc}</span>
      </div>
      <div className="center-row">
        <span className="cl">Chủ Mệnh</span>
        <span className="cv">{info.ChuMenh}</span>
      </div>
      <div className="center-row">
        <span className="cl">Chủ Thân</span>
        <span className="cv">{info.ChuThan}</span>
      </div>
      <div className="center-row">
        <span className="cl">Thân cư</span>
        <span className="cv">{info.ThanCu}</span>
      </div>
    </div>
  )
}

export default function App() {
  const [form, setForm] = useState<FormData>({
    name: '', gender: 'male', isLunar: false,
    year: 1990, month: 1, day: 1, gioIndex: 0,
  })
  const [result, setResult] = useState<LaSoResult | null>(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(true)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : ['year', 'month', 'day', 'gioIndex'].includes(name)
          ? Number(value)
          : value,
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const laso = generateLaSo({
        name: form.name || 'Vô danh',
        gender: form.gender,
        birth: {
          isLunar: form.isLunar,
          year: form.year,
          month: form.month,
          day: form.day,
          hour: form.gioIndex * 2,
        },
      })
      setResult(laso)
      setShowForm(false)
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi tính lá số.')
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-symbol">☯</div>
        <h1>Tử Vi Đẩu Số</h1>
        <p className="header-sub">Lá số tử vi trực tuyến · Tính chính xác theo phương pháp cổ truyền</p>
      </header>

      <main className="app-main">
        {/* Form toggle */}
        {result && (
          <div className="form-toggle-bar">
            <button className="btn-toggle" onClick={() => setShowForm(v => !v)}>
              {showForm ? '▲ Ẩn form' : '▼ Sửa thông tin'}
            </button>
          </div>
        )}

        {/* Input Form */}
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

        {/* Chart */}
        {result && (
          <section className="chart-section">
            {/* Traditional 4×4 grid */}
            <div className="chart-grid">
              {result.Cac_cung.map((cung: any, i: number) => (
                <PalaceCell key={i} cung={cung} />
              ))}
              <ChartCenter info={result.Info} form={form} />
            </div>

            {/* Legend */}
            <div className="legend">
              <div className="legend-group">
                <strong>Ngũ hành:</strong>
                {Object.entries(HANH).map(([k, v]) => (
                  <span key={k} style={{ color: v.color }} className="legend-item">● {v.name}</span>
                ))}
              </div>
              <div className="legend-group">
                <strong>Trạng thái:</strong>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <span key={k} style={{ color: v.color }} className="legend-item">{k}={v.label}</span>
                ))}
              </div>
              <div className="legend-group">
                <strong>Tứ Hóa:</strong>
                <span className="hoa hoa-loc">Lộc</span>
                <span className="hoa hoa-quyen">Quyền</span>
                <span className="hoa hoa-khoa">Khoa</span>
                <span className="hoa hoa-ky">Kỵ</span>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        Tử Vi Đẩu Số · Powered by <a href="https://github.com/implicit-invocation/tuvi-neo" target="_blank" rel="noreferrer">tuvi-neo</a>
      </footer>
    </div>
  )
}
