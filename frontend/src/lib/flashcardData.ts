/**
 * 内置示例闪卡数据
 * 按学科分类，每个学科有多组可供切换
 */
import type { FlashCard } from './spacedRepetition'

export interface FlashCardGroup {
  id: string
  name: string
  icon: string       // emoji icon
  cardCount: number
  cards: FlashCard[]
}

// ─── 英语词汇 ────────────────────────────────────────────────────

const ENGLISH_GROUPS: FlashCardGroup[] = [
  {
    id: 'en-cet4-core',
    name: 'CET-4 核心词汇',
    icon: '📘',
    cardCount: 10,
    cards: [
      { id: 'en-1', front: 'Abundant', back: 'adj. 丰富的，充裕的\n例: Natural resources are abundant in this region.', category: '四级核心词', tags: ['CET-4'] },
      { id: 'en-2', front: 'Controversy', back: 'n. 争论，争议\n例: The new policy has caused considerable controversy.', category: '四级核心词', tags: ['CET-4'] },
      { id: 'en-3', front: 'Elaborate', back: 'adj. 精心制作的; v. 详细阐述\n例: Please elaborate on your proposal.', category: '四级核心词', tags: ['CET-4'] },
      { id: 'en-4', front: 'Fundamental', back: 'adj. 基本的，根本的\n例: Freedom of speech is a fundamental right.', category: '四级核心词', tags: ['CET-4'] },
      { id: 'en-5', front: 'Inevitable', back: 'adj. 不可避免的\n例: Change is inevitable in a dynamic world.', category: '四级核心词', tags: ['CET-4'] },
      { id: 'en-6', front: 'Magnificent', back: 'adj. 壮丽的，宏伟的\n例: The view from the mountain was magnificent.', category: '四级核心词', tags: ['CET-4'] },
      { id: 'en-7', front: 'Persistent', back: 'adj. 持久的，坚持不懈的\n例: His persistent effort paid off in the end.', category: '四级核心词', tags: ['CET-4'] },
      { id: 'en-8', front: 'Simultaneous', back: 'adj. 同时发生的\n例: The two events were simultaneous.', category: '四级核心词', tags: ['CET-4'] },
      { id: 'en-9', front: 'Tremendous', back: 'adj. 巨大的，极大的\n例: We have made tremendous progress this year.', category: '四级核心词', tags: ['CET-4'] },
      { id: 'en-10', front: 'Versatile', back: 'adj. 多才多艺的，多用途的\n例: She is a versatile actress who can play any role.', category: '四级核心词', tags: ['CET-4'] },
    ],
  },
  {
    id: 'en-cet4-phrases',
    name: 'CET-4 高频短语',
    icon: '📗',
    cardCount: 8,
    cards: [
      { id: 'en-p1', front: 'account for', back: '解释，说明；占（比例）\n例: Exports account for 30% of GDP.', category: '高频短语', tags: ['CET-4'] },
      { id: 'en-p2', front: 'break down', back: '分解; 崩溃; 出故障\n例: The car broke down on the highway.', category: '高频短语', tags: ['CET-4'] },
      { id: 'en-p3', front: 'come up with', back: '提出，想出\n例: She came up with a brilliant idea.', category: '高频短语', tags: ['CET-4'] },
      { id: 'en-p4', front: 'give rise to', back: '引起，导致\n例: The new policy gave rise to controversy.', category: '高频短语', tags: ['CET-4'] },
      { id: 'en-p5', front: 'in terms of', back: '在...方面；就...而言\n例: In terms of quality, this product is the best.', category: '高频短语', tags: ['CET-4'] },
      { id: 'en-p6', front: 'make sense', back: '有意义；讲得通\n例: This explanation makes sense.', category: '高频短语', tags: ['CET-4'] },
      { id: 'en-p7', front: 'take into account', back: '考虑到，顾及\n例: We should take all factors into account.', category: '高频短语', tags: ['CET-4'] },
      { id: 'en-p8', front: 'turn out', back: '结果是，证明是\n例: The project turned out to be a great success.', category: '高频短语', tags: ['CET-4'] },
    ],
  },
  {
    id: 'en-cet6-adv',
    name: 'CET-6 进阶词汇',
    icon: '📙',
    cardCount: 8,
    cards: [
      { id: 'en-6a1', front: 'Ambiguous', back: 'adj. 模棱两可的，含糊不清的\n例: The statement was deliberately ambiguous.', category: '六级词汇', tags: ['CET-6'] },
      { id: 'en-6a2', front: 'Contemplate', back: 'v. 沉思，深思熟虑\n例: He contemplated the meaning of life.', category: '六级词汇', tags: ['CET-6'] },
      { id: 'en-6a3', front: 'Deteriorate', back: 'v. 恶化，变坏\n例: The patient\'s condition deteriorated rapidly.', category: '六级词汇', tags: ['CET-6'] },
      { id: 'en-6a4', front: 'Encompass', back: 'v. 包含，涵盖\n例: The course encompasses a wide range of topics.', category: '六级词汇', tags: ['CET-6'] },
      { id: 'en-6a5', front: 'Fluctuate', back: 'v. 波动，起伏不定\n例: Oil prices fluctuate dramatically.', category: '六级词汇', tags: ['CET-6'] },
      { id: 'en-6a6', front: 'Illuminate', back: 'v. 照亮；阐明\n例: The research illuminated a crucial aspect.', category: '六级词汇', tags: ['CET-6'] },
      { id: 'en-6a7', front: 'Predominant', back: 'adj. 主要的，占优势的\n例: English is the predominant language in business.', category: '六级词汇', tags: ['CET-6'] },
      { id: 'en-6a8', front: 'Scrutinize', back: 'v. 仔细检查，审查\n例: The committee will scrutinize the evidence.', category: '六级词汇', tags: ['CET-6'] },
    ],
  },
]

