# Task: Monster Store

## Goal

Create the first version of the companion monster store/selector inside the new Ghou
activity page.

The page starts mostly empty, but the implementation should define the product model
and UI structure needed for multiple collectible companions later.

## Product Behavior

- The Activity Bar keeps two main destinations:
  - Terminal workspace.
  - Monster store / companion selector.
- The right-side Ghou companion panel stays visible in both destinations so agent
  notifications continue to arrive while the user browses monsters.
- The monster store shows a grid of monster cards.
- Every monster starts at level 0 by default.
- Every monster uses an egg visual from level 0 through 4.
- At level 5, that monster hatches and uses its first visible monster form.
- If the user owns a monster and it is still an egg, the grid card shows the egg.
- If the user owns a monster and it has hatched, the grid card shows the first frame of
  the highest unlocked stage.
- Clicking an owned monster makes it the active companion.
- The active companion card shows a glowing border and selected tick.
- The right-side companion panel uses the active companion name in the terminal header,
  message author, and XP bar.
- Hovering an owned hatched monster animates it.
- Hovering an owned egg can animate the egg if the egg sprite supports animation.
- Monsters the user does not own appear dimmed/locked.
- Hovering a locked monster does not animate it.
- Hovering a locked monster shows only:
  - name;
  - rarity;
  - price.
- The first implementation ships with only Ghou as real data/art. The model must make
  adding more monsters later straightforward.

## Monster Points

Monster Points, or MP, are earned when any owned monster levels up.

Reward is based on the level reached, not the monster species. This keeps progression
portable: training any companion helps unlock future companions.

Proposed formula:

```ts
function getMonsterPointsForReachedLevel(level: number): number {
  if (level <= 0) return 0
  if (level <= 2) return 500

  const progress = (level - 2) / 98
  const rawReward = 500 + 499500 * Math.pow(progress, 2.2)

  return Math.round(rawReward / 50) * 50
}
```

Examples:

- Level 1 -> 2 gives `500 MP`.
- Level 0 -> 1 gives `500 MP`.
- Level 99 -> 100 gives `500000 MP`.
- Early levels stay meaningful but cheap.
- Late levels become much more valuable.

This formula is intentionally backloaded so high-level companions feel special without
making early store unlocks impossible.

## Egg Box Flow

The store should use boxes as the primary MP sink instead of direct companion purchases.

The first implementation ships with three rollable boxes:

| Box               |       Price | Drop Table                                                                       |
| ----------------- | ----------: | -------------------------------------------------------------------------------- |
| Basic Egg Box     |  `10000 MP` | Starter 28%, Common 42%, Uncommon 22%, Rare 7%, Ultra rare 0.9%, Legendary 0.1%  |
| Rare Egg Box      |  `50000 MP` | Starter 10%, Common 32%, Uncommon 38%, Rare 16%, Ultra rare 3.5%, Legendary 0.5% |
| Legendary Egg Box | `200000 MP` | Common 10%, Uncommon 36%, Rare 34%, Ultra rare 16%, Legendary 4%                 |

Opening a box is handled by the Electron main process so MP debit, companion unlock,
duplicate XP, and JSON persistence happen as one operation.

The store page has two scrollable sections:

- `Companion Store`: the companion collection grid.
- `Companion Boxes`: larger square cards for rollable boxes. The card body shows only
  the box name, price, and open state; detailed odds appear on hover.
- Opening a box shows a full-screen roll overlay with colored companion cards moving
  from right to left. The reel stops on the rolled companion, then shows a `You got`
  result modal for either a new unlock or duplicate XP.

Rules:

- Gifted/Special companions do not appear in paid boxes.
- Rare, Ultra rare, and Legendary companions are not directly purchasable and should
  show `Only obtainable through a box`.
- If the rolled companion is new, it becomes owned at level 0.
- If the rolled companion is already owned, the duplicate gives XP to that companion.
- Duplicate XP is fixed by rarity for now:
  - Starter: `100 XP`.
  - Common: `150 XP`.
  - Uncommon: `350 XP`.
  - Rare: `1200 XP`.
  - Ultra rare: `4000 XP`.
  - Legendary: `15000 XP`.
- If duplicate XP causes level-ups, the same MP reward formula applies per level crossed.
- The latest box openings are persisted so the UI can show the most recent drop.

Future balancing ideas:

- Add pity/fragments if the rare chase feels too random.
- Add more box tiers later instead of making every monster directly buyable.
- Keep the server/account anti-farm layer for a later milestone.

## Rarity And Pricing

Each monster has a fixed rarity in code. Users cannot edit rarity.

Initial rarity proposal:

