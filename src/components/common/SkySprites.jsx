import { memo } from 'react'

/**
 * Shared SVG sprites and path definitions for atmospheric sky ambient objects
 * across DawnSkyObjects, DaySkyObjects, and DuskSkyObjects.
 */

// ── Cloud Paths ──────────────────────────────────────────────────────────────
export const CLOUD_PATHS = [
  'M10,50 Q25,25 55,28 Q75,10 115,18 Q145,5 175,22 Q205,12 235,28 Q260,20 280,45 Q295,60 285,75 Q270,90 240,88 Q210,95 160,90 Q110,95 60,88 Q20,88 10,70 Q5,60 10,50 Z',
  'M15,45 Q35,18 70,22 Q95,8 135,14 Q170,5 200,20 Q230,12 255,30 Q275,25 290,48 Q300,68 285,82 Q260,92 210,88 Q160,94 110,88 Q65,92 30,82 Q10,72 15,45 Z',
  'M8,40 Q22,15 50,20 Q70,5 105,12 Q130,4 160,18 Q185,10 210,24 Q230,18 250,38 Q265,55 255,70 Q240,82 195,80 Q150,85 105,80 Q60,84 25,75 Q5,62 8,40 Z',
  'M12,48 Q28,20 60,24 Q82,8 120,16 Q150,6 180,22 Q210,14 238,30 Q262,22 282,46 Q294,64 282,78 Q262,88 215,86 Q168,92 118,87 Q68,90 26,80 Q8,68 12,48 Z',
]

/**
 * Morning Swallow Silhouette (curved swept-wing geometry)
 */
export const SwallowSilhouette = memo(function SwallowSilhouette({
  className = 'fill-amber-200/50 animate-[bird-flap_1.2s_ease-in-out_infinite]',
  style,
  width = 20,
  height = 12,
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 20 12"
      className={className}
      style={style}
    >
      <path d="M0,7 Q5,1 10,6 Q15,1 20,7 Q14,4 10,8 Q6,4 0,7 Z" />
    </svg>
  )
})

/**
 * High-Altitude Soaring Bird Silhouette (eagle/hawk geometry with tail fan)
 */
export const SoaringBirdSilhouette = memo(function SoaringBirdSilhouette({
  className = 'fill-slate-700/60 drop-shadow-sm',
  style,
  width = 26,
  height = 12,
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 26 12"
      className={className}
      style={style}
    >
      <path d="M0,4 Q7,-1 13,3 Q19,-1 26,4 Q21,7 13,8 Q5,7 0,4 Z M13,8 L10,12 L16,12 Z" />
    </svg>
  )
})

/**
 * Evening Roosting Bird Silhouette (compact dusk wing geometry)
 */
export const RoostingBirdSilhouette = memo(function RoostingBirdSilhouette({
  className = 'animate-[bird-flap_1.6s_ease-in-out_infinite]',
  fill = '#1e1b4b',
  opacity = '0.7',
  style,
  width = 20,
  height = 12,
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 20 12"
      className={className}
      style={style}
    >
      <path
        d="M0 6 C4 1, 8 1, 10 5 C12 1, 16 1, 20 6 C16 4, 12 4, 10 7 C8 4, 4 4, 0 6 Z"
        fill={fill}
        opacity={opacity}
      />
    </svg>
  )
})

/**
 * Evening Star / Venus 4-Point Sparkle
 */
export const VenusSparkle = memo(function VenusSparkle({
  className = 'fill-amber-100 opacity-90 animate-[pulse_4s_ease-in-out_infinite]',
  style,
  width = 18,
  height = 18,
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 18 18"
      className={className}
      style={style}
    >
      <path d="M9,0 Q9,9 0,9 Q9,9 9,18 Q9,9 18,9 Q9,9 9,0 Z" />
    </svg>
  )
})
