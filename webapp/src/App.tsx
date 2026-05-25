import { useState } from 'react'
import { generateLaSo } from 'tuvi-neo'
import type { LaSoResult } from 'tuvi-neo'
import './App.css'

interface FormData {
  name: string
  gender: 'male' | 'female'
  isLunar: boolean
  year: number
  month: number
  day: number
  hour: number
}

const HOURS = [
  { value: 0, label: '00:00 - Tý (23h-1h)' },
  { value: 1, label: '01:00 - Sửu (1h-3h)' },
  { value: 2, label: '03:00 - Dần (3h-5h)' },
  { value: 3, label: '05:00 - Mão (5h-7h)' },
  { value: 4, label: '07:00 - Thìn (7h-9h)' },
  { value: 5, label: '09:00 - Tị (9h-11h)' },
  { value: 6, label: '11:00 - Ngọ (11h-13h)' },
  { value: 7, label: '13:00 - Mùi (13h-15h)' },
  { value: 8, label: '15:00 - Thân (15h-17h)' },
  { value: 9, label: '17:00 - Dậu (17h-19h)' },
  { value: 10, label: '19:00 - Tuất (19h-21h)' },
  { value: 11, label: '21:00 - Hợi (21h-23h)' },
]

function StarBadge({ name, type }: { name: string; type: 'chinh' | 'tot' | 'xau' }) {
  return (
    <span className={`star-badge star-${type}`}>{name}</span>
  )
}

function PalaceCard({ cung, index }: { cung: any; index: number }) {
  return (
    <div className={`palace-card ${cung.Than ? 'than-palace' : ''}`}>
      <div className="palace-header">
        <span className="palace-index">{index + 1}</span>
        <span className="palace-name">{cung.Name}</span>
        {cung.Than ? <span className="than-badge">THÂN</span> : null}
      </div>
      {cung.TrangSinh && (
        <div className="palace-trangsinh">{cung.TrangSinh}</div>
      )}
      <div className="palace-stars">
        {cung.ChinhTinh?.map((s: any, i: number) => (
          <StarBadge key={i} name={s.Name} type="chinh" />
        ))}
        {cung.Saotot?.map((s: any, i: number) => (
          <StarBadge key={i} name={s.Name} type="tot" />
        ))}
        {cung.Saoxau?.map((s: any, i: number) => (
          <StarBadge key={i} name={s.Name} type="xau" />
        ))}
      </div>
      <div className="palace-tuahoa">
        {cung.LocNhap ? <span className="tuahoa loc">Lộc</span> : null}
        {cung.KyNhap ? <span className="tuahoa ky">Kỵ</span> : null}
        {cung.QuyenNhap ? <span className="tuahoa quyen">Quyền</span> : null}
        {cung.KhoaNhap ? <span className="tuahoa khoa">Khoa</span> : null}
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="info-card">
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  )
}

export default function App() {
  const [form, setForm] = useState<FormData>({
    name: '',
    gender: 'male',
    isLunar: false,
    year: 1990,
    month: 1,
    day: 1,
    hour: 0,
  })
  const [result, setResult] = useState<LaSoResult | null>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : type === 'number' || name === 'year' || name === 'month' || name === 'day' || name === 'hour'
          ? Number(value)
          : value,
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const laso = generateLaSo({
        name: form.name || 'Không tên',
        gender: form.gender,
        birth: {
          isLunar: form.isLunar,
          year: form.year,
          month: form.month,
          day: form.day,
          hour: form.hour * 2,
        },
      })
      setResult(laso)
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi tính lá số.')
    } finally {
      setLoading(false)
    }
  }

  const raw = result?.getRawData() as any

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-icon">☯</div>
        <h1>Lá Số Tử Vi</h1>
        <p className="subtitle">Tử Vi Đẩu Số · Xem lá số tử vi trực tuyến</p>
      </header>

      <main className="app-main">
        <section className="form-section">
          <form onSubmit={handleSubmit} className="birth-form">
            <h2>Nhập thông tin</h2>

            <div className="form-group">
              <label>Họ và tên</label>
              <input
                type="text"
                name="name"
                placeholder="Nguyễn Văn A"
                value={form.name}
                onChange={handleChange}
              />
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
                <label>Lịch</label>
                <select
                  name="isLunar"
                  value={form.isLunar ? 'true' : 'false'}
                  onChange={e => setForm(p => ({ ...p, isLunar: e.target.value === 'true' }))}
                >
                  <option value="false">Dương lịch</option>
                  <option value="true">Âm lịch</option>
                </select>
              </div>
            </div>

            <div className="form-row three">
              <div className="form-group">
                <label>Năm sinh</label>
                <input
                  type="number"
                  name="year"
                  min={1900}
                  max={2100}
                  value={form.year}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Tháng</label>
                <input
                  type="number"
                  name="month"
                  min={1}
                  max={12}
                  value={form.month}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Ngày</label>
                <input
                  type="number"
                  name="day"
                  min={1}
                  max={31}
                  value={form.day}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Giờ sinh</label>
              <select name="hour" value={form.hour} onChange={handleChange}>
                {HOURS.map(h => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Đang tính...' : '✨ Xem lá số'}
            </button>
          </form>
        </section>

        {error && (
          <div className="error-box">{error}</div>
        )}

        {result && raw && (
          <section className="result-section">
            <div className="result-header">
              <h2>LÁ SỐ TỬ VI</h2>
              <p className="result-name">{raw.Ten} · {raw.GioiTinh === 1 ? 'Nam' : 'Nữ'}</p>
            </div>

            <div className="info-grid">
              <InfoCard label="Năm sinh" value={result.Info.Nam} />
              <InfoCard label="Giờ sinh" value={result.Info.Gio} />
              <InfoCard label="Âm dương" value={result.Info.AmDuong} />
              <InfoCard label="Cục" value={result.Info.Cuc} />
              <InfoCard label="Chủ Mệnh" value={result.Info.ChuMenh} />
              <InfoCard label="Chủ Thân" value={result.Info.ChuThan} />
              <InfoCard label="Thân cư" value={result.Info.ThanCu} />
            </div>

            <h3 className="palaces-title">12 Cung</h3>
            <div className="palaces-grid">
              {result.Cac_cung.map((cung: any, i: number) => (
                <PalaceCard key={i} cung={cung} index={i} />
              ))}
            </div>

            <div className="legend">
              <span className="star-badge star-chinh">Chính tinh</span>
              <span className="star-badge star-tot">Sao tốt</span>
              <span className="star-badge star-xau">Sao xấu</span>
            </div>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>Tử Vi Đẩu Số · Powered by <a href="https://github.com/implicit-invocation/tuvi-neo" target="_blank" rel="noreferrer">tuvi-neo</a></p>
      </footer>
    </div>
  )
}
