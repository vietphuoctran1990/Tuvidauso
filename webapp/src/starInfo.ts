export interface StarDetail {
  element: string
  role: string
  meaning: string
  mieuEffect: string
  hamEffect: string
}

export const STAR_INFO: Record<string, StarDetail> = {
  'Tử vi': {
    element: 'Thổ', role: 'Chính Tinh - Đế Tinh (Vua các sao)',
    meaning: 'Chủ địa vị, quyền lực, phú quý. Người có sao này ở Mệnh có phong độ lãnh đạo, được tôn kính.',
    mieuEffect: 'Công danh hiển đạt, quyền quý, được Tả-Hữu phù giúp thì phát lớn.',
    hamEffect: 'Kiêu ngạo, cô đơn, khó gần, dễ bị người phản bội.',
  },
  'Liêm trinh': {
    element: 'Hỏa', role: 'Chính Tinh - Thứ Đế Tinh',
    meaning: 'Chủ tình ái, phúc thọ, quan hệ xã hội. Sao đa tình, có nhan sắc và sức hút.',
    mieuEffect: 'Văn tài xuất chúng, phú quý, tình duyên tốt, sự nghiệp thăng tiến.',
    hamEffect: 'Dâm đãng, vướng tù tội, tình cảm phức tạp.',
  },
  'Thiên đồng': {
    element: 'Thủy', role: 'Chính Tinh - Phúc Tinh',
    meaning: 'Chủ an nhàn, hưởng thụ, phúc phận trời ban. Người hiền lành, nhẹ nhàng, ít lo nghĩ.',
    mieuEffect: 'Phúc thọ song toàn, cuộc sống sung túc nhàn hạ.',
    hamEffect: 'Lười biếng, ỷ lại, khó tự lập, dễ bị người lợi dụng.',
  },
  'Vũ khúc': {
    element: 'Kim', role: 'Chính Tinh - Tài Tinh',
    meaning: 'Chủ tiền bạc, tài chính, kinh doanh. Người cương trực, quyết đoán, có đầu óc tài chính.',
    mieuEffect: 'Giàu có, kinh doanh thành công, quyết đoán nhạy bén.',
    hamEffect: 'Cô đơn, góa bụa, tham lam, khắc vợ/chồng.',
  },
  'Thái dương': {
    element: 'Hỏa', role: 'Chính Tinh - Quý Nhân Tinh',
    meaning: 'Chủ địa vị, danh vọng, cha (hoặc chồng với nữ). Sao của sự hiển đạt và vinh quang.',
    mieuEffect: 'Công danh hiển đạt, được quý nhân phù trợ, uy tín cao.',
    hamEffect: 'Gian truân, cha yếu hoặc mất sớm, khó được người giúp.',
  },
  'Thiên cơ': {
    element: 'Mộc', role: 'Chính Tinh - Trí Tuệ Tinh',
    meaning: 'Chủ trí tuệ, biến đổi, linh hoạt. Người thông minh, đa mưu túc kế, hay thay đổi.',
    mieuEffect: 'Thông minh xuất chúng, tài mưu lược, thành công qua trí óc.',
    hamEffect: 'Hay thay đổi, thiếu ổn định, dễ bất an tâm lý.',
  },
  'Thiên phủ': {
    element: 'Thổ', role: 'Chính Tinh - Tài Khố Tinh (Kho báu)',
    meaning: 'Chủ giàu có, tích lũy, bảo thủ. Đây là sao kho báu, chủ về tài sản và sự tích lũy.',
    mieuEffect: 'Phú quý, tích lũy tài sản lớn, sống sung túc.',
    hamEffect: 'Tham lam, bảo thủ, khó hào phóng.',
  },
  'Thái âm': {
    element: 'Thủy', role: 'Chính Tinh - Điền Trạch Tinh',
    meaning: 'Chủ điền sản, mẹ (hoặc vợ), bất động sản. Sao của sự mềm mại, nội tâm phong phú.',
    mieuEffect: 'Giàu về bất động sản, phụ nữ may mắn, tình cảm gia đình tốt.',
    hamEffect: 'Mẹ yếu hoặc vắng, thất bại về nhà đất, nội tâm u uất.',
  },
  'Tham lang': {
    element: 'Thủy', role: 'Chính Tinh - Đào Hoa Tinh',
    meaning: 'Chủ tình ái, ham muốn, đào hoa. Người tài hoa, đa tình, thích hưởng thụ.',
    mieuEffect: 'Tài nghệ xuất chúng, hấp dẫn, gặp Hỏa/Linh thì phú quý bất ngờ.',
    hamEffect: 'Đa tình, hay thay tình cảm, dễ vướng tệ nạn xã hội.',
  },
  'Cự môn': {
    element: 'Thủy', role: 'Chính Tinh - Khẩu Thiệt Tinh',
    meaning: 'Chủ tranh luận, thị phi, khẩu tài. Người hay cãi vã nhưng có tài hùng biện.',
    mieuEffect: 'Hùng biện xuất chúng, thành công nhờ lời nói, diễn thuyết.',
    hamEffect: 'Nhiều thị phi, hay bị hiểu lầm, tranh chấp pháp lý.',
  },
  'Thiên tướng': {
    element: 'Thủy', role: 'Chính Tinh - Ấn Tinh',
    meaning: 'Chủ ấn tín, phụ tá, quản lý. Người ngay thẳng, được tín nhiệm, giỏi quản lý.',
    mieuEffect: 'Quyền quý, được tin tưởng giao trọng trách, tốt cho công chức.',
    hamEffect: 'Thiếu quyết đoán, dễ bị lợi dụng, thụ động.',
  },
  'Thiên lương': {
    element: 'Mộc', role: 'Chính Tinh - Thanh Cao Tinh',
    meaning: 'Chủ y học, đạo đức, cứu giúp. Người có đức hạnh, hay giúp đỡ người khác.',
    mieuEffect: 'Phúc thọ, được tôn kính, thích hợp ngành y dược, tôn giáo.',
    hamEffect: 'Hay lo nghĩ, cô đơn, gánh nặng trách nhiệm lớn.',
  },
  'Thất sát': {
    element: 'Kim', role: 'Chính Tinh - Tướng Tinh',
    meaning: 'Chủ uy quyền, quyết đoán, chiến đấu. Người dũng cảm, mạnh mẽ, có tính chiến sĩ.',
    mieuEffect: 'Uy quyền, chiến thắng, lập nên sự nghiệp bằng sức mạnh bản thân.',
    hamEffect: 'Bạo lực, cô đơn, hay xung đột, dễ bị tai nạn.',
  },
  'Phá quân': {
    element: 'Thủy', role: 'Chính Tinh - Tiêu Hao Tinh',
    meaning: 'Chủ biến đổi, phá cũ xây mới, tiêu hao. Người thích cái mới, dám thay đổi.',
    mieuEffect: 'Tài cải tổ, lập nghiệp mới, phá cũ xây mới thành công.',
    hamEffect: 'Tiêu hao tài sản, biến động liên tục, khó ổn định.',
  },
  // Phụ tinh quan trọng
  'Lộc tồn': {
    element: 'Thổ', role: 'Phụ Tinh - Lộc Tinh',
    meaning: 'Sao lộc tài, tích lũy tiền bạc, an toàn. Bảo vệ tài sản và mang lại phúc lộc.',
    mieuEffect: 'Tài lộc dồi dào, an toàn về vật chất, không lo thiếu thốn.',
    hamEffect: 'Đơn độc nếu không có sao bạn đồng hành.',
  },
  'Văn xương': {
    element: 'Kim', role: 'Phụ Tinh - Văn Học Tinh',
    meaning: 'Sao văn học, thi cử, học vấn. Mang lại tài năng về chữ nghĩa và học hành.',
    mieuEffect: 'Học giỏi, thi đậu, thành công nhờ văn chương, nghiên cứu.',
    hamEffect: 'Gặp Kỵ thì học hành trở ngại, thi cử khó khăn.',
  },
  'Văn khúc': {
    element: 'Thủy', role: 'Phụ Tinh - Nghệ Thuật Tinh',
    meaning: 'Sao âm nhạc, nghệ thuật, tài hoa. Mang lại năng khiếu âm nhạc và sáng tạo.',
    mieuEffect: 'Tài nghệ nghệ thuật, âm nhạc, hội họa xuất chúng.',
    hamEffect: 'Gặp Kỵ thì tài hoa bị cản trở.',
  },
  'Tả phù': {
    element: 'Thổ', role: 'Phụ Tinh - Quý Nhân (Trên)',
    meaning: 'Sao quý nhân từ bề trên, người giúp đỡ có địa vị cao hơn. Tăng cường sức mạnh các sao chính.',
    mieuEffect: 'Được cấp trên, người có quyền thế giúp đỡ, hỗ trợ mạnh.',
    hamEffect: 'Yếu nếu đứng một mình không có sao đồng hành tốt.',
  },
  'Hữu bật': {
    element: 'Thổ', role: 'Phụ Tinh - Quý Nhân (Ngang)',
    meaning: 'Sao quý nhân ngang hàng, bạn bè, đồng nghiệp giúp đỡ. Tăng cường sức mạnh các sao chính.',
    mieuEffect: 'Bạn bè, đồng nghiệp hỗ trợ nhiệt tình, hợp tác thành công.',
    hamEffect: 'Yếu nếu đứng một mình không có sao đồng hành tốt.',
  },
  'Thiên khôi': {
    element: 'Hỏa', role: 'Phụ Tinh - Quý Nhân Nam',
    meaning: 'Sao quý nhân nam giới, thiên về công danh và học vấn. Được quý nhân nam giúp đỡ.',
    mieuEffect: 'Được quý nhân nam nâng đỡ, công danh thuận lợi.',
    hamEffect: 'Tác dụng giảm khi gặp sao xấu đi kèm.',
  },
  'Thiên việt': {
    element: 'Hỏa', role: 'Phụ Tinh - Quý Nhân Nữ',
    meaning: 'Sao quý nhân nữ giới. Được quý nhân nữ giúp đỡ, tốt cho tình cảm và giao tế.',
    mieuEffect: 'Được quý nhân nữ hỗ trợ, xã giao tốt, tình duyên thuận.',
    hamEffect: 'Tác dụng giảm khi gặp sao xấu đi kèm.',
  },
  'Hóa lộc': {
    element: 'Thổ', role: 'Tứ Hóa - Hóa Lộc',
    meaning: 'Sao biến hóa mang lại tài lộc, may mắn. Khuếch đại vượng khí của sao đứng chung.',
    mieuEffect: 'Tài lộc, cơ hội, may mắn dồi dào trong cung này.',
    hamEffect: 'Đôi khi gây ra sự tham lam hay tiêu xài quá mức.',
  },
  'Hóa quyền': {
    element: 'Mộc', role: 'Tứ Hóa - Hóa Quyền',
    meaning: 'Sao biến hóa mang lại quyền lực, uy thế. Tăng cường sức mạnh và quyền hành.',
    mieuEffect: 'Quyền lực, uy thế, khả năng lãnh đạo được tăng cường.',
    hamEffect: 'Đôi khi độc đoán, tranh giành quyền lực không cần thiết.',
  },
  'Hóa khoa': {
    element: 'Thủy', role: 'Tứ Hóa - Hóa Khoa',
    meaning: 'Sao biến hóa mang lại danh tiếng, học vấn. Tăng uy tín và sự công nhận của xã hội.',
    mieuEffect: 'Danh tiếng tốt, học vấn thành công, được xã hội công nhận.',
    hamEffect: 'Ít tác dụng phụ tiêu cực, đây là sao khá lành.',
  },
  'Hóa kỵ': {
    element: 'Thủy', role: 'Tứ Hóa - Hóa Kỵ',
    meaning: 'Sao biến hóa mang lại trở ngại, phiền não. Khuếch đại các mặt tiêu cực.',
    mieuEffect: 'Không có mặt tốt, cần cẩn trọng trong cung có sao này.',
    hamEffect: 'Trở ngại, phiền não, mất mát, thất bại liên quan đến cung đó.',
  },
  'Kình dương': {
    element: 'Kim', role: 'Phụ Tinh - Hung Tinh',
    meaning: 'Sao hung hăng, tai họa, bạo lực. Thường gây ra xung đột và thương tổn.',
    mieuEffect: 'Trong một số trường hợp giúp mạnh mẽ quyết đoán nếu có sao tốt đi kèm.',
    hamEffect: 'Hung hăng, hay va chạm, dễ bị thương tích, tai nạn.',
  },
  'Đà la': {
    element: 'Kim', role: 'Phụ Tinh - Hung Tinh',
    meaning: 'Sao trở ngại, chậm trễ, thụt lùi. Gây ra sự trì hoãn và trở ngại liên tục.',
    mieuEffect: 'Đôi khi giúp kiên trì, bền bỉ vượt qua thử thách.',
    hamEffect: 'Chậm chạp, hay bị trở ngại, khó tiến tới mục tiêu.',
  },
  'Địa không': {
    element: 'Hỏa', role: 'Phụ Tinh - Hung Tinh',
    meaning: 'Sao mất mát, hư không. Gây ra sự tiêu tan, mất đi những gì đang có.',
    mieuEffect: 'Đôi khi giúp buông bỏ, không tham lam.',
    hamEffect: 'Mất mát, tài sản tiêu tán, cơ hội vuột khỏi tầm tay.',
  },
  'Địa kiếp': {
    element: 'Hỏa', role: 'Phụ Tinh - Hung Tinh',
    meaning: 'Sao nguy hiểm, kiếp nạn. Gây ra các tai nạn, biến cố bất ngờ.',
    mieuEffect: 'Cần cẩn thận để tránh tai họa trong cung này.',
    hamEffect: 'Nguy hiểm, kiếp nạn, biến cố bất ngờ, mất mát đột ngột.',
  },
  'Hỏa tinh': {
    element: 'Hỏa', role: 'Phụ Tinh - Hung/Cát Tinh',
    meaning: 'Sao lửa, hung khi đứng một mình nhưng gặp Tham Lang thì cực phú quý bất ngờ.',
    mieuEffect: 'Gặp Tham Lang: phú quý đột biến, giàu nhanh bất ngờ.',
    hamEffect: 'Đứng một mình: nóng nảy, bạo lực, dễ xảy ra hỏa hoạn.',
  },
  'Linh tinh': {
    element: 'Hỏa', role: 'Phụ Tinh - Hung/Cát Tinh',
    meaning: 'Sao linh, hung khi đứng một mình nhưng gặp Tham Lang thì cực phú quý bất ngờ.',
    mieuEffect: 'Gặp Tham Lang: phú quý đột biến tương tự Hỏa Tinh.',
    hamEffect: 'Đứng một mình: hung dữ, tai họa, bệnh tật bất ngờ.',
  },
  'Thiên mã': {
    element: 'Hỏa', role: 'Phụ Tinh - Di Động Tinh',
    meaning: 'Sao di chuyển, bôn ba. Người có sao này hay đi lại, thay đổi chỗ ở.',
    mieuEffect: 'Thành công nhờ di chuyển, xuất ngoại, du lịch.',
    hamEffect: 'Không yên một chỗ, hay phải bôn ba vất vả.',
  },
}

