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
import treeAcacia from '@/assets/forest/trees/tree-acacia.png'
import treeBanana from '@/assets/forest/trees/tree-banana.png'
import treeBanyan from '@/assets/forest/trees/tree-banyan.png'
import treeCactus from '@/assets/forest/trees/tree-cactus.png'
import treeOak2 from '@/assets/forest/trees/tree-oak-2.png'
import treePalm1 from '@/assets/forest/trees/tree-palm-1.png'
import treePalm2 from '@/assets/forest/trees/tree-palm-2.png'
import treePine2 from '@/assets/forest/trees/tree-pine-2.png'

import shrub01 from '@/assets/forest/shrubs/shrub-01.png'
import shrub02 from '@/assets/forest/shrubs/shrub-02.png'
import shrub03 from '@/assets/forest/shrubs/shrub-03.png'
import shrub04 from '@/assets/forest/shrubs/shrub-04.png'
import shrub05 from '@/assets/forest/shrubs/shrub-05.png'
import shrub06 from '@/assets/forest/shrubs/shrub-06.png'
import shrub07 from '@/assets/forest/shrubs/shrub-07.png'
import shrub08 from '@/assets/forest/shrubs/shrub-08.png'
import shrub09 from '@/assets/forest/shrubs/shrub-09.png'
import shrub10 from '@/assets/forest/shrubs/shrub-10.png'
import shrub11 from '@/assets/forest/shrubs/shrub-11.png'
import shrub12 from '@/assets/forest/shrubs/shrub-12.png'
import shrub13 from '@/assets/forest/shrubs/shrub-13.png'
import shrub14 from '@/assets/forest/shrubs/shrub-14.png'
import shrub15 from '@/assets/forest/shrubs/shrub-15.png'

import flowerAnthurium from '@/assets/forest/flowers/anthurium.png'
import flowerBananaLeaf from '@/assets/forest/flowers/banana-leaf.png'
import flowerBirdParadise from '@/assets/forest/flowers/bird-paradise.png'
import flowerCalla from '@/assets/forest/flowers/calla.png'
import flowerFerns from '@/assets/forest/flowers/ferns.png'
import flowerFlameLily from '@/assets/forest/flowers/flame-lily.png'
import flowerHeliconia from '@/assets/forest/flowers/heliconia.png'
import flowerHibiscus from '@/assets/forest/flowers/hibiscus.png'
import flowerMonstera from '@/assets/forest/flowers/monstera.png'
import flowerOrangeHeliconia from '@/assets/forest/flowers/orange-heliconia.png'
import flowerPalmFrond from '@/assets/forest/flowers/palm-frond.png'
import flowerPinkGinger from '@/assets/forest/flowers/pink-ginger.png'
import flowerPlumeria from '@/assets/forest/flowers/plumeria.png'
import flowerProtea from '@/assets/forest/flowers/protea.png'
import flowerRedTorch from '@/assets/forest/flowers/red-torch.png'

export const TREE_SPRITES = [
  { id: 'tree-01', src: tree01, w: 260, h: 297, aspect: 260 / 297, type: 'blossom' },
  { id: 'tree-02', src: tree02, w: 330, h: 299, aspect: 330 / 299, type: 'oak' },
  { id: 'tree-03', src: tree03, w: 259, h: 281, aspect: 259 / 281, type: 'pine' },
  { id: 'tree-04', src: tree04, w: 413, h: 283, aspect: 413 / 283, type: 'oak' },
  { id: 'tree-05', src: tree05, w: 254, h: 281, aspect: 254 / 281, type: 'blossom' },
  { id: 'tree-06', src: tree06, w: 297, h: 515, aspect: 297 / 515, type: 'pine' },
  { id: 'tree-07', src: tree07, w: 432, h: 515, aspect: 432 / 515, type: 'oak' },
  { id: 'tree-08', src: tree08, w: 516, h: 480, aspect: 516 / 480, type: 'oak' },
  { id: 'tree-09', src: tree09, w: 238, h: 515, aspect: 238 / 515, type: 'pine' },
  { id: 'tree-acacia', src: treeAcacia, w: 296, h: 286, aspect: 296 / 286, type: 'acacia' },
  { id: 'tree-banana', src: treeBanana, w: 275, h: 294, aspect: 275 / 294, type: 'palm' },
  { id: 'tree-banyan', src: treeBanyan, w: 274, h: 277, aspect: 274 / 277, type: 'oak' },
  { id: 'tree-cactus', src: treeCactus, w: 178, h: 298, aspect: 178 / 298, type: 'pine' },
  { id: 'tree-oak-2', src: treeOak2, w: 265, h: 285, aspect: 265 / 285, type: 'oak' },
  { id: 'tree-palm-1', src: treePalm1, w: 218, h: 295, aspect: 218 / 295, type: 'palm' },
  { id: 'tree-palm-2', src: treePalm2, w: 165, h: 293, aspect: 165 / 293, type: 'palm' },
  { id: 'tree-pine-2', src: treePine2, w: 172, h: 279, aspect: 172 / 279, type: 'pine' },
]

