export interface Province {
  key: string;
  name: string;
  lon: number;
}

export const STANDARD_MERIDIAN = 105;

export const VN_PROVINCES: Province[] = [
  { key: "an_giang", name: "An Giang", lon: 105.12 },
  { key: "ba_ria_vung_tau", name: "Bà Rịa - Vũng Tàu", lon: 107.25 },
  { key: "bac_giang", name: "Bắc Giang", lon: 106.20 },
  { key: "bac_kan", name: "Bắc Kạn", lon: 105.83 },
  { key: "bac_lieu", name: "Bạc Liêu", lon: 105.73 },
  { key: "bac_ninh", name: "Bắc Ninh", lon: 106.07 },
  { key: "ben_tre", name: "Bến Tre", lon: 106.38 },
  { key: "binh_dinh", name: "Bình Định (Quy Nhơn)", lon: 109.22 },
  { key: "binh_duong", name: "Bình Dương", lon: 106.65 },
  { key: "binh_phuoc", name: "Bình Phước", lon: 106.92 },
  { key: "binh_thuan", name: "Bình Thuận (Phan Thiết)", lon: 108.10 },
  { key: "ca_mau", name: "Cà Mau", lon: 105.15 },
  { key: "can_tho", name: "Cần Thơ", lon: 105.78 },
  { key: "cao_bang", name: "Cao Bằng", lon: 106.25 },
  { key: "da_nang", name: "Đà Nẵng", lon: 108.22 },
  { key: "dak_lak", name: "Đắk Lắk (Buôn Ma Thuột)", lon: 108.05 },
  { key: "dak_nong", name: "Đắk Nông (Gia Nghĩa)", lon: 107.70 },
  { key: "dien_bien", name: "Điện Biên", lon: 103.02 },
  { key: "dong_nai", name: "Đồng Nai (Biên Hòa)", lon: 107.00 },
  { key: "dong_thap", name: "Đồng Tháp", lon: 105.63 },
  { key: "gia_lai", name: "Gia Lai (Pleiku)", lon: 108.00 },
  { key: "ha_giang", name: "Hà Giang", lon: 104.98 },
  { key: "ha_nam", name: "Hà Nam", lon: 105.92 },
  { key: "ha_noi", name: "Hà Nội", lon: 105.85 },
  { key: "ha_tinh", name: "Hà Tĩnh", lon: 105.90 },
  { key: "hai_duong", name: "Hải Dương", lon: 106.33 },
  { key: "hai_phong", name: "Hải Phòng", lon: 106.68 },
  { key: "hau_giang", name: "Hậu Giang", lon: 105.62 },
  { key: "hoa_binh", name: "Hòa Bình", lon: 105.33 },
  { key: "hung_yen", name: "Hưng Yên", lon: 106.05 },
  { key: "khanh_hoa", name: "Khánh Hòa (Nha Trang)", lon: 109.19 },
  { key: "kien_giang", name: "Kiên Giang (Rạch Giá)", lon: 105.08 },
  { key: "kon_tum", name: "Kon Tum", lon: 107.98 },
  { key: "lai_chau", name: "Lai Châu", lon: 103.47 },
  { key: "lam_dong", name: "Lâm Đồng (Đà Lạt)", lon: 108.43 },
  { key: "lang_son", name: "Lạng Sơn", lon: 106.75 },
  { key: "lao_cai", name: "Lào Cai", lon: 103.97 },
  { key: "long_an", name: "Long An", lon: 106.40 },
  { key: "nam_dinh", name: "Nam Định", lon: 106.17 },
  { key: "nghe_an", name: "Nghệ An (Vinh)", lon: 105.67 },
  { key: "ninh_binh", name: "Ninh Bình", lon: 105.97 },
  { key: "ninh_thuan", name: "Ninh Thuận (Phan Rang)", lon: 108.99 },
  { key: "phu_tho", name: "Phú Thọ (Việt Trì)", lon: 105.40 },
  { key: "phu_yen", name: "Phú Yên (Tuy Hòa)", lon: 109.28 },
  { key: "quang_binh", name: "Quảng Bình (Đồng Hới)", lon: 106.62 },
  { key: "quang_nam", name: "Quảng Nam (Tam Kỳ)", lon: 108.47 },
  { key: "quang_ngai", name: "Quảng Ngãi", lon: 108.78 },
  { key: "quang_ninh", name: "Quảng Ninh (Hạ Long)", lon: 107.08 },
  { key: "quang_tri", name: "Quảng Trị (Đông Hà)", lon: 107.18 },
  { key: "soc_trang", name: "Sóc Trăng", lon: 105.97 },
  { key: "son_la", name: "Sơn La", lon: 103.92 },
  { key: "tay_ninh", name: "Tây Ninh", lon: 106.10 },
  { key: "thai_binh", name: "Thái Bình", lon: 106.33 },
  { key: "thai_nguyen", name: "Thái Nguyên", lon: 105.85 },
  { key: "thanh_hoa", name: "Thanh Hóa", lon: 105.78 },
  { key: "thua_thien_hue", name: "Thừa Thiên Huế (Huế)", lon: 107.60 },
  { key: "tien_giang", name: "Tiền Giang (Mỹ Tho)", lon: 106.35 },
  { key: "tp_hcm", name: "TP. Hồ Chí Minh", lon: 106.70 },
  { key: "tra_vinh", name: "Trà Vinh", lon: 106.33 },
  { key: "tuyen_quang", name: "Tuyên Quang", lon: 105.22 },
  { key: "vinh_long", name: "Vĩnh Long", lon: 105.97 },
  { key: "vinh_phuc", name: "Vĩnh Phúc", lon: 105.60 },
  { key: "yen_bai", name: "Yên Bái", lon: 104.87 },
];