// ─── 文学常识 ─────────────────────────────────────────────────────

const LITERATURE_GROUPS: FlashCardGroup[] = [
  {
    id: 'lit-tang-poetry',
    name: '唐诗名句',
    icon: '🏮',
    cardCount: 8,
    cards: [
      { id: 'lit-1', front: '"床前明月光，疑是地上霜" 的作者和出处？', back: '李白《静夜思》\n朝代：唐代\n体裁：五言绝句', category: '古诗词', tags: ['唐诗'] },
      { id: 'lit-2', front: '"大漠孤烟直，长河落日圆" 的作者和出处？', back: '王维《使至塞上》\n朝代：唐代\n体裁：五言律诗\n名句赏析：对仗工整，描绘壮阔边塞风光', category: '古诗词', tags: ['唐诗'] },
      { id: 'lit-t1', front: '"春眠不觉晓，处处闻啼鸟" 的作者和出处？', back: '孟浩然《春晓》\n朝代：唐代\n体裁：五言绝句\n名句赏析：以声衬静，春天的生机', category: '古诗词', tags: ['唐诗'] },
      { id: 'lit-t2', front: '"白日依山尽，黄河入海流" 的作者和出处？', back: '王之涣《登鹳雀楼》\n朝代：唐代\n体裁：五言绝句\n下句：欲穷千里目，更上一层楼', category: '古诗词', tags: ['唐诗'] },
      { id: 'lit-t3', front: '"两个黄鹂鸣翠柳，一行白鹭上青天" 的作者？', back: '杜甫《绝句》\n朝代：唐代\n体裁：七言绝句\n名句赏析：色彩鲜明，动静结合', category: '古诗词', tags: ['唐诗'] },
      { id: 'lit-t4', front: '"千山鸟飞绝，万径人踪灭" 的作者和出处？', back: '柳宗元《江雪》\n朝代：唐代\n体裁：五言绝句\n下句：孤舟蓑笠翁，独钓寒江雪', category: '古诗词', tags: ['唐诗'] },
      { id: 'lit-t5', front: '"锄禾日当午，汗滴禾下土" 的作者和出处？', back: '李绅《悯农（其二）》\n朝代：唐代\n体裁：五言绝句\n下句：谁知盘中餐，粒粒皆辛苦', category: '古诗词', tags: ['唐诗'] },
      { id: 'lit-t6', front: '"海内存知己，天涯若比邻" 的作者和出处？', back: '王勃《送杜少府之任蜀州》\n朝代：唐代\n体裁：五言律诗\n名句赏析：表达了真挚友情超越距离的主题', category: '古诗词', tags: ['唐诗'] },
    ],
  },
  {
    id: 'lit-song-ci',
    name: '宋词精选',
    icon: '🎋',
    cardCount: 8,
    cards: [
      { id: 'lit-8', front: '"但愿人长久，千里共婵娟" 出自哪首词？', back: '苏轼《水调歌头·明月几时有》\n朝代：北宋\n写作背景：中秋之夜思念弟弟苏辙\n婵娟：指月亮', category: '宋词', tags: ['宋词'] },
      { id: 'lit-s1', front: '"众里寻他千百度" 的下句和作者？', back: '辛弃疾《青玉案·元夕》\n下句：蓦然回首，那人却在灯火阑珊处\n朝代：南宋\n名句赏析：后被王国维用以比喻治学的最高境界', category: '宋词', tags: ['宋词'] },
      { id: 'lit-s2', front: '"问君能有几多愁？" 的下句和作者？', back: '李煜《虞美人》\n下句：恰似一江春水向东流\n朝代：南唐（词属宋词范畴）\n背景：亡国之痛，此词为李煜绝笔', category: '宋词', tags: ['宋词'] },
      { id: 'lit-s3', front: '"衣带渐宽终不悔，为伊消得人憔悴" 的作者？', back: '柳永《蝶恋花·伫倚危楼风细细》\n朝代：北宋\n名句赏析：被王国维喻为做学问的第二境界\n柳永是北宋婉约派代表词人', category: '宋词', tags: ['宋词'] },
      { id: 'lit-s4', front: '"大江东去，浪淘尽，千古风流人物" 出自？', back: '苏轼《念奴娇·赤壁怀古》\n朝代：北宋\n背景：苏轼被贬黄州，游赤壁\n风格：豪放派代表作', category: '宋词', tags: ['宋词'] },
      { id: 'lit-s5', front: '"寻寻觅觅，冷冷清清，凄凄惨惨戚戚" 出自？', back: '李清照《声声慢》\n朝代：南宋\n名句赏析：连用叠字，音韵优美\n李清照是婉约派代表词人', category: '宋词', tags: ['宋词'] },
      { id: 'lit-s6', front: '"醉里挑灯看剑，梦回吹角连营" 的作者？', back: '辛弃疾《破阵子·为陈同甫赋壮词以寄之》\n朝代：南宋\n名句赏析：表达壮志难酬的悲愤\n辛弃疾是豪放派代表词人', category: '宋词', tags: ['宋词'] },
      { id: 'lit-s7', front: '"人生如逆旅，我亦是行人" 的作者和出处？', back: '苏轼《临江仙·送钱穆父》\n朝代：北宋\n名句赏析：表达人生哲理，豁达超然', category: '宋词', tags: ['宋词'] },
    ],
  },
  {
    id: 'lit-classics',
    name: '文学名著',
    icon: '📚',
    cardCount: 8,
    cards: [
      { id: 'lit-3', front: '《红楼梦》的作者是谁？别名有哪些？', back: '作者：曹雪芹（后40回高鹗续）\n别名：《石头记》《情僧录》《风月宝鉴》《金陵十二钗》\n地位：中国古典四大名著之一', category: '文学常识', tags: ['名著'] },
      { id: 'lit-4', front: '"路漫漫其修远兮，吾将上下而求索" 出自哪里？', back: '屈原《离骚》\n朝代：战国时期\n体裁：楚辞\n含义：道路漫长而遥远，但我仍将百折不挠地去追求探索', category: '古诗词', tags: ['楚辞'] },
      { id: 'lit-5', front: '唐宋八大家指哪八位？', back: '唐代：韩愈、柳宗元\n宋代：欧阳修、苏洵、苏轼、苏辙、王安石、曾巩\n\n口诀：韩柳欧三苏，王曾排队走', category: '文学常识', tags: ['唐宋'] },
      { id: 'lit-6', front: '"人生自古谁无死，留取丹心照汗青" 的作者是谁？', back: '文天祥《过零丁洋》\n朝代：南宋\n背景：被元军俘虏途经零丁洋时所作\n汗青：指史册', category: '古诗词', tags: ['宋诗'] },
      { id: 'lit-7', front: '莎士比亚四大悲剧是哪四部？', back: '《哈姆雷特》(Hamlet)\n《奥赛罗》(Othello)\n《李尔王》(King Lear)\n《麦克白》(Macbeth)\n\n创作时期：1601-1606年', category: '文学常识', tags: ['外国文学'] },
      { id: 'lit-c1', front: '中国古典四大名著是哪四部？', back: '《红楼梦》— 曹雪芹\n《西游记》— 吴承恩\n《水浒传》— 施耐庵\n《三国演义》— 罗贯中', category: '文学常识', tags: ['名著'] },
      { id: 'lit-c2', front: '"世界三大短篇小说巨匠" 是谁？', back: '莫泊桑（法国）— 代表作《项链》《羊脂球》\n契诃夫（俄国）— 代表作《变色龙》《套中人》\n欧·亨利（美国）— 代表作《麦琪的礼物》《最后一片叶子》', category: '文学常识', tags: ['外国文学'] },
      { id: 'lit-c3', front: '鲁迅的第一篇白话文小说是什么？', back: '《狂人日记》（1918年）\n发表于《新青年》杂志\n意义：中国现代文学史上第一篇白话文小说\n主题：批判封建礼教"吃人"的本质', category: '文学常识', tags: ['现代文学'] },
    ],
  },
]

