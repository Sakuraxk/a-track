import { useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "@iconify/react"
import { useSubjectStore } from "@/stores/subject"
import { SubjectIcon } from "@/components/ui/SubjectIcon"
import { cn } from "@/lib/utils"

interface Chapter {
  id: string
  title: string
  description: string
}

// 基于学科 key 生成对应的课程目录
const generateChapters = (key: string, name: string): Chapter[] => {
  const normalizedKey = key.toLowerCase()
  if (normalizedKey.includes("python") || normalizedKey.includes("programming")) {
    return [
      { id: "ch1", title: "Python 基础语法", description: "变量、数据类型、运算符" },
      { id: "ch2", title: "控制流", description: "条件判断、循环结构" },
      { id: "ch3", title: "函数与模块", description: "函数、参数传递、常用模块" },
      { id: "ch4", title: "数据结构", description: "列表、字典、元组、集合" },
      { id: "ch5", title: "面向对象进阶", description: "类与对象、文件操作" },
    ]
  }
  if (normalizedKey.includes("machine_learning") || normalizedKey.includes("ml")) {
    return [
      { id: "ch1", title: "机器学习概述", description: "基础、分类、KNN演示" },
      { id: "ch2", title: "线性模型", description: "回归、逻辑回归及其优化" },
      { id: "ch3", title: "经典分类算法", description: "决策树、SVM、K-Means" },
      { id: "ch4", title: "概率与集成", description: "贝叶斯、随机森林、XGB" },
      { id: "ch5", title: "深度学习先导", description: "神经网络基础" },
    ]
  }
  if (normalizedKey.includes("math")) {
    return [
      { id: "ch1", title: "函数与极限", description: "极限概念、连续性" },
      { id: "ch2", title: "导数与微分", description: "求导法则、高阶导数" },
      { id: "ch3", title: "微分应用", description: "中值定理、极值应用" },
      { id: "ch4", title: "定积分应用", description: "求面积、体积、牛莱公式" },
      { id: "ch5", title: "常微分方程", description: "一阶、二阶线性微分方程" },
    ]
  }
  return [
    { id: "ch1", title: "课程导论", description: "学习路径规划" },
    { id: "ch2", title: "核心概念", description: "关键理论梳理" },
    { id: "ch3", title: "实践演练", description: "场景化应用" },
  ]
}

export default function InteractiveLearning() {
  const subjects = useSubjectStore((s) => s.subjects)
  const isLoading = useSubjectStore((s) => s.isLoading)
  const fetchSubjects = useSubjectStore((s) => s.fetchSubjects)
  const navigate = useNavigate()
  const disabledCourses = useMemo(() => [], [])

  useEffect(() => {
    fetchSubjects()
  }, [fetchSubjects])

  const subtitle = (name: string) => {
    if (name.toLowerCase().includes("python")) return "Python 编程基础 · 实战驱动"
    if (name.includes("机器")) return "人工智能核心 · 算法可视化"
    if (name.includes("英语")) return "沉浸式语境 · 智能反馈"
    if (name.includes("数学")) return "可视化高等数学 · 直观理解"
    return "体系化学习 · 交互式体验"
  }

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="relative mb-12 px-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="h-1 w-8 rounded-full bg-blue-600" />
              <span className="text-xs font-bold uppercase tracking-widest text-blue-600/80">Explorer</span>
            </div>
            <div className="flex items-center justify-between">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">
                交互式<span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">学习实验室</span>
              </h2>
            </div>
            <p className="mt-2 text-slate-500 max-w-lg font-medium leading-relaxed">
              探索 AI 驱动的深度交互内容。每一模块都经过精心设计，让复杂概念在交互中变得直观。
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-80 flex-col items-center justify-center gap-6 rounded-[40px] border-2 border-dashed border-slate-200 bg-white/50 backdrop-blur-sm">
            <div className="h-12 w-12 rounded-full border-4 border-blue-50 border-t-blue-600 animate-spin" />
            <p className="font-bold text-slate-500">正在同步实验室数据...</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => {
              const isDisabled = disabledCourses.includes(subject.name)
              const chapters = generateChapters(subject.key, subject.name)
              
              return (
                <button
                  key={subject.id}
                  onClick={() => navigate("/app/interactive-learning/" + subject.id)}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-[40px] border border-white bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_40px_80px_rgba(0,0,0,0.1)]",
                    isDisabled && "grayscale opacity-70 cursor-not-allowed"
                  )}
                >
                  {/* Card Content */}
                  <div className="flex flex-1 flex-col p-8 pb-4">
                    <div className="mb-6 flex items-start justify-between">
                      <SubjectIcon subject={subject} className="h-16 w-16 shadow-lg transition-transform duration-500 group-hover:scale-110" />
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                        <Icon icon="solar:double-alt-arrow-right-linear" className="h-5 w-5" />
                      </div>
                    </div>

                    <h3 className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors text-left">
                      {subject.name}
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-slate-400 text-left">
                      {subtitle(subject.name)}
                    </p>
                  </div>

                  {/* Bottom Progress */}
                  <div className="px-8 pb-8 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase">学习进度</span>
                      <span className="text-[10px] font-black text-blue-600">{subject.progress_percent || 0}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-1000"
                        style={{ width: `${subject.progress_percent || 0}%` }}
                      />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
