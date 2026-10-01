/**
 * 站点级内容配置（唯一事实源）。
 * 数据来源：社团公众号「大川飞桨领航团」已发布推文（见 legacy/content/posts/ 与 DESIGN.md §数据出处）。
 * 修改文案只动这一个文件，不要在组件里硬编码。
 */

export const CLUB = {
  name: '四川大学飞桨领航团',
  nameFull: '四川大学百度飞桨领航团',
  nameEn: 'SCU PaddlePaddle Pioneer Group',
  established: 2025,
  // Hero 大标题：取自社团 2026 招新推文标题口号「聚力AI，青春启航」
  slogan: '聚力 AI',
  sloganAccent: '青春启航',
  heroLede:
    '我们是四川大学百度飞桨领航团——一个由计算机学院承办、百度公司协办的 AI 学生社团。',
  manifesto:
    '飞桨领航团成立于 2025 年 7 月。我们举办的活动包括：技术培训和工程师认证、AI 修复唐卡、组织社员参加竞赛、运营新媒体。一年时间，社团已有 400 余名成员，核心成员 50 余名，活动累计覆盖近 5 万人次。',
  flow: ['好奇心', '学习基础', '动手实践', '团队协作', '开源分享', '持续迭代'],

  links: {
    github: 'https://github.com/SCU-PaddlePaddle-Pioneer-Group',
    qqGroup: '1098392715',
    wechat: '大川飞桨领航团',
  },
} as const

/**
 * 核心数据 —— 出自《年终总结报告｜SCU飞桨领航团2025》（公众号 2026-08-19 推文）。
 * 数字必须与事实一致，不要随意夸大。
 */
export const STATS = [
  { value: '400+', label: '在校成员' },
  { value: '5万+', label: '活动覆盖人次' },
  { value: '30+', label: '省级以上获奖人次' },
  { value: '2025', label: '社团成立年份' },
] as const

/**
 * 三大部门 —— 出自《聚力AI，青春启航｜2026年招新》（公众号 2026-08-25 推文）。
 */
export const DEPARTMENTS = [
  {
    index: '01',
    name: '技术部',
    nameEn: 'TECH',
    intro: '对人工智能、编程开发和项目实践感兴趣？从技术学习到真实项目，这里是动手派的起点。',
    points: ['飞桨及 AI 基础技术学习', 'AI 项目开发与功能测试', '技术培训与经验分享', '学科竞赛与创新项目'],
  },
  {
    index: '02',
    name: '活动部',
    nameEn: 'EVENTS',
    intro: '喜欢沟通协作，愿意把一个想法变成一场真正落地的活动？完整参与项目落地的全过程。',
    points: ['AI 主题活动策划与执行', '活动流程设计与现场组织', '嘉宾场地与人员对接', '校园合作与社团联动'],
  },
  {
    index: '03',
    name: '宣传部',
    nameEn: 'MEDIA',
    intro: '热爱设计、摄影、写作、新媒体运营？用创意讲好 AI 时代的故事，让更多人看见领航团。',
    points: ['公众号推文撰写与排版', '海报展板等视觉物料设计', '活动摄影与视频记录', '社交平台运营'],
  },
] as const

/** 加入我们 · 招新信息（同出处） */
export const JOIN = {
  title: '这个秋天，与我们一起出发',
  desc: '无论你是否有编程基础、来自哪个专业，只要对人工智能、活动策划或创意宣传感兴趣，都可以在这里找到自己的位置。关注公众号获取招新通知，或加入招新 QQ 群与我们一起出发。',
  qqNote: '招新 QQ 群',
  wechatNote: '微信公众号',
} as const
