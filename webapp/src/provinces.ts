// Kinh độ (longitude) trung tâm tỉnh/thành Việt Nam — dùng để hiệu chỉnh giờ mặt trời thật.
// Kinh tuyến chuẩn của múi giờ Việt Nam (UTC+7) là 105°Đ.
// Lệch mỗi 1° kinh độ ≈ 4 phút thời gian mặt trời.

export interface Province {
  key: string
  name: string
  lon: number
}

export const STANDARD_MERIDIAN = 105 // kinh tuyến chuẩn UTC+7

export const VN_PROVINCES: Province[] = [
  // ── Miền Bắc ──
  { key: 'hanoi',      name: 'Hà Nội',              lon: 105.85 },
  { key: 'haiphong',   name: 'Hải Phòng',           lon: 106.68 },
  { key: 'quangninh',  name: 'Quảng Ninh (Hạ Long)', lon: 107.08 },
  { key: 'bacgiang',   name: 'Bắc Giang',           lon: 106.19 },
  { key: 'bacninh',    name: 'Bắc Ninh',            lon: 106.08 },
  { key: 'haiduong',   name: 'Hải Dương',           lon: 106.33 },
  { key: 'hungyen',    name: 'Hưng Yên',            lon: 106.05 },
  { key: 'vinhphuc',   name: 'Vĩnh Phúc',           lon: 105.60 },
  { key: 'thainguyen', name: 'Thái Nguyên',         lon: 105.83 },
  { key: 'phutho',     name: 'Phú Thọ',             lon: 105.22 },
  { key: 'bacninh2',   name: 'Hà Nam',              lon: 105.92 },
  { key: 'namdinh',    name: 'Nam Định',            lon: 106.17 },
  { key: 'thaibinh',   name: 'Thái Bình',           lon: 106.34 },
  { key: 'ninhbinh',   name: 'Ninh Bình',           lon: 105.97 },
  { key: 'hoabinh',    name: 'Hòa Bình',            lon: 105.34 },
  { key: 'sonla',      name: 'Sơn La',              lon: 103.92 },
  { key: 'dienbien',   name: 'Điện Biên',           lon: 103.02 },
  { key: 'laichau',    name: 'Lai Châu',            lon: 103.46 },
  { key: 'laocai',     name: 'Lào Cai',             lon: 103.97 },
  { key: 'yenbai',     name: 'Yên Bái',             lon: 104.87 },
  { key: 'tuyenquang', name: 'Tuyên Quang',         lon: 105.21 },
  { key: 'hagiang',    name: 'Hà Giang',            lon: 104.98 },
  { key: 'caobang',    name: 'Cao Bằng',            lon: 106.25 },
  { key: 'backan',     name: 'Bắc Kạn',             lon: 105.83 },
  { key: 'langson',    name: 'Lạng Sơn',            lon: 106.76 },

  // ── Miền Trung & Tây Nguyên ──
  { key: 'thanhhoa',   name: 'Thanh Hóa',           lon: 105.78 },
  { key: 'nghean',     name: 'Nghệ An (Vinh)',      lon: 105.69 },
  { key: 'hatinh',     name: 'Hà Tĩnh',             lon: 105.90 },
  { key: 'quangbinh',  name: 'Quảng Bình (Đồng Hới)', lon: 106.60 },
  { key: 'quangtri',   name: 'Quảng Trị (Đông Hà)', lon: 107.10 },
  { key: 'hue',        name: 'Thừa Thiên Huế',      lon: 107.58 },
  { key: 'danang',     name: 'Đà Nẵng',             lon: 108.22 },
  { key: 'quangnam',   name: 'Quảng Nam (Tam Kỳ)',  lon: 108.48 },
  { key: 'quangngai',  name: 'Quảng Ngãi',          lon: 108.80 },
  { key: 'binhdinh',   name: 'Bình Định (Quy Nhơn)', lon: 109.22 },
  { key: 'phuyen',     name: 'Phú Yên (Tuy Hòa)',   lon: 109.30 },
  { key: 'khanhhoa',   name: 'Khánh Hòa (Nha Trang)', lon: 109.19 },
  { key: 'ninhthuan',  name: 'Ninh Thuận (Phan Rang)', lon: 108.99 },
  { key: 'binhthuan',  name: 'Bình Thuận (Phan Thiết)', lon: 108.10 },
  { key: 'kontum',     name: 'Kon Tum',             lon: 108.00 },
  { key: 'gialai',     name: 'Gia Lai (Pleiku)',    lon: 108.00 },
  { key: 'daklak',     name: 'Đắk Lắk (Buôn Ma Thuột)', lon: 108.05 },
  { key: 'daknong',    name: 'Đắk Nông (Gia Nghĩa)', lon: 107.69 },
  { key: 'lamdong',    name: 'Lâm Đồng (Đà Lạt)',   lon: 108.44 },

  // ── Miền Nam ──
  { key: 'hcm',        name: 'TP. Hồ Chí Minh',     lon: 106.70 },
  { key: 'binhduong',  name: 'Bình Dương',          lon: 106.65 },
  { key: 'dongnai',    name: 'Đồng Nai (Biên Hòa)', lon: 106.82 },
  { key: 'baria',      name: 'Bà Rịa – Vũng Tàu',   lon: 107.08 },
  { key: 'binhphuoc',  name: 'Bình Phước (Đồng Xoài)', lon: 106.91 },
  { key: 'tayninh',    name: 'Tây Ninh',            lon: 106.13 },
  { key: 'longan',     name: 'Long An (Tân An)',    lon: 106.41 },
  { key: 'tiengiang',  name: 'Tiền Giang (Mỹ Tho)', lon: 106.36 },
  { key: 'bentre',     name: 'Bến Tre',             lon: 106.38 },
  { key: 'travinh',    name: 'Trà Vinh',            lon: 106.34 },
  { key: 'vinhlong',   name: 'Vĩnh Long',           lon: 105.97 },
  { key: 'dongthap',   name: 'Đồng Tháp (Cao Lãnh)', lon: 105.63 },
  { key: 'angiang',    name: 'An Giang (Long Xuyên)', lon: 105.44 },
  { key: 'kiengiang',  name: 'Kiên Giang (Rạch Giá)', lon: 105.08 },
  { key: 'cantho',     name: 'Cần Thơ',             lon: 105.78 },
  { key: 'haugiang',   name: 'Hậu Giang (Vị Thanh)', lon: 105.47 },
  { key: 'soctrang',   name: 'Sóc Trăng',           lon: 105.97 },
  { key: 'baclieu',    name: 'Bạc Liêu',            lon: 105.72 },
  { key: 'camau',      name: 'Cà Mau',              lon: 105.15 },
]

