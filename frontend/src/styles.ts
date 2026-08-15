// A handful of exact Tailwind utility strings repeated identically across
// several components (the same button look, the same page container).
// Kept as plain strings - not wrapper components - so components still
// apply them via a normal className, matching the "utility classes in
// JSX" approach; this just avoids the same long string drifting slightly
// out of sync if hand-copied into five different files.
export const PAGE = 'mx-auto w-full max-w-[900px] px-6 pb-16 pt-8'
export const PAGE_SUBTITLE = 'mb-6 text-ink-soft'
export const EMPTY_STATE = 'py-8 text-ink-soft'
export const ERROR_BANNER =
  'mx-auto my-4 max-w-[900px] rounded-lg border border-danger bg-danger-bg px-4 py-3 text-danger'

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:enabled:bg-accent-dark'
export const BTN_SECONDARY =
  'rounded-lg border border-border bg-surface px-5 py-3 font-semibold text-ink hover:enabled:bg-bg'
