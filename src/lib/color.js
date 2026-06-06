/** Color helpers for the dynamic, mode-tied accent system. */

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

/** Parse #rgb / #rrggbb into {r,g,b}; falls back to indigo on bad input. */
export function hexToRgb(hex) {
  let h = (hex || '').replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return { r: 99, g: 102, b: 241 }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/** "r g b" triplet for Tailwind's `rgb(var(--x) / <alpha>)` tokens. */
export function rgbTriplet(hex) {
  const { r, g, b } = hexToRgb(hex)
  return `${r} ${g} ${b}`
}

/** Blend a hex toward white (amt 0..1) — used to derive the secondary accent. */
export function lighten(hex, amt = 0.18) {
  const { r, g, b } = hexToRgb(hex)
  return `${clampByte(r + (255 - r) * amt)} ${clampByte(g + (255 - g) * amt)} ${clampByte(
    b + (255 - b) * amt,
  )}`
}

/** rgba() string at a given alpha — for inline glows/tints. */
export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
