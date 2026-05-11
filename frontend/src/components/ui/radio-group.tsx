import * as React from "react"
import { cn } from "@/lib/utils"

const RadioGroupContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
} | null>(null)

const RadioGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value?: string
    onValueChange?: (value: string) => void
    disabled?: boolean
  }
>(({ className, value, onValueChange, disabled, ...props }, ref) => {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange, disabled }}>
      <div className={cn("grid gap-2", className)} {...props} ref={ref} />
    </RadioGroupContext.Provider>
  )
})
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, disabled: itemDisabled, ...props }, ref) => {
  const context = React.useContext(RadioGroupContext)
  const isChecked = context?.value === value
  const isDisabled = itemDisabled || context?.disabled

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isChecked}
      disabled={isDisabled}
      onClick={() => !isDisabled && context?.onValueChange?.(value)}
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center",
        className
      )}
      {...props}
    >
      {isChecked && (
        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
      )}
    </button>
  )
})
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
