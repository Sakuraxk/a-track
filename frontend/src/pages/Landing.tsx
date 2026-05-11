import { ArrowRight, Brain, Code, Map, MessageSquare, PlayCircle, Users, Zap } from "lucide-react"
import { useNavigate } from "react-router-dom"

const subjectChips = [
  "Python 编程",
  "机器学习",
  "高等数学",
  "AI通识与AI素养",
]

const featureCards = [
  {
    icon: Brain,
    title: "动态知识主线",
    description: "根据你的基础、目标与学习节奏，自动组织知识点顺序，不让你在错位的内容里反复打转。",
    tone: "border-[oklch(90%_0.02_165)] bg-[linear-gradient(135deg,oklch(98%_0.012_165),oklch(99%_0.008_165))] text-[oklch(47%_0.09_165)]",
  },
  {
    icon: Code,
    title: "Learning Studio 工作台",
    description: "概念、练习、复盘和 AI 辅导在同一个空间里连续发生，不再被割裂的页面来回打断。",
    tone: "border-[oklch(89%_0.018_220)] bg-[linear-gradient(135deg,oklch(98%_0.01_220),oklch(99%_0.008_220))] text-[oklch(45%_0.09_220)]",
  },
  {
    icon: Zap,
    title: "克制的 AI 陪伴",
    description: "AI 不只是给答案，而是帮助你理解上下文、校准节奏、在卡住时把你带回正确的下一步。",
    tone: "border-[oklch(89%_0.02_80)] bg-[linear-gradient(135deg,oklch(98.8%_0.008_80),oklch(99%_0.006_80))] text-[oklch(53%_0.11_80)]",
  },
]