export const SHRUB_SPRITES = [
  { id: 'shrub-01', src: shrub01, w: 124, h: 180, aspect: 124 / 180 },
  { id: 'shrub-02', src: shrub02, w: 150, h: 71, aspect: 150 / 71 },
  { id: 'shrub-03', src: shrub03, w: 193, h: 119, aspect: 193 / 119 },
  { id: 'shrub-04', src: shrub04, w: 128, h: 181, aspect: 128 / 181 },
  { id: 'shrub-05', src: shrub05, w: 173, h: 179, aspect: 173 / 179 },
  { id: 'shrub-06', src: shrub06, w: 156, h: 111, aspect: 156 / 111 },
  { id: 'shrub-07', src: shrub07, w: 152, h: 92, aspect: 152 / 92 },
  { id: 'shrub-08', src: shrub08, w: 151, h: 69, aspect: 151 / 69 },
  { id: 'shrub-09', src: shrub09, w: 173, h: 117, aspect: 173 / 117 },
  { id: 'shrub-10', src: shrub10, w: 152, h: 93, aspect: 152 / 93 },
  { id: 'shrub-11', src: shrub11, w: 167, h: 119, aspect: 167 / 119 },
  { id: 'shrub-12', src: shrub12, w: 133, h: 96, aspect: 133 / 96 },
  { id: 'shrub-13', src: shrub13, w: 152, h: 90, aspect: 152 / 90 },
  { id: 'shrub-14', src: shrub14, w: 160, h: 72, aspect: 160 / 72 },
  { id: 'shrub-15', src: shrub15, w: 170, h: 145, aspect: 170 / 145 },
]

export const FLOWER_SPRITES = [
  { id: 'anthurium', src: flowerAnthurium, w: 136, h: 159, aspect: 136 / 159 },
  { id: 'banana-leaf', src: flowerBananaLeaf, w: 134, h: 178, aspect: 134 / 178 },
  { id: 'bird-paradise', src: flowerBirdParadise, w: 125, h: 174, aspect: 125 / 174 },
  { id: 'calla', src: flowerCalla, w: 79, h: 163, aspect: 79 / 163 },
  { id: 'ferns', src: flowerFerns, w: 163, h: 175, aspect: 163 / 175 },
  { id: 'flame-lily', src: flowerFlameLily, w: 128, h: 164, aspect: 128 / 164 },
  { id: 'heliconia', src: flowerHeliconia, w: 98, h: 171, aspect: 98 / 171 },
  { id: 'hibiscus', src: flowerHibiscus, w: 138, h: 143, aspect: 138 / 143 },
  { id: 'monstera', src: flowerMonstera, w: 134, h: 150, aspect: 134 / 150 },
  { id: 'orange-heliconia', src: flowerOrangeHeliconia, w: 112, h: 179, aspect: 112 / 179 },
  { id: 'palm-frond', src: flowerPalmFrond, w: 143, h: 155, aspect: 143 / 155 },
  { id: 'pink-ginger', src: flowerPinkGinger, w: 82, h: 171, aspect: 82 / 171 },
  { id: 'plumeria', src: flowerPlumeria, w: 159, h: 149, aspect: 159 / 149 },
  { id: 'protea', src: flowerProtea, w: 101, h: 183, aspect: 101 / 183 },
  { id: 'red-torch', src: flowerRedTorch, w: 150, h: 178, aspect: 150 / 178 },
]

export const DEFAULT_FOLIAGE_HEIGHTS = {
  flower: 34,
  shrub: 50,
  tree: 88,
}

const SPECIES_MAP = {
  oak: [
    TREE_SPRITES[1],
    TREE_SPRITES[3],
    TREE_SPRITES[6],
    TREE_SPRITES[7],
    TREE_SPRITES[11],
    TREE_SPRITES[13],
  ],
  pine: [
    TREE_SPRITES[2],
    TREE_SPRITES[5],
    TREE_SPRITES[8],
    TREE_SPRITES[12],
    TREE_SPRITES[16],
  ],
  blossom: [
    TREE_SPRITES[0],
    TREE_SPRITES[4],
    TREE_SPRITES[9],
  ],
  palm: [
    TREE_SPRITES[10],
    TREE_SPRITES[14],
    TREE_SPRITES[15],
  ],
  sapling: [
    TREE_SPRITES[2],
    TREE_SPRITES[0],
    TREE_SPRITES[9],
  ],
}

/**
 * Computes a deterministic pseudo-random integer seed from a session,
 * guaranteeing that the exact same tree, shrub, or flower sprite is rendered
 * across Calendar Day View, Week View, Deep Focus Forest, and Idle Sanctuary.
 */