export const PALACE_INFO: Record<string, { meaning: string; aspects: string[] }> = {
  'Mệnh': {
    meaning: 'Cung quan trọng nhất, thể hiện bản thân tổng quát, tính cách, sức khỏe và vận mệnh cuộc đời.',
    aspects: ['Bản tính, tính cách', 'Ngoại hình, dáng vẻ', 'Vận mệnh tổng quát', 'Sức khỏe tổng thể'],
  },
  'Phụ mẫu': {
    meaning: 'Phản ánh mối quan hệ với cha mẹ, bề trên, và các vấn đề pháp lý, giấy tờ.',
    aspects: ['Cha mẹ, ông bà', 'Quan hệ với bề trên', 'Giấy tờ pháp lý', 'Nhà ở, nơi sinh'],
  },
  'Phúc đức': {
    meaning: 'Phúc phần trời ban, đời sống tinh thần, hưởng thụ và phúc từ tổ tiên.',
    aspects: ['Phúc lộc trời ban', 'Đời sống tinh thần', 'Thú vui, giải trí', 'Phúc từ tổ tiên'],
  },
  'Điền trạch': {
    meaning: 'Nhà cửa, bất động sản, nơi ở và tài sản cố định.',
    aspects: ['Nhà đất, BĐS', 'Nơi sinh sống', 'Tài sản cố định', 'Phong thủy nhà ở'],
  },
  'Quan lộc': {
    meaning: 'Sự nghiệp, công danh, chức vụ và cơ hội thăng tiến trong công việc.',
    aspects: ['Sự nghiệp, chức vụ', 'Công danh, địa vị', 'Kinh doanh', 'Thăng tiến, cơ hội'],
  },
  'Nô bộc': {
    meaning: 'Cấp dưới, bạn bè, đối tác và người giúp việc trong cuộc sống.',
    aspects: ['Bạn bè, đồng nghiệp', 'Cấp dưới, nhân viên', 'Đối tác kinh doanh', 'Quan hệ xã hội'],
  },
  'Di': {
    meaning: 'Di chuyển, xuất ngoại, thay đổi môi trường và vận may khi đi xa.',
    aspects: ['Du lịch, di chuyển', 'Xuất ngoại, định cư', 'Thay đổi môi trường', 'Vận may khi đi xa'],
  },
  'Tật ách': {
    meaning: 'Sức khỏe, bệnh tật, tai nạn và những trở ngại về thể chất.',
    aspects: ['Sức khỏe thể chất', 'Bệnh tật, tai nạn', 'Tâm lý, tinh thần', 'Tuổi thọ'],
  },
  'Tài bạch': {
    meaning: 'Tài chính, thu nhập, tiền bạc và khả năng kiếm tiền.',
    aspects: ['Thu nhập, tiền bạc', 'Tài chính cá nhân', 'Đầu tư, kinh doanh', 'Khả năng giữ tiền'],
  },
  'Tử tức': {
    meaning: 'Con cái, sáng tạo, học trò và mọi thứ "sinh ra" từ bản thân.',
    aspects: ['Con cái, sinh sản', 'Học sinh, đệ tử', 'Sáng tạo, dự án', 'Phúc từ con cái'],
  },
  'Phu thê': {
    meaning: 'Hôn nhân, vợ/chồng, tình duyên và mối quan hệ lứa đôi.',
    aspects: ['Hôn nhân, vợ/chồng', 'Tình duyên, bạn đời', 'Hạnh phúc gia đình', 'Quan hệ tình cảm'],
  },
  'Huynh đệ': {
    meaning: 'Anh chị em, bạn bè thân thiết và mối quan hệ ngang hàng.',
    aspects: ['Anh chị em ruột', 'Bạn bè thân thiết', 'Đồng nghiệp, cộng sự', 'Quan hệ ngang hàng'],
  },
}

export const TRANG_SINH_INFO: Record<string, string> = {
  'Trường sinh': 'Đầu đời phát triển mạnh mẽ, sức sống dồi dào.',
  'Mộc dục': 'Giai đoạn học hỏi, có thể gặp khó khăn ban đầu.',
  'Quan đới': 'Trưởng thành, bắt đầu có địa vị và trách nhiệm.',
  'Lâm quan': 'Đỉnh cao sự nghiệp, quyền lực và danh vọng.',
  'Đế vượng': 'Cực thịnh, đỉnh cao nhất của vận khí.',
  'Suy': 'Bắt đầu suy giảm, cần cẩn thận giữ gìn.',
  'Bệnh': 'Vận khí yếu, dễ gặp bệnh tật, trở ngại.',
  'Tử': 'Vận khí tụt xuống thấp, cần thận trọng.',
  'Mộ': 'Thu về, tích lũy nội lực, có thể ẩn dật.',
  'Tuyệt': 'Kết thúc một chu kỳ, chuẩn bị cho cái mới.',
  'Thai': 'Khởi đầu mới, tiềm năng đang hình thành.',
  'Dưỡng': 'Dưỡng sức, chuẩn bị cho giai đoạn mới.',
}
