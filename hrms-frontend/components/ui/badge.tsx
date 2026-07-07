import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

type BadgeTone = 'default' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<BadgeTone, string> = {
  default: 'bg-paper text-ink-soft border-border',
  success: 'bg-accent-soft text-accent border-transparent',
  warning: 'bg-amber-soft text-amber border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
};

export function Badge({
  tone = 'default',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Maps common backend enum statuses to a sensible badge tone. */
export function statusTone(status: string): BadgeTone {
  const positive = ['ACTIVE', 'APPROVED', 'PRESENT'];
  const negative = ['SUSPENDED', 'TERMINATED', 'REJECTED', 'ABSENT', 'CANCELLED'];
  const warning = ['PENDING', 'ON_LEAVE', 'INVITED', 'LATE', 'HALF_DAY'];
  if (positive.includes(status)) return 'success';
  if (negative.includes(status)) return 'danger';
  if (warning.includes(status)) return 'warning';
  return 'default';
}
