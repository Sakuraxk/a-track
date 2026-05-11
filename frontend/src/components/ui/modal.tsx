import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
}

const Modal = ({
  open,
  onClose,
  children,
  className,
  showCloseButton = true,
  closeOnOverlayClick = true,
}: ModalProps) => {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [open])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      <div
        className={cn(
          "relative z-10 bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200",
          "max-h-[90vh] overflow-auto",
          className
        )}
      >
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors z-10"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

interface ModalHeaderProps {
  children: React.ReactNode
  className?: string
}

const ModalHeader = ({ children, className }: ModalHeaderProps) => (
  <div className={cn("px-8 pt-8 pb-4", className)}>{children}</div>
)

interface ModalBodyProps {
  children: React.ReactNode
  className?: string
}

const ModalBody = ({ children, className }: ModalBodyProps) => (
  <div className={cn("px-8 py-4", className)}>{children}</div>
)

interface ModalFooterProps {
  children: React.ReactNode
  className?: string
}

const ModalFooter = ({ children, className }: ModalFooterProps) => (
  <div className={cn("px-8 pb-8 pt-4", className)}>{children}</div>
)

export { Modal, ModalHeader, ModalBody, ModalFooter }