// ─── 历史时间线 ──────────────────────────────────────────────────

const HISTORY_GROUPS: FlashCardGroup[] = [
  {
    id: 'hist-ancient',
    name: '中国古代史',
    icon: '🏛️',
    cardCount: 8,
    cards: [
      { id: 'hist-1', front: '秦始皇统一六国是哪一年？', back: '公元前 221 年\n\n秦王嬴政统一六国，建立中国历史上第一个统一的封建王朝\n重要措施：书同文、车同轨、统一度量衡', category: '中国古代史', tags: ['秦朝'] },
      { id: 'hist-a1', front: '隋朝大运河是谁下令修建的？', back: '隋炀帝杨广（605年开始修建）\n\n连通：海河、黄河、淮河、长江、钱塘江\n全长约2700公里\n意义：促进南北经济文化交流', category: '中国古代史', tags: ['隋朝'] },
      { id: 'hist-a2', front: '"贞观之治" 是哪个皇帝的政绩？', back: '唐太宗李世民\n\n时间：627-649年\n特点：政治清明、经济恢复、社会安定\n善于纳谏，重用魏征、房玄龄、杜如晦', category: '中国古代史', tags: ['唐朝'] },
      { id: 'hist-a3', front: '科举制度始于哪个朝代？', back: '隋朝（隋文帝开始，隋炀帝设进士科）\n\n发展：唐朝完善，宋朝鼎盛\n废除：1905年（清光绪三十一年）\n历时约1300年', category: '中国古代史', tags: ['隋朝'] },
      { id: 'hist-a4', front: '造纸术是谁改进的？', back: '蔡伦（东汉，约105年）\n\n原材料：树皮、麻头、破布、旧鱼网\n意义：四大发明之一\n极大地促进了文化传播', category: '中国古代史', tags: ['汉朝'] },
      { id: 'hist-a5', front: '"开元盛世" 是指哪个时期？', back: '唐玄宗李隆基统治前期（713-741年）\n\n特点：国力达到鼎盛\n经济繁荣、文化昌盛、国际影响力巨大\n后因安史之乱（755年）由盛转衰', category: '中国古代史', tags: ['唐朝'] },
      { id: 'hist-a6', front: '郑和下西洋始于哪一年？共几次？', back: '1405年首次出发，共7次（1405-1433年）\n\n下令者：明成祖朱棣\n最远到达：非洲东海岸和红海沿岸\n船队规模：最多时200余艘', category: '中国古代史', tags: ['明朝'] },
      { id: 'hist-a7', front: '中国历史上唯一的女皇帝是谁？', back: '武则天\n\n在位时期：690-705年\n国号：周（武周）\n是中国历史上唯一正统的女皇帝\n政绩：发展科举，重用贤才', category: '中国古代史', tags: ['唐朝'] },
    ],
  },
  {
    id: 'hist-modern',
    name: '中国近现代史',
    icon: '🇨🇳',
    cardCount: 8,
    cards: [
      { id: 'hist-2', front: '鸦片战争爆发于哪一年？签订了什么条约？', back: '1840 年（第一次鸦片战争）\n\n签订《南京条约》（1842年）\n主要内容：割让香港岛、开放五口通商、赔款2100万银元\n意义：中国近代史的开端', category: '中国近代史', tags: ['清朝'] },
      { id: 'hist-4', front: '中华人民共和国成立于哪一年？', back: '1949 年 10 月 1 日\n\n毛泽东在天安门城楼庄严宣告\n中央人民政府成立\n标志着中国人民从此站起来了', category: '中国现代史', tags: ['新中国'] },
      { id: 'hist-6', front: '辛亥革命发生在哪一年？有什么历史意义？', back: '1911 年\n\n武昌起义（10月10日）\n推翻了清朝统治，结束了中国两千多年的封建帝制\n建立中华民国\n领导人：孙中山', category: '中国近代史', tags: ['民国'] },
      { id: 'hist-m1', front: '五四运动爆发于哪一年？导火索是什么？', back: '1919年5月4日\n\n导火索：巴黎和会上中国外交失败\n口号："外争国权，内惩国贼"\n意义：中国新民主主义革命的开端', category: '中国近代史', tags: ['民国'] },
      { id: 'hist-m2', front: '中国共产党成立于哪一年？在哪里？', back: '1921年7月23日\n\n地点：上海（一大会址）\n最后一天转移到嘉兴南湖\n出席代表：13人\n意义：开天辟地的大事变', category: '中国现代史', tags: ['建党'] },
      { id: 'hist-m3', front: '长征始于哪一年？行程约多少？', back: '1934年10月开始\n\n行程：约二万五千里\n起点：江西瑞金\n终点：陕北（1935年10月到达）\n关键会议：遵义会议（1935年1月）', category: '中国现代史', tags: ['红军'] },
      { id: 'hist-m4', front: '抗日战争全面爆发的标志是什么？', back: '七七事变（卢沟桥事变）\n时间：1937年7月7日\n\n抗战持续：1937-1945年（8年全面抗战）\n胜利：1945年8月15日日本宣布无条件投降', category: '中国近代史', tags: ['抗战'] },
      { id: 'hist-m5', front: '改革开放是从哪一年开始的？', back: '1978年\n\n标志：十一届三中全会\n总设计师：邓小平\n内容：对内改革、对外开放\n经济特区：深圳、珠海、汕头、厦门', category: '中国现代史', tags: ['改革开放'] },
    ],
  },
  {
    id: 'hist-world',
    name: '世界历史',
    icon: '🌍',
    cardCount: 8,
    cards: [
      { id: 'hist-3', front: '法国大革命爆发于哪一年？标志性事件是什么？', back: '1789 年\n\n标志性事件：攻占巴士底狱（7月14日）\n口号："自由、平等、博爱"\n发表《人权宣言》', category: '世界史', tags: ['法国'] },
      { id: 'hist-5', front: '文艺复兴运动起源于哪里？核心思想是什么？', back: '起源：14世纪的意大利（佛罗伦萨）\n\n核心思想：人文主义\n代表人物：达·芬奇、米开朗基罗、拉斐尔（文艺复兴三杰）\n影响：推动欧洲从中世纪向近代社会转型', category: '世界史', tags: ['文艺复兴'] },
      { id: 'hist-w1', front: '第一次工业革命始于哪个国家？标志是什么？', back: '英国（18世纪60年代）\n\n标志：瓦特改良蒸汽机\n影响：从手工劳动转为机器生产\n代表发明：珍妮纺纱机、蒸汽机车', category: '世界史', tags: ['工业革命'] },
      { id: 'hist-w2', front: '第一次世界大战的起止时间？', back: '1914-1918年\n\n导火索：萨拉热窝事件\n主要参战方：协约国 vs 同盟国\n结果：同盟国战败\n影响：四大帝国解体', category: '世界史', tags: ['一战'] },
      { id: 'hist-w3', front: '第二次世界大战的起止时间？', back: '1939-1945年\n\n开始标志：德国入侵波兰\n主要轴心国：德国、日本、意大利\n结果：反法西斯联盟胜利\n联合国成立（1945年）', category: '世界史', tags: ['二战'] },
      { id: 'hist-w4', front: '美国独立战争始于哪一年？', back: '1775年（莱克星顿枪声）\n\n《独立宣言》：1776年7月4日\n领导人：乔治·华盛顿\n意义：建立第一个资产阶级联邦制共和国', category: '世界史', tags: ['美国'] },
      { id: 'hist-w5', front: '冷战的起止时间？主要对立双方？', back: '1947-1991年\n\n双方：美国（北约）vs 苏联（华约）\n标志开始：杜鲁门主义\n标志结束：苏联解体（1991年12月）\n特点：未直接军事冲突的全面对抗', category: '世界史', tags: ['冷战'] },
      { id: 'hist-w6', front: '人类第一次登月是哪一年？', back: '1969年7月20日\n\n宇航员：尼尔·阿姆斯特朗（阿波罗11号）\n名言："这是个人的一小步，却是人类的一大步"\n国家：美国', category: '世界史', tags: ['航天'] },
    ],
  },
]

