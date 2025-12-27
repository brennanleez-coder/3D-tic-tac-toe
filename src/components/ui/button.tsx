import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "gradient" | "outline" | "ghost" | "icon"
  size?: "default" | "sm" | "lg" | "icon"
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50 hover:from-purple-500 hover:to-pink-500",
  gradient: "bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-500 hover:via-pink-500 hover:to-purple-500 text-white shadow-2xl shadow-purple-500/50 hover:shadow-purple-500/70 transform hover:scale-110 active:scale-95",
  outline: "bg-black/60 backdrop-blur-sm hover:bg-black/80 text-gray-300 hover:text-white border border-purple-500/30 hover:border-purple-500/50 transform hover:scale-105 active:scale-95",
  ghost: "bg-black/40 text-gray-300 hover:bg-black/60 border border-purple-500/20 hover:border-purple-500/30",
  icon: "bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-2xl shadow-purple-500/50 transform hover:scale-110 active:scale-95",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "px-5 py-2 text-xs sm:text-sm",
  sm: "px-6 py-3 text-sm",
  lg: "px-10 py-4 text-xl font-bold rounded-xl",
  icon: "w-12 h-12 rounded-full",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }

