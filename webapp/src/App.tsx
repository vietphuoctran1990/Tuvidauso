import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react'
import { generateLaSo } from 'tuvi-neo'
import type { LaSoResult } from 'tuvi-neo'
import { STAR_INFO, PALACE_INFO, TRANG_SINH_INFO } from './starInfo'
import { exportChartPDF, exportAnalysisPrint } from './pdfExport'
import { VN_PROVINCES, trueSolarGioIndex } from './provinces'

import './App.css'

// ── Mystical interaction effects ────────────────────────────────────────────
const MP_SYMBOLS = ['✦', '✧', '⋆', '⊹', '✴', '◈', '◆', '⬡', '⊛', '✵']
const MP_COLORS  = ['#d4af37', '#a855f7', '#22d3ee', '#f0abfc', '#fde68a', '#c084fc']

function burstParticles(e: React.MouseEvent, count = 9) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span')
    s.className = 'mp'
    s.textContent = MP_SYMBOLS[Math.floor(Math.random() * MP_SYMBOLS.length)]
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.7
    const dist  = 45 + Math.random() * 85
    s.style.cssText = [
      `left:${e.clientX}px`,
      `top:${e.clientY}px`,
      `--dx:${(Math.cos(angle) * dist).toFixed(1)}px`,
      `--dy:${(Math.sin(angle) * dist - 35).toFixed(1)}px`,
      `--rot:${(Math.random() * 720 - 360).toFixed(0)}deg`,
      `color:${MP_COLORS[Math.floor(Math.random() * MP_COLORS.length)]}`,
      `font-size:${(10 + Math.floor(Math.random() * 11))}px`,
    ].join(';')
    document.body.appendChild(s)
    s.addEventListener('animationend', () => s.remove())
  }
}

function createRipple(e: React.MouseEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect()
  const d = document.createElement('div')
  d.className = 'ripple-effect'
  d.style.cssText = `left:${e.clientX - rect.left}px;top:${e.clientY - rect.top}px`
  e.currentTarget.appendChild(d)
  d.addEventListener('animationend', () => d.remove())
}

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

// Tam hợp groups: each group is 3 chi indices
const TAM_HOP_GROUPS: number[][] = [
  [2, 6, 10],  // Dần, Ngọ, Tuất
  [11, 3, 7],  // Hợi, Mão, Mùi
  [8, 0, 4],   // Thân, Tý, Thìn
  [5, 9, 1],   // Tị, Dậu, Sửu
]

// Xung pairs: index i xung with i+6
const XUNG_PAIRS: [number, number][] = [
  [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]
]

// Annual stars config
interface AnnualStarConfig {
  name: string; icon: string; color: string; offset: number
}
const ANNUAL_STARS: AnnualStarConfig[] = [
  { name: 'Thái Tuế',    icon: '☉', color: '#f59e0b', offset: 0 },
  { name: 'Tang Môn',    icon: '✦', color: '#6b7280', offset: 2 },
  { name: 'Quan Phù',    icon: '⚖', color: '#3b82f6', offset: 4 },
  { name: 'Tuế Phá',     icon: '⚡', color: '#ef4444', offset: 6 },
  { name: 'Long Đức',    icon: '🐉', color: '#10b981', offset: 7 },
  { name: 'Bạch Hổ',     icon: '⚔', color: '#dc2626', offset: 8 },
  { name: 'Phúc Đức',    icon: '✿', color: '#8b5cf6', offset: 9 },
  { name: 'Điếu Khách',  icon: '♦', color: '#64748b', offset: 10 },
]

// Year options for selects (1950–2080) — constant, built once
const YEAR_OPTIONS: number[] = Array.from({ length: 131 }, (_, i) => 1950 + i)

type Tab = 'laso' | 'daihan' | 'tieuHan' | 'ai'

interface FormData {
  name: string; gender: 'male'|'female'; isLunar: boolean
  year: number; month: number; day: number; gioIndex: number
  // Giờ mặt trời thật (tùy chọn): tỉnh sinh + giờ:phút đồng hồ
  province: string; clockTime: string
}

// Tính giờ hiệu chỉnh từ form. Nếu có đủ tỉnh + giờ:phút → dùng giờ mặt trời thật,
// ngược lại dùng Giờ (Chi) người dùng tự chọn.
function resolveGio(form: FormData): { gioIndex: number; corrected: boolean; correctionMin: number } {
  const prov = VN_PROVINCES.find(p => p.key === form.province)
  const m = form.clockTime.match(/^(\d{1,2}):(\d{2})$/)
  if (prov && m) {
    const hour = Math.min(23, Math.max(0, Number(m[1])))
    const minute = Math.min(59, Math.max(0, Number(m[2])))
    const { gioIndex, correctionMin } = trueSolarGioIndex(hour, minute, prov.lon, form.month, form.day)
    return { gioIndex, corrected: true, correctionMin }
  }
  return { gioIndex: form.gioIndex, corrected: false, correctionMin: 0 }
}

interface SelectedStar { name: string; status?: string; hanh?: number }

interface SavedChart {
  id: string; label: string; savedAt: number; form: FormData
}

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

// Compute tam hop / xung chi indices for a given chi index
function computeRelations(chiIdx: number): { tamHop: number[]; xung: number | null } {
  const group = TAM_HOP_GROUPS.find(g => g.includes(chiIdx))
  const tamHop = group ? group.filter(i => i !== chiIdx) : []
  let xung: number | null = null
  for (const [a, b] of XUNG_PAIRS) {
    if (a === chiIdx) { xung = b; break }
    if (b === chiIdx) { xung = a; break }
  }
  return { tamHop, xung }
}

// Compute annual stars positions for a given year
function getAnnualStarsForYear(year: number): Record<number, { name: string; icon: string; color: string }[]> {
  const yearChi = ((year - 4) % 12 + 12) % 12
  const result: Record<number, { name: string; icon: string; color: string }[]> = {}
  for (const star of ANNUAL_STARS) {
    const pos = (yearChi + star.offset) % 12
    if (!result[pos]) result[pos] = []
    result[pos].push({ name: star.name, icon: star.icon, color: star.color })
  }
  return result
}

// Tứ Hóa table indexed by Thiên Can (0=Giáp … 9=Quý)
const TU_HOA_BY_CAN = [
  { loc: 'Liêm trinh',  quyen: 'Phá quân',    khoa: 'Vũ khúc',     ky: 'Thái dương'  }, // Giáp
  { loc: 'Thiên cơ',    quyen: 'Thiên lương',  khoa: 'Tử vi',       ky: 'Thái âm'     }, // Ất
  { loc: 'Thiên đồng',  quyen: 'Thiên cơ',     khoa: 'Văn xương',   ky: 'Liêm trinh'  }, // Bính
  { loc: 'Thái âm',     quyen: 'Thiên đồng',   khoa: 'Thiên cơ',    ky: 'Cự môn'      }, // Đinh
  { loc: 'Tham lang',   quyen: 'Thái âm',      khoa: 'Hữu bật',     ky: 'Thiên cơ'    }, // Mậu
  { loc: 'Vũ khúc',     quyen: 'Tham lang',    khoa: 'Thiên lương', ky: 'Văn khúc'    }, // Kỷ
  { loc: 'Thái dương',  quyen: 'Vũ khúc',      khoa: 'Thái âm',     ky: 'Thiên đồng'  }, // Canh
  { loc: 'Cự môn',      quyen: 'Thái dương',   khoa: 'Văn khúc',    ky: 'Văn xương'   }, // Tân
  { loc: 'Thiên lương', quyen: 'Tử vi',        khoa: 'Tả phù',      ky: 'Vũ khúc'     }, // Nhâm
  { loc: 'Phá quân',    quyen: 'Cự môn',       khoa: 'Thái âm',     ky: 'Tham lang'   }, // Quý
]

