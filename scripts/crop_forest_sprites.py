"""
Crop and generate transparent forest PNG sprites from source sheets.
Run with: python scripts/crop_forest_sprites.py
"""
import os
from PIL import Image
import numpy as np
from collections import deque

def process_white_bg(crop_rgb):
    h, w, _ = crop_rgb.shape
    bg_mask = np.zeros((h, w), dtype=bool)
    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    
    for r in range(h):
        for c in [0, w - 1]:
            if (crop_rgb[r, c] > 230).all():
                q.append((r, c))
                visited[r, c] = True
    for c in range(w):
        for r in [0, h - 1]:
            if not visited[r, c] and (crop_rgb[r, c] > 230).all():
                q.append((r, c))
                visited[r, c] = True
                
    while q:
        r, c = q.popleft()
        bg_mask[r, c] = True
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < h and 0 <= nc < w and not visited[nr, nc]:
                if (crop_rgb[nr, nc] > 225).all():
                    visited[nr, nc] = True
                    q.append((nr, nc))
                    
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = crop_rgb
    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)
    
    mean_bright = crop_rgb.mean(axis=2)
    soften = (~bg_mask) & (mean_bright > 220)
    alpha[soften] = np.clip(255 - (mean_bright[soften] - 220) * 8, 30, 255).astype(np.uint8)
    rgba[:, :, 3] = alpha
    return Image.fromarray(rgba)

def main():
    os.makedirs('src/assets/forest/trees', exist_ok=True)
    os.makedirs('src/assets/forest/shrubs', exist_ok=True)

    # 1. Trees from trees.jpg
    im1 = Image.open('src/assets/forest/trees.jpg')
    arr1 = np.array(im1)
    boxes1 = [
        (130, 428, 107, 363),
        (130, 429, 426, 752),
        (148, 429, 819, 1074),
        (147, 430, 1110, 1519),
        (148, 429, 1565, 1815),
    ]
    for idx, (y1, y2, x1, x2) in enumerate(boxes1, start=1):
        crop = arr1[y1:y2, x1:x2]
        img = process_white_bg(crop)
        img.save(f'src/assets/forest/trees/tree-0{idx}.png', optimize=True)

    # 2. Trees from trees-2.jpg
    im2 = Image.open('src/assets/forest/trees-2.jpg')
    arr2 = np.array(im2)
    boxes2 = [
        (525, 3105, 45, 1525),
        (740, 3060, 1645, 3588),
        (1090, 2925, 3685, 5645),
        (5, 2942, 5685, 7030),
    ]
    for idx, (y1, y2, x1, x2) in enumerate(boxes2, start=6):
        crop = arr2[y1:y2, x1:x2]
        img = process_white_bg(crop)
        w, h = img.size
        scale = 512.0 / max(w, h)
        img_down = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
        img_down.save(f'src/assets/forest/trees/tree-0{idx}.png', optimize=True)

    # 3. Shrubs from base-shrubs.jpg
    im3 = Image.open('src/assets/forest/base-shrubs.jpg')
    arr3 = np.array(im3)
    h3, w3, _ = arr3.shape
    diff = arr3.max(axis=2).astype(int) - arr3.min(axis=2).astype(int)
    brightness = arr3.mean(axis=2)
    is_grey = (diff < 15) & (brightness > 155)

    bg_mask = np.zeros((h3, w3), dtype=bool)
    visited = np.zeros((h3, w3), dtype=bool)
    q = deque()
    for c in range(w3):
        if is_grey[0, c]:
            q.append((0, c))
            visited[0, c] = True
    while q:
        r, c = q.popleft()
        bg_mask[r, c] = True
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < h3 and 0 <= nc < w3 and not visited[nr, nc]:
                if is_grey[nr, nc]:
                    visited[nr, nc] = True
                    q.append((nr, nc))

    rgba3 = np.zeros((h3, w3, 4), dtype=np.uint8)
    rgba3[:, :, :3] = arr3
    alpha3 = np.where(bg_mask, 0, 255).astype(np.uint8)
    boundary = (~bg_mask) & is_grey
    alpha3[boundary] = np.clip(255 - (brightness[boundary] - 155) * 4, 20, 255).astype(np.uint8)
    rgba3[:, :, 3] = alpha3

    shrub_rows = np.where((~bg_mask).any(axis=1))[0]
    y_start, y_end = shrub_rows[0], shrub_rows[-1] + 1
    sections = [
        (0, 640, 'shrub-01.png'),
        (640, 1280, 'shrub-02.png'),
        (1280, 1920, 'shrub-03.png'),
    ]
    for x1, x2, filename in sections:
        sec = rgba3[y_start:y_end, x1:x2]
        img = Image.fromarray(sec)
        alpha_sec = sec[:, :, 3]
        valid_cols = np.where(alpha_sec.any(axis=0))[0]
        if len(valid_cols) > 0:
            img = img.crop((valid_cols[0], 0, valid_cols[-1] + 1, img.height))
        target_h = 140
        scale = target_h / img.height
        img_down = img.resize((int(img.width * scale), target_h), Image.Resampling.LANCZOS)
        img_down.save(f'src/assets/forest/shrubs/{filename}', optimize=True)

    print("All sprites generated successfully.")

if __name__ == '__main__':
    main()
