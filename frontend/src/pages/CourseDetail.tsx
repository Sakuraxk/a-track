import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "@/components/ui/Icon"
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
      { id: "ch1", title: "第一章 Python 基础语法", description: "变量、数据类型、运算符" },
      { id: "ch2", title: "第二章 控制流", description: "条件判断、循环结构" },
      { id: "ch3", title: "第三章 函数与模块", description: "函数、参数传递、常用模块" },
      { id: "ch4", title: "第四章 数据结构", description: "列表、字典、元组、集合的使用技巧" },
      { id: "ch5", title: "第五章 面向对象与进阶", description: "类与对象、文件操作、异常处理" },
    ]
  }
  if (normalizedKey.includes("machine_learning") || normalizedKey.includes("ml")) {
    return [
      { id: "ch1", title: "第一章 机器学习概述", description: "人工智能基础、机器学习分类、KNN与梯度下降演示" },
      { id: "ch2", title: "第二章 线性模型", description: "线性回归、逻辑回归及其优化" },
      { id: "ch3", title: "第三章 经典分类与聚类算法", description: "决策树、SVM、K-Means、KNN" },
      { id: "ch4", title: "第四章 概率模型与集成学习", description: "朴素贝叶斯、随机森林、XGBoost" },
      { id: "ch5", title: "第五章 数据预处理与特征工程", description: "数据清洗、特征选择、降维技术" },
      { id: "ch6", title: "第六章 模型评估与选择", description: "交叉验证、偏差方差权衡、模型调优" },
      { id: "ch7", title: "第七章 神经网络基础", description: "感知机、多层前馈神经网络、反向传播" },
      { id: "ch8", title: "第八章 卷积神经网络", description: "CNN架构、卷积层、池化层、经典网络模型" },
      { id: "ch9", title: "第九章 循环神经网络", description: "RNN、LSTM、GRU及其应用场景" },
      { id: "ch10", title: "第十章 强化学习入门", description: "马尔可夫决策过程、Q学习、策略梯度" },
      { id: "ch11", title: "第十一章 模型部署与优化", description: "模型压缩、推理优化、生产环境部署" },
      { id: "ch12", title: "第十二章 实战项目", description: "端到端机器学习项目实战" },
    ]
  }
  if (normalizedKey.includes("math")) {
    return [
      { id: "ch1", title: "第一章 函数、极限与连续", description: "数列与函数极限、两个重要极限、连续性" },
      { id: "ch2", title: "第二章 导数与微分", description: "导数概念、求导法则、高阶导数" },
      { id: "ch3", title: "第三章 微分中值定理及应用", description: "洛必达法则、泰勒公式、单调性与极值" },
      { id: "ch4", title: "第四章 不定积分与定积分", description: "牛顿-莱布尼茨公式、换元法与分部积分法" },
      { id: "ch5", title: "第五章 常微分方程", description: "一阶微分方程、二阶常系数线性微分方程" },
    ]
  }

  // Fallback default chapters
  return [
    { id: "ch1", title: "第一章 课程概述与导论", description: `了解 ${name} 的基础框架、学习方法` },
    { id: "ch2", title: "第二章 核心概念", description: "深入学科关键理论与重点知识" },
    { id: "ch3", title: "第三章 实践与应用", description: "结合场景，进行理论应用演练" },
    { id: "ch4", title: "第四章 进阶挑战", description: "攻克疑难点，提升核心能力" },
    { id: "ch5", title: "第五章 总结与展望", description: "课程整体梳理及未来学习规划" },
  ]
}

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  
  const subjects = useSubjectStore(s => s.subjects)
  const subject = subjects.find(sub => sub.id === courseId)

  if (!subject) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Icon icon="solar:sad-circle-bold-duotone" className="h-16 w-16 text-slate-300" />
        <p className="text-slate-500">课程不存在</p>
        <button
          onClick={() => navigate("/app/interactive-learning")}
          className="bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          返回导航页
        </button>
      </div>
    )
  }

  const chapters = generateChapters(subject.key, subject.name)

  return (
    <div className="h-full overflow-y-auto pb-10 no-scrollbar">
      {/* Back + Header */}
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={() => navigate("/app/interactive-learning")}
          className="lg:hidden flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
        >
          <Icon icon="solar:arrow-left-linear" className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <SubjectIcon subject={subject} className="h-11 w-11" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-display">{subject.name}</h1>
            <p className="text-xs text-slate-500">{chapters.length} 个章节 · 沉浸式交互</p>
          </div>
        </div>
      </div>

      {/* Chapters Summary Text */}
      <div className="mb-6 rounded-3xl bg-blue-50/50 p-6 border border-blue-100/50">
        <p className="text-slate-600 text-sm leading-relaxed">
          {subject.description || `这是为你量身定制的 ${subject.name} 课程体系，从基础到进阶，带你全面掌握核心知识点。`}
        </p>
      </div>

      {/* Chapters List */}
      <div className="grid gap-4 md:grid-cols-1">
        {chapters.map((chapter, index) => (
          <button
            key={chapter.id}
            onClick={() =>
              navigate(`/app/interactive-learning/${courseId}/${chapter.id}`)
            }
            className="group flex w-full items-center gap-5 rounded-[24px] border border-slate-200/80 bg-white px-6 py-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_12px_40px_rgba(59,130,246,0.08)]"
          >
            {/* Chapter number */}
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-50 text-sm font-bold text-slate-400 transition-colors group-hover:bg-blue-600 group-hover:text-white">
              {String(index + 1).padStart(2, "0")}
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
               <h3 className="text-base font-bold text-slate-800 transition-colors group-hover:text-blue-600">
                {chapter.title}
              </h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-1">{chapter.description}</p>
            </div>

            {/* Arrow */}
            <Icon
              icon="solar:arrow-right-linear"
              className="h-5 w-5 flex-shrink-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-blue-600"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
