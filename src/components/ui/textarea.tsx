import * as React from 'react';

import {cn} from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({className, ...props}, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs ring-offset-background transition-[border-color,box-shadow] duration-150',
          'placeholder:text-muted-foreground/70',
          'hover:border-ring/40',
          'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
          'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/25',
          'md:text-sm',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
