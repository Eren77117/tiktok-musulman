import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30',
        success: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30',
        destructive: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30',
        warning: 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/30',
        secondary: 'bg-white/5 text-gray-400 ring-1 ring-white/10',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
