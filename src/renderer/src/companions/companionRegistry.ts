import ghouEggSpriteUrl from '../assets/companions/ghou/ghou-sprite-egg.png'
import ghouLvl1SpriteUrl from '../assets/companions/ghou/ghou-sprite-lvl1.png'
import ghouLvl2SpriteUrl from '../assets/companions/ghou/ghou-sprite-lvl2.png'
import ghouLvl3SpriteUrl from '../assets/companions/ghou/ghou-sprite-lvl3.png'
import type { CompanionDefinition, CompanionSpriteStage } from './companionTypes'

export const STARTER_COMPANION_ID = 'ghou'

export const GHOU_STAGES: CompanionSpriteStage[] = [
  {
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'egg',
    minLevel: 0,
    spriteUrl: ghouEggSpriteUrl,
    width: 116
  },
  {
    frameColumns: 6,
    frameRows: 6,
    height: 168,
    id: 'lvl1',
    minLevel: 5,
    spriteUrl: ghouLvl1SpriteUrl,
    width: 116
  },
  {
    frameColumns: 6,
    frameRows: 6,
    height: 135,
    id: 'lvl2',
    minLevel: 25,
    spriteUrl: ghouLvl2SpriteUrl,
    width: 128
  },
  {
    frameColumns: 6,
    frameRows: 6,
    height: 154,
    id: 'lvl3',
    minLevel: 50,
    spriteUrl: ghouLvl3SpriteUrl,
    width: 139
  }
]

export const COMPANION_REGISTRY: CompanionDefinition[] = [
  {
    basePrice: 0,
    id: STARTER_COMPANION_ID,
    name: 'Ghou',
    rarity: 'starter',
    stages: GHOU_STAGES
  },
  {
    basePrice: 10000,
    id: 'raya',
    name: 'Raya',
    rarity: 'common',
    stages: GHOU_STAGES
  }
]

export function getCompanionStageForLevel(
  companion: CompanionDefinition,
  level: number
): CompanionSpriteStage {
  const safeLevel = Math.max(0, Math.floor(level))

  return companion.stages.reduce((activeStage, stage) => {
    return safeLevel >= stage.minLevel ? stage : activeStage
  }, companion.stages[0])
}
