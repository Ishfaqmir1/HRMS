import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-border bg-paper text-ink-soft",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-danger-soft text-danger",
        outline: "text-ink",
        success: "border-transparent bg-accent-soft text-accent",
        warning: "border-transparent bg-amber-soft text-amber",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

const toneToVariant: Record<string, string> = {
  default: 'default',
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
};

function Badge({ className, variant, tone, ...props }: BadgeProps) {
  const resolvedVariant = variant || (tone ? toneToVariant[tone] : undefined) as any;
  return <div className={cn(badgeVariants({ variant: resolvedVariant }), className)} {...props} />
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';

export function statusTone(status: string): BadgeVariant {
  const positive = ['ACTIVE', 'APPROVED', 'PRESENT'];
  const negative = ['SUSPENDED', 'TERMINATED', 'REJECTED', 'ABSENT', 'CANCELLED'];
  const warning = ['PENDING', 'ON_LEAVE', 'INVITED', 'LATE', 'HALF_DAY'];
  if (positive.includes(status)) return 'success';
  if (negative.includes(status)) return 'danger';
  if (warning.includes(status)) return 'warning';
  return 'default';
}

export { Badge, badgeVariants }
