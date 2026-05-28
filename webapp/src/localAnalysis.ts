// ── Offline (rule-based) Tử Vi analysis engine ─────────────────────────────
// Generates a complete Vietnamese-language chart reading without any API key.
// Output format is identical to the AI stream: Markdown with ## headings.

// ── Types ──────────────────────────────────────────────────────────────────
interface PalaceData {
  name: string; tieuHan: string; canCung: string
  isLife: boolean; isBody: boolean
  trangSinh: string; tuan: boolean; triet: boolean
  locNhap?: string; quyenNhap?: string; khoaNhap?: string; kyNhap?: string
  chinhTinh: Array<{ name: string; status: string }>
  saotot: Array<{ name: string; status?: string }>
  saoxau: Array<{ name: string }>
}

interface DaiHanData {
  startAge: number; endAge: number; cungName: string; chiName: string
  trangSinh?: string
  locNhap?: string; quyenNhap?: string; khoaNhap?: string; kyNhap?: string
  chinhTinh: string[]; saotot: string[]; saoxau: string[]
}

interface TieuHanData {
  yearChi: string; chiName: string; cungName: string; years: number[]
  locNhap?: string; quyenNhap?: string; khoaNhap?: string; kyNhap?: string
  chinhTinh: string[]; saotot: string[]; saoxau: string[]
}

export interface LocalAnalysisInput {
  form: { name: string; gender: string; year: number; month: number; day: number; isLunar: boolean; gioIndex: number }
  info: { nam: string; gio: string; amDuong: string; cuc: string; chuMenh: string; chuThan: string; thanCu: string }
  danNap: string
  palaces: PalaceData[]
  daiHan: DaiHanData[]
  tieuHan: TieuHanData[]
  currentYear: number
  currentDH: { startAge: number; endAge: number; cungName: string; startYear: number; endYear: number } | null
  currentTH: { yearChi: string; cungName: string } | null
}

// ── Star knowledge base ─────────────────────────────────────────────────────