// ─── 通用混合卡组 ────────────────────────────────────────────────

const DEFAULT_GROUPS: FlashCardGroup[] = [
  {
    id: 'mix-literature',
    name: '文学常识精选',
    icon: '📖',
    cardCount: 8,
    cards: LITERATURE_GROUPS[0].cards,
  },
  {
    id: 'mix-history',
    name: '历史知识精选',
    icon: '🏛️',
    cardCount: 8,
    cards: HISTORY_GROUPS[0].cards,
  },
  {
    id: 'mix-english',
    name: '英语词汇精选',
    icon: '📘',
    cardCount: 8,
    cards: ENGLISH_GROUPS[0].cards.slice(0, 8),
  },
]

// ─── 按subject key获取对应的闪卡组列表 ──────────────────────────

export function getFlashcardGroups(subjectKey: string): FlashCardGroup[] {
  const key = subjectKey.toLowerCase()
  if (key.includes('english')) return ENGLISH_GROUPS
  if (key.includes('literature') || key.includes('chinese')) return LITERATURE_GROUPS
  if (key.includes('history')) return HISTORY_GROUPS
  return DEFAULT_GROUPS
}

// ─── 兼容旧接口：按subject key获取默认的第一组闪卡 ──────────────

export function getDefaultFlashcards(subjectKey: string): FlashCard[] {
  const groups = getFlashcardGroups(subjectKey)
  return groups[0]?.cards ?? []
}