const pathSteps = [
  {
    index: "01",
    title: "了解你的当前状态",
    description: "通过基准测试和学习画像，找到真正影响推进速度的关键前置知识。",
  },
  {
    index: "02",
    title: "生成适合你的学习主线",
    description: "把学科目标拆成可执行节点，让今天和明天都知道要做什么。",
  },
  {
    index: "03",
    title: "在工作台里持续推进",
    description: "用同一空间承接概念学习、练习验证、AI 提问和复盘反馈。",
  },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900 font-sans selection:bg-[oklch(92%_0.05_165)] selection:text-slate-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(91%_0.05_165_/_0.18),transparent_26%),radial-gradient(circle_at_top_right,oklch(92%_0.04_220_/_0.14),transparent_24%),radial-gradient(circle_at_70%_65%,oklch(93%_0.04_80_/_0.10),transparent_24%)]"
      />

      <nav className="sticky top-0 z-50 px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-slate-200/80 bg-white px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.05)] md:px-6">
          <a href="#" className="flex items-center gap-3 font-display text-2xl font-semibold tracking-tight md:text-3xl">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
              <img src="/logo1.png" alt="Logo" className="h-full w-full object-contain p-0.5" />
            </div>
            <span>
              智辙 <span className="font-['Audiowide'] text-[0.75em] font-normal tracking-normal text-slate-500">A-TRACK</span>
            </span>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-slate-600 transition-colors hover:text-[oklch(46%_0.09_165)]">学习方式</a>
            <a href="#path" className="text-sm font-medium text-slate-600 transition-colors hover:text-[oklch(46%_0.09_220)]">学习路径</a>
            <a href="#community" className="text-sm font-medium text-slate-600 transition-colors hover:text-[oklch(53%_0.11_80)]">学习社区</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 md:block"
            >
              登录
            </button>
            <button
              onClick={() => navigate("/register")}
              className="inline-flex h-[44px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,oklch(31%_0.035_215),oklch(38%_0.05_165))] px-5 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(15,23,42,0.14)] transition-all hover:brightness-105"
            >
              免费开始
            </button>
          </div>
        </div>
      </nav>

      <header className="relative px-6 pb-20 pt-20 md:px-8 md:pt-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] lg:items-end">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[oklch(89%_0.02_165)] bg-[linear-gradient(135deg,oklch(98%_0.012_165),oklch(99%_0.008_80))] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.26em] text-[oklch(47%_0.09_165)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[oklch(58%_0.12_165)]" />
              AI 多学科自适应学习平台
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-slate-900 md:text-7xl lg:text-[5.5rem]">
                把自学这件事，
                <br />
                重新放回一个
                <span className="text-[oklch(55%_0.09_205)]">有秩序的学习空间</span>
                里。
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                智辙不是一个只会堆功能的学习平台，而是一个会帮你进入状态、维持节奏、衔接主线的自适应学习工作台。
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => navigate("/register")}
                className="inline-flex h-[54px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,oklch(31%_0.035_215),oklch(38%_0.05_165))] px-8 text-base font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] transition-all hover:brightness-105"
              >
                进入学习空间
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => navigate("/login")}
                className="inline-flex h-[54px] items-center justify-center gap-2 rounded-full border border-[oklch(89%_0.02_220)] bg-[linear-gradient(135deg,oklch(99%_0.006_220),oklch(98.8%_0.008_165))] px-8 text-base font-medium text-[oklch(44%_0.08_220)] transition-colors hover:border-[oklch(86%_0.03_220)] hover:bg-white"
              >
                <PlayCircle className="h-5 w-5" />
                继续我的课程
              </button>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              {subjectChips.map((chip, index) => (
                <span
                  key={chip}
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${
                    index % 3 === 0
                      ? "border-[oklch(89%_0.02_165)] bg-[oklch(98%_0.012_165)] text-[oklch(47%_0.09_165)]"
                      : index % 3 === 1
                        ? "border-[oklch(89%_0.018_220)] bg-[oklch(98%_0.01_220)] text-[oklch(44%_0.08_220)]"
                        : "border-[oklch(89%_0.02_80)] bg-[oklch(98.8%_0.008_80)] text-[oklch(53%_0.11_80)]"
                  }`}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div className="relative grid gap-4">
            <div className="absolute inset-x-6 top-4 h-40 rounded-2xl bg-[radial-gradient(circle_at_top_right,oklch(86%_0.07_165_/_0.20),transparent_34%),radial-gradient(circle_at_bottom_left,oklch(86%_0.05_220_/_0.18),transparent_32%)] blur-2xl" />

            <div className="relative rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,white,oklch(99%_0.004_210))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[oklch(46%_0.09_220)]">今日主线</p>
              <p className="mt-3 text-2xl font-semibold leading-tight text-slate-900">
                变量与类型
                <br />
                进入函数入门
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                系统先帮你回到主线，再决定是否补练或提问，不会让你在碎片页面里迷路。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[oklch(89%_0.02_165)] bg-[linear-gradient(135deg,oklch(98%_0.012_165),oklch(99%_0.008_165))] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
                <p className="text-sm font-medium text-[oklch(48%_0.09_165)]">Learning Studio</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  概念、AI 提问、练习与复盘在同一空间里自然衔接。
                </p>
              </div>
              <div className="rounded-2xl border border-[oklch(89%_0.02_80)] bg-[linear-gradient(135deg,oklch(98.8%_0.008_80),oklch(99%_0.006_80))] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
                <p className="text-sm font-medium text-[oklch(53%_0.11_80)]">学习节奏</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  不靠廉价激励，而靠清晰主线和稳定反馈让你持续推进。
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-[linear-gradient(145deg,oklch(29%_0.03_215),oklch(34%_0.05_165))] px-5 py-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
              <p className="text-sm text-white/72">学习空间感受</p>
              <p className="mt-3 text-lg leading-8 text-white/92">
                “像走进一间有光、有秩序、但不吵闹的学习工作室，而不是进入一个会不断打扰你的平台。”
              </p>
            </div>
          </div>
        </div>
      </header>

      <section id="features" className="px-6 py-20 md:px-8">
        <div className="mx-auto max-w-7xl space-y-12">
          <div className="max-w-3xl space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[oklch(47%_0.09_165)]">学习方式</p>
            <h2 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              把“会学什么”与“下一步做什么”，
              <span className="text-[oklch(44%_0.08_220)]">放进同一个设计语言里</span>
            </h2>
            <p className="text-lg leading-8 text-slate-600">
              颜色不再只用来制造刺激，而是帮助你判断主线、结构与学习状态。
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {featureCards.map((card) => (
              <div key={card.title} className={`rounded-2xl border p-8 shadow-[0_18px_60px_rgba(15,23,42,0.05)] ${card.tone}`}>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/75 shadow-sm">
                  <card.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900">{card.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="path" className="px-6 py-20 md:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,white,oklch(99%_0.004_210))] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)] md:p-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[oklch(89%_0.018_220)] bg-[linear-gradient(135deg,oklch(98%_0.01_220),oklch(99%_0.006_220))] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.26em] text-[oklch(44%_0.08_220)]">
                <Map className="h-4 w-4" />
                学习路径
              </div>
              <h2 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                从评估到工作台，
                <span className="text-[oklch(47%_0.09_165)]">每一步都能接得上</span>
              </h2>
              <p className="text-lg leading-8 text-slate-600">
                真正的个性化学习，不是给你更多内容，而是帮你把内容排进一个能持续推进的顺序里。
              </p>
              <button
                onClick={() => navigate("/register")}
                className="inline-flex items-center gap-2 rounded-full border border-[oklch(89%_0.02_80)] bg-[linear-gradient(135deg,oklch(99%_0.006_80),oklch(98.8%_0.008_165))] px-6 py-3.5 text-sm font-medium text-[oklch(43%_0.05_80)] transition-colors hover:border-[oklch(86%_0.03_80)] hover:bg-white"
              >
                开始生成我的路径
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4">
              {pathSteps.map((step, index) => (
                <div
                  key={step.index}
                  className={`rounded-2xl border p-6 ${
                    index === 0
                      ? "border-[oklch(89%_0.02_165)] bg-[linear-gradient(135deg,oklch(98%_0.012_165),oklch(99%_0.008_165))]"
                      : index === 1
                        ? "border-[oklch(89%_0.018_220)] bg-[linear-gradient(135deg,oklch(98%_0.01_220),oklch(99%_0.006_220))]"
                        : "border-[oklch(89%_0.02_80)] bg-[linear-gradient(135deg,oklch(98.8%_0.008_80),oklch(99%_0.006_80))]"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/82 text-sm font-semibold text-slate-800 shadow-sm">
                      {step.index}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{step.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="community" className="px-6 py-20 md:px-8">
        <div className="mx-auto max-w-7xl grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,white,oklch(99%_0.004_165))] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[oklch(55%_0.05_80)]">学习社区</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              自学不必孤单，
              <span className="text-[oklch(53%_0.11_80)]">但也不必喧闹</span>
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              当你真正卡住时，社区和 AI 都在同一个学习空间里提供帮助，不会把你拽进另一种产品节奏。
            </p>

            <div className="mt-10 space-y-4">
              <div className="rounded-2xl border border-[oklch(89%_0.018_220)] bg-white/80 p-5">
                <div className="flex items-center gap-3 text-[oklch(44%_0.08_220)]">
                  <Users className="h-5 w-5" />
                  <span className="text-sm font-medium">技术问答广场</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">把问题带回上下文里讨论，而不是在碎片帖子里重复描述背景。</p>
              </div>
              <div className="rounded-2xl border border-[oklch(89%_0.02_165)] bg-white/80 p-5">
                <div className="flex items-center gap-3 text-[oklch(47%_0.09_165)]">
                  <MessageSquare className="h-5 w-5" />
                  <span className="text-sm font-medium">学习笔记与共读</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">共享解题思路、概念理解和练习反馈，让知识迁移发生得更自然。</p>
              </div>
            </div>
          </div>

          <div className="grid content-start gap-5">
            <article className="rounded-2xl border border-[oklch(89%_0.018_220)] bg-[linear-gradient(135deg,oklch(98%_0.01_220),oklch(99%_0.006_220))] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 text-[oklch(44%_0.08_220)] shadow-sm">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-[oklch(44%_0.08_220)]">学习者</p>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-700">
                机器学习第三章里梯度下降总发散，AI 导师提示我先检查归一化，终于知道问题不在模型结构，而在数据尺度。
              </p>
            </article>

            <article className="rounded-2xl bg-[linear-gradient(145deg,oklch(29%_0.03_215),oklch(34%_0.05_165))] p-6 text-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white shadow-sm">
                  <Brain className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-white/86">AI 导师</p>
              </div>
              <p className="mt-4 text-sm leading-7 text-white/92">
                先别急着改参数。回到当前上下文看一眼：特征是否归一化？损失曲线是否在第一轮就剧烈震荡？先把这两步确认清楚。
              </p>
            </article>

            <article className="rounded-2xl border border-[oklch(89%_0.02_80)] bg-[linear-gradient(135deg,oklch(98.8%_0.008_80),oklch(99%_0.006_80))] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/82 text-[oklch(53%_0.11_80)] shadow-sm">
                  <Zap className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-[oklch(53%_0.11_80)]">学习空间</p>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-700">
                真正有价值的鼓励，不是把你推向排行榜，而是在你快失去方向的时候，把你带回正确的下一步。
              </p>
            </article>
          </div>
        </div>
      </section>

      <footer className="mt-12 overflow-hidden rounded-t-[3rem] bg-[linear-gradient(160deg,oklch(25%_0.025_215),oklch(30%_0.035_165))] px-6 py-20 text-white md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-6">
              <h2 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                准备好把学习，
                <br />
                放进更好的节奏里了吗？
              </h2>
              <p className="max-w-xl text-lg leading-8 text-white/72">
                从今天开始，用更清晰的主线、更稳定的节奏和更安静的学习空间，重新组织你的大学自学过程。
              </p>
            </div>

            <button
              onClick={() => navigate("/register")}
              className="inline-flex h-[54px] items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-7 text-sm font-semibold text-white transition-colors hover:bg-white/16"
            >
              立即加入
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-16 flex flex-col gap-5 border-t border-white/12 pt-8 text-sm text-white/58 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full">
                <img src="/logo1.png" alt="Logo" className="h-full w-full object-contain" />
              </div>
              <span className="text-white/78">
                智辙 <span className="font-['Audiowide'] text-[0.9em] tracking-normal text-white/56">A-TRACK</span> © 2026 HBUE大数据系版权所有
              </span>
            </div>
            <div className="flex gap-6">
              <a href="#" className="transition-colors hover:text-white">关于我们</a>
              <a href="#" className="transition-colors hover:text-white">隐私政策</a>
              <a href="#" className="transition-colors hover:text-white">服务条款</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