// Compute Tứ Hóa for a given Can index — finds which palace each transforming star lands in
function computeTuHoaForCan(canIdx: number, rawCungs: any[]) {
  const th = TU_HOA_BY_CAN[canIdx]
  if (!th) return null
  const findPalace = (starName: string): string => {
    const low = starName.toLowerCase()
    for (const c of rawCungs) {
      const names: string[] = [
        ...(c.ChinhTinh ?? []).map((s: any) => (s.Name as string).toLowerCase()),
        ...(c.Saotot   ?? []).map((s: any) => (s.Name as string).toLowerCase()),
        ...(c.Saoxau   ?? []).map((s: any) => (s.Name as string).toLowerCase()),
      ]
      if (names.includes(low)) return c.Name as string
    }
    return '—'
  }
  return {
    can:   T_CAN[canIdx],
    loc:   { star: th.loc,   palace: findPalace(th.loc)   },
    quyen: { star: th.quyen, palace: findPalace(th.quyen) },
    khoa:  { star: th.khoa,  palace: findPalace(th.khoa)  },
    ky:    { star: th.ky,    palace: findPalace(th.ky)    },
  }
}

// Tự Hóa (自化): sao nằm trong cung tự hóa theo Can của chính cung đó.
// Với mỗi cung, lấy Can cung → bộ Tứ Hóa của Can → nếu sao hóa nằm ngay trong
// cung này thì cung "tự hóa" loại đó (Lộc/Quyền/Khoa/Kỵ).
const TU_HOA_KEYS: [keyof typeof TU_HOA_BY_CAN[number], string][] = [
  ['loc', 'Lộc'], ['quyen', 'Quyền'], ['khoa', 'Khoa'], ['ky', 'Kỵ'],
]

function detectTuHoaForPalace(rawCung: any): { type: string; star: string }[] {
  const th = TU_HOA_BY_CAN[rawCung.CanCung]
  if (!th) return []
  const ownStars: string[] = [
    ...(rawCung.ChinhTinh ?? []).map((s: any) => (s.Name as string).toLowerCase()),
    ...(rawCung.Saotot   ?? []).map((s: any) => (s.Name as string).toLowerCase()),
    ...(rawCung.Saoxau   ?? []).map((s: any) => (s.Name as string).toLowerCase()),
  ]
  const out: { type: string; star: string }[] = []
  for (const [key, label] of TU_HOA_KEYS) {
    const star = th[key]
    if (ownStars.includes(star.toLowerCase())) out.push({ type: label, star })
  }
  return out
}

// Detect Cách Cục patterns from raw palace data
function detectCachCuc(rawCungs: any[]): string[] {
  const found: string[] = []
  const menhC = rawCungs.find((c: any) => c.Name === 'Mệnh')
  if (!menhC) return found

  const getN = (c: any): string[] => [
    ...(c.ChinhTinh ?? []).map((s: any) => (s.Name as string).toLowerCase()),
    ...(c.Saotot   ?? []).map((s: any) => (s.Name as string).toLowerCase()),
    ...(c.Saoxau   ?? []).map((s: any) => (s.Name as string).toLowerCase()),
  ]
  const mS  = getN(menhC)
  const inM = (n: string) => mS.includes(n.toLowerCase())
  const inC = (c: any, n: string) => getN(c).includes(n.toLowerCase())

  const mIdx = D_CHI.indexOf(menhC.TieuHan)
  const adjL = rawCungs.find((c: any) => c.TieuHan === D_CHI[(mIdx - 1 + 12) % 12])
  const adjR = rawCungs.find((c: any) => c.TieuHan === D_CHI[(mIdx + 1) % 12])
  const xungC = rawCungs.find((c: any) => c.TieuHan === D_CHI[(mIdx + 6) % 12])

  // Hung cách
  if (inM('kình dương')) found.push('Kình Dương tọa Mệnh — cứng rắn quyết đoán, dễ gặp tai họa sát thương')
  if (inM('đà la'))      found.push('Đà La tọa Mệnh — nhiều trắc trở, hay trì hoãn, chậm thành công')

  const mK = inM('địa không'); const mKp = inM('địa kiếp')
  if (mK && mKp)     found.push('Không Kiếp đồng cung Mệnh — đại hung, tán tài phá nghiệp')
  else if (mK)       found.push('Địa Không tọa Mệnh — tổn tài, khó giữ của cải lâu dài')
  else if (mKp)      found.push('Địa Kiếp tọa Mệnh — hao tài, tai họa bất ngờ')

  if (!mK && !mKp && adjL && adjR) {
    const lH = inC(adjL, 'địa không') || inC(adjL, 'địa kiếp')
    const rH = inC(adjR, 'địa không') || inC(adjR, 'địa kiếp')
    if (lH && rH) found.push('Không Kiếp giáp Mệnh — hai cung kề kẹp Mệnh, tiêu tán tài lộc')
  }

  const hoa = inM('hỏa tinh'); const linh = inM('linh tinh')
  if (hoa && linh) found.push('Hỏa Linh đồng cung Mệnh — hung cách, nóng nảy, tai họa đột ngột')
  else if (hoa)    found.push('Hỏa Tinh tọa Mệnh — tính nóng, dễ bị tổn thương đột ngột')
  else if (linh)   found.push('Linh Tinh tọa Mệnh — hay gặp biến cố bất ngờ')

  if (inM('thiên khốc') && inM('thiên hư')) found.push('Thiên Khốc Thiên Hư đồng cung Mệnh — hay lo âu, cô đơn nội tâm')
  if (inM('cô thần') || inM('quả tú'))      found.push('Cô Thần/Quả Tú tọa Mệnh — cô đơn, hôn nhân dễ trắc trở')

  // Cát cách
  for (const c of rawCungs) {
    if (getN(c).includes('lộc tồn') && c.LocNhap)
      found.push(`Song Lộc tại ${c.Name} — Lộc Tồn + Hóa Lộc đồng cung, đại phú`)
  }
  for (const c of rawCungs) {
    const s = getN(c)
    if (s.includes('lộc tồn') && s.includes('thiên mã'))
      found.push(`Lộc Mã Giao Trì tại ${c.Name} — Lộc Tồn + Thiên Mã, phú quý phát xa`)
  }

  const vX = inM('văn xương'); const vK = inM('văn khúc')
  if (vX && vK) found.push('Song Văn tọa Mệnh — Văn Xương + Văn Khúc, học rộng văn chương xuất sắc')
  else if (vX)  found.push('Văn Xương tọa Mệnh — thông minh, học giỏi, văn chương')
  else if (vK)  found.push('Văn Khúc tọa Mệnh — tài nghệ, nghệ thuật, khéo léo')

  const kh = inM('thiên khôi'); const vi = inM('thiên việt')
  if (kh && vi) found.push('Khôi Việt đồng cung Mệnh — quý nhân phù trợ mạnh, công danh hanh thông')
  else if (kh)  found.push('Thiên Khôi tọa Mệnh — được quý nhân đỡ đầu, dễ thăng tiến')
  else if (vi)  found.push('Thiên Việt tọa Mệnh — quý nhân hỗ trợ sự nghiệp')

  const ta = inM('tả phù'); const hu = inM('hữu bật')
  if (ta && hu) found.push('Tả Hữu đồng cung Mệnh — nhiều người giúp đỡ, lãnh đạo tốt')

  if (xungC) {
    const xS = getN(xungC)
    const tdM = inM('thái dương'); const taX = xS.includes('thái âm')
    const taM = inM('thái âm');   const tdX = xS.includes('thái dương')
    if ((tdM && taX) || (taM && tdX)) found.push('Nhật Nguyệt chiếu Mệnh — Thái Dương & Thái Âm soi rọi, sáng láng minh tuệ')
  }

  const tuViS = menhC.ChinhTinh?.find((s: any) => (s.Name as string).toLowerCase() === 'tử vi')
  if (tuViS && ['M','V'].includes(tuViS.Status)) found.push('Tử Vi Miếu/Vượng tọa Mệnh — đế tinh vượng địa, uy quyền lãnh đạo')

  const phuS = menhC.ChinhTinh?.find((s: any) => (s.Name as string).toLowerCase() === 'thiên phủ')
  if (phuS && ['M','V','Đ'].includes(phuS.Status)) found.push('Thiên Phủ Miếu/Vượng tọa Mệnh — phú tinh, giàu có, biết tích lũy')

  return found
}