const STAR_PROFILE: Record<string, {
  tags: string
  mieu: string     // when strong (Miếu/Vượng/Đắc)
  binh: string     // neutral
  ham: string      // weak (Hàm)
  career: string
  finance: string
  health: string
}> = {
  'Tử Vi': {
    tags: 'quyền uy · lãnh đạo · danh vọng',
    mieu: 'Bẩm sinh có tố chất lãnh đạo, được người xung quanh kính nể. Dễ đạt địa vị cao và công nhận xã hội. Cuộc đời có quý nhân phù trợ đắc lực.',
    binh: 'Có tính cách quyết đoán, muốn làm chủ. Đạt thành công nhờ kiên trì và tự lực.',
    ham: 'Dễ bảo thủ, tự ái cao, khó lắng nghe người khác. Thành công muộn hơn, cần rèn tính khiêm nhường.',
    career: 'Xuất sắc trong các vị trí lãnh đạo, quản lý cấp cao, hành chính nhà nước, chính trị.',
    finance: 'Tài vận đến nhờ địa vị và quyền lực. Cuộc sống sung túc nhưng chi tiêu cũng lớn.',
    health: 'Sức khỏe tổng thể tốt. Chú ý huyết áp và stress do áp lực công việc lớn.',
  },
  'Thiên Phủ': {
    tags: 'tích lũy · kho bạc · ổn định',
    mieu: 'Tính cách điềm đạm, biết tích lũy và gìn giữ tài sản. Cuộc đời ổn định, ít biến động lớn. Tài vận bền vững.',
    binh: 'Sống thực tế, an phận. Tích lũy từng bước, không mạo hiểm.',
    ham: 'Bảo thủ, sợ rủi ro, hay bỏ lỡ cơ hội tốt vì thiếu quyết đoán. Dễ bị người khác chiếm lợi.',
    career: 'Phù hợp với ngân hàng, tài chính, quản lý tài sản, kế toán, kinh doanh truyền thống.',
    finance: 'Tài vận ổn định, ít thăng giáng. Giỏi tiết kiệm, tích lũy lâu dài, không thích đầu cơ.',
    health: 'Sức khỏe ổn định. Chú ý cân nặng và tiêu hóa do lối sống thiếu vận động.',
  },
  'Liêm Trinh': {
    tags: 'nguyên tắc · ý chí · phức tạp',
    mieu: 'Có nguyên tắc sống rõ ràng, ý chí sắt đá. Thành công nhờ kiên trì và kỷ luật. Có thể đạt đỉnh cao trong chuyên môn.',
    binh: 'Sống theo nguyên tắc, đôi khi cứng nhắc. Thích làm những việc có ý nghĩa.',
    ham: 'Cần cẩn thận với pháp lý, tranh chấp, tai tiếng. Tránh các giao dịch không rõ ràng. Hôn nhân có thể trắc trở.',
    career: 'Phù hợp với quân sự, luật pháp, y tế, tôn giáo, nghiên cứu. Cần nghề có kỷ luật cao.',
    finance: 'Tài vận có thăng giáng. Cẩn thận đầu tư và cho vay. Nên tránh kinh doanh đối tác không rõ ràng.',
    health: 'Chú ý gan, mật, hệ tiết niệu. Tránh rượu bia và chất kích thích.',
  },
  'Thiên Tướng': {
    tags: 'hỗ trợ · uy tín · pháp luật',
    mieu: 'Tính cách điềm tĩnh, đáng tin cậy, luôn hành động đúng quy tắc. Giỏi hỗ trợ và tham mưu. Được đồng nghiệp tin cậy.',
    binh: 'Làm việc có nguyên tắc, uy tín tốt. Không nổi bật nhưng bền vững.',
    ham: 'Thiếu chủ kiến, hay phụ thuộc người khác. Dễ bị người khác lợi dụng lòng tốt.',
    career: 'Phù hợp vai trò tham mưu, tư vấn, hành chính, kế toán kiểm toán, luật sư.',
    finance: 'Thu nhập ổn định từ lương bổng. Tài vận trung bình nhưng không thiếu.',
    health: 'Sức khỏe trung bình. Chú ý xương khớp và hệ hô hấp.',
  },
  'Tham Lang': {
    tags: 'đa tài · ham muốn · biến hóa',
    mieu: 'Tài năng đa dạng, sức hút cá nhân mạnh, giỏi giao tiếp xã hội. Thành công lớn trong lĩnh vực giải trí và kinh doanh dịch vụ. Vận sau 40 rất tốt.',
    binh: 'Đa tài nhưng dàn trải. Thích nhiều thứ, cần tập trung mới thành công.',
    ham: 'Dễ bị cám dỗ bởi vật chất, sắc đẹp, tiêu khiển. Hay thay đổi hướng đi. Cần kiềm chế tính tham lam.',
    career: 'Phù hợp nghệ thuật, giải trí, F&B, du lịch, kinh doanh dịch vụ, môi giới, sales.',
    finance: 'Tiền đến nhanh tiền đi nhanh. Sau 40 tuổi tài vận mới thực sự phát. Cần kỷ luật tài chính.',
    health: 'Chú ý gan, thận, hệ sinh dục. Tránh quá độ trong ăn uống và sinh hoạt.',
  },
  'Cự Môn': {
    tags: 'ngôn ngữ · tranh luận · ẩn khuất',
    mieu: 'Tài ăn nói xuất sắc, có khả năng thuyết phục cao. Thành công nhờ ngôn ngữ và giao tiếp. Giỏi biện luận và đàm phán.',
    binh: 'Có duyên với ngôn ngữ, hay nói thẳng. Cần học cách diễn đạt khéo léo hơn.',
    ham: 'Hay gây tranh cãi, thị phi khẩu thiệt. Cần kiểm soát lời nói. Tránh can dự vào việc người khác.',
    career: 'Phù hợp với luật sư, nhà báo, giáo viên, diễn giả, sales, phát ngôn viên, chính trị gia.',
    finance: 'Tài vận thường ẩn, cần nỗ lực tìm kiếm. Kiếm tiền nhờ kỹ năng ngôn ngữ và quan hệ.',
    health: 'Chú ý miệng, răng, cổ họng, hệ tiêu hóa. Tránh căng thẳng kéo dài.',
  },
  'Thiên Đồng': {
    tags: 'phúc lộc · nhẹ nhàng · hưởng thụ',
    mieu: 'Tính tình hiền hòa, lạc quan, cuộc đời có nhiều phúc khí. Được quý nhân và người thân hỗ trợ nhiều. Sống thọ và an nhiên.',
    binh: 'Hiền lành, dễ sống. Cuộc đời tương đối suôn sẻ. Cần thêm chí cầu tiến.',
    ham: 'Thiếu quyết đoán, ỷ lại. Cuộc đời không gặp nhiều khó khăn nhưng cũng khó đạt đỉnh cao.',
    career: 'Phù hợp ngành phục vụ, giáo dục, y tế, tâm lý, nghệ thuật, làm việc cho người khác.',
    finance: 'Tài vận nhờ phúc đức, có thể hưởng tài sản từ gia đình. Không cần lo lắng thiếu ăn.',
    health: 'Sức khỏe tốt, sống thọ. Chú ý tiêu hóa và béo phì nếu lười vận động.',
  },
  'Thiên Cơ': {
    tags: 'thông minh · mưu lược · biến đổi',
    mieu: 'Tư duy nhanh nhạy, giỏi phân tích và lên kế hoạch. Thích nghi tốt với thay đổi. Thành công nhờ trí tuệ và sự linh hoạt.',
    binh: 'Thông minh, cần cù. Hay có nhiều ý tưởng nhưng cần bền bỉ thực hiện.',
    ham: 'Thiếu ổn định, hay thay đổi. Tính toán quá nhiều dẫn đến bỏ lỡ cơ hội thực tế.',
    career: 'Phù hợp với IT, phân tích dữ liệu, nghiên cứu, tư vấn chiến lược, marketing, tài chính.',
    finance: 'Tài vận thay đổi theo thời điểm. Nhạy bén với cơ hội. Nên đa dạng hóa thu nhập.',
    health: 'Chú ý thần kinh, mất ngủ, stress. Cần nghỉ ngơi đủ giấc và thư giãn đầu óc.',
  },
  'Thái Dương': {
    tags: 'ánh sáng · danh tiếng · xã hội',
    mieu: 'Nhiệt huyết, bao dung, thích giúp đỡ người khác. Dễ nổi danh và được xã hội công nhận. Thành công trong vai trò đại diện.',
    binh: 'Năng động, nhiệt tình. Thích hoạt động cộng đồng và xây dựng mối quan hệ.',
    ham: 'Quá chú trọng hình ảnh, hao sức vì người khác. Cuộc sống thiếu riêng tư. Vất vả sau chiều.',
    career: 'Phù hợp chính trị, nhà báo, nghệ sĩ, lãnh đạo doanh nghiệp, giảng dạy, từ thiện.',
    finance: 'Tài vận tốt nhờ danh tiếng và mối quan hệ. Kiếm nhiều nhưng chi tiêu cũng lớn.',
    health: 'Chú ý tim mạch, mắt, huyết áp. Tránh làm việc quá sức và thiếu ngủ.',
  },
  'Thái Âm': {
    tags: 'tinh tế · tài vận ẩn · âm đức',
    mieu: 'Tính cách tinh tế, giàu cảm xúc, thẩm mỹ cao. Tài vận ẩn nhưng bền vững, hay có nguồn thu không ngờ. Phù hợp kinh doanh bất động sản.',
    binh: 'Nhạy cảm, nội tâm phong phú. Tài vận cần khai thác đúng hướng.',
    ham: 'Đa sầu đa cảm, khó thoát khỏi lo lắng. Tài vận bị ẩn, khó thu tiền mặc dù làm việc nhiều.',
    career: 'Phù hợp nghệ thuật, thẩm mỹ, địa ốc, tài chính, thiết kế, chăm sóc sức khỏe.',
    finance: 'Tài vận tốt, đặc biệt về bất động sản và tài sản dài hạn. Nên đầu tư dài hạn.',
    health: 'Chú ý hệ nội tiết, tâm lý, phụ khoa (với nữ). Tránh suy nghĩ tiêu cực kéo dài.',
  },
  'Phá Quân': {
    tags: 'cải cách · phiêu lưu · tiêu hao',
    mieu: 'Tinh thần đột phá, gan dạ, không ngại đối mặt thử thách. Thường thành công sau nhiều lần vấp ngã. Phù hợp khởi nghiệp.',
    binh: 'Thích thay đổi và phiêu lưu. Cuộc đời nhiều biến động nhưng không thiếu thú vị.',
    ham: 'Phá hoại, khó giữ của cải, nhiều lần thất bại. Hôn nhân dễ trắc trở, dễ có vợ/chồng hai.',
    career: 'Phù hợp khởi nghiệp, cải cách tổ chức, quân sự, thể thao mạo hiểm, xây dựng phá dỡ.',
    finance: 'Tài vận thăng giáng mạnh. Dễ kiếm nhưng khó giữ. Cần kiểm soát chi tiêu nghiêm túc.',
    health: 'Cẩn thận tai nạn thương tích. Chú ý gan, thận, hệ sinh dục.',
  },
  'Vũ Khúc': {
    tags: 'kiên định · tài chính Kim · cô độc',
    mieu: 'Ý chí mạnh, quyết đoán, đặc biệt xuất sắc về tài chính. Thành công trong kinh doanh và quản lý tiền bạc. Rất giỏi tích lũy.',
    binh: 'Thực tế, chắc chắn. Làm việc nghiêm túc, ít lời nhiều việc.',
    ham: 'Cứng nhắc, khó nhượng bộ. Dễ cô đơn trong tình cảm. Giao tiếp xã hội hạn chế.',
    career: 'Xuất sắc trong tài chính, ngân hàng, kế toán, kinh doanh độc lập, kim loại, xây dựng.',
    finance: 'Tài vận rất tốt. Giỏi tích lũy và quản lý tiền. Phù hợp đầu tư dài hạn, bất động sản.',
    health: 'Chú ý phổi, hệ hô hấp, da liễu. Tránh để cô đơn dẫn đến trầm cảm.',
  },
  'Thiên Lương': {
    tags: 'phúc đức · y tế · đạo đức',
    mieu: 'Tính cách thiện lương, hay cứu giúp người, có uy tín đạo đức. Sống thọ và an nhiên. Phúc đức từ thiện nghiệp.',
    binh: 'Lương thiện, thích làm việc nghĩa. Cần cân bằng giữa giúp đỡ người và lo cho bản thân.',
    ham: 'Quá lý tưởng, hay bị lợi dụng lòng tốt. Tài vận không mạnh vì ít chú tâm đến lợi ích cá nhân.',
    career: 'Phù hợp y tế, tâm lý, tư vấn, giảng dạy, tôn giáo, phúc lợi xã hội.',
    finance: 'Tài vận không phải thế mạnh. Thường cho đi hơn nhận lại. Cần cân đối thu chi.',
    health: 'Sức khỏe tốt, sống thọ. Chú ý xương khớp và dạ dày.',
  },
}

