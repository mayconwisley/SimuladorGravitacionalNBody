const paths = {
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /></>,
  restart: <><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3.5 4v4.5H8" /></>,
  repeat: <><path d="M17 3.5 20 6.5l-3 3" /><path d="M4 11.5V10a3.5 3.5 0 0 1 3.5-3.5H20" /><path d="M7 20.5 4 17.5l3-3" /><path d="M20 12.5V14a3.5 3.5 0 0 1-3.5 3.5H4" /></>,
  stepBack: <><path d="M18 5 9 12l9 7z" /><path d="M6 5v14" /></>,
  stepForward: <><path d="m6 5 9 7-9 7z" /><path d="M18 5v14" /></>,
  upload: <><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  download: <><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  orbit: <><circle cx="12" cy="12" r="2.5" /><ellipse cx="12" cy="12" rx="9.5" ry="4.5" transform="rotate(-25 12 12)" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6.5 7l1 12.5h9l1-12.5" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.5h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.5h.01" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  zoomIn: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M11 8v6M8 11h6" /></>,
  zoomOut: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M8 11h6" /></>,
  frame: <><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" /></>,
  tag: <><path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z" /><circle cx="8.5" cy="8.5" r="1.5" /></>,
  trail: <><path d="M4 18c4-1 6-5 8-8s4-5 8-6" strokeDasharray="2 3" /><circle cx="20" cy="4" r="1.6" fill="currentColor" /></>,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  sparkle: <path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z" />,
  move: <><path d="M12 3v18M3 12h18" /><path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" /></>,
  rocket: <><path d="M12 15c-2-2-3-5-1-9 2-2.5 5-3 8-3 0 3-.5 6-3 8-4 2-7 1-9-1" transform="translate(-1 1)" /><path d="M7 15l-3 1 1-3M9 17l-1 3 3-1" /><circle cx="14" cy="9" r="1.5" /></>,
  burst: <><path d="M12 2.5l1.6 5.2 5.2-2.4-2.4 5.2 5.1 1.5-5.1 1.5 2.4 5.2-5.2-2.4L12 21.5l-1.6-5.2-5.2 2.4 2.4-5.2L2.5 12l5.1-1.5-2.4-5.2 5.2 2.4z" /></>,
  periapsis: <><circle cx="17" cy="12" r="2.5" /><path d="M14 12H4" /><path d="m7 9-3 3 3 3" /></>,
  apoapsis: <><circle cx="7" cy="12" r="2.5" /><path d="M10 12h10" /><path d="m17 9 3 3-3 3" /></>,
  escape: <><path d="M7 17 17 7" /><path d="M9 7h8v8" /><circle cx="6" cy="18" r="1.5" /></>,
  compare: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  rewind: <><path d="M11 6 4 12l7 6z" /><path d="M20 6l-7 6 7 6z" /></>,
  keyboard: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" /></>
};

export default function Icon({ name, size = 16, className = '', strokeWidth = 1.8 }) {
  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
