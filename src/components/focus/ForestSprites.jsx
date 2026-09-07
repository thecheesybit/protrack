import { memo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

import tree01 from '@/assets/forest/trees/tree-01.png'
import tree02 from '@/assets/forest/trees/tree-02.png'
import tree03 from '@/assets/forest/trees/tree-03.png'
import tree04 from '@/assets/forest/trees/tree-04.png'
import tree05 from '@/assets/forest/trees/tree-05.png'
import tree06 from '@/assets/forest/trees/tree-06.png'
import tree07 from '@/assets/forest/trees/tree-07.png'
import tree08 from '@/assets/forest/trees/tree-08.png'
import tree09 from '@/assets/forest/trees/tree-09.png'

import shrub01 from '@/assets/forest/shrubs/shrub-01.png'
import shrub02 from '@/assets/forest/shrubs/shrub-02.png'
import shrub03 from '@/assets/forest/shrubs/shrub-03.png'

export const TREE_SPRITES = [
  { id: 'tree-01', src: tree01, w: 256, h: 298, aspect: 256 / 298, type: 'blossom' },
  { id: 'tree-02', src: tree02, w: 326, h: 299, aspect: 326 / 299, type: 'oak' },
  { id: 'tree-03', src: tree03, w: 255, h: 281, aspect: 255 / 281, type: 'pine' },
  { id: 'tree-04', src: tree04, w: 409, h: 283, aspect: 409 / 283, type: 'oak' },
  { id: 'tree-05', src: tree05, w: 250, h: 281, aspect: 250 / 281, type: 'blossom' },
  { id: 'tree-06', src: tree06, w: 293, h: 512, aspect: 293 / 512, type: 'pine' },
  { id: 'tree-07', src: tree07, w: 428, h: 512, aspect: 428 / 512, type: 'oak' },
  { id: 'tree-08', src: tree08, w: 512, h: 479, aspect: 512 / 479, type: 'oak' },
  { id: 'tree-09', src: tree09, w: 234, h: 511, aspect: 234 / 511, type: 'pine' },
]

export const SHRUB_SPRITES = [
  { id: 'shrub-01', src: shrub01, w: 151, h: 140, aspect: 151 / 140 },
  { id: 'shrub-02', src: shrub02, w: 155, h: 140, aspect: 155 / 140 },
  { id: 'shrub-03', src: shrub03, w: 151, h: 140, aspect: 151 / 140 },
]

const SPECIES_MAP = {
  oak: [TREE_SPRITES[1], TREE_SPRITES[3], TREE_SPRITES[6], TREE_SPRITES[7]],
  pine: [TREE_SPRITES[2], TREE_SPRITES[5], TREE_SPRITES[8]],
  blossom: [TREE_SPRITES[0], TREE_SPRITES[4]],
  sapling: [TREE_SPRITES[2], TREE_SPRITES[0]],
}

export function resolveTreeSprite(species, variant = 0) {
  if (typeof species === 'number') {
    return TREE_SPRITES[Math.abs(species) % TREE_SPRITES.length]
  }
  const key = String(species || 'oak').toLowerCase()
  const bucket = SPECIES_MAP[key] || SPECIES_MAP.oak
  return bucket[Math.abs(variant) % bucket.length]
}

export const SpriteTree = memo(function SpriteTree({
  species = 'oak',
  variant = 0,
  height = 92,
  width,
  delay = 0,
  className,
  style,
  alt = 'Planted focus tree',
}) {
  const sprite = resolveTreeSprite(species, variant)
  const computedWidth = width != null ? width : Math.round(height * sprite.aspect)

  return (
    <motion.img
      src={sprite.src}
      alt={alt}
      width={computedWidth}
      height={height}
      initial={{ scale: 0, y: 16, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay,
      }}
      style={{
        height: `${height}px`,
        width: `${computedWidth}px`,
        ...style,
      }}
      className={cn('shrink-0 drop-shadow-md origin-bottom select-none pointer-events-none object-contain', className)}
      draggable={false}
    />
  )
})

export const SpriteShrub = memo(function SpriteShrub({
  variant = 0,
  height = 20,
  width,
  delay = 0,
  className,
  style,
  alt = 'Forest shrub',
}) {
  const sprite = SHRUB_SPRITES[Math.abs(variant) % SHRUB_SPRITES.length]
  const computedWidth = width != null ? width : Math.round(height * sprite.aspect)

  return (
    <motion.img
      src={sprite.src}
      alt={alt}
      width={computedWidth}
      height={height}
      initial={{ scale: 0, y: 8, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay,
      }}
      style={{
        height: `${height}px`,
        width: `${computedWidth}px`,
        ...style,
      }}
      className={cn('shrink-0 drop-shadow-sm origin-bottom select-none pointer-events-none object-contain', className)}
      draggable={false}
    />
  )
})

