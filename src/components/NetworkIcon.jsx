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
  whatsapp: (
    <>
      <path
        d="M12 5.2a6.800 6.800 0 0 0-5.900 10.200L5.200 18.800l3.500-.9A6.800 6.800 0 1 0 12 5.200z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.800"
        strokeLinejoin="round"
      />
      <path
        d="M9.700 9.200c.3-.5.6-.4.800.1l.5 1.100c0 .3-.4.700-.5.900.5 1 1.300 1.700 2.300 2.200.2-.2.600-.7.900-.6l1.100.5c.5.200.5.500.1.900-.6.700-1.600.8-2.600.3-1.700-.8-3-2.100-3.400-3.800-.1-.6 0-1.100.8-1.600z"
        fill="#fff"
      />
    </>
  ),
  messenger: (
    <>
      <path
        d="M12 4.800c-4 0-7 2.900-7 6.700 0 2 .9 3.700 2.300 4.900V19l2.500-1.400c.7.200 1.400.3 2.200.3 4 0 7-2.900 7-6.700S16 4.800 12 4.800z"
        fill="#fff"
      />
      <path d="M7.400 13.300l3.100-3.300 1.800 1.800 3-1.800-3.100 3.300-1.800-1.800z" fill="#0a7cff" />
    </>
  ),
  facebook: (
    <text x="12" y="19" textAnchor="middle" fontSize="19" fontWeight="800" fontFamily="Arial, sans-serif" fill="#fff">
      f
    </text>
  ),
  x: (
    <>
      <path d="M6.500 6l11 12M17.500 6l-11 12" stroke="#fff" strokeWidth="2.200" strokeLinecap="round" />
    </>
  ),
  telegram: (
    <path d="M18.800 6.200L5.300 11.500c-.7.300-.7.700-.1.900l3.400 1.100 1.300 4c.2.500.3.600.7.600s.5-.1.800-.4l1.700-1.600 3.500 2.600c.6.400 1.100.2 1.300-.6l2.300-10.900c.2-.9-.3-1.300-1.100-1z" fill="#fff" />
  ),
  slack: (
    <path
      d="M10 6.500l-1 11M15 6.500l-1 11M6.500 10h11M6 14.500h11"
      stroke="#fff"
      strokeWidth="1.900"
      strokeLinecap="round"
    />
  ),
  teams: (
    <text x="12" y="17.500" textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="Arial, sans-serif" fill="#fff">
      T
    </text>
  ),
  linkedin: (
    <text x="12" y="16.800" textAnchor="middle" fontSize="13" fontWeight="800" fontFamily="Arial, sans-serif" fill="#fff">
      in
    </text>
  ),
  tiktok: (
    <path
      d="M13.200 5v9.300a2.600 2.600 0 1 1-2.600-2.600M13.200 5c.3 1.900 1.500 3.100 3.600 3.300"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  gmail: (
    <path
      d="M5 8.500v8h3v-5l4 3 4-3v5h3v-8l-7 5.200z"
      fill="#ea4335"
    />
  ),
}

const BG = {
  whatsapp: '#25d366',
  messenger: 'linear-gradient(135deg,#00b2ff 0%,#006aff 55%,#a033ff 100%)',
  facebook: '#1877f2',
  x: '#000',
  telegram: '#27a7e7',
  slack: '#4a154b',
  teams: '#5059c9',
  linkedin: '#0a66c2',
  tiktok: '#010101',
  gmail: '#fff',
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
