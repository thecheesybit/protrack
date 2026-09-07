# Forest Sprites Asset Pipeline

This directory contains raster illustration sprites cropped and background-removed from the original source sheets (`trees.jpg`, `trees-2.jpg`, `base-shrubs.jpg`) for rendering in the calendar grove (`CalendarForest.jsx` / `ForestSprites.jsx`).

## Source to Output Mapping

### Trees (`src/assets/forest/trees/`)
Cropped from `trees.jpg` and `trees-2.jpg`, with white background flood-filled and softly feathered to transparent alpha, and downscaled to ≤ 512px height:

| Output Sprite | Source Sheet | Original Bounding Box | Dimensions (W×H) | Species Category |
|---------------|--------------|-----------------------|------------------|------------------|
| `tree-01.png` | `trees.jpg` | x=[107, 363], y=[130, 428] | 256×298 | Blossom / Flowering |
| `tree-02.png` | `trees.jpg` | x=[426, 752], y=[130, 429] | 326×299 | Oak / Deciduous |
| `tree-03.png` | `trees.jpg` | x=[819, 1074], y=[148, 429] | 255×281 | Pine / Conifer |
| `tree-04.png` | `trees.jpg` | x=[1110, 1519], y=[147, 430] | 409×283 | Oak / Broadleaf |
| `tree-05.png` | `trees.jpg` | x=[1565, 1815], y=[148, 429] | 250×281 | Blossom / Pink |
| `tree-06.png` | `trees-2.jpg` | x=[45, 1525], y=[525, 3105] | 293×512 | Pine / Tall Evergreen |
| `tree-07.png` | `trees-2.jpg` | x=[1645, 3588], y=[740, 3060] | 428×512 | Oak / Great Canopy |
| `tree-08.png` | `trees-2.jpg` | x=[3685, 5645], y=[1090, 2925] | 512×479 | Oak / Lush Woodland |
| `tree-09.png` | `trees-2.jpg` | x=[5685, 7030], y=[5, 2942] | 234×511 | Cypress / Columnar Pine |

### Shrubs (`src/assets/forest/shrubs/`)
Cropped from `base-shrubs.jpg` with top checkerboard background removed and downscaled to 140px height:

| Output Sprite | Source Sheet | Original Width Span | Dimensions (W×H) | Usage |
|---------------|--------------|---------------------|------------------|-------|
| `shrub-01.png` | `base-shrubs.jpg` | x=[0, 640] | 151×140 | Left flanking bush |
| `shrub-02.png` | `base-shrubs.jpg` | x=[640, 1280] | 155×140 | Center ground cover |
| `shrub-03.png` | `base-shrubs.jpg` | x=[1280, 1920] | 151×140 | Right flanking bush |

## Regeneration Script
Generated using Python PIL:
```bash
python scripts/crop_forest_sprites.py
```
Only the cropped transparent PNGs are imported into bundle builds; source sheets are preserved in `src/assets/forest/` for reference.
