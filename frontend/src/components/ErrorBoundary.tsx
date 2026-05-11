import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface Props {
    children: ReactNode
    fallbackMessage?: string
}

interface State {
    hasError: boolean
    error: Error | null
}

/**
 * 通用 Error Boundary — 捕获子组件的渲染错误，显示友好的降级 UI 而非白屏。
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("[ErrorBoundary] 捕获渲染错误:", error, errorInfo)
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
                    <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 max-w-lg w-full text-center space-y-4">
                        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-red-50 text-red-500 mx-auto">
                            <AlertTriangle className="h-7 w-7" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">
                            {this.props.fallbackMessage || "页面出现异常"}
                        </h3>
                        <p className="text-sm text-gray-500">
                            发生了一个意外错误，请尝试刷新页面。
                        </p>
                        {this.state.error && (
                            <details className="text-left text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                                <summary className="cursor-pointer font-medium mb-1">错误详情</summary>
                                <pre className="whitespace-pre-wrap break-words">{this.state.error.message}</pre>
                            </details>
                        )}
                        <button
                            onClick={this.handleRetry}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-green to-emerald-600 text-white rounded-xl font-medium shadow-sm hover:from-brand-green-dark hover:to-emerald-700 transition-all"
                        >
                            <RefreshCw className="h-4 w-4" />
                            重试
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
