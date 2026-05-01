# Companion Sprite Strategy

Pixel Companion companions should eventually move from CSS-only placeholders to real
pixel-art sprites. The sprite system should support fixed companion identities while
still allowing selected visual parts to reflect project colors or official variant
colors.

This document defines the recommended workflow for generated sprites, tintable parts,
and palette swapping.

## Current Decision

The first sprite implementation should use fixed official colors. Do not implement
runtime recoloring or palette swapping yet.

The renderer should initially focus on:

- accepting a provided Ghou sprite asset;
- showing the sprite crisply with `image-rendering: pixelated`;
- supporting simple state-based animation frames when assets exist;
- keeping the code path small enough to replace or expand later.

Palette swapping remains a future option, but it should not block the first animated
sprite pass.

Ghou currently uses fixed-color 36-frame sprite sheets with level-based evolution:

- `ghou-sprite-egg.png`: level 0 through 4.
- `ghou-sprite-lvl1.png`: level 5 through 24.
- `ghou-sprite-lvl2.png`: level 25 through 49.
- `ghou-sprite-lvl3.png`: level 50 and above.

## Goals

- Keep companions as fixed product characters, not user-authored profiles.
- Allow each companion to declare which visual parts can change color.
- Preserve pixel-art lighting, shadows, and outlines.
- Support multiple companions and evolution stages without rewriting renderer logic.
- Make generated sprite assets predictable enough for code-driven recoloring.

## Recommended Approach

Use **palette swapping with sentinel colors**.

Generated sprite tools usually output fully colored art. Before adding those sprites to
the app, normalize the parts that should be recolored into a small set of artificial
colors that never appear naturally in the final art.

Example sentinel palette:

```text
#ff00ff = primary tint base
#cc00cc = primary tint shadow
#ff66ff = primary tint highlight

#00ffff = secondary tint base
#00cccc = secondary tint shadow
#66ffff = secondary tint highlight

#ffff00 = accent tint base
#cccc00 = accent tint shadow
#ffff66 = accent tint highlight
```

The app can then replace those exact colors at render time while leaving eyes, mouth,
outline, expression, and non-tintable details untouched.

## Why Not Auto-Detect Colors?

Do not try to infer tintable areas from arbitrary generated colors.

Generated sprites may reuse similar colors across unrelated parts. A dragon wing, eye
highlight, outline reflection, and belly shadow can all share nearby tones. Automatic
color inference would recolor the wrong pixels.

Sentinel colors make the contract explicit:

- the artist or maintainer chooses what is tintable;
- the app only replaces exact known colors;
- non-tintable pixels remain stable;
- future companions can reuse the same renderer.

## Asset Preparation Workflow

1. Generate or draw the sprite normally.
2. Decide which part is tintable:
   - Ghou: head/body glow.
   - Dragon: eyes, wings, horns, or belly.
   - Turtle: shell.
3. Open the sprite in a pixel-art editor such as Aseprite, LibreSprite, Pixelorama, or
   Piskel.
4. Disable anti-aliasing for manual edits and exports.
5. Replace tintable pixels with sentinel colors.
6. Keep outlines, eyes, mouth, shadows, and important character details as real colors.
7. Export as PNG with transparent background.
8. Keep every frame in the same grid size.

For richer pixel art, use the three-tone sentinel set instead of a single flat color:

```text
base      -> requested color
shadow    -> requested color darkened
highlight -> requested color lightened
```

This preserves volume while still allowing project-colored variants.

## Suggested File Structure

```text
src/renderer/src/assets/companions/
  ghou/
    manifest.ts
    egg.png
    baby-idle.png
    baby-working.png
    base-idle.png
    base-working.png
    base-done.png
    base-error.png
    base-waiting-input.png
  dragon/
    manifest.ts
    egg.png
    baby-idle.png
    base-idle.png
```

Each companion should own a small manifest that declares stages, states, frame sizes,
and tint slots.

Example:

```ts
export const ghouCompanion = {
  id: 'ghou',
  name: 'Ghou',
  tintSlots: {
    primary: {
      label: 'Head glow',
      sentinel: {
        base: '#ff00ff',
        shadow: '#cc00cc',
        highlight: '#ff66ff'
      }
    }
  },
  stages: {
    egg: {
      idle: './egg.png'
    },
    base: {
      idle: './base-idle.png',
      working: './base-working.png',
      done: './base-done.png',
      error: './base-error.png',
      waiting_input: './base-waiting-input.png'
    }
  }
}
```

## Renderer Strategy

The renderer should treat companion art as data:

```tsx
<CompanionAvatar
  companionId="ghou"
  stage="base"
  state="working"
  tints={{
    primary: activeProjectColor
  }}
/>
```

Implementation options:

- Use a small offscreen canvas to palette-swap PNG pixels, then cache the generated
  image URL by `companionId + stage + state + tint`.
- Keep `image-rendering: pixelated` on the rendered sprite.
- Avoid recoloring the source asset in place.
- Cache aggressively so repeated terminal updates do not reprocess the same sprite.

Canvas palette swapping is a good fit here because pixel sprites are small, exact color
matching works well, and it avoids complicated shader or SVG pipelines.

## Evolution Stages

Each companion can define official stage art:

```text
egg -> hatchling -> base -> evolved -> final
```

XP decides the active stage. Users should not edit the companion profile or XP curve.
The app may tint selected parts by project or official variant, but the companion
identity and progression rules stay fixed in code.

## Practical Rules For New Sprites

- Use transparent PNGs.
- Use a consistent frame size per companion.
- Keep sprite sheets aligned to a fixed grid.
- Avoid anti-aliased edges on sentinel-colored regions.
- Reserve sentinel colors only for tintable pixels.
- Keep black/dark outlines outside the tint map unless a companion explicitly supports
  outline variants.
- Test each sprite on dark and light terminal themes.
- Prefer a small number of meaningful tint slots over many tiny recolorable details.

## Initial Implementation Plan

1. Create a `CompanionAvatar` component separate from `CompanionPanel`.
2. Add a companion manifest type.
3. Move Ghou's current CSS avatar behind the new component as the fallback renderer.
4. Add PNG sprite support for Ghou.
5. Implement canvas-based palette swapping for sentinel colors.
6. Cache generated tinted sprites.
7. Add state-based sprites for `idle`, `working`, `done`, `error`, and `waiting_input`.
8. Add stage selection from companion level.