| Rarity    | Store Multiplier | Intended Meaning      |
| --------- | ---------------: | --------------------- |
| Common    |               1x | Easy first unlocks    |
| Uncommon  |               3x | Mild commitment       |
| Rare      |               8x | Noticeable investment |
| Epic      |              20x | Long-term goal        |
| Legendary |              60x | Prestige companion    |

Each monster declares a base price. Final price:

```ts
price = basePrice * rarityMultiplier
```

For phase one, Ghou is the default starter and should be owned automatically with price
`0`.

## Data Model

Add companion/monster definitions as fixed code data, not user-editable settings.

Suggested files:

```text
src/renderer/src/companions/
  companionTypes.ts
  companionRegistry.ts
  companionEconomy.ts
```

Suggested static definition shape:

```ts
type CompanionDefinition = {
  id: string
  name: string
  rarity: CompanionRarity
  basePrice: number
  stages: {
    egg: CompanionSpriteStage
    hatchling: CompanionSpriteStage
    evolved?: CompanionSpriteStage
    final?: CompanionSpriteStage
  }
}
```

Persist user-owned state separately from definitions:

```ts
type CompanionOwnershipState = {
  activeCompanionId: string
  monsterPoints: number
  companions: Record<
    string,
    {
      owned: boolean
      level: number
      currentXp: number
      totalXp: number
      unlockedAt?: string
      updatedAt?: string
    }
  >
}
```

Initial persistence can remain JSON in Electron `userData`, matching the current app.
SQLite can wait until the project has more account/server needs.

## UI Architecture

Keep the store modular. Do not build the full page inside `App.tsx`.

Suggested files:

```text
src/renderer/src/components/CompanionStorePage.tsx
src/renderer/src/components/CompanionStoreGrid.tsx
src/renderer/src/components/CompanionStoreCard.tsx
src/renderer/src/components/CompanionAvatar.tsx
src/renderer/src/components/MonsterPointsBalance.tsx
```

Current `CompanionCatalogPanel` should become a thin route-level wrapper that renders
the store page.

The grid should use stable card dimensions so hover animation does not resize or shift
the layout.

Locked cards should use opacity/filter styling, not a different layout.

## Sprite Rules

- Each monster owns its official art in code/assets.
- Level thresholds are fixed:
  - `0-4`: egg.
  - `5+`: hatched stage.
  - Future thresholds can reuse the existing Ghou model: `25+`, `50+`, etc.
- Store card idle state uses the first frame only.
- Store card hover state enables sprite animation only if owned.
- Locked monster hover never animates.

## Implementation Phases

### Phase 1: Store Shell

- Rename/replace `CompanionCatalogPanel` with a store page wrapper.
- Keep the page visually black/empty except the required grid area.
- Add the two Activity Bar routes only: terminal and monster store.
- Keep the right companion panel always mounted.

### Phase 2: Companion Registry

- Create fixed companion definition types.
- Add Ghou as the only registered companion.
- Move Ghou stage thresholds into reusable companion logic.
- Keep current Ghou progress mapped into the new ownership shape.

### Phase 3: Store Grid

- Render a grid of companion cards.
- Show Ghou as owned.
- Support locked-card states even if no locked monsters ship yet.
- Show name, rarity, price metadata on hover.

### Phase 4: MP Economy

- Add MP balance to persisted companion ownership state.
- Award MP whenever a companion levels up.
- Award per level crossed, so multi-level gains do not skip MP.
- Add duplicate-award protection using the same event/award discipline as XP.

### Phase 5: Purchasing And Active Companion

- Add purchase action for locked monsters.
- Subtract MP atomically.
- Mark monster as owned at level 0.
- Let user select owned monster as active companion.
- Keep Ghou as default active companion.

## Acceptance Criteria

- Activity Bar shows only Terminal and Ghou/monster-store icons.
- Clicking Terminal shows the existing terminal workspace.
- Clicking Ghou shows the monster store area in the center.
- The right Ghou message/progress panel stays visible in both routes.
- Store data is driven by a companion registry, not hardcoded JSX.
- Ghou appears as owned by default.
- Owned egg cards show egg art.
- Owned hatched cards show the first monster frame at rest.
- Owned cards animate only on hover.
- Locked cards are dimmed and do not animate on hover.
- Locked-card hover exposes name, rarity, and price.
- MP reward calculation returns:
  - `500` for level `2`;
  - `500000` for level `100`.

## Open Questions

- Should buying a monster immediately make it active, or only add it to the collection?
- Should locked monsters be visible as silhouettes, dimmed eggs, or dimmed first forms?
- Should Ghou be labeled as `Common`, `Starter`, or a special non-store rarity?
- Should MP eventually sync to an account/server, or stay local until anti-farm systems
  exist?
