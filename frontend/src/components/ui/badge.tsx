import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#ffd100] text-[#202020] font-bold shadow-xs hover:bg-[#ffee32]",
        secondary:
          "border-transparent bg-[#333533] text-white font-bold hover:bg-[#202020]",
        destructive:
          "border-transparent bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200",
        outline: "text-[#202020] border-[#d6d6d6] font-medium bg-white",
        success: "border-transparent bg-emerald-100 text-emerald-800 border-emerald-200",
        warning: "border-transparent bg-amber-100 text-amber-900 border-amber-300 font-semibold",
        error: "border-transparent bg-rose-100 text-rose-800 border-rose-200",
        gold: "border border-[#ffd100] bg-[#ffd100]/15 text-[#202020] font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