/**
 * Equation of Time in minutes.
 * @param dayOfYear - day number of the year (1–365)
 */
export function equationOfTime(dayOfYear: number): number {
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

/**
 * Returns the day-of-year number (1-based) for a given month and day.
 * Uses a fixed 365-day calendar (non-leap).
 * @param month - 1–12
 * @param day   - 1–31
 */
export function dayOfYear(month: number, day: number): number {
  const cumulativeDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return cumulativeDays[month - 1] + day;
}

/**
 * True solar time correction in minutes for a given longitude and date.
 * Positive means solar noon is earlier than clock noon.
 * @param lon   - longitude in decimal degrees
 * @param month - 1–12
 * @param day   - 1–31
 */
export function solarCorrectionMinutes(lon: number, month: number, day: number): number {
  return (lon - STANDARD_MERIDIAN) * 4 + equationOfTime(dayOfYear(month, day));
}

/**
 * Converts a clock time and province longitude into the correct Giờ Chi index (0–11).
 *
 * Giờ Chi map:
 *   0 = Tý   (23:00–01:00)
 *   1 = Sửu  (01:00–03:00)
 *   2 = Dần  (03:00–05:00)
 *   3 = Mão  (05:00–07:00)
 *   4 = Thìn (07:00–09:00)
 *   5 = Tỵ   (09:00–11:00)
 *   6 = Ngọ  (11:00–13:00)
 *   7 = Mùi  (13:00–15:00)
 *   8 = Thân (15:00–17:00)
 *   9 = Dậu  (17:00–19:00)
 *  10 = Tuất (19:00–21:00)
 *  11 = Hợi  (21:00–23:00)
 *
 * @param hour   - clock hour (0–23)
 * @param minute - clock minute (0–59)
 * @param lon    - province longitude in decimal degrees
 * @param month  - birth month (1–12)
 * @param day    - birth day (1–31)
 */
export function trueSolarGioIndex(
  hour: number,
  minute: number,
  lon: number,
  month: number,
  day: number
): { gioIndex: number; correctionMin: number } {
  const correctionMin = solarCorrectionMinutes(lon, month, day);
  const totalMin = hour * 60 + minute + correctionMin;
  // Shift by 60 minutes so that Tý starts at 23:00 (−60 from midnight)
  const normalized = (((totalMin + 60) % 1440) + 1440) % 1440;
  const gioIndex = Math.floor(normalized / 120);
  return { gioIndex, correctionMin };
}
