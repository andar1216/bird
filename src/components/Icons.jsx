const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const SearchIcon = (p) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const ComposeIcon = (p) => (
  <svg {...base} {...p}><path d="M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6" /><path d="M18.4 3.6a1.9 1.9 0 0 1 2.7 2.7L12 15.4 8 16l.6-4z" /></svg>
)
export const LayersIcon = (p) => (
  <svg {...base} {...p}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>
)
export const SendIcon = (p) => (
  <svg {...base} {...p}><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
)
export const PlusIcon = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const MicIcon = (p) => (
  <svg {...base} {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
)
export const PlayIcon = (p) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M8 5v14l11-7z" /></svg>
)
export const BackIcon = (p) => (
  <svg {...base} {...p}><path d="m15 18-6-6 6-6" /></svg>
)
export const PhoneIcon = (p) => (
  <svg {...base} {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>
)
export const InfoIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
)
export const MuteIcon = (p) => (
  <svg {...base} {...p}><path d="M6 8a6 6 0 0 1 9.5-4.9M18 8c0 4 1 6 2 7H4M10 20a2 2 0 0 0 4 0M3 3l18 18" /></svg>
)
export const SunIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
)
export const MoonIcon = (p) => (
  <svg {...base} {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>
)
export const SmileIcon = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></svg>
)
