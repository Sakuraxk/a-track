import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

interface SubPageHeaderProps {
    title: string
    subtitle?: string
}

/**
 * 子页面头部导航组件
 * 用于 AI 学习路线、题库练习、动态题库等子页面
 * 包含返回按钮和当前科目显示
 */
export function SubPageHeader({ title, subtitle }: SubPageHeaderProps) {
    const navigate = useNavigate()

    const handleBack = () => {
        navigate(-1)
    }

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            {/* 左侧：返回按钮和标题 */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleBack}
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-primary/50 transition-all flex-shrink-0"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{title}</h1>
                    {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
                </div>
            </div>
        </div>
    )
}