// Trạng Sinh effects
const TRANG_SINH_EFFECT: Record<string, string> = {
  'Trường Sinh': 'Giai đoạn phát triển bền vững, nền móng tốt, nhiều quý nhân hỗ trợ.',
  'Mộc Dục':    'Giai đoạn học hỏi, trải nghiệm. Có thể thiếu ổn định, nhiều ham muốn.',
  'Quan Đới':   'Trưởng thành, bắt đầu có uy tín và địa vị. Sự nghiệp đang phát triển tốt.',
  'Lâm Quan':   'Đạt đỉnh công danh, quyền lực và uy tín tối đa. Thời kỳ vàng son.',
  'Đế Vượng':   'Cực thịnh, đỉnh cao của vận hạn. Mọi việc đều thuận lợi và như ý.',
  'Suy':        'Bắt đầu suy giảm, cần củng cố nền tảng. Chưa đến mức xấu nhưng cần cẩn thận.',
  'Bệnh':       'Sức khỏe và vận hạn suy yếu. Nhiều trở ngại, cần bảo vệ sức khỏe.',
  'Tử':         'Giai đoạn tạm dừng, kết thúc chu kỳ cũ. Nên tĩnh dưỡng, chờ thời.',
  'Mộ':         'Vận hạn bị che khuất, tạm dừng. Nên tĩnh tại, tránh liều lĩnh.',
  'Tuyệt':      'Giai đoạn suy tàn, mọi việc khó khăn. Cần kiên nhẫn chờ chu kỳ mới.',
  'Thai':       'Bắt đầu nảy sinh cơ hội mới. Giai đoạn ươm mầm, chưa phát lộ.',
  'Dưỡng':      'Được bảo hộ, nuôi dưỡng. Tương đối bình an nhưng chưa phát.',
}

// Hung tinh phổ biến và tác động
const HUNG_TINH_EFFECT: Record<string, string> = {
  'Kình Dương': 'cứng rắn, hay tranh chấp, dễ bị thương tích hoặc thủ thuật',
  'Đà La':      'trì hoãn, vướng bận, sự việc kéo dài dai dẳng',
  'Hỏa Tinh':   'bốc đồng, hay xảy ra sự cố đột ngột, tai nạn lửa hoặc bỏng',
  'Linh Tinh':  'lạnh lùng, hay gặp hiểm nguy bất ngờ, cô độc',
  'Thiên Không': 'vô ích, tốn công vô ích, thiếu thực chất',
  'Địa Kiếp':   'tổn thất, mất mát bất ngờ, hay bị cướp đoạt',
  'Thiên Hình': 'hình phạt, liên quan pháp luật, hoặc phẫu thuật',
  'Thiên Khốc': 'buồn bã, tang gia, thân nhân gặp nạn',
  'Thiên Hư':   'hư hỏng, mất mát, không thực chất',
  'Phá Toái':   'vỡ vụn, phá sản, mất tài sản',
}

// ── Helper functions ─────────────────────────────────────────────────────────

function getPalace(palaces: PalaceData[], name: string): PalaceData | undefined {
  return palaces.find(p => p.name === name)
}

function starStatus(p: PalaceData | undefined): 'strong' | 'neutral' | 'weak' | 'empty' {
  if (!p || p.chinhTinh.length === 0) return 'empty'
  const strong = p.chinhTinh.filter(s => ['M','V','Đ'].includes(s.status)).length
  const weak   = p.chinhTinh.filter(s => s.status === 'H').length
  if (p.tuan || p.triet) return 'weak'
  if (strong > weak) return 'strong'
  if (weak > strong) return 'weak'
  return 'neutral'
}

function hoaDesc(p: PalaceData | undefined): string {
  if (!p) return ''
  const parts: string[] = []
  if (p.locNhap)   parts.push(`Hóa Lộc (${p.locNhap}) → tài lộc vượng`)
  if (p.quyenNhap) parts.push(`Hóa Quyền (${p.quyenNhap}) → uy quyền tăng`)
  if (p.khoaNhap)  parts.push(`Hóa Khoa (${p.khoaNhap}) → danh tiếng tốt`)
  if (p.kyNhap)    parts.push(`Hóa Kỵ (${p.kyNhap}) → cần đề phòng trở ngại`)
  return parts.join('; ')
}

