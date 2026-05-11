import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-azul-eletrico text-white',
        secondary: 'border-transparent bg-roxo-luminoso text-white',
        destructive: 'border-transparent bg-red-500 text-white',
        outline: 'text-foreground border-current',
        success: 'border-transparent bg-green-100 text-green-800 border-green-200',
        warning: 'border-transparent bg-orange-100 text-orange-800 border-orange-200',
        info: 'border-transparent bg-blue-100 text-blue-800 border-blue-200',
        rose: 'border-transparent bg-rosa-vibrante/10 text-rosa-vibrante border-rosa-vibrante/20',
        purple: 'border-transparent bg-roxo-luminoso/10 text-roxo-luminoso border-roxo-luminoso/20',
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
