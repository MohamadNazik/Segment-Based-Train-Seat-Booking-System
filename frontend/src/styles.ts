// Tailwind utility strings repeated identically across several components,
// kept as plain constants (not wrapper components) to avoid drift.
export const PAGE = 'mx-auto w-full max-w-[900px] px-6 pb-16 pt-8'
export const PAGE_SUBTITLE = 'mb-6 text-ink-soft'
export const EMPTY_STATE = 'py-8 text-ink-soft'
export const ERROR_BANNER =
  'mx-auto my-4 max-w-[900px] rounded-lg border border-danger bg-danger-bg px-4 py-3 text-danger'

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:enabled:bg-accent-dark'
export const BTN_SECONDARY =
  'rounded-lg border border-border bg-surface px-5 py-3 font-semibold text-ink hover:enabled:bg-bg'
