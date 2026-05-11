import { shallowReactive, markRaw } from 'vue'

// ===== 学科定义（与项目 seed_subjects.py 一致）=====
export const subjects = [
  { id: 's1', key: 'python', name: 'Python 编程', icon: 'logos:python', color: '', bgColor: '#e0f2fe', description: 'Python 编程语言基础与进阶', isActive: true },
  { id: 's2', key: 'machine_learning', name: '机器学习', icon: 'icon-park-outline:brain', color: '#a855f7', bgColor: '#f4e8ff', description: '机器学习算法与应用', isActive: true },
  { id: 's4', key: 'advanced_math', name: '高等数学', icon: 'icon-park-outline:formula', color: '#3b82f6', bgColor: '#dbeafe', description: '微积分、级数、多元函数', isActive: true },
  { id: 's6', key: 'probability', name: '概率论', icon: 'icon-park-outline:chart-graph', color: '#7c3aed', bgColor: '#ede9fe', description: '概率空间、随机变量、概率分布与极限定理', isActive: true },
  { id: 's7', key: 'linear_algebra', name: '线性代数', icon: 'icon-park-outline:table', color: '#4f46e5', bgColor: '#e0e7ff', description: '矩阵运算、向量空间、特征值理论', isActive: true },
  { id: 's8', key: 'statistics', name: '统计学', icon: 'icon-park-outline:chart-histogram', color: '#0d9488', bgColor: '#ccfbf1', description: '描述统计、假设检验、回归分析', isActive: true },
  { id: 's5', key: 'ai_literacy', name: 'AI通识与AI素养', icon: 'icon-park-outline:brain', color: '#06b6d4', bgColor: '#e0f7fa', description: '全面认知AI、掌握AI智能体落地能力与AI素养体系', isActive: true },
]

// ===== 知识节点（按学科分类）=====
const knowledgeNodes = {
  python: ['变量与类型', '条件语句', '循环结构', '函数定义', '列表操作', '字典操作', '文件读写', '异常处理', '面向对象', '模块导入', '装饰器', '生成器', '正则表达式', '数据库操作', '网络编程'],
  machine_learning: ['线性回归', '逻辑回归', '决策树', '随机森林', 'SVM', 'KNN', '朴素贝叶斯', '聚类分析', '降维方法', '神经网络基础', '梯度下降', '交叉验证', '特征工程', '模型评估', '集成学习'],
  advanced_math: ['极限', '连续', '导数', '微分', '不定积分', '定积分', '级数', '多元函数', '偏导数', '重积分', '线性代数基础', '矩阵运算', '行列式', '特征值', '概率论基础'],
  probability: ['样本空间与事件', '概率公理', '古典概型', '条件概率', '贝叶斯公式', '事件独立性', '离散随机变量', '连续随机变量', '数学期望', '方差', '协方差', '大数定律', '中心极限定理', '联合分布', '边际分布'],
  linear_algebra: ['行列式定义', '行列式性质', '克拉默法则', '矩阵运算', '逆矩阵', '初等变换', '高斯消元法', '解的结构', '秩与可解性', '向量空间', '基与维数', '线性变换', '特征值计算', '对角化', '二次型'],
  statistics: ['集中趋势', '离散程度', '数据可视化', '抽样方法', '卡方分布', 't分布', 'F分布', '点估计', '区间估计', '假设检验', 'Z检验', 't检验', '一元回归', '多元回归', '方差分析'],
  ai_literacy: ['AI认知重构', 'AI发展历程', '大模型原理', 'AI工具生态', 'AI应用落地', 'AI伦理合规', 'AI未来趋势', 'Markdown', 'JSON数据格式', 'CLI命令行', 'Node.js与Python环境', 'Git与GitHub', 'YAML配置', 'API与Docker', 'AI智能体实战'],
}

// ===== 中文姓名生成器 =====
const lastNames = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '林', '何', '高', '罗', '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭', '曾', '肖', '田', '董', '潘', '袁', '蔡', '蒋', '余']
const firstNames = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '洋', '勇', '艳', '杰', '军', '辉', '建国', '建华', '明', '新', '华', '文', '玉梅', '秀兰', '海', '飞', '鑫', '博', '宇航', '子涵', '梓轩', '雨泽', '浩然', '子墨', '思源', '一诺', '欣怡', '梓萱', '诗涵', '雅琪', '梦瑶']

export function randomName() {
  const ln = lastNames[Math.floor(Math.random() * lastNames.length)]
  const fn = firstNames[Math.floor(Math.random() * firstNames.length)]
  return ln + fn
}

