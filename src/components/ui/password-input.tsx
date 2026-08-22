"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  /** Optional icon pinned inside the left edge, e.g. Lock on the auth screens. */
  startIcon?: React.ComponentType<{ className?: string }>;
  /**
   * What the toggle is revealing, used in its accessible name. Defaults to
   * "password"; pass "PIN" and the like for masked fields that are not one.
   */
  revealLabel?: string;
  /** Centres the text and pads both edges so the toggle does not skew it. */
  centered?: boolean;
  /** Applied to the positioning wrapper - use it to constrain field width. */
  wrapperClassName?: string;
};

/**
 * A masked field with a show/hide toggle. Reveal state is local to the field,
 * so one visible password never unmasks its neighbour, and it always resets to
 * masked on remount.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      wrapperClassName,
      startIcon: StartIcon,
      revealLabel = "password",
      centered,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [visible, setVisible] = React.useState(false);
    const ToggleIcon = visible ? EyeOff : Eye;

    return (
      <div className={cn("relative", wrapperClassName)}>
        {StartIcon ? (
          <StartIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        ) : null}

        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={cn(
            StartIcon && "pl-9",
            // Keep glyphs clear of the toggle; a centred field needs the same
            // padding on both sides or the text drifts off-centre.
            centered ? "px-10 text-center" : "pr-10",
            className,
          )}
          {...props}
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={visible ? `Hide ${revealLabel}` : `Show ${revealLabel}`}
          aria-pressed={visible}
          className={cn(
            "absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md",
            "text-muted-foreground transition-colors hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <ToggleIcon className="h-4 w-4" />
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