// Compute DH fortune score
function computeDhScore(dh: any): number {
  let score = 5
  const cung = dh.cung
  if (!cung) return score

  // TrangSinh
  const ts = cung.TrangSinh ?? ''
  if (ts === 'Trường Sinh' || ts === 'Đế Vượng') score += 3
  else if (ts === 'Quan Đới' || ts === 'Lâm Quan') score += 2
  else if (ts === 'Mộc Dục' || ts === 'Dưỡng') score += 1
  else if (ts === 'Suy') score -= 1
  else if (ts === 'Bệnh') score -= 2
  else if (ts === 'Tử' || ts === 'Tuyệt') score -= 3
  else if (ts === 'Mộ') score -= 2

  // Tứ Hóa
  if (cung.LocNhap) score += 3
  if (cung.QuyenNhap) score += 2
  if (cung.KhoaNhap) score += 1
  if (cung.KyNhap) score -= 3

  // Stars
  const totStars = (cung.Saotot ?? []).length
  const xauStars = (cung.Saoxau ?? []).length
  score += Math.min(3, totStars * 0.5)
  score -= Math.min(3, xauStars * 0.5)

  // Tuần/Triệt
  if (cung.Tuan === 1 || cung.Triet === 1) score -= 2

  return Math.max(1, Math.min(10, Math.round(score)))
}

