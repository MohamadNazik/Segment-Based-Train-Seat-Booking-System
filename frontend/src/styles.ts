import heroImage from './assets/hero.jpg'

// Shared hero background (landing + checkout): the photo, a green brand
// tint, and a dark vignette on top for text legibility.
export const HERO_BACKGROUND = {
  backgroundImage:
    'linear-gradient(to bottom, rgba(10,20,15,0.55) 0%, rgba(10,20,15,0.25) 45%, rgba(10,20,15,0.65) 100%), ' +
    'linear-gradient(rgba(31,111,74,0.55), rgba(31,111,74,0.55)), ' +
    `url(${heroImage})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
}

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
