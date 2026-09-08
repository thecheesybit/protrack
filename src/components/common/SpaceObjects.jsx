import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'

/**
 * Ambient night sky: a moon, shooting stars, and drifting asteroids/spacecraft.
 * Every object is spawned by JS with randomized position, direction, speed and
 * interval, then removed on animationend — so no two passes repeat the same
 * spot, timing, or heading. Only runs in the dark "starry" slots.
 */

const NIGHT_SLOTS = new Set(['deep_night', 'dawn', 'dusk', 'evening'])
const rnd = (min, max) => min + Math.random() * (max - min)
const uid = () => Math.random().toString(36).slice(2)

const MOON_SPOTS = [
  { right: '7%', top: '10%' },
  { right: '15%', top: '7%' },
  { right: '9%', top: '17%' },
  { left: '18%', top: '9%' },
]

function makeMeteor() {
  const dir = Math.random() < 0.5 ? -1 : 1 // down-left or down-right
  const distVW = rnd(30, 55)
  const fallVH = rnd(16, 34)
  return {
    id: uid(),
    top: `${rnd(1, 42)}%`,
    left: `${rnd(12, 88)}%`,
    mx: `${dir * distVW}vw`,
    my: `${fallVH}vh`,
    angle: (Math.atan2(fallVH, dir * distVW) * 180) / Math.PI,
    dur: rnd(1, 2),
    len: Math.round(rnd(90, 180)),
  }
}

function makeDrifter() {
  return {
    id: uid(),
    kind: Math.random() < 0.5 ? 'ship' : 'rock',
    top: `${rnd(6, 68)}%`,
    dir: Math.random() < 0.5 ? 'drift-ltr' : 'drift-rtl',
    dur: rnd(48, 95),
    op: rnd(0.4, 0.7).toFixed(2),
  }
}

/** Generic spawner: keeps a live list, spawns on a random interval, self-cleans. */
function useSpawner(active, make, firstRange, gapRange) {
  const [items, setItems] = useState([])
  useEffect(() => {
    if (!active) {
      setItems([])
      return undefined
    }
    let timer
    const spawn = () => {
      setItems((l) => [...l, make()])
      timer = setTimeout(spawn, rnd(...gapRange))
    }
    timer = setTimeout(spawn, rnd(...firstRange))
    return () => clearTimeout(timer)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
  const remove = (id) => setItems((l) => l.filter((x) => x.id !== id))
  return [items, remove]
}

function Asteroid() {
  return <div className="h-3 w-4 rotate-12 rounded-[45%_55%_50%_50%] bg-slate-500/70" />
}

function Spacecraft() {
  return (
    <svg width="30" height="14" viewBox="0 0 30 14" fill="none" aria-hidden="true">
      <ellipse cx="15" cy="9" rx="14" ry="3.5" fill="rgb(148 163 184 / 0.75)" />
      <ellipse cx="15" cy="6.5" rx="7" ry="4.5" fill="rgb(203 213 225 / 0.9)" />
      <circle cx="10" cy="9.5" r="0.9" className="fill-accent-2" />
      <circle cx="15" cy="9.5" r="0.9" className="fill-accent-2" />
      <circle cx="20" cy="9.5" r="0.9" className="fill-accent-2" />
    </svg>
  )
}

export function SpaceObjects() {
  const slot = useStore((s) => s.chronoSlot)
  const active = NIGHT_SLOTS.has(slot)

  // Moon position is re-rolled once per entry into a night slot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const moonSpot = useMemo(() => MOON_SPOTS[Math.floor(Math.random() * MOON_SPOTS.length)], [active])

  const [meteors, removeMeteor] = useSpawner(active, makeMeteor, [1200, 4000], [2800, 9000])
  const [drifters, removeDrifter] = useSpawner(active, makeDrifter, [5000, 14000], [14000, 30000])

  return (
    <div
      className="absolute inset-0 overflow-hidden transition-opacity duration-[1500ms] ease-out"
      style={{ opacity: 'var(--stars-opacity, 0)' }}
      aria-hidden="true"
    >
      {active && (
        <div className="absolute animate-moon-bob" style={moonSpot}>
          <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-slate-100 via-slate-200 to-slate-400/80 shadow-[0_0_70px_24px_rgba(226,232,240,0.18)]">
            <span className="absolute left-3 top-4 h-2 w-2 rounded-full bg-slate-500/30" />
            <span className="absolute right-4 top-7 h-3 w-3 rounded-full bg-slate-500/25" />
            <span className="absolute bottom-3 left-6 h-1.5 w-1.5 rounded-full bg-slate-500/30" />
          </div>
        </div>
      )}

      {meteors.map((m) => (
        <div
          key={m.id}
          className="absolute"
          style={{
            top: m.top,
            left: m.left,
            '--mx': m.mx,
            '--my': m.my,
            animation: `shooting-star-once ${m.dur}s ease-in forwards`,
          }}
          onAnimationEnd={() => removeMeteor(m.id)}
        >
          <div
            className="h-[2px] rounded-full bg-gradient-to-r from-transparent to-white"
            style={{ width: m.len, transform: `rotate(${m.angle}deg)`, transformOrigin: 'left center' }}
          />
        </div>
      ))}

      {drifters.map((d) => (
        <div
          key={d.id}
          className="absolute"
          style={{ top: d.top, '--drift-op': d.op, animation: `${d.dir} ${d.dur}s linear forwards` }}
          onAnimationEnd={() => removeDrifter(d.id)}
        >
          {d.kind === 'ship' ? <Spacecraft /> : <Asteroid />}
        </div>
      ))}
    </div>
  )
}
