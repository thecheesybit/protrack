import { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'

import deer from '@/assets/forest/animals/deer.png'
import rhino from '@/assets/forest/animals/rhino.png'
import polarBear from '@/assets/forest/animals/polar-bear.png'
import redPanda from '@/assets/forest/animals/red-panda.png'
import fox from '@/assets/forest/animals/fox.png'
import hippo from '@/assets/forest/animals/hippo.png'
import lion from '@/assets/forest/animals/lion.png'
import tiger from '@/assets/forest/animals/tiger.png'
import elephant from '@/assets/forest/animals/elephant.png'
import gorilla from '@/assets/forest/animals/gorilla.png'
import giraffe from '@/assets/forest/animals/giraffe.png'
import penguin from '@/assets/forest/animals/penguin.png'
import koala from '@/assets/forest/animals/koala.png'
import ostrich from '@/assets/forest/animals/ostrich.png'
import zebra from '@/assets/forest/animals/zebra.png'
import kangaroo from '@/assets/forest/animals/kangaroo.png'
import flamingo from '@/assets/forest/animals/flamingo.png'
import panda from '@/assets/forest/animals/panda.png'
import monkey from '@/assets/forest/animals/monkey.png'
import walrus from '@/assets/forest/animals/walrus.png'
import moose from '@/assets/forest/animals/moose.png'
import camel from '@/assets/forest/animals/camel.png'
import bison from '@/assets/forest/animals/bison.png'
import bear from '@/assets/forest/animals/bear.png'
import crocodile from '@/assets/forest/animals/crocodile.png'
import stork from '@/assets/forest/animals/stork.png'
import pigeon from '@/assets/forest/animals/pigeon.png'
import cardinal from '@/assets/forest/animals/cardinal.png'
import toucan from '@/assets/forest/animals/toucan.png'
import crow from '@/assets/forest/animals/crow.png'
import robin from '@/assets/forest/animals/robin.png'
import kingfisher from '@/assets/forest/animals/kingfisher.png'
import sparrow from '@/assets/forest/animals/sparrow.png'
import seagull from '@/assets/forest/animals/seagull.png'
import greenPigeon from '@/assets/forest/animals/green-pigeon.png'
import kiwi from '@/assets/forest/animals/kiwi.png'
import pelican from '@/assets/forest/animals/pelican.png'
import hummingbird from '@/assets/forest/animals/hummingbird.png'
import bluebird from '@/assets/forest/animals/bluebird.png'
import canary from '@/assets/forest/animals/canary.png'

/**
 * Wildlife reward layer for the forest views: as the grove grows, small
 * critters start visiting, then bigger ones, on top of the existing
 * tree/shrub/flower sprites. Tiers are cumulative — a thriving forest shows
 * small birds *and* big mammals together, like a real ecosystem.
 */
export const ANIMAL_TIER_THRESHOLDS = { small: 5, medium: 15, large: 30 }

const SMALL_ANIMALS = [
  { id: 'penguin', src: penguin, h: 34 },
  { id: 'flamingo', src: flamingo, h: 40 },
  { id: 'monkey', src: monkey, h: 32 },
  { id: 'stork', src: stork, h: 36 },
  { id: 'cardinal', src: cardinal, h: 22 },
  { id: 'robin', src: robin, h: 22 },
  { id: 'kingfisher', src: kingfisher, h: 22 },
  { id: 'sparrow', src: sparrow, h: 20 },
  { id: 'hummingbird', src: hummingbird, h: 20 },
  { id: 'bluebird', src: bluebird, h: 20 },
  { id: 'canary', src: canary, h: 20 },
  { id: 'pigeon', src: pigeon, h: 24 },
  { id: 'green-pigeon', src: greenPigeon, h: 24 },
  { id: 'seagull', src: seagull, h: 22 },
  { id: 'kiwi', src: kiwi, h: 22 },
]

const MEDIUM_ANIMALS = [
  { id: 'fox', src: fox, h: 34 },
  { id: 'red-panda', src: redPanda, h: 34 },
  { id: 'zebra', src: zebra, h: 44 },
  { id: 'kangaroo', src: kangaroo, h: 42 },
  { id: 'koala', src: koala, h: 34 },
  { id: 'giraffe', src: giraffe, h: 56 },
  { id: 'ostrich', src: ostrich, h: 48 },
  { id: 'toucan', src: toucan, h: 26 },
  { id: 'crow', src: crow, h: 22 },
  { id: 'pelican', src: pelican, h: 30 },
]

const LARGE_ANIMALS = [
  { id: 'elephant', src: elephant, h: 52 },
  { id: 'lion', src: lion, h: 44 },
  { id: 'tiger', src: tiger, h: 42 },
  { id: 'polar-bear', src: polarBear, h: 46 },
  { id: 'bear', src: bear, h: 44 },
  { id: 'moose', src: moose, h: 48 },
  { id: 'gorilla', src: gorilla, h: 44 },
  { id: 'rhino', src: rhino, h: 40 },
  { id: 'hippo', src: hippo, h: 40 },
  { id: 'bison', src: bison, h: 40 },
  { id: 'walrus', src: walrus, h: 36 },
  { id: 'panda', src: panda, h: 40 },
  { id: 'deer', src: deer, h: 44 },
  { id: 'camel', src: camel, h: 44 },
  { id: 'crocodile', src: crocodile, h: 26 },
]

export const ANIMAL_SPRITES = [
  ...SMALL_ANIMALS.map((a) => ({ ...a, tier: 'small' })),
  ...MEDIUM_ANIMALS.map((a) => ({ ...a, tier: 'medium' })),
  ...LARGE_ANIMALS.map((a) => ({ ...a, tier: 'large' })),
]

const FLAVOR = {
  small: ['is visiting', 'stopped by', 'feels welcome here'],
  medium: ['has made this grove home', 'wandered in', 'feels safe here'],
  large: ['has claimed this thriving forest', 'roams here now', 'feels right at home'],
}

/** Small deterministic PRNG (mulberry32) so a given seed always yields the same animals/positions. */
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Which tiers are unlocked at this plant count. Cumulative — a large forest
 * still shows small critters, not just big ones.
 */
export function unlockedAnimalTiers(count) {
  const tiers = []
  if (count >= ANIMAL_TIER_THRESHOLDS.small) tiers.push('small')
  if (count >= ANIMAL_TIER_THRESHOLDS.medium) tiers.push('medium')
  if (count >= ANIMAL_TIER_THRESHOLDS.large) tiers.push('large')
  return tiers
}

/**
 * Resolves a short, deterministic list of animals (with scatter position) to
 * render for a given plant `count`, seeded so the same count+seed always
 * renders the same critters in the same spots (no re-randomizing on re-render).
 * @returns {Array<{ id: string, src: string, h: number, tier: string, leftPct: number, bottomPct: number, flavor: string }>}
 */
export function resolveAnimalsForCount(count, seed = 0) {
  const tiers = unlockedAnimalTiers(count)
  if (tiers.length === 0) return []

  const pool = ANIMAL_SPRITES.filter((a) => tiers.includes(a.tier))
  const maxAnimals = tiers.includes('large') ? 3 : tiers.includes('medium') ? 2 : 1
  const n = Math.min(maxAnimals, pool.length)

  const rand = mulberry32(seed + count * 1000)

  // Fisher-Yates over a copy, using the seeded PRNG, then take the first n.
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled.slice(0, n).map((animal, idx) => {
    const flavorList = FLAVOR[animal.tier] || FLAVOR.small
    return {
      ...animal,
      leftPct: 8 + rand() * 84,
      bottomPct: 4 + rand() * 14 + idx * 2,
      flavor: flavorList[Math.floor(rand() * flavorList.length)],
    }
  })
}

/** One non-interactive (except a hover tooltip) critter, absolutely positioned by its caller. */
export const AnimalSprite = memo(function AnimalSprite({ animal, onHover, className, style }) {
  return (
    <motion.img
      src={animal.src}
      alt=""
      aria-hidden="true"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22, delay: 0.15 }}
      onMouseEnter={() => onHover?.(animal)}
      onMouseLeave={() => onHover?.(null)}
      style={{ height: `${animal.h}px`, width: 'auto', ...style }}
      className={cn(
        'pointer-events-auto absolute select-none object-contain drop-shadow-md',
        className,
      )}
      draggable={false}
    />
  )
})

/**
 * Scatters the resolved wildlife for `count` across a relatively-positioned
 * container, with a small shared hover tooltip. Drop into any forest overview
 * surface (currently `MonthlyForest`'s soil patch).
 */
export function ForestWildlife({ count, seed = 0 }) {
  const [hovered, setHovered] = useState(null)
  const animals = resolveAnimalsForCount(count, seed)

  if (animals.length === 0) return null

  return (
    <>
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute top-2 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-slate-950/90 px-2.5 py-1 text-[10px] font-semibold text-white/85 shadow-xl backdrop-blur-xl"
          >
            A visiting {hovered.id.replace('-', ' ')} — your forest {hovered.flavor}
          </motion.div>
        )}
      </AnimatePresence>
      {animals.map((animal, idx) => (
        <AnimalSprite
          key={animal.id}
          animal={animal}
          onHover={setHovered}
          style={{
            left: `${animal.leftPct}%`,
            bottom: `${animal.bottomPct}%`,
            zIndex: 5 + idx,
          }}
        />
      ))}
    </>
  )
}
