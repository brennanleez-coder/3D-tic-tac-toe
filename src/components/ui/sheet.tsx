'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactNode;
}

const Sheet = ({ open, onOpenChange, children }: SheetProps) => {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {children}
    </div>
  );
};

const SheetOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'fixed inset-0 z-[101] bg-black/60 backdrop-blur-sm pointer-events-auto',
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = 'bottom', className, children, ...props }, ref) => {
    const sideClasses = {
      bottom: 'left-4 right-4 bottom-0 border-t animate-slide-up max-h-[85vh] rounded-t-3xl',
      top: 'inset-x-0 top-0 border-b',
      left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
      right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'fixed z-[102] gap-4 bg-gradient-to-b from-black/95 to-black/90 backdrop-blur-xl border-purple-500/30 shadow-2xl pointer-events-auto',
          sideClasses[side],
          side === 'top' && 'rounded-b-3xl',
          className
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SheetContent.displayName = 'SheetContent';

export { Sheet, SheetOverlay, SheetContent };

