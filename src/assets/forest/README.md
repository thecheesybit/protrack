# Forest Sprites

`trees/tree-01.png … tree-09.png` — 9 transparent, trunk-baseline-aligned tree
sprites rendered at each calendar day-column baseline by
`src/components/focus/CalendarForest.jsx` (`DayGrove`) via
`src/components/focus/ForestSprites.jsx` (`<SpriteTree>`). The planted count and
species map to that day's successful focus sessions.

## Provenance

Cropped, white-background-removed and downscaled (≤ 512 px tall) from three
source sheets — `trees.jpg` (tree-01…05), `trees-2.jpg` (tree-06…09) and
`base-shrubs.jpg` — with a one-off Pillow script. The source sheets and the
script were removed once the sprites were final (they are not needed for the
build and cost ~5 MB in the repo); the crop boxes and the script live in git
history if the sprites ever need to be regenerated.

Shrubs were dropped from the calendar entirely at the owner's request — the
`shrub-*.png` crops and the `<SpriteShrub>` renderer are gone.
