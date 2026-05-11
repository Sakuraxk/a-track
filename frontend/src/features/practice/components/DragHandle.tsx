import { useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface DragHandleProps {
  onDrag: (deltaX: number) => void
  className?: string
}

export function DragHandle({ onDrag, className }: DragHandleProps) {
  const draggingRef = useRef(false)
  const lastXRef = useRef(0)
  const cleanupRef = useRef<(() => void) | null>(null)

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()

      draggingRef.current = true
      lastXRef.current = event.clientX

      const prevUserSelect = document.body.style.userSelect
      const prevCursor = document.body.style.cursor
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"

      const handleMouseMove = (e: MouseEvent) => {
        if (!draggingRef.current) return
        const delta = e.clientX - lastXRef.current
        lastXRef.current = e.clientX
        onDrag(delta)
      }

      const handleMouseUp = () => {
        draggingRef.current = false
        document.body.style.userSelect = prevUserSelect
        document.body.style.cursor = prevCursor
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
        cleanupRef.current = null
      }

      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)

      cleanupRef.current = () => {
        document.body.style.userSelect = prevUserSelect
        document.body.style.cursor = prevCursor
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
        draggingRef.current = false
      }
    },
    [onDrag],
  )

  useEffect(() => {
    return () => cleanupRef.current?.()
  }, [])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={handleMouseDown}
      className={cn(
        "relative w-2 cursor-col-resize select-none flex-shrink-0",
        "bg-transparent hover:bg-indigo-500/20 transition-colors",
        className,
      )}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-slate-200 dark:bg-slate-700" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
    </div>
  )
}
