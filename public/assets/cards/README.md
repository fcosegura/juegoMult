# Card assets

Replace art without changing code: use the same `asset_key` as filename.

## Dimensions

| Asset | Size (px) | Format |
|-------|-----------|--------|
| Card illustration (`art/`, `placeholders/`) | **128 × 176** | WebP or SVG |
| Rarity frame (`frames/`) | **128 × 176** | WebP or SVG, transparent |
| Missing card (`missing.svg`) | **128 × 176** | SVG |

## Folders

- `art/` — final artwork (`{asset_key}.webp` or `.svg`)
- `placeholders/` — temporary pixel placeholders
- `frames/` — `frame_common`, `frame_rare`, `frame_epic`, `frame_legendary`

## Naming

File name must match `asset_key` exactly, e.g. `card_001.webp`.