function warnDesc(p: PalaceData | undefined): string {
  if (!p) return ''
  const w: string[] = []
  if (p.tuan)    w.push('Tuần (sao giảm 30% sức mạnh)')
  if (p.triet)   w.push('Triệt (sao bị cô lập)')
  if (p.kyNhap)  w.push(`Hóa Kỵ từ ${p.kyNhap}`)
  return w.length ? `⚠ Cảnh báo: ${w.join(', ')}. ` : ''
}

function catHungSummary(p: PalaceData | undefined): string {
  if (!p) return 'Không có chính tinh — cần xem xét cung chiếu.'
  const cats = p.saotot.slice(0, 4).map(s => s.name).join(', ')
  const hungs = p.saoxau.slice(0, 3).map(s => s.name).join(', ')
  const parts: string[] = []
  if (cats) parts.push(`Cát tinh: ${cats}`)
  if (hungs) parts.push(`Hung tinh: ${hungs}`)
  return parts.join(' | ')
}

function starProfile(name: string, status: string): string {
  const p = STAR_PROFILE[name]
  if (!p) return `${name} hiện diện trong cung.`
  if (['M','V','Đ'].includes(status)) return `**${name}** (${p.tags}) ở Miếu/Đắc địa: ${p.mieu}`
  if (status === 'H') return `**${name}** (${p.tags}) ở Hàm địa: ${p.ham}`
  return `**${name}** (${p.tags}): ${p.binh}`
}

function dhScoreText(score: number): string {
  if (score >= 8) return 'rất tốt, giai đoạn vàng son'
  if (score >= 6) return 'tương đối tốt, thuận lợi'
  if (score >= 5) return 'trung bình, bình ổn'
  if (score >= 3) return 'hơi yếu, cần thận trọng'
  return 'khó khăn, nhiều thử thách'
}

// ── Section builders ─────────────────────────────────────────────────────────

function buildTongQuan(data: LocalAnalysisInput): string {
  const { info, form, danNap } = data
  const name = form.name || 'Bạn'
  const gender = form.gender === 'Nam' ? 'Nam' : 'Nữ'
  return `# Lá Số Tử Vi — ${name}

## Tổng Quan Mệnh Cách

**${name}** sinh ngày ${form.day}/${form.month}/${form.year} ${form.isLunar ? '(âm lịch)' : ''}, giới tính: ${gender}.

- **Năm sinh (Can Chi):** ${info.nam}
- **Giờ sinh:** ${info.gio} | **Âm Dương:** ${info.amDuong}
- **Cục:** ${info.cuc} — xác định điểm khởi đầu vận hạn và mức độ phát triển
- **Chủ Mệnh:** ${info.chuMenh} — ngôi sao chủ đạo chi phối tính cách và số phận
- **Chủ Thân:** ${info.chuThan} — ảnh hưởng đến thể chất, nội tâm và bản ngã
- **Thân cư:** ${info.thanCu} — vị trí cung Thân, phản ánh nội tâm sâu xa
- **Hướng vận Đại Hạn:** ${danNap}

Lá số được luận giải dựa trên nguyên tắc Tử Vi Đẩu Số cổ truyền Việt Nam — phân tích vị trí sao, trạng thái, Tứ Hóa và tương tác giữa các cung.`
}

function buildTinhCach(data: LocalAnalysisInput): string {
  const menh = getPalace(data.palaces, 'Mệnh')
  const name = data.form.name || 'Bạn'

  let lines = [`## Tính Cách & Tố Chất\n`]
  lines.push(warnDesc(menh))

  if (!menh || menh.chinhTinh.length === 0) {
    lines.push(`Cung Mệnh không có Chính Tinh (trống) — đây là cung Mệnh đặc biệt, tính cách được định hình bởi các sao chiếu và Tứ Hóa. Người này thường đa dạng, khó đoán và thích nghi tốt với nhiều môi trường.`)
  } else {
    for (const s of menh.chinhTinh) {
      lines.push(starProfile(s.name, s.status))
      const sp = STAR_PROFILE[s.name]
      if (sp) lines.push(`> Sự nghiệp phù hợp: ${sp.career}`)
    }
  }

  const hd = hoaDesc(menh)
  if (hd) lines.push(`\nTứ Hóa tại cung Mệnh: ${hd}`)

  const sh = catHungSummary(menh)
  if (sh) lines.push(`\n${sh}`)

  lines.push(`\n**${name}** có xu hướng ${menh?.chinhTinh[0] ? STAR_PROFILE[menh.chinhTinh[0].name]?.binh ?? 'cần nỗ lực phát huy tiềm năng của bản thân' : 'linh hoạt và dễ thích nghi với hoàn cảnh'}.`)

  return lines.filter(Boolean).join('\n')
}

function buildSuNghiep(data: LocalAnalysisInput): string {
  const quanLoc = getPalace(data.palaces, 'Quan Lộc')
  const phucDuc = getPalace(data.palaces, 'Phúc Đức')

  let lines = [`## Sự Nghiệp & Công Danh\n`]

  if (quanLoc) {
    const st = starStatus(quanLoc)
    lines.push(`**Cung Quan Lộc** (${quanLoc.canCung} ${quanLoc.tieuHan}) — chủ sự nghiệp và công danh:`)
    lines.push(warnDesc(quanLoc))

    if (quanLoc.chinhTinh.length === 0) {
      lines.push(`Cung Quan Lộc trống — sự nghiệp hình thành từ nhiều hướng khác nhau. Cần xem xét cung chiếu tam hợp để đánh giá đầy đủ.`)
    } else {
      for (const s of quanLoc.chinhTinh) {
        const sp = STAR_PROFILE[s.name]
        lines.push(starProfile(s.name, s.status))
        if (sp) lines.push(`→ ${sp.career}`)
      }
    }

    if (st === 'strong') lines.push(`✦ Sự nghiệp phát triển thuận lợi, có xu hướng thành công và được công nhận.`)
    else if (st === 'weak') lines.push(`⚠ Sự nghiệp gặp nhiều trở ngại. Cần kiên trì và chọn hướng phù hợp.`)

    const hd = hoaDesc(quanLoc)
    if (hd) lines.push(`Tứ Hóa: ${hd}`)
    const sh = catHungSummary(quanLoc)
    if (sh) lines.push(sh)
  }

  if (phucDuc && phucDuc.chinhTinh.length > 0) {
    lines.push(`\n**Cung Phúc Đức** hỗ trợ: ${phucDuc.chinhTinh.map(s => s.name).join(', ')} — phúc khí hỗ trợ sự nghiệp.`)
  }

  return lines.filter(Boolean).join('\n')
}