// ===== 日期工具 =====
function randomDate(startDays, endDays) {
  const now = new Date('2026-04-07')
  const start = new Date(now.getTime() - startDays * 86400000)
  const end = new Date(now.getTime() - endDays * 86400000)
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0]
}

function randomDatetime(startDays, endDays) {
  const now = new Date('2026-04-07T08:00:00')
  const start = new Date(now.getTime() - startDays * 86400000)
  const end = new Date(now.getTime() - endDays * 86400000)
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  return d.toISOString().replace('T', ' ').split('.')[0]
}

function getScoreByDifficulty(key) {
  if (key === 'advanced_math' || key === 'probability' || key === 'linear_algebra') {
    return Math.floor(Math.random() * 40 + 45) // 难度极高: 45~85
  } else if (key === 'machine_learning' || key === 'statistics') {
    return Math.floor(Math.random() * 35 + 55) // 难度较高: 55~90
  } else if (key === 'ai_literacy') {
    return Math.floor(Math.random() * 25 + 70) // 难度中低（通识课）: 70~95
  } else {
    return Math.floor(Math.random() * 30 + 65) // 难度中等: 65~95
  }
}


// ===== 生成 500 个用户 =====
export const userList = shallowReactive([])

const levels = ['beginner', 'intermediate', 'advanced']
const levelLabels = { beginner: '初级', intermediate: '中级', advanced: '高级' }
const paces = ['light', 'medium', 'intense']
const paceLabels = { light: '轻松', medium: '适中', intense: '密集' }
const onboardingStatuses = ['not_started', 'in_progress', 'completed']

for (let i = 1; i <= 500; i++) {
  const createdAt = randomDatetime(180, 1)
  const lastLogin = randomDate(30, 0)
  const level = levels[Math.floor(Math.random() * 3)]
  const pace = paces[Math.floor(Math.random() * 3)]

  // 每个用户随机选修 1-4 门学科
  const subjectCount = Math.floor(Math.random() * 4) + 1
  const shuffled = [...subjects].sort(() => 0.5 - Math.random())
  const enrolledSubjects = shuffled.slice(0, subjectCount)

  // 为每门学科生成学习数据
  const subjectProfiles = enrolledSubjects.map(sub => {
    const nodes = knowledgeNodes[sub.key] || []
    const masteredCount = Math.floor(Math.random() * nodes.length)
    const weakPoints = nodes.slice(masteredCount).slice(0, Math.floor(Math.random() * 3) + 1)
    const onboarding = onboardingStatuses[Math.floor(Math.random() * 3)]

    // 能力标签（模拟 ability_tags）
    const abilityTags = {}
    nodes.forEach(n => {
      abilityTags[n] = Math.floor(Math.random() * 100)
    })

    return {
      subjectId: sub.id,
      subjectKey: sub.key,
      subjectName: sub.name,
      level: level,
      pace: pace,
      onboardingStatus: onboarding,
      masteredNodes: masteredCount,
      totalNodes: nodes.length,
      weakPoints,
      abilityTags,
      completionRate: parseFloat((masteredCount / nodes.length * 100).toFixed(1)),
      score: getScoreByDifficulty(sub.key)
    }
  })

  // 总体学习统计
  const totalStudyDuration = Math.floor(Math.random() * 3000) + 50 // 分钟
  const totalPracticeCount = Math.floor(Math.random() * 500) + 10
  const correctRate = parseFloat((Math.random() * 40 + 55).toFixed(1))
  const aiInteractionCount = Math.floor(Math.random() * 200)
  const streakDays = Math.floor(Math.random() * 30)
  const xp = Math.floor(Math.random() * 5000)
  const userLevel = Math.floor(xp / 500) + 1

  userList.push(markRaw({
    id: `user-${String(i).padStart(4, '0')}`,
    email: `student${i}@atrack.edu.cn`,
    phone: `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
    name: randomName(),
    gender: i % 2 === 0 ? '男' : '女',
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=user${i}`,
    createdAt,
    lastLogin,
    // 学科档案
    enrolledSubjects: enrolledSubjects.map(s => s.name),
    enrolledSubjectKeys: enrolledSubjects.map(s => s.key),
    subjectProfiles,
    // 整体统计
    level,
    levelLabel: levelLabels[level],
    pacePreference: pace,
    paceLabel: paceLabels[pace],
    totalStudyDuration,
    totalStudyDurationFormatted: totalStudyDuration >= 60
      ? `${Math.floor(totalStudyDuration / 60)}h ${totalStudyDuration % 60}m`
      : `${totalStudyDuration}m`,
    totalPracticeCount,
    correctRate,
    aiInteractionCount,
    streakDays,
    xp,
    userLevel,
    // 状态
    status: lastLogin >= '2026-03-30' ? 'active' : lastLogin >= '2026-03-01' ? 'inactive' : 'churned',
    statusLabel: lastLogin >= '2026-03-30' ? '活跃' : lastLogin >= '2026-03-01' ? '不活跃' : '已流失'
  }))
}