export function getSessionFoliageSeed(session, fallbackIdx = 0) {
  if (!session) return fallbackIdx
  if (typeof session.spriteVariant === 'number') return Math.abs(session.spriteVariant)
  const raw = String(session.id || session.startedAt || session.createdAt || session.targetDate || fallbackIdx)
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Formats an organic, human-friendly breakdown of flora counts.
 * e.g. "4 trees and a flower", "2 trees, 1 shrub and a flower", "5 trees", "a flower"
 */
export function formatFloraBreakdown(input) {
  let trees = 0
  let shrubs = 0
  let flowers = 0

  if (Array.isArray(input)) {
    for (const s of input) {
      if (!s || s.completed === false || s.failedReason) continue
      const dur = Number(s.durationMin) || 0
      const type = s.plantType || (dur < 10 ? 'flower' : dur <= 15 ? 'shrub' : 'tree')
      if (type === 'flower') flowers++
      else if (type === 'shrub') shrubs++
      else trees++
    }
  } else if (input && typeof input === 'object') {
    trees = Number(input.trees != null ? input.trees : input.treesGrown || 0)
    shrubs = Number(input.shrubs || 0)
    flowers = Number(input.flowers || 0)
  }

  const parts = []
  if (trees > 0) {
    parts.push(`${trees} ${trees === 1 ? 'tree' : 'trees'}`)
  }
  if (shrubs > 0) {
    parts.push(`${shrubs} ${shrubs === 1 ? 'shrub' : 'shrubs'}`)
  }
  if (flowers > 0) {
    parts.push(flowers === 1 ? 'a flower' : `${flowers} flowers`)
  }

  if (parts.length === 0) return '0 trees'
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts[0]}, ${parts[1]} and ${parts[2]}`
}

export function resolveTreeSprite(species = 'all', variant = 0) {
  if (typeof species === 'number') {
    return TREE_SPRITES[Math.abs(species) % TREE_SPRITES.length]
  }
  const key = String(species || '').toLowerCase()
  if (key && SPECIES_MAP[key]) {
    const bucket = SPECIES_MAP[key]
    return bucket[Math.abs(variant) % bucket.length]
  }
  // Uniform random across ALL 17 trees
  return TREE_SPRITES[Math.abs(variant) % TREE_SPRITES.length]
}

export function resolveFoliageSprite(type = 'tree', species = 'all', variant = 0) {
  const normType = String(type || 'tree').toLowerCase()
  if (normType === 'flower') {
    return FLOWER_SPRITES[Math.abs(variant) % FLOWER_SPRITES.length]
  }
  if (normType === 'shrub') {
    return SHRUB_SPRITES[Math.abs(variant) % SHRUB_SPRITES.length]
  }
  return resolveTreeSprite(species, variant)
}

export const SpriteFoliage = memo(function SpriteFoliage({
  type = 'tree',
  species = 'oak',
  variant = 0,
  height,
  width,
  delay = 0,
  className,
  style,
  alt,
}) {
  const normType = ['flower', 'shrub', 'tree'].includes(type) ? type : 'tree'
  const finalHeight = height != null ? height : DEFAULT_FOLIAGE_HEIGHTS[normType]
  const sprite = resolveFoliageSprite(normType, species, variant)
  const computedWidth = width != null ? width : Math.round(finalHeight * sprite.aspect)
  const defaultAlt =
    normType === 'flower'
      ? 'Planted focus flower'
      : normType === 'shrub'
      ? 'Planted focus shrub'
      : 'Planted focus tree'

  const swayDur = 6.5 + (Math.abs(variant) % 4) * 1.1
  const swayDelay = -((Math.abs(variant) * 1.7) % 6)

  return (
    <motion.img
      src={sprite.src}
      alt={alt || defaultAlt}
      width={computedWidth}
      height={finalHeight}
      initial={{ scale: 0, y: 12, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      whileHover={{ scale: 1.06, y: -2 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay,
      }}
      style={{
        height: `${finalHeight}px`,
        width: `${computedWidth}px`,
        animation: `flora-sway ${swayDur}s ease-in-out infinite`,
        animationDelay: `${swayDelay}s`,
        ...style,
      }}
      className={cn('shrink-0 drop-shadow-md origin-bottom select-none pointer-events-none object-contain', className)}
      draggable={false}
    />
  )
})

export const SpriteTree = memo(function SpriteTree({
  species = 'oak',
  variant = 0,
  height = 88,
  width,
  delay = 0,
  className,
  style,
  alt = 'Planted focus tree',
}) {
  return (
    <SpriteFoliage
      type="tree"
      species={species}
      variant={variant}
      height={height}
      width={width}
      delay={delay}
      className={className}
      style={style}
      alt={alt}
    />
  )
})