function buildTaiChinh(data: LocalAnalysisInput): string {
  const taiBach = getPalace(data.palaces, 'Tài Bạch')
  const dien    = getPalace(data.palaces, 'Điền Trạch')

  let lines = [`## Tài Chính & Tiền Bạc\n`]

  if (taiBach) {
    const st = starStatus(taiBach)
    lines.push(`**Cung Tài Bạch** (${taiBach.canCung} ${taiBach.tieuHan}) — chủ tài lộc và thu nhập:`)
    lines.push(warnDesc(taiBach))

    if (taiBach.chinhTinh.length === 0) {
      lines.push(`Cung Tài Bạch trống — tài vận phụ thuộc vào cung chiếu và nỗ lực cá nhân. Không tự nhiên có của mà cần tìm kiếm.`)
    } else {
      for (const s of taiBach.chinhTinh) {
        const sp = STAR_PROFILE[s.name]
        lines.push(starProfile(s.name, s.status))
        if (sp) lines.push(`→ ${sp.finance}`)
      }
    }

    if (st === 'strong') lines.push(`✦ Tài vận khá tốt, có xu hướng thu nhập ổn định và tích lũy được.`)
    else if (st === 'weak') lines.push(`⚠ Tài vận gặp thách thức. Cần quản lý tài chính chặt chẽ, tránh rủi ro lớn.`)

    const hd = hoaDesc(taiBach)
    if (hd) lines.push(`Tứ Hóa: ${hd}`)
  }

  if (dien && dien.chinhTinh.length > 0) {
    const st = starStatus(dien)
    lines.push(`\n**Cung Điền Trạch** — bất động sản và tài sản cố định: ${dien.chinhTinh.map(s => s.name).join(', ')} ở ${st === 'strong' ? 'trạng thái tốt — có khả năng sở hữu bất động sản' : st === 'weak' ? 'trạng thái yếu — cẩn thận với giao dịch nhà đất' : 'mức bình thường'}.`)
    const hd = hoaDesc(dien)
    if (hd) lines.push(`Tứ Hóa Điền Trạch: ${hd}`)
  }

  return lines.filter(Boolean).join('\n')
}

function buildTinhDuyen(data: LocalAnalysisInput): string {
  const phuThe = getPalace(data.palaces, data.form.gender === 'Nam' ? 'Thê Thiếp' : 'Phu Quân')
    ?? getPalace(data.palaces, 'Thê Thiếp')
    ?? getPalace(data.palaces, 'Phu Quân')
  const tuTuc  = getPalace(data.palaces, 'Tử Tức')

  let lines = [`## Tình Duyên & Hôn Nhân\n`]

  const phuLabel = data.form.gender === 'Nam' ? 'Thê Thiếp' : 'Phu Quân'
  const target = getPalace(data.palaces, phuLabel) ?? phuThe

  if (target) {
    const st = starStatus(target)
    lines.push(`**Cung ${target.name}** (${target.canCung} ${target.tieuHan}) — chủ hôn nhân và tình duyên:`)
    lines.push(warnDesc(target))

    if (target.chinhTinh.length === 0) {
      lines.push(`Cung tình duyên trống — duyên phận đến muộn hoặc từ nhiều hướng bất ngờ. Nên mở rộng giao tiếp.`)
    } else {
      for (const s of target.chinhTinh) lines.push(starProfile(s.name, s.status))
    }

    if (st === 'strong') lines.push(`✦ Tình duyên thuận lợi. Hôn nhân có khả năng hạnh phúc và bền vững.`)
    else if (st === 'weak') lines.push(`⚠ Tình duyên có trắc trở. Cần kiên nhẫn và cẩn thận trong việc chọn bạn đời.`)

    const hd = hoaDesc(target)
    if (hd) lines.push(`Tứ Hóa: ${hd}`)
    const sh = catHungSummary(target)
    if (sh) lines.push(sh)
  }

  if (tuTuc && tuTuc.chinhTinh.length > 0) {
    const st = starStatus(tuTuc)
    lines.push(`\n**Cung Tử Tức** — con cái: ${tuTuc.chinhTinh.map(s => s.name).join(', ')} ${st === 'strong' ? '— con cái thông minh, hiếu thảo' : st === 'weak' ? '— con cái gặp khó khăn hoặc muộn có con' : '— bình thường'}.`)
    const hd = hoaDesc(tuTuc)
    if (hd) lines.push(`Tứ Hóa: ${hd}`)
  }

  return lines.filter(Boolean).join('\n')
}

function buildGiaDinh(data: LocalAnalysisInput): string {
  const phuMau   = getPalace(data.palaces, 'Phụ Mẫu')
  const huynhDe  = getPalace(data.palaces, 'Huynh Đệ')
  const phucDuc  = getPalace(data.palaces, 'Phúc Đức')

  let lines = [`## Gia Đình & Thân Thuộc\n`]

  if (phuMau) {
    const st = starStatus(phuMau)
    lines.push(`**Cung Phụ Mẫu** — cha mẹ và bề trên:`)
    lines.push(warnDesc(phuMau))
    if (phuMau.chinhTinh.length > 0) {
      lines.push(phuMau.chinhTinh.map(s => starProfile(s.name, s.status)).join('\n'))
    }
    lines.push(st === 'strong' ? '✦ Được cha mẹ yêu thương, hỗ trợ. Gia đình có phúc.'
      : st === 'weak' ? '⚠ Quan hệ với cha mẹ có thể gặp trở ngại. Cha mẹ có sức khỏe hoặc tài chính không ổn.'
      : 'Quan hệ cha mẹ bình thường, ổn định.')
    const hd = hoaDesc(phuMau)
    if (hd) lines.push(`Tứ Hóa: ${hd}`)
  }

  if (huynhDe) {
    const st = starStatus(huynhDe)
    lines.push(`\n**Cung Huynh Đệ** — anh chị em và bạn bè thân:`)
    lines.push(warnDesc(huynhDe))
    lines.push(st === 'strong' ? '✦ Anh chị em hòa thuận, đoàn kết và hỗ trợ lẫn nhau.'
      : st === 'weak' ? '⚠ Quan hệ anh chị em có thể có mâu thuẫn hoặc ít hỗ trợ nhau.'
      : 'Quan hệ anh chị em bình thường, không đặc biệt thân thiết cũng không mâu thuẫn.')
    const hd = hoaDesc(huynhDe)
    if (hd) lines.push(`Tứ Hóa: ${hd}`)
  }

  if (phucDuc) {
    lines.push(`\n**Cung Phúc Đức** — phúc khí gia tiên và tâm linh: ${phucDuc.chinhTinh.map(s => s.name).join(', ') || 'trống'} — ${starStatus(phucDuc) === 'strong' ? 'phúc ấm dày, tổ tiên phù hộ' : starStatus(phucDuc) === 'weak' ? 'cần chú ý thờ cúng gia tiên' : 'phúc đức bình thường'}.`)
  }

  return lines.filter(Boolean).join('\n')
}

