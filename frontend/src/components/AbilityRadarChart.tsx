import { useMemo } from "react"
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"

interface AbilityRadarChartProps {
    abilityTags?: Record<string, number>
    data?: { ability: string; score: number }[]
    hideCard?: boolean
}

const TRANSLATION_MAP: Record<string, string> = {
    // 基础
    "basics.variables": "基础变量",
    "basics.operators": "运算符",
    "basics.strings": "字符串",
    "basics.numbers": "数值计算",
    "basics.arithmetic": "算术运算",
    "basics.printing": "输出打印",
    "basics.input": "输入读取",
    "basics.io": "输入输出",
    "basics.syntax": "语法规范",
    // 流程控制
    "conditions.if": "条件判断",
    "conditions.else": "分支逻辑",
    "conditions.boolean": "布尔逻辑",
    "conditions.logic": "逻辑判断",
    "loops.for": "For 循环",
    "loops.while": "While 循环",
    "loops.break": "循环中断",
    "loops.flow": "控制流",
    // 数据结构
    "lists.basics": "列表基础",
    "lists.methods": "列表操作",
    "dicts.basics": "字典基础",
    "dicts.methods": "字典方法",
    "lists": "列表应用",
    "dicts": "字典应用",
    "sets": "集合操作",
    "tuples": "元组应用",
    // 进阶
    "functions.def": "函数定义",
    "functions.args": "参数传递",
    "functions.return": "函数返回值",
    "oop.class": "类与对象",
    "oop.inheritance": "继承与多态",
    "errors.handling": "异常处理",
    "modules.import": "模块导入",
    // 算法与 AI
    "ai_generated": "AI 生成能力",
    "concept_learning": "概念掌握",
}

const translateAbility = (key: string): string => {
    if (TRANSLATION_MAP[key]) return TRANSLATION_MAP[key]

    // 模糊匹配前缀
    for (const [prefix, translation] of Object.entries(TRANSLATION_MAP)) {
        if (key.startsWith(prefix)) return translation
    }

    // 回退处理：去除前缀并首字母大写
    const lastPart = key.split('.').pop() || key
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1)
}

export function AbilityRadarChart({ abilityTags, data, hideCard = false }: AbilityRadarChartProps) {
    // Process ability tags for radar chart
    const chartData = useMemo(() => {
        const process = (ability: string, score: number) => {
            const translated = translateAbility(ability)
            return {
                ability: translated.length > 8 ? translated.slice(0, 8) + '...' : translated,
                fullAbility: translated === ability ? ability : `${translated} (${ability})`,
                score,
                maxScore: 100
            }
        }

        if (data) {
            return data.map(item => process(item.ability, item.score))
        }

        const entries = Object.entries(abilityTags || {})
        if (entries.length === 0) return []

        // Sort by score and take top 8 abilities (radar chart works best with 3-8 points)
        return entries
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([ability, score]) => process(ability, score))
    }, [abilityTags, data])

    // Calculate average score
    const avgScore = useMemo(() => {
        if (chartData.length === 0) return 0
        const sum = chartData.reduce((acc, item) => acc + item.score, 0)
        return Math.round(sum / chartData.length)
    }, [chartData])

    const renderChart = () => (
        <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={1} initialDimension={{ width: 100, height: 100 }}>
                <RadarChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis
                        dataKey="ability"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                    />
                    <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={false}
                    />
                    <Radar
                        name="能力分数"
                        dataKey="score"
                        stroke="#2dd4bf"
                        fill="#2dd4bf"
                        fillOpacity={0.6}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid #334155',
                            borderRadius: '12px',
                            padding: '12px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                            color: '#f1f5f9'
                        }}
                        itemStyle={{ color: '#2dd4bf' }}
                        cursor={{ stroke: '#2dd4bf', strokeWidth: 1 }}
                        formatter={(value: number | undefined, _name: string | undefined, props: any) => [
                            `${value ?? 0}/100`,
                            props.payload.fullAbility
                        ]}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    )

    if (chartData.length === 0) {
        if (hideCard) return null
        return (
            <Card className="border-2 border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl bg-white dark:bg-slate-900">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <TrendingUp className="w-5 h-5 text-teal-500" />
                        能力分布雷达图
                    </CardTitle>
                    <CardDescription>可视化展示你的能力标签分布</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <TrendingUp className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-500 dark:text-slate-400 text-sm">暂无能力标签数据</p>
                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">在偏好设置中添加能力标签</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (hideCard) {
        return renderChart()
    }

    return (
        <Card className="border-2 border-slate-100 dark:border-slate-800 shadow-sm rounded-2xl bg-white dark:bg-slate-900">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <TrendingUp className="w-5 h-5 text-teal-500" />
                    能力分布雷达图
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                    展示你的 TOP {chartData.length} 能力标签 • 平均分: {avgScore}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {renderChart()}

                {/* Legend for color categories */}
                <div className="flex justify-center gap-6 mt-4 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <span className="text-slate-600 dark:text-slate-400">弱项 (0-40)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <span className="text-slate-600 dark:text-slate-400">中等 (41-70)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-teal-400" />
                        <span className="text-slate-600 dark:text-slate-400">强项 (71-100)</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