// ===== 社区帖子模拟数据 =====
export const communityPosts = []
const postTitles = [
  '如何理解 Python 装饰器？', '线性回归的直觉解释', '高等数学极限求解技巧',
  '数据结构与算法心得分享',
  '求助：微积分基本定理证明', '机器学习入门路线推荐',
  '分享我的 Python 项目', '线性代数矩阵分解',
  '深度学习框架对比', '高级函数编程技巧',
  'KNN 算法实现细节', 'SVM 核函数选择', '递归与迭代的选择',
  '概率论中的贝叶斯公式', '面向对象设计原则', '学习打卡第30天！',
  'Python 爬虫实战经验', '数学建模竞赛心得'
]
// ===== 系统运营数据（最近30天趋势）=====
export const dailyStats = []
let currentActive = 160;
let currentNew = 12;
let currentDuration = 8000;

for (let i = 29; i >= 0; i--) {
  const date = new Date('2026-04-07')
  date.setDate(date.getDate() - i)
  const dateStr = date.toISOString().split('T')[0]
  
  // 模拟自然增长：活跃用户稳步小幅上升，有小波动
  currentActive = Math.max(100, currentActive + Math.floor(Math.random() * 8 - 2)); 
  // 学习时长严格递增，展现出 30 天稳步增长的良好趋势
  currentDuration += Math.floor(Math.random() * 250) + 50; 
  // 新增用户维持一定的波动
  currentNew = Math.max(8, currentNew + Math.floor(Math.random() * 7 - 3));

  dailyStats.push({
    date: dateStr,
    activeUsers: currentActive,
    newUsers: currentNew,
    studyDuration: currentDuration, // 稳步上升的分钟数
    practiceCount: Math.floor(Math.random() * 800) + 400,
    aiInteractions: Math.floor(Math.random() * 300) + 100,
    postsCreated: Math.floor(Math.random() * 15) + 3
  })
}

// ===== AI 对话记录模拟 =====
export function generateAIConversation(userName, subject) {
  const conversations = [
    { role: 'user', content: `老师，我不太理解${subject}中的这个概念，能帮我解释一下吗？` },
    { role: 'assistant', content: `好的，${userName}同学。让我用一个简单的例子来帮助你理解。首先，你能告诉我你目前对这个概念了解多少吗？` },
    { role: 'user', content: '我知道基本定义，但是在实际应用的时候总是搞不清楚。' },
    { role: 'assistant', content: '这很正常！很多同学在这一步会遇到困难。让我给你一个具体的场景...\n\n首先，我们需要理解核心原理。想象一下你在日常生活中遇到类似的情况...' },
    { role: 'user', content: '哦！我好像明白了，让我试着做一下这道题。' },
    { role: 'assistant', content: '很好！你的思路是对的。注意最后一步的细节处理，继续加油！🎉' }
  ]
  return conversations
}

// ===== 个性化学习建议模拟 =====
export function generateLearningAdvice(profile) {
  const advices = []
  if (profile.weakPoints && profile.weakPoints.length > 0) {
    advices.push(`📍 重点突破「${profile.weakPoints[0]}」，建议每天花 20 分钟进行专项练习`)
  }
  if (profile.completionRate < 50) {
    advices.push('📚 学习进度偏慢，建议制定每日学习计划，保持稳定的学习节奏')
  }
  if (profile.completionRate >= 80) {
    advices.push('🌟 学习进度优秀！可以尝试更高难度的题目来挑战自己')
  }
  advices.push('🤖 建议多使用 AI 导师功能，进行苏格拉底式对话学习')
  advices.push('📊 定期查看能力雷达图，了解自己的知识薄弱点')
  return advices
}

// ===== 统计计算工具 =====
export function getSubjectDistribution() {
  const dist = {}
  subjects.forEach(s => { dist[s.name] = 0 })
  userList.forEach(u => {
    u.enrolledSubjects.forEach(name => {
      dist[name] = (dist[name] || 0) + 1
    })
  })
  return Object.entries(dist).map(([name, value]) => ({ name, value }))
}