function buildSucKhoe(data: LocalAnalysisInput): string {
  const tatAch = getPalace(data.palaces, 'Tật Ách')

  let lines = [`## Sức Khỏe & Tuổi Thọ\n`]

  if (tatAch) {
    const st = starStatus(tatAch)
    lines.push(`**Cung Tật Ách** (${tatAch.canCung} ${tatAch.tieuHan}) — chủ sức khỏe và bệnh tật:`)
    lines.push(warnDesc(tatAch))

    if (tatAch.chinhTinh.length === 0) {
      lines.push(`Cung Tật Ách trống — sức khỏe tổng thể tương đối ổn định.`)
    } else {
      for (const s of tatAch.chinhTinh) {
        const sp = STAR_PROFILE[s.name]
        lines.push(starProfile(s.name, s.status))
        if (sp) lines.push(`→ Chú ý: ${sp.health}`)
      }
    }

    if (st === 'strong') lines.push(`✦ Sức đề kháng tốt. Sức khỏe ổn định, hồi phục nhanh khi bệnh.`)
    else if (st === 'weak') lines.push(`⚠ Sức khỏe cần chú ý. Nên khám định kỳ và giữ thói quen sinh hoạt lành mạnh.`)

    const hd = hoaDesc(tatAch)
    if (hd) lines.push(`Tứ Hóa: ${hd}`)

    // Hung tinh effects
    const hungEffects = tatAch.saoxau
      .filter(s => HUNG_TINH_EFFECT[s.name])
      .map(s => `- **${s.name}**: ${HUNG_TINH_EFFECT[s.name]}`)
    if (hungEffects.length > 0) {
      lines.push(`\nCác hung tinh cần lưu ý trong cung Tật Ách:\n${hungEffects.join('\n')}`)
    }
  }

  // Longevity from Phúc Đức
  const phucDuc = getPalace(data.palaces, 'Phúc Đức')
  if (phucDuc) {
    const st = starStatus(phucDuc)
    lines.push(`\n**Cung Phúc Đức** liên quan tuổi thọ: ${st === 'strong' ? 'phúc đức dày, xu hướng sống thọ' : st === 'weak' ? 'cần chăm sóc sức khỏe và tích đức' : 'tuổi thọ bình thường'}.`)
  }

  return lines.filter(Boolean).join('\n')
}

function buildTuHoa(data: LocalAnalysisInput): string {
  let lines = [`## Tứ Hóa Xuyên Cung\n`]
  lines.push(`Tứ Hóa phân tích tác động của bốn hóa tinh khi xuyên vào các cung:\n`)

  let hasHoa = false
  for (const p of data.palaces) {
    const items: string[] = []
    if (p.locNhap)   items.push(`Hóa Lộc từ **${p.locNhap}**`)
    if (p.quyenNhap) items.push(`Hóa Quyền từ **${p.quyenNhap}**`)
    if (p.khoaNhap)  items.push(`Hóa Khoa từ **${p.khoaNhap}**`)
    if (p.kyNhap)    items.push(`Hóa Kỵ từ **${p.kyNhap}**`)
    if (items.length > 0) {
      hasHoa = true
      const desc = p.isLife ? `**Cung Mệnh (${p.tieuHan})** 🔴` : p.isBody ? `**Cung Thân (${p.name})** 🟡` : `Cung **${p.name}** (${p.tieuHan})`
      lines.push(`- ${desc}: ${items.join(', ')}`)

      // Extra meaning for important palaces
      if (p.isLife) {
        if (p.locNhap)   lines.push(`  → Hóa Lộc vào Mệnh: tài lộc và may mắn theo suốt cuộc đời`)
        if (p.quyenNhap) lines.push(`  → Hóa Quyền vào Mệnh: bẩm sinh có uy quyền, tính lãnh đạo mạnh`)
        if (p.khoaNhap)  lines.push(`  → Hóa Khoa vào Mệnh: danh tiếng tốt, được công nhận và quý trọng`)
        if (p.kyNhap)    lines.push(`  → Hóa Kỵ vào Mệnh: cuộc đời có nhiều trở ngại, cần kiên trì vượt qua`)
      }
    }
  }

  if (!hasHoa) lines.push(`Không phát hiện Tứ Hóa đặc biệt vào các cung chính. Lá số cân bằng tự nhiên.`)

  return lines.filter(Boolean).join('\n')
}