// ── Build chart data for AI ────────────────────────────────────────────────
function buildChartData(result: LaSoResult, form: FormData, daiHan: any[], tieuHan: any[], targetYear?: number) {
  const currentYear = targetYear ?? new Date().getFullYear()
  const age = currentYear - form.year
  const currentDH = daiHan.find(dh => age >= dh.startAge && age <= dh.endAge)
  const currentTH = tieuHan.find(th => th.years.includes(currentYear))
  const rawCungs = result.Cac_cung as any[]

  // Annual stars (Thái Tuế, Tang Môn, etc.) mapped to palace names
  const annualByPos = getAnnualStarsForYear(currentYear)
  const annualStars: Record<string, string[]> = {}
  for (const c of rawCungs) {
    const chiIdx = D_CHI.indexOf(c.TieuHan)
    const stars = annualByPos[chiIdx]
    if (stars?.length) annualStars[c.Name] = stars.map(s => s.name)
  }

  // Tam hợp / xung for cung Mệnh
  const menhRaw = rawCungs.find((c: any) => c.Name === 'Mệnh')
  const mIdx = menhRaw ? D_CHI.indexOf(menhRaw.TieuHan) : -1
  const mRels = mIdx >= 0 ? computeRelations(mIdx) : null
  const menhRelations = mRels ? {
    menhChi: D_CHI[mIdx],
    tamHop: mRels.tamHop.map(i => ({ chi: D_CHI[i], cungName: rawCungs.find((c: any) => c.TieuHan === D_CHI[i])?.Name ?? '' })),
    xung: mRels.xung !== null ? { chi: D_CHI[mRels.xung], cungName: rawCungs.find((c: any) => c.TieuHan === D_CHI[mRels.xung!])?.Name ?? '' } : null,
  } : null

  // Tứ Hóa for current Đại Hạn (using that cung's Can)
  const tuHoaDH = currentDH?.cung?.CanCung !== undefined
    ? computeTuHoaForCan(currentDH.cung.CanCung, rawCungs) : null

  // Tứ Hóa for current year (using year's Can)
  const yearCanIdx = ((currentYear - 4) % 10 + 10) % 10
  const tuHoaNam = computeTuHoaForCan(yearCanIdx, rawCungs)

  // Auto-detected Cách Cục
  const cachCuc = detectCachCuc(rawCungs)

  // Tự Hóa per palace + tổng hợp danh sách
  const tuHoaList: string[] = []
  for (const c of rawCungs) {
    const th = detectTuHoaForPalace(c)
    for (const t of th) tuHoaList.push(`${c.Name} (Can ${T_CAN[c.CanCung] ?? '?'}): Tự Hóa ${t.type} — ${t.star}`)
  }

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
    palaces: rawCungs.map((c: any) => ({
      name: c.Name, tieuHan: c.TieuHan,
      canCung: T_CAN[c.CanCung] ?? '',
      isLife: c.Name === 'Mệnh', isBody: c.Than === 1,
      trangSinh: c.TrangSinh, tuan: c.Tuan === 1, triet: c.Triet === 1,
      locNhap: c.LocNhap, quyenNhap: c.QuyenNhap, khoaNhap: c.KhoaNhap, kyNhap: c.KyNhap,
      annualStars: annualStars[c.Name] ?? [],
      tuHoa: detectTuHoaForPalace(c),
      chinhTinh: (c.ChinhTinh ?? []).map((s: any) => ({ name: s.Name, status: s.Status })),
      saotot:    (c.Saotot   ?? []).map((s: any) => ({ name: s.Name, status: s.Status })),
      saoxau:    (c.Saoxau   ?? []).map((s: any) => ({ name: s.Name })),
    })),
    daiHan: daiHan.map(dh => {
      const canIdx = dh.cung?.CanCung ?? -1
      return {
        startAge: dh.startAge, endAge: dh.endAge,
        cungName: dh.cung?.Name ?? '', chiName: dh.chiName,
        canCung: T_CAN[canIdx] ?? '',
        trangSinh: dh.cung?.TrangSinh ?? '',
        locNhap: dh.cung?.LocNhap, quyenNhap: dh.cung?.QuyenNhap,
        khoaNhap: dh.cung?.KhoaNhap, kyNhap: dh.cung?.KyNhap,
        dhTuHoa: canIdx >= 0 ? computeTuHoaForCan(canIdx, rawCungs) : null,
        chinhTinh: (dh.cung?.ChinhTinh ?? []).map((s: any) => s.Name),
        saotot:    (dh.cung?.Saotot   ?? []).slice(0, 8).map((s: any) => s.Name),
        saoxau:    (dh.cung?.Saoxau   ?? []).slice(0, 5).map((s: any) => s.Name),
      }
    }),
    tieuHan: tieuHan.map(th => {
      const thCanIdx = ((th.years[0] + (th.age ?? 0) - 4) % 10 + 10) % 10
      return {
        yearChi: th.yearChi, chiName: th.chiName,
        cungName: th.cung?.Name ?? '', years: th.years,
        locNhap: th.cung?.LocNhap, quyenNhap: th.cung?.QuyenNhap,
        khoaNhap: th.cung?.KhoaNhap, kyNhap: th.cung?.KyNhap,
        thTuHoa: computeTuHoaForCan(thCanIdx, rawCungs),
        chinhTinh: (th.cung?.ChinhTinh ?? []).map((s: any) => s.Name),
        saotot: (th.cung?.Saotot ?? []).slice(0, 6).map((s: any) => s.Name),
        saoxau: (th.cung?.Saoxau ?? []).slice(0, 4).map((s: any) => s.Name),
      }
    }),
    currentYear,
    annualStars,
    menhRelations,
    tuHoaDH,
    tuHoaNam,
    cachCuc,
    tuHoaList,
    currentDH: currentDH ? {
      startAge: currentDH.startAge, endAge: currentDH.endAge,
      cungName: currentDH.cung?.Name ?? '',
      canCung: T_CAN[currentDH.cung?.CanCung ?? -1] ?? '',
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
  // Escape HTML first (AI-generated text), then apply **bold** markdown
  const esc = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return esc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
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
          <button className="btn-close" onClick={e => { createRipple(e); onClose() }}>✕</button>
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
function InterpretTab({ result, form, daiHan, tieuHan, initialYear, onYearChange }: {
  result: LaSoResult; form: FormData; daiHan: any[]; tieuHan: any[]
  initialYear?: number; onYearChange?: (y: number) => void
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [toast, setToast] = useState('')
  const [targetYear, setTargetYear] = useState<number>(initialYear ?? new Date().getFullYear())
  useEffect(() => {
    if (initialYear !== undefined) setTargetYear(initialYear)
  }, [initialYear])

  const sectionMatches = text.match(/^## .+/gm) ?? []
  const sectionCount = sectionMatches.length
  const lastSection = sectionMatches.length > 0 ? sectionMatches[sectionMatches.length - 1].replace(/^## /, '') : ''

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function handleShare() {
    const title = `Lá số Tử Vi của ${form.name || 'bạn'}`
    const shareText = text.replace(/##\s*/g, '\n\n').replace(/\*\*/g, '')
    if (navigator.share) {
      try { await navigator.share({ title, text: `${title}\n\n${shareText}` }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${title}\n\n${shareText}`)
      showToast('Đã sao chép bài luận giải vào clipboard!')
    }
  }

  function handleDownloadAnalysis() {
    const el = document.querySelector('.interpret-result') as HTMLElement
    if (!el) return
    exportAnalysisPrint(el, form.name)
  }

  async function startAiAnalysis() {
    setLoading(true); setDone(false); setText(''); setError('')
    const chartData = buildChartData(result, form, daiHan, tieuHan, targetYear)
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

  function handleAnalyze() {
    if (loading) return
    startAiAnalysis()
  }

  return (
    <div className="interpret-tab">
      {!text && !loading && !error && (
        <div className="interpret-start">
          <div className="is-icon deepseek-icon">🐋</div>
          <h2>Phân Tích Lá Số</h2>
          <p>Luận giải lá số của <strong>{form.name || 'bạn'}</strong> — tính cách, sự nghiệp, tài chính, tình duyên, sức khỏe, đại hạn và tiểu hạn.</p>

          <div className="year-picker-row">
            <label className="year-picker-label">Xem vận năm:</label>
            <select
              className="year-picker-select"
              value={targetYear}
              onChange={e => {
                const y = Number(e.target.value)
                setTargetYear(y)
                onYearChange?.(y)
              }}
            >
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button
            className="btn-analyze btn-analyze-deepseek"
            onClick={e => { createRipple(e); burstParticles(e, 16); handleAnalyze() }}
          >
            🐋 Phân tích chuyên sâu
          </button>
          <p className="is-note">Năm {targetYear} · DeepSeek V3 · 17 mục chi tiết</p>
        </div>
      )}

      {loading && !text && (
        <div className="interpret-loading">
          <div className="spin-container"><span className="spin-sym">☯</span></div>
          <p>Đang phân tích lá số tử vi...</p>
          <p className="load-sub">DeepSeek V3 đang phân tích các sao và tổng hợp kết quả...</p>
        </div>
      )}

      {loading && text && sectionCount > 0 && (
        <div className="progress-indicator">
          Đang viết: mục {sectionCount}/17 — <em>{lastSection}</em>
        </div>
      )}

      {text && (
        <div className="interpret-result">
          <div className="interpret-year-badge badge-deepseek">
            🐋 DeepSeek V3 · Năm {targetYear}
          </div>
          <MdText text={text} />
          {loading && <span className="cursor-blink">▌</span>}
        </div>
      )}

      {error && (
        <div className="interpret-error">
          <strong>Lỗi:</strong> {error}<br />
          {(error.includes('API key') || error.includes('authentication')) && (
            <span>Nhấn <strong>Đổi API key</strong> bên dưới để cập nhật key.</span>
          )}
        </div>
      )}

      {(done || error) && (
        <div className="interpret-actions">
          <button
            className="btn-reanalyze"
            disabled={loading}
            onClick={e => { createRipple(e); handleAnalyze() }}
          >
            🔄 Phân tích lại
          </button>
          {done && error === '' && (
            <>
              <button className="btn-share" onClick={e => { createRipple(e); handleShare() }}>🔗 Chia sẻ</button>
              <button className="btn-export" onClick={e => { createRipple(e); handleDownloadAnalysis() }}>🖨️ In / Lưu PDF</button>
            </>
          )}
        </div>
      )}

      {toast && <div className="share-toast">{toast}</div>}
    </div>
  )
}

// ── StarBadge ───────────────────────────────────────────────────────────────
const StarBadge = memo(function StarBadge({ name, status, hanh, isHoa, onClick }: {
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
})

// ── Palace Cell ─────────────────────────────────────────────────────────────
const PalaceCell = memo(function PalaceCell({ cung, isSelected, onClick, onStarClick, palaceHighlight, annualStars, showAnnualStars }: {
  cung: any; isSelected: boolean; onClick: (cung: any) => void
  onStarClick: (name: string, status?: string, hanh?: number) => void
  palaceHighlight?: 'tamhop' | 'xung'
  annualStars?: { name: string; icon: string; color: string }[]
  showAnnualStars?: boolean
}) {
  const chiIdx = D_CHI.indexOf(cung.TieuHan)
  const [row, col] = CHI_GRID[chiIdx] ?? [0, 0]
  const canName = T_CAN[cung.CanCung] ?? ''
  const isLife = cung.Name === 'Mệnh'
  const isBody = cung.Than === 1
  const hoaStars = new Set<string>([cung.LocNhap, cung.QuyenNhap, cung.KhoaNhap, cung.KyNhap].filter(Boolean))
  const primaryElem = cung.ChinhTinh?.[0]?.NguHanh ?? 0
  const tuHoa = detectTuHoaForPalace(cung)

  const starClick = (s: any) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onStarClick(s.Name, s.Status, s.NguHanh)
  }

  let highlightClass = ''
  if (isSelected) highlightClass = 'palace-selected'
  else if (palaceHighlight === 'tamhop') highlightClass = 'palace-tamhop'
  else if (palaceHighlight === 'xung') highlightClass = 'palace-xung'

  return (
    <div
      className={`palace-cell elem-${primaryElem}${isLife ? ' palace-life' : ''}${isBody ? ' palace-body' : ''} ${highlightClass}`}
      style={{ gridRow: row, gridColumn: col }}
      onClick={() => onClick(cung)}
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

      {tuHoa.length > 0 && (
        <div className="pc-tuhoa">
          {tuHoa.map((t, i) => (
            <span key={i} className={`tuhoa ${t.type === 'Lộc' ? 'loc' : t.type === 'Quyền' ? 'quyen' : t.type === 'Khoa' ? 'khoa' : 'ky'}`}
              title={`Tự Hóa ${t.type} — ${t.star} (theo Can ${canName})`}>
              ↻{t.type}
            </span>
          ))}
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

      {showAnnualStars && annualStars && annualStars.length > 0 && (
        <div className="pc-annual-stars">
          {annualStars.map((as, i) => (
            <span key={i} className="annual-star-badge" style={{ color: as.color }} title={as.name}>
              {as.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})

// ── Chart Center ─────────────────────────────────────────────────────────────
const ChartCenter = memo(function ChartCenter({ info, form, allCungs }: { info: any; form: FormData; allCungs: any[] }) {
  // Compute stats
  let goodCount = 0, badCount = 0, locCount = 0, kyCount = 0
  for (const c of allCungs) {
    goodCount += (c.Saotot ?? []).length + (c.ChinhTinh ?? []).length
    badCount  += (c.Saoxau ?? []).length
    if (c.LocNhap) locCount++
    if (c.KyNhap)  kyCount++
  }
  const raw = goodCount - badCount + locCount * 2 - kyCount * 2
  const maxRaw = goodCount + badCount + (locCount + kyCount) * 2 || 1
  const strengthPct = Math.max(0, Math.min(100, Math.round(((raw + maxRaw) / (2 * maxRaw)) * 100)))

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
      <hr className="cc-hr" />
      <div className="cc-stats">
        <div className="cc-stats-row">
          <span className="cc-stat-good">⭐ Cát: {goodCount}</span>
          <span className="cc-stat-bad">⚠ Hung: {badCount}</span>
        </div>
        <div className="cc-strength-bar-wrap">
          <div className="cc-strength-bar" style={{ width: `${strengthPct}%` }} />
        </div>
      </div>
      <div className="cc-hint">Chạm vào cung hoặc sao để xem chú giải</div>
    </div>
  )
})

// ── Palace Detail Panel ─────────────────────────────────────────────────────
function PalacePanel({ cung, onClose }: { cung: any; onClose: () => void }) {
  const info = PALACE_INFO[cung.Name]
  const tsInfo = TRANG_SINH_INFO[cung.TrangSinh] ?? ''
  const allStars = [
    ...(cung.ChinhTinh ?? []).map((s: any) => ({ ...s, cat: true, kind: 'Chính tinh' })),
    ...(cung.Saotot ?? []).map((s: any) => ({ ...s, cat: true, kind: 'Cát tinh' })),
    ...(cung.Saoxau ?? []).map((s: any) => ({ ...s, cat: false, kind: 'Hung tinh' })),
  ]
  const [starSearch, setStarSearch] = useState('')
  const filteredStars = starSearch
    ? allStars.filter(s => s.Name.toLowerCase().includes(starSearch.toLowerCase()))
    : allStars

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="palace-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Cung {cung.Name}</h2>
            <span className="panel-chi">{T_CAN[cung.CanCung]} {cung.TieuHan}</span>
            {cung.Than === 1 && <span className="tag than ml">THÂN</span>}
          </div>
          <button className="btn-close" onClick={e => { createRipple(e); onClose() }}>✕</button>
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
          <input
            className="star-search-input"
            type="text"
            placeholder={`Tìm kiếm trong ${allStars.length} sao...`}
            value={starSearch}
            onChange={e => setStarSearch(e.target.value)}
          />
          <div className="star-list">
            {filteredStars.map((s: any, i: number) => {
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
            {filteredStars.length === 0 && <p className="panel-desc">Không tìm thấy sao phù hợp.</p>}
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
  const list = useMemo(() => getDaiHan(result), [result])
  const danNap = useMemo(() => getDanNap(result), [result])
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
          const score = computeDhScore(dh)
          const barColor = score >= 7 ? '#16a34a' : score >= 5 ? '#d97706' : '#dc2626'
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
              <div className="dh-score-bar-wrap">
                <div className="dh-score-bar-label">Vận số: {score}/10</div>
                <div className="dh-score-bar-track">
                  <div
                    className="dh-score-bar-fill"
                    style={{ width: `${score * 10}%`, background: barColor }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tiểu Hạn Tab ────────────────────────────────────────────────────────────
function TieuHanTab({ result, form, onStarClick, onPalaceClick, onAnalyzeYear }: {
  result: LaSoResult; form: FormData
  onStarClick: (name: string, status?: string, hanh?: number) => void
  onPalaceClick: (cung: any) => void
  onAnalyzeYear?: (year: number) => void
}) {
  const list = useMemo(() => getTieuHan(result, form.year), [result, form.year])
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
              // Pick the best year to analyze: current year if available, else first
              const analyzeTargetYear = th.years.includes(currentYear) ? currentYear : th.years[0]
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
                    {onAnalyzeYear && (
                      <button
                        className="btn-th-analyze"
                        title={`Phân tích năm ${analyzeTargetYear}`}
                        onClick={() => onAnalyzeYear(analyzeTargetYear)}
                      >✦</button>
                    )}
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

// ── Skeleton Loading ─────────────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="skeleton-cell" />
      ))}
    </div>
  )
}

// ── Tam Phương Tứ Chính Panel ────────────────────────────────────────────────
// Hiển thị 4 cung: cung đang chọn (Chính), Chiếu đối cung, 2 cung Tam Hợp
function TamPhuongPanel({ data, onClose, onSelectCung }: {
  data: { chinh: any; chieu: any; tamHop1: any; tamHop2: any }
  onClose: () => void
  onSelectCung: (cung: any) => void
}) {
  const slots = [
    { label: 'Chính cung',  role: 'chinh',  cung: data.chinh,   color: 'var(--purple)' },
    { label: 'Chiếu cung',  role: 'chieu',  cung: data.chieu,   color: '#dc2626' },
    { label: 'Tam hợp 1',   role: 'tamhop', cung: data.tamHop1, color: '#d97706' },
    { label: 'Tam hợp 2',   role: 'tamhop', cung: data.tamHop2, color: '#d97706' },
  ]

  function slotStars(cung: any) {
    if (!cung) return []
    return [
      ...(cung.ChinhTinh ?? []).map((s: any) => ({ ...s, group: 'chinh' })),
      ...(cung.Saotot    ?? []).map((s: any) => ({ ...s, group: 'tot' })),
      ...(cung.Saoxau    ?? []).map((s: any) => ({ ...s, group: 'xau' })),
    ]
  }

  function slotHoa(cung: any): string[] {
    if (!cung) return []
    return [
      cung.LocNhap   && `Lộc←${cung.LocNhap}`,
      cung.QuyenNhap && `Quyền←${cung.QuyenNhap}`,
      cung.KhoaNhap  && `Khoa←${cung.KhoaNhap}`,
      cung.KyNhap    && `Kỵ←${cung.KyNhap}`,
    ].filter(Boolean) as string[]
  }

  const tuHoaOf = (c: any) => detectTuHoaForPalace(c ?? {})

  return (
    <div className="tp-panel">
      <div className="tp-header">
        <span className="tp-title">⊹ Tam phương tứ chính — <b>{data.chinh?.Name}</b> ({T_CAN[data.chinh?.CanCung] ?? ''} {data.chinh?.TieuHan})</span>
        <button className="tp-close" onClick={onClose} aria-label="Đóng">✕</button>
      </div>
      <div className="tp-grid">
        {slots.map(({ label, role, cung, color }) => (
          <div key={label}
            className={`tp-slot tp-${role}${cung ? ' tp-clickable' : ''}`}
            style={{ '--tp-color': color } as React.CSSProperties}
            onClick={() => cung && role !== 'chinh' && onSelectCung(cung)}
          >
            <div className="tp-slot-label">{label}</div>
            {cung ? (
              <>
                <div className="tp-slot-name">{cung.Name}</div>
                <div className="tp-slot-chi">{T_CAN[cung.CanCung] ?? ''} {cung.TieuHan}</div>
                {cung.TrangSinh && <div className="tp-slot-ts">{cung.TrangSinh}</div>}
                {slotHoa(cung).length > 0 && (
                  <div className="tp-slot-hoa">
                    {slotHoa(cung).map((h, i) => {
                      const type = h.startsWith('Lộc') ? 'loc' : h.startsWith('Quyền') ? 'quyen' : h.startsWith('Khoa') ? 'khoa' : 'ky'
                      return <span key={i} className={`hoa ${type}`}>{h}</span>
                    })}
                  </div>
                )}
                {tuHoaOf(cung).length > 0 && (
                  <div className="tp-slot-hoa">
                    {tuHoaOf(cung).map((t, i) => (
                      <span key={i} className={`tuhoa ${t.type === 'Lộc' ? 'loc' : t.type === 'Quyền' ? 'quyen' : t.type === 'Khoa' ? 'khoa' : 'ky'}`}>↻{t.type}</span>
                    ))}
                  </div>
                )}
                <div className="tp-slot-stars">
                  {slotStars(cung).map((s, i) => (
                    <span key={i}
                      className={`tp-star tp-star-${s.group}`}
                      style={s.NguHanh ? { color: HANH[s.NguHanh]?.color } : undefined}
                    >
                      {s.Name}{s.Status && s.group === 'chinh' ? <sup>{s.Status}</sup> : ''}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="tp-slot-empty">—</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [form, setForm] = useState<FormData>({
    name: '', gender: 'male', isLunar: false,
    year: 1990, month: 1, day: 1, gioIndex: 0,
    province: '', clockTime: '',
  })
  // Thông tin hiệu chỉnh giờ mặt trời thật (nếu có)
  const [solarInfo, setSolarInfo] = useState<{ corrected: boolean; correctionMin: number; gioIndex: number } | null>(null)
  const [result, setResult] = useState<LaSoResult | null>(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(true)
  const [tab, setTab] = useState<Tab>('laso')
  const [selectedCung, setSelectedCung] = useState<any>(null)
  const [selectedStar, setSelectedStar] = useState<SelectedStar | null>(null)
  const [downloadingChart, setDownloadingChart] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('tuvi-theme') as 'light' | 'dark') || 'light'
  )
  // Feature: saved charts
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>(() => {
    try { return JSON.parse(localStorage.getItem('tuvi-saved-charts') ?? '[]') } catch { return [] }
  })
  const [showSavedList, setShowSavedList] = useState(false)
  // Feature: skeleton loading
  const [isCalculating, setIsCalculating] = useState(false)
  // Feature: grid view toggle (mobile list view)
  const [gridView, setGridView] = useState<'grid' | 'list'>('grid')
  // Feature: show annual stars overlay
  const [showAnnualStars, setShowAnnualStars] = useState(false)
  // Feature: analysis year lifted to App level
  const [analysisYear, setAnalysisYear] = useState<number>(new Date().getFullYear())
  // Feature: onboarding tooltip
  const [showOnboarding, setShowOnboarding] = useState(false)
  const onboardingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('tuvi-theme', theme)
  }, [theme])

  // Persist saved charts
  useEffect(() => {
    localStorage.setItem('tuvi-saved-charts', JSON.stringify(savedCharts))
  }, [savedCharts])

  // Reset gridView on desktop (guard avoids redundant state sets during drag)
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 480) setGridView(v => (v === 'grid' ? v : 'grid'))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Compute palace highlights (tam phương tứ chính: chiếu + tam hợp) khi click cung
  const palaceRelations = useMemo<Record<string, 'tamhop' | 'xung'>>(() => {
    const rel: Record<string, 'tamhop' | 'xung'> = {}
    if (selectedCung && result) {
      const selChiIdx = D_CHI.indexOf(selectedCung.TieuHan)
      if (selChiIdx >= 0) {
        const { tamHop, xung } = computeRelations(selChiIdx)
        for (const idx of tamHop) rel[D_CHI[idx]] = 'tamhop'
        if (xung !== null) rel[D_CHI[xung]] = 'xung'
      }
    }
    return rel
  }, [selectedCung, result])

  // Tứ chính cung (dùng cho panel Tam phương tứ chính)
  const tamPhuongData = useMemo(() => {
    if (!selectedCung || !result) return null
    const selChiIdx = D_CHI.indexOf(selectedCung.TieuHan)
    if (selChiIdx < 0) return null
    const { tamHop, xung } = computeRelations(selChiIdx)
    const allCungs = result.Cac_cung as any[]
    const byChi = (idx: number) => allCungs.find((c: any) => c.TieuHan === D_CHI[idx]) ?? null
    return {
      chinh: selectedCung,
      chieu: xung !== null ? byChi(xung) : null,
      tamHop1: tamHop[0] !== undefined ? byChi(tamHop[0]) : null,
      tamHop2: tamHop[1] !== undefined ? byChi(tamHop[1]) : null,
    }
  }, [selectedCung, result])

  // Annual stars map
  const annualStarsMap = useMemo(
    () => (result ? getAnnualStarsForYear(analysisYear) : {}),
    [result, analysisYear]
  )

  // Đại Hạn / Tiểu Hạn computed once per chart (heavy: scans all 12 palaces)
  const daiHanList = useMemo(() => (result ? getDaiHan(result) : []), [result])
  const tieuHanList = useMemo(() => (result ? getTieuHan(result, form.year) : []), [result, form.year])

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
    setIsCalculating(true)
    setTimeout(() => {
      try {
        const gio = resolveGio(form)
        const laso = generateLaSo({
          name: form.name || 'Vô danh', gender: form.gender,
          birth: { isLunar: form.isLunar, year: form.year, month: form.month, day: form.day, hour: gio.gioIndex * 2 },
        })
        setSolarInfo({ corrected: gio.corrected, correctionMin: gio.correctionMin, gioIndex: gio.gioIndex })
        setResult(laso); setShowForm(false); setTab('laso')
        setSelectedCung(null); setSelectedStar(null)
        setIsCalculating(false)

        // Onboarding
        if (!localStorage.getItem('tuvi-onboarded')) {
          setShowOnboarding(true)
          onboardingTimerRef.current = setTimeout(() => {
            setShowOnboarding(false)
            localStorage.setItem('tuvi-onboarded', '1')
          }, 5000)
        }
      } catch (err: any) {
        setError(err?.message || 'Có lỗi xảy ra khi tính lá số.')
        setIsCalculating(false)
      }
    }, 350)
  }

  function handleSaveChart() {
    const label = `${form.name || 'Vô danh'} — ${form.day}/${form.month}/${form.year}`
    const newChart: SavedChart = {
      id: Date.now().toString(),
      label,
      savedAt: Date.now(),
      form: { ...form },
    }
    setSavedCharts(prev => {
      const updated = [newChart, ...prev].slice(0, 10)
      return updated
    })
  }

  function handleLoadChart(saved: SavedChart) {
    // Lá số cũ có thể thiếu trường mới → bổ sung mặc định
    const loadedForm: FormData = { ...saved.form, province: saved.form.province ?? '', clockTime: saved.form.clockTime ?? '' }
    setForm(loadedForm)
    setIsCalculating(true)
    setTimeout(() => {
      try {
        const gio = resolveGio(loadedForm)
        const laso = generateLaSo({
          name: loadedForm.name || 'Vô danh', gender: loadedForm.gender,
          birth: { isLunar: loadedForm.isLunar, year: loadedForm.year, month: loadedForm.month, day: loadedForm.day, hour: gio.gioIndex * 2 },
        })
        setSolarInfo({ corrected: gio.corrected, correctionMin: gio.correctionMin, gioIndex: gio.gioIndex })
        setResult(laso); setShowForm(false); setTab('laso')
        setSelectedCung(null); setSelectedStar(null)
        setShowSavedList(false)
      } catch { /* ignore */ } finally {
        setIsCalculating(false)
      }
    }, 350)
  }

  function handleDeleteChart(id: string) {
    setSavedCharts(prev => prev.filter(c => c.id !== id))
  }

  const handlePalaceClick = useCallback((cung: any) => {
    setSelectedStar(null)
    setSelectedCung((prev: any) => prev?.Name === cung.Name && prev?.TieuHan === cung.TieuHan ? null : cung)
  }, [])

  const handleStarClick = useCallback((name: string, status?: string, hanh?: number) => {
    setSelectedCung(null)
    setSelectedStar({ name, status, hanh })
  }, [])

  function handleAnalyzeYear(year: number) {
    setAnalysisYear(year)
    setTab('ai')
  }

  function dismissOnboarding() {
    if (onboardingTimerRef.current) clearTimeout(onboardingTimerRef.current)
    setShowOnboarding(false)
    localStorage.setItem('tuvi-onboarded', '1')
  }

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
          <button
            className="btn-theme"
            onClick={e => { createRipple(e); setTheme(t => t === 'dark' ? 'light' : 'dark') }}
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          >
            {theme === 'dark' ? '☀ Sáng' : '🌙 Tối'}
          </button>
        </div>
      </header>

      <main className="app-main">
        {result && (
          <div className="form-toggle-row">
            <button className="btn-toggle" onClick={e => { createRipple(e); setShowForm(v => !v) }}>
              {showForm ? '▲ Ẩn form' : '▼ Sửa thông tin'}
            </button>
            <button className="btn-save" onClick={e => { createRipple(e); handleSaveChart() }} title="Lưu lá số">
              💾 Lưu
            </button>
            <div className="saved-charts-wrap">
              <button className="btn-saved-toggle" onClick={e => { createRipple(e); setShowSavedList(v => !v) }}>
                📂 {savedCharts.length}
              </button>
              {showSavedList && savedCharts.length > 0 && (
                <div className="saved-charts-dropdown">
                  {savedCharts.map(sc => (
                    <div key={sc.id} className="saved-chart-item">
                      <span className="saved-chart-label">{sc.label}</span>
                      <div className="saved-chart-actions">
                        <button className="btn-sc-load" onClick={() => handleLoadChart(sc)}>Tải</button>
                        <button className="btn-sc-del" onClick={() => handleDeleteChart(sc.id)}>Xóa</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showSavedList && savedCharts.length === 0 && (
                <div className="saved-charts-dropdown">
                  <p className="saved-charts-empty">Chưa có lá số nào được lưu.</p>
                </div>
              )}
            </div>
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

              <details className="solar-time-box">
                <summary>🌞 Giờ mặt trời thật (tùy chọn — chính xác hơn)</summary>
                <p className="solar-hint">
                  Nếu biết giờ:phút sinh và nơi sinh, hệ thống sẽ hiệu chỉnh theo kinh độ để xác định đúng canh giờ.
                  Khi điền đủ, giá trị này sẽ thay cho "Giờ sinh" ở trên.
                </p>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tỉnh/Thành nơi sinh</label>
                    <select name="province" value={form.province} onChange={handleChange}>
                      <option value="">— Không rõ —</option>
                      {VN_PROVINCES.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Giờ:phút sinh (đồng hồ)</label>
                    <input name="clockTime" type="time" value={form.clockTime} onChange={handleChange} />
                  </div>
                </div>
              </details>

              <button type="submit" className="submit-btn" onClick={e => { createRipple(e); burstParticles(e, 14) }}>✨ Xem lá số tử vi</button>
              {error && <div className="error-msg">{error}</div>}
            </form>
          </section>
        )}

        {isCalculating && <SkeletonGrid />}

        {result && !isCalculating && (
          <section className="chart-section">
            <div className="tabs">
              {([['laso','🗺 Lá Số'],['daihan','📅 Đại Hạn'],['tieuHan','🔄 Tiểu Hạn'],['ai','✦ Phân tích lá số']] as [Tab,string][]).map(([t,l]) => (
                <button key={t} className={`tab-btn ${tab === t ? 'tab-active' : ''} ${t === 'ai' ? 'tab-ai' : ''}`} onClick={e => { createRipple(e); setTab(t) }}>{l}</button>
              ))}
            </div>

            {solarInfo?.corrected && (
              <div className="solar-banner">
                🌞 Đã hiệu chỉnh <b>giờ mặt trời thật</b>: lệch {solarInfo.correctionMin >= 0 ? '+' : ''}{Math.round(solarInfo.correctionMin)} phút →
                an theo <b>Giờ {D_CHI[solarInfo.gioIndex]}</b>.
              </div>
            )}

            {tab === 'laso' && (
              <>
                <div className="annual-stars-controls">
                  <button
                    className={`btn-annual-toggle ${showAnnualStars ? 'btn-annual-active' : ''}`}
                    onClick={() => setShowAnnualStars(v => !v)}
                  >
                    {showAnnualStars ? '✦ Ẩn sao năm' : `Sao năm ${analysisYear}`}
                  </button>
                  {showAnnualStars && (
                    <select
                      className="annual-year-select"
                      value={analysisYear}
                      onChange={e => setAnalysisYear(Number(e.target.value))}
                    >
                      {YEAR_OPTIONS.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  )}
                </div>
                {gridView === 'grid' ? (
                  <div className="chart-grid">
                    {result.Cac_cung.map((cung: any, i: number) => {
                      const chiIdx = D_CHI.indexOf(cung.TieuHan)
                      const highlight = selectedCung?.TieuHan === cung.TieuHan
                        ? undefined
                        : palaceRelations[cung.TieuHan]
                      return (
                        <PalaceCell key={i} cung={cung}
                          isSelected={selectedCung?.TieuHan === cung.TieuHan}
                          onClick={handlePalaceClick}
                          onStarClick={handleStarClick}
                          palaceHighlight={highlight}
                          annualStars={annualStarsMap[chiIdx]}
                          showAnnualStars={showAnnualStars}
                        />
                      )
                    })}
                    <ChartCenter info={result.Info} form={form} allCungs={result.Cac_cung} />
                  </div>
                ) : (
                  <div className="palace-list-view">
                    {result.Cac_cung.map((cung: any, i: number) => {
                      const chiIdx = D_CHI.indexOf(cung.TieuHan)
                      const canName = T_CAN[cung.CanCung] ?? ''
                      const hoaStars = new Set<string>([cung.LocNhap, cung.QuyenNhap, cung.KhoaNhap, cung.KyNhap].filter(Boolean))
                      return (
                        <div key={i} className="palace-list-card" onClick={() => handlePalaceClick(cung)}>
                          <div className="plc-header">
                            <span className="plc-name">{cung.Name}</span>
                            <span className="plc-chi">{canName} {cung.TieuHan}</span>
                            {cung.TrangSinh && <span className="tag ts">{cung.TrangSinh}</span>}
                            {cung.Tuan === 1 && <span className="tag tuan">Tuần</span>}
                            {cung.Triet === 1 && <span className="tag triet">Triệt</span>}
                            {cung.Than === 1 && <span className="tag than">THÂN</span>}
                          </div>
                          <div className="plc-stars">
                            {[...(cung.ChinhTinh??[]), ...(cung.Saotot??[]), ...(cung.Saoxau??[])].map((s: any, j: number) => (
                              <span key={j}
                                className="star-badge star-clickable"
                                style={s.NguHanh ? { color: HANH[s.NguHanh]?.color } : undefined}
                                onClick={e => { e.stopPropagation(); handleStarClick(s.Name, s.Status, s.NguHanh) }}
                              >
                                {hoaStars.has(s.Name) ? <u>{s.Name}</u> : s.Name}
                              </span>
                            ))}
                          </div>
                          {showAnnualStars && annualStarsMap[chiIdx]?.length > 0 && (
                            <div className="pc-annual-stars">
                              {annualStarsMap[chiIdx].map((as, k) => (
                                <span key={k} className="annual-star-badge" style={{ color: as.color }} title={as.name}>
                                  {as.icon} {as.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {tamPhuongData && (
                  <TamPhuongPanel
                    data={tamPhuongData}
                    onClose={() => setSelectedCung(null)}
                    onSelectCung={handlePalaceClick}
                  />
                )}

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
                  <button className="btn-export" onClick={e => { createRipple(e); handleDownloadChart() }} disabled={downloadingChart}>
                    {downloadingChart ? '⏳ Đang tạo PDF...' : '📄 Tải PDF lá số'}
                  </button>
                  <button
                    className="btn-list-toggle"
                    onClick={() => setGridView(v => v === 'grid' ? 'list' : 'grid')}
                  >
                    {gridView === 'grid' ? '📋 Danh sách' : '⊞ Lưới'}
                  </button>
                </div>
              </>
            )}

            {tab === 'daihan' && (
              <DaiHanTab result={result} form={form} onStarClick={handleStarClick} onPalaceClick={handlePalaceClick} />
            )}
            {tab === 'tieuHan' && (
              <TieuHanTab result={result} form={form} onStarClick={handleStarClick} onPalaceClick={handlePalaceClick} onAnalyzeYear={handleAnalyzeYear} />
            )}
            {tab === 'ai' && (
              <InterpretTab
                result={result} form={form}
                daiHan={daiHanList} tieuHan={tieuHanList}
                initialYear={analysisYear}
                onYearChange={y => setAnalysisYear(y)}
              />
            )}
          </section>
        )}
      </main>

      {selectedCung && <PalacePanel cung={selectedCung} onClose={() => setSelectedCung(null)} />}
      {selectedStar && <StarModal star={selectedStar} onClose={() => setSelectedStar(null)} />}

      {showOnboarding && (
        <div className="onboarding-tooltip" onClick={dismissOnboarding}>
          💡 Mẹo: Nhấn vào cung hoặc sao bất kỳ để xem chú giải chi tiết
        </div>
      )}

      <footer className="app-footer">
        Tử Vi Đẩu Số · Created by TVP
      </footer>
    </div>
  )
}