export function getLevelDistribution() {
  const dist = { '初级': 0, '中级': 0, '高级': 0 }
  userList.forEach(u => { dist[u.levelLabel]++ })
  return Object.entries(dist).map(([name, value]) => ({ name, value }))
}

export function getWeakPointStats() {
  const stats = {}
  userList.forEach(u => {
    u.subjectProfiles.forEach(sp => {
      sp.weakPoints.forEach(wp => {
        stats[wp] = (stats[wp] || 0) + 1
      })
    })
  })
  return Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, value]) => ({ name, value }))
}

export function getScoreDistribution() {
  const ranges = { '60-69': 0, '70-79': 0, '80-89': 0, '90-100': 0 }
  userList.forEach(u => {
    u.subjectProfiles.forEach(sp => {
      const s = sp.score
      if (s >= 90) ranges['90-100']++
      else if (s >= 80) ranges['80-89']++
      else if (s >= 70) ranges['70-79']++
      else ranges['60-69']++
    })
  })
  return Object.entries(ranges).map(([name, value]) => ({ name, value }))
}

export function getStatusDistribution() {
  const dist = { '活跃': 0, '不活跃': 0, '已流失': 0 }
  userList.forEach(u => { dist[u.statusLabel]++ })
  return Object.entries(dist).map(([name, value]) => ({ name, value }))
}

// ===== 全局后台模拟流 =====
// 无论在哪个页面，后台保持一定频率生成新用户
setInterval(() => {
  if (Math.random() > 0.4) {
    const randomSubjectObj = subjects[Math.floor(Math.random() * subjects.length)];
    const randomSub = randomSubjectObj.name;
    const levelsArr = ['初级', '中级', '高级'];
    const newLevel = levelsArr[Math.floor(Math.random() * 3)];
    const now = new Date();
    const nowHora = now.toLocaleTimeString('zh-CN', { hour12: false });
    const localDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const duration = Math.floor(Math.random() * 300) + 10;
    const durationFmt = duration >= 60 ? `${Math.floor(duration / 60)}h ${duration % 60}m` : `${duration}m`;
    const rate = parseFloat((Math.random() * 40 + 55).toFixed(1));
    const aiCount = Math.floor(Math.random() * 50);
    const xp = Math.floor(Math.random() * 1000) + 100;
    
    const nodes = knowledgeNodes[randomSubjectObj.key] || [];
    const masteredCount = Math.floor(Math.random() * nodes.length);
    const weakPoints = nodes.slice(masteredCount).slice(0, Math.floor(Math.random() * 3) + 1);
    const abilityTags = {};
    nodes.forEach(n => {
      abilityTags[n] = Math.floor(Math.random() * 100);
    });
    
    const subProfile = {
      subjectId: randomSubjectObj.id,
      subjectKey: randomSubjectObj.key,
      subjectName: randomSubjectObj.name,
      level: newLevel === '初级' ? 'beginner' : newLevel === '中级' ? 'intermediate' : 'advanced',
      pace: 'medium',
      onboardingStatus: 'in_progress',
      masteredNodes: masteredCount,
      totalNodes: nodes.length,
      weakPoints,
      abilityTags,
      completionRate: parseFloat((masteredCount / nodes.length * 100).toFixed(1)) || 0,
      score: getScoreByDifficulty(randomSubjectObj.key)
    };

    const fakeUser = markRaw({
      id: `user-sim-${Date.now()}`,
      name: randomName(),
      email: `data-${Math.floor(Math.random() * 9000)}@atrack.edu.cn`,
      phone: `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
      gender: Math.random() > 0.5 ? '男' : '女',
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=sim${Date.now()}`,
      enrolledSubjects: [randomSub],
      levelLabel: newLevel,
      paceLabel: '适中',
      totalStudyDurationFormatted: durationFmt,
      totalStudyDuration: duration,
      correctRate: rate,
      aiInteractionCount: aiCount,
      totalPracticeCount: Math.floor(Math.random() * 50) + 5,
      streakDays: Math.floor(Math.random() * 10) + 1,
      xp: xp,
      userLevel: Math.floor(xp / 500) + 1,
      status: 'active',
      statusLabel: '在线',
      lastLogin: localDateStr,
      createdAt: `${localDateStr} ${nowHora}`,
      subjectProfiles: [subProfile]
    });
    userList.unshift(fakeUser);
  }
}, 3000);
