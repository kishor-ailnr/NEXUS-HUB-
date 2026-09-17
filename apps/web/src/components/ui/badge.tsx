import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-navy text-white shadow hover:bg-navy/80',
        secondary:
          'border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200',
        destructive:
          'border-transparent bg-status-critical text-white shadow hover:bg-status-critical/80',
        outline: 'text-slate-950 border-slate-200',
        healthy:
          'border-status-healthy/30 bg-status-healthy-light text-status-healthy-dark',
        warning:
          'border-status-warning/30 bg-status-warning-light text-status-warning-dark',
        informational:
          'border-status-informational/30 bg-status-informational-light text-status-informational-dark',
        critical:
          'border-status-critical/30 bg-status-critical-light text-status-critical-dark',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