// Phương trình thời gian (equation of time) — sai lệch giữa giờ mặt trời thật
// và giờ mặt trời trung bình, theo ngày trong năm. Đơn vị: phút. Biên độ ±~16 phút.
export function equationOfTime(dayOfYear: number): number {
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
}

const CUM_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

export function dayOfYear(month: number, day: number): number {
  const m = Math.min(12, Math.max(1, month))
  return CUM_DAYS[m - 1] + day
}

// Tổng hiệu chỉnh (phút) cần cộng vào giờ đồng hồ để ra giờ mặt trời thật.
export function solarCorrectionMinutes(lon: number, month: number, day: number): number {
  const lonCorrection = (lon - STANDARD_MERIDIAN) * 4
  return lonCorrection + equationOfTime(dayOfYear(month, day))
}

// Từ giờ:phút đồng hồ + tỉnh + ngày → chỉ số Giờ (Chi) 0..11 theo giờ mặt trời thật.
export function trueSolarGioIndex(
  hour: number, minute: number, lon: number, month: number, day: number,
): { gioIndex: number; correctionMin: number } {
  const correctionMin = solarCorrectionMinutes(lon, month, day)
  const totalMin = hour * 60 + minute + correctionMin
  // Giờ Tý: 23:00–00:59 → cộng 60 phút rồi chia 120 phút mỗi canh giờ
  const normalized = (((totalMin + 60) % 1440) + 1440) % 1440
  const gioIndex = Math.floor(normalized / 120)
  return { gioIndex, correctionMin }
}
