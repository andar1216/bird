// Simple stylised network glyphs on brand-colored tiles (not official logos).
const GLYPHS = {
  instagram: (
    <>
      <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.1" cy="7.9" r="1" fill="#fff" />
    </>
  ),
  snapchat: (
    <path
      d="M12 4c-2.6 0-4.3 1.9-4.3 4.5v1.8c-.5.2-1.2.4-1.7.4.1.5.8.9 1.5 1-.3.9-1.1 1.6-2.2 1.9.2.6 1.1.8 1.9.9.2.5.3 1 .6 1.1.5.2 1-.1 1.7.1.8.3 1.4 1.3 2.5 1.3s1.7-1 2.5-1.3c.7-.2 1.2.1 1.7-.1.3-.1.4-.6.6-1.1.8-.1 1.7-.3 1.9-.9-1.1-.3-1.9-1-2.2-1.9.7-.1 1.4-.5 1.5-1-.5 0-1.2-.2-1.7-.4V8.5C16.3 5.900 14.600 4 12 4z"
      fill="#fff"
      stroke="#111"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
  ),
  messages: (
    <path
      d="M7 6.5h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6.2L7 19v-2.5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"
      fill="#fff"
    />
  ),
  discord: (
    <>
      <path
        d="M7.2 7.6c1.5-.7 3-1 4.800-1s3.300.3 4.800 1c1.200 2.400 1.900 4.800 2.100 7.600-.9.8-1.900 1.300-2.900 1.600l-.7-1.200c-1.100.4-2.200.5-3.300.5s-2.200-.1-3.300-.5l-.7 1.200c-1-.3-2-.8-2.900-1.600.2-2.800.9-5.200 2.100-7.600z"
        fill="#fff"
      />
      <circle cx="9.600" cy="12.400" r="1.200" fill="#5865f2" />
      <circle cx="14.400" cy="12.400" r="1.200" fill="#5865f2" />
    </>
  ),
}

const BG = {
  instagram: 'linear-gradient(135deg,#feda75 0%,#fa7e1e 25%,#d62976 55%,#962fbf 80%,#4f5bd5 100%)',
  snapchat: '#fffc00',
  messages: '#1a73e8',
  discord: '#5865f2',
}

export default function NetworkIcon({ network, size = 16, className = '' }) {
  return (
    <span
      className={`net-icon ${className}`}
      style={{ width: size, height: size, background: BG[network] }}
      title={network}
    >
      <svg viewBox="0 0 24 24" width={size * 0.92} height={size * 0.92} aria-hidden="true">
        {GLYPHS[network]}
      </svg>
    </span>
  )
}