function buildDaiHanHienTai(data: LocalAnalysisInput): string {
  const { currentDH, daiHan, form } = data
  let lines = [`## Đại Hạn Hiện Tại\n`]

  if (!currentDH) {
    lines.push(`Chưa xác định được Đại Hạn hiện tại dựa trên năm sinh ${form.year}.`)
    return lines.join('\n')
  }

  const age = data.currentYear - form.year
  const dh = daiHan.find(d => d.startAge === currentDH.startAge)

  lines.push(`Hiện tại (${data.currentYear}), **${form.name || 'bạn'}** đang ở tuổi **${age}**, trong **Đại Hạn tuổi ${currentDH.startAge}–${currentDH.endAge}** (${currentDH.startYear}–${currentDH.endYear}).`)
  lines.push(`Đại Hạn cung **${currentDH.cungName}**.`)

  if (dh) {
    if (dh.trangSinh) {
      lines.push(`\n**Trạng Sinh:** ${dh.trangSinh} — ${TRANG_SINH_EFFECT[dh.trangSinh] ?? ''}`)
    }

    const hoa: string[] = []
    if (dh.locNhap)   hoa.push(`Hóa Lộc (${dh.locNhap}) → tài lộc vượng trong giai đoạn này`)
    if (dh.quyenNhap) hoa.push(`Hóa Quyền (${dh.quyenNhap}) → thăng tiến, quyền lực tăng`)
    if (dh.khoaNhap)  hoa.push(`Hóa Khoa (${dh.khoaNhap}) → danh tiếng và học vấn phát`)
    if (dh.kyNhap)    hoa.push(`Hóa Kỵ (${dh.kyNhap}) → cẩn thận trở ngại và mâu thuẫn`)
    if (hoa.length > 0) lines.push(`\n**Tứ Hóa Đại Hạn:** ${hoa.join('; ')}`)

    if (dh.chinhTinh.length > 0) {
      lines.push(`\n**Chính tinh Đại Hạn:** ${dh.chinhTinh.join(', ')}`)
    }
    if (dh.saotot.length > 0) {
      lines.push(`**Cát tinh:** ${dh.saotot.slice(0, 6).join(', ')} — hỗ trợ quý nhân, tài vận`)
    }
    if (dh.saoxau.length > 0) {
      lines.push(`**Hung tinh:** ${dh.saoxau.slice(0, 4).join(', ')} — cần đề phòng`)
    }

    // Overall assessment
    let quality = 5
    if (['Trường Sinh','Đế Vượng','Lâm Quan','Quan Đới'].includes(dh.trangSinh ?? '')) quality += 2
    if (['Tuyệt','Tử','Bệnh','Mộ'].includes(dh.trangSinh ?? '')) quality -= 2
    if (dh.locNhap) quality += 2
    if (dh.quyenNhap) quality += 1
    if (dh.kyNhap) quality -= 2
    quality = Math.max(1, Math.min(10, quality))
    lines.push(`\n**Đánh giá tổng thể Đại Hạn:** ${quality}/10 — ${dhScoreText(quality)}.`)

    if (quality >= 7) {
      lines.push(`Đây là giai đoạn **thuận lợi**. Nên mạnh dạn đầu tư, phát triển sự nghiệp và mở rộng quan hệ. Những quyết định quan trọng trong thời kỳ này thường có kết quả tốt.`)
    } else if (quality >= 5) {
      lines.push(`Giai đoạn **trung bình**, cần nỗ lực vừa phải. Không nên liều lĩnh nhưng cũng không nên bỏ lỡ cơ hội tốt. Duy trì ổn định và tích lũy.`)
    } else {
      lines.push(`Giai đoạn **nhiều thử thách**. Nên giữ thái độ bảo thủ, tránh rủi ro lớn, củng cố những gì đang có. Tĩnh tâm tu thân và chờ giai đoạn tốt hơn.`)
    }
  }

  return lines.filter(Boolean).join('\n')
}

function buildTieuHan(data: LocalAnalysisInput, targetYear: number): string {
  const th = data.tieuHan.find(t => t.years.includes(targetYear))
  let lines = [`## Tiểu Hạn Năm ${targetYear}\n`]

  if (!th) {
    lines.push(`Không tìm thấy dữ liệu Tiểu Hạn cho năm ${targetYear}.`)
    return lines.join('\n')
  }

  lines.push(`Năm **${targetYear}** (năm ${th.yearChi}), Tiểu Hạn đi vào cung **${th.cungName}** (${th.chiName}).`)

  if (th.chinhTinh.length > 0) lines.push(`\n**Chính tinh:** ${th.chinhTinh.join(', ')}`)

  const hoa: string[] = []
  if (th.locNhap)   hoa.push(`Hóa Lộc (${th.locNhap}) → tài lộc, thu nhập tăng`)
  if (th.quyenNhap) hoa.push(`Hóa Quyền (${th.quyenNhap}) → thăng tiến, uy quyền`)
  if (th.khoaNhap)  hoa.push(`Hóa Khoa (${th.khoaNhap}) → danh tiếng, thi đạt`)
  if (th.kyNhap)    hoa.push(`Hóa Kỵ (${th.kyNhap}) → trở ngại, tranh chấp`)
  if (hoa.length > 0) lines.push(`**Tứ Hóa năm:** ${hoa.join('; ')}`)

  if (th.saotot.length > 0) lines.push(`**Cát tinh:** ${th.saotot.join(', ')}`)
  if (th.saoxau.length > 0) lines.push(`**Hung tinh:** ${th.saoxau.join(', ')} — cẩn thận các rủi ro này`)

  // Assessment
  let score = 5
  if (th.locNhap)   score += 3
  if (th.quyenNhap) score += 2
  if (th.khoaNhap)  score += 1
  if (th.kyNhap)    score -= 3
  score = Math.max(1, Math.min(10, score))

  lines.push(`\n**Đánh giá năm ${targetYear}:** ${score}/10 — ${dhScoreText(score)}.`)

  if (score >= 7) {
    lines.push(`Năm ${targetYear} là năm **thuận lợi** cho ${data.form.name || 'bạn'}. Đây là thời điểm tốt để:`
      + `\n- Thực hiện các kế hoạch đã chuẩn bị`
      + `\n- Đầu tư và phát triển sự nghiệp`
      + `\n- Xây dựng hoặc củng cố các mối quan hệ quan trọng`)
  } else if (score >= 5) {
    lines.push(`Năm ${targetYear} ở mức **bình thường**. Nên duy trì ổn định, tránh quyết định lớn và tập trung vào công việc hàng ngày.`)
  } else {
    lines.push(`Năm ${targetYear} nhiều **thử thách**. Cần:`
      + `\n- Thận trọng trong chi tiêu và đầu tư`
      + `\n- Tránh tranh chấp và kiện tụng`
      + `\n- Chú ý sức khỏe và an toàn giao thông`)
  }

  return lines.filter(Boolean).join('\n')
}

function buildLoTrinh(data: LocalAnalysisInput): string {
  let lines = [`## Lộ Trình Các Đại Hạn\n`]
  lines.push(`Tổng quan chất lượng từng Đại Hạn trong cuộc đời:\n`)

  for (const dh of data.daiHan) {
    const startYear = data.form.year + dh.startAge - 1
    let score = 5
    if (['Trường Sinh','Đế Vượng','Lâm Quan','Quan Đới'].includes(dh.trangSinh ?? '')) score += 2
    if (['Tuyệt','Tử','Bệnh','Mộ'].includes(dh.trangSinh ?? '')) score -= 2
    if (dh.locNhap)   score += 2
    if (dh.quyenNhap) score += 1
    if (dh.kyNhap)    score -= 2
    score = Math.max(1, Math.min(10, score))

    const bar = '█'.repeat(Math.round(score / 2)) + '░'.repeat(5 - Math.round(score / 2))
    const label = score >= 7 ? '✦ Tốt' : score >= 5 ? '▪ TB' : '⚠ Khó'
    lines.push(`- **Tuổi ${dh.startAge}–${dh.endAge}** (${startYear}–${startYear+9}) · Cung ${dh.cungName} · ${dh.trangSinh ?? ''}: ${bar} ${score}/10 ${label}`)
  }

  return lines.join('\n')
}

