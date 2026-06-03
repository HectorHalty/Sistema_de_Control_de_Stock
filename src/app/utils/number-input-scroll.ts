import type { WheelEventHandler } from 'react';

/** Evita que la rueda del mouse cambie valores en inputs type="number" enfocados. */
export function preventNumberInputWheelScroll(event: WheelEvent): void {
  const target = event.target;
  if (
    target instanceof HTMLInputElement &&
    target.type === 'number' &&
    document.activeElement === target
  ) {
    event.preventDefault();
  }
}

export function attachNumberInputScrollGuard(): () => void {
  document.addEventListener('wheel', preventNumberInputWheelScroll, { passive: false });
  return () => document.removeEventListener('wheel', preventNumberInputWheelScroll);
}

export function numberInputWheelProps(
  onWheel?: WheelEventHandler<HTMLInputElement>,
): WheelEventHandler<HTMLInputElement> {
  return event => {
    event.currentTarget.blur();
    onWheel?.(event);
  };
}