function buildKetLuan(data: LocalAnalysisInput, targetYear: number): string {
  const menh     = getPalace(data.palaces, 'Mệnh')
  const quanLoc  = getPalace(data.palaces, 'Quan Lộc')
  const taiBach  = getPalace(data.palaces, 'Tài Bạch')
  const name     = data.form.name || 'Bạn'

  const menhSt  = starStatus(menh)
  const quanSt  = starStatus(quanLoc)
  const taiSt   = starStatus(taiBach)

  const strengths: string[] = []
  const weaknesses: string[] = []

  if (menhSt === 'strong') strengths.push('tính cách mạnh mẽ, có sức hút tự nhiên')
  else if (menhSt === 'weak') weaknesses.push('cần rèn luyện tính cách và sự quyết đoán')

  if (quanSt === 'strong') strengths.push('tiềm năng sự nghiệp vượt trội')
  else if (quanSt === 'weak') weaknesses.push('sự nghiệp cần nhiều nỗ lực hơn người thường')

  if (taiSt === 'strong') strengths.push('tài vận ổn định')
  else if (taiSt === 'weak') weaknesses.push('cần quản lý tài chính cẩn thận')

  if (menh?.locNhap || menh?.quyenNhap) strengths.push('Tứ Hóa vào Mệnh rất thuận lợi')
  if (menh?.kyNhap) weaknesses.push('Hóa Kỵ vào Mệnh — cần kiên trì vượt khó')

  const lines = [`## Kết Luận & Lời Khuyên\n`]

  lines.push(`**Tóm tắt lá số ${name}** (${data.info.nam}, ${data.info.cuc}):\n`)

  if (strengths.length > 0) {
    lines.push(`**Điểm mạnh nổi bật:**`)
    strengths.forEach(s => lines.push(`- ${s}`))
  }

  if (weaknesses.length > 0) {
    lines.push(`\n**Điểm cần chú ý:**`)
    weaknesses.forEach(w => lines.push(`- ${w}`))
  }

  lines.push(`\n**Lời khuyên thiết thực:**`)
  lines.push(`- Hiểu rõ điểm mạnh của bản thân (${menh?.chinhTinh.map((s: { name: string }) => s.name).join(', ') || 'theo cung Mệnh'}) để phát huy tối đa`)
  lines.push(`- Chọn nghề nghiệp phù hợp với chính tinh và trạng thái sao trong cung Quan Lộc`)
  lines.push(`- Theo dõi các chu kỳ Đại Hạn để biết khi nào nên tiến, khi nào nên lui`)
  lines.push(`- Trong năm ${targetYear} (${data.currentYear === targetYear ? 'năm hiện tại' : 'năm được chọn phân tích'}): ${data.currentTH?.cungName ? `chú tâm vào cung ${data.currentTH.cungName}` : 'duy trì ổn định và tích lũy'}`)

  lines.push(`\n*Lưu ý: Phân tích này dựa trên nguyên tắc Tử Vi Đẩu Số — mang tính tham khảo. Số phận do chính mình tạo ra qua nỗ lực và phẩm hạnh. Lá số chỉ cho thấy xu hướng, không phải định mệnh bất biến.*`)

  return lines.filter(Boolean).join('\n')
}

function buildNhaCua(data: LocalAnalysisInput): string {
  const dienTrach = getPalace(data.palaces, 'Điền Trạch')
  let lines = [`## Nhà Cửa & Bất Động Sản\n`]

  if (!dienTrach) return lines.join('\n')

  const st = starStatus(dienTrach)
  lines.push(`**Cung Điền Trạch** (${dienTrach.canCung} ${dienTrach.tieuHan}):`)
  lines.push(warnDesc(dienTrach))

  if (dienTrach.chinhTinh.length === 0) {
    lines.push(`Cung trống — nhà cửa không cố định, có thể hay thay đổi chỗ ở.`)
  } else {
    for (const s of dienTrach.chinhTinh) lines.push(starProfile(s.name, s.status))
  }

  lines.push(st === 'strong'
    ? '✦ Thuận lợi về nhà cửa và bất động sản. Có thể sở hữu nhiều tài sản.'
    : st === 'weak'
    ? '⚠ Nhà cửa không ổn định. Cẩn thận với giao dịch bất động sản và tranh chấp nhà đất.'
    : 'Nhà cửa bình thường, ổn định vừa phải.')

  const hd = hoaDesc(dienTrach)
  if (hd) lines.push(`Tứ Hóa: ${hd}`)

  return lines.filter(Boolean).join('\n')
}

function buildXaHoi(data: LocalAnalysisInput): string {
  const thienDi = getPalace(data.palaces, 'Thiên Di')
  const boBinh  = getPalace(data.palaces, 'Bộ Binh') // fallback

  const target = thienDi ?? boBinh
  let lines = [`## Xã Hội & Di Chuyển\n`]

  if (!target) return lines.join('\n')

  const st = starStatus(target)
  lines.push(`**Cung Thiên Di** (${target.canCung} ${target.tieuHan}) — xuất ngoại và di chuyển:`)
  lines.push(warnDesc(target))

  if (target.chinhTinh.length > 0) {
    for (const s of target.chinhTinh) lines.push(starProfile(s.name, s.status))
  }

  lines.push(st === 'strong'
    ? '✦ Thuận lợi khi ra ngoài, đi xa, xuất ngoại. Quan hệ xã hội rộng rãi.'
    : st === 'weak'
    ? '⚠ Di chuyển xa dễ gặp trở ngại. Cẩn thận khi xuất ngoại và đi lại.'
    : 'Di chuyển và giao tiếp xã hội ở mức bình thường.')

  // Thiên Mã
  const maStars = target.saotot.filter(s => s.name === 'Thiên Mã')
  if (maStars.length > 0) lines.push(`✦ Có Thiên Mã — thuận lợi cho việc xuất ngoại, đi công tác xa, định cư ở nơi khác.`)

  const hd = hoaDesc(target)
  if (hd) lines.push(`Tứ Hóa: ${hd}`)

  return lines.filter(Boolean).join('\n')
}

// ── Main export ──────────────────────────────────────────────────────────────

export function generateLocalAnalysis(data: LocalAnalysisInput, targetYear: number): string {
  const sections: string[] = [
    buildTongQuan(data),
    buildTinhCach(data),
    buildSuNghiep(data),
    buildTaiChinh(data),
    buildTinhDuyen(data),
    buildGiaDinh(data),
    buildNhaCua(data),
    buildXaHoi(data),
    buildSucKhoe(data),
    buildTuHoa(data),
    buildDaiHanHienTai(data),
    buildTieuHan(data, targetYear),
    buildLoTrinh(data),
    buildKetLuan(data, targetYear),
  ]

  return sections.join('\n\n---\n\n')
}
