import combotEggSpriteUrl from '../assets/companions/combot/combot-egg-idle.png'
import combotLvl1SpriteUrl from '../assets/companions/combot/combot-lvl1-idle.png'
import combotLvl2SpriteUrl from '../assets/companions/combot/combot-lvl2-idle.png'
import combotLvl3SpriteUrl from '../assets/companions/combot/combot-lvl3-idle.png'
import frogoEggSpriteUrl from '../assets/companions/frogo/frogo-egg-idle.png'
import frogoLvl1SpriteUrl from '../assets/companions/frogo/frogo-lvl1-idle.png'
import frogoLvl2SpriteUrl from '../assets/companions/frogo/frogo-lvl2-idle.png'
import frogoLvl3SpriteUrl from '../assets/companions/frogo/frogo-lvl3-idle.png'
import ghouEggSpriteUrl from '../assets/companions/ghou/ghou-sprite-egg.png'
import ghouLvl1SpriteUrl from '../assets/companions/ghou/ghou-sprite-lvl1.png'
import ghouLvl2SpriteUrl from '../assets/companions/ghou/ghou-sprite-lvl2.png'
import ghouLvl3SpriteUrl from '../assets/companions/ghou/ghou-sprite-lvl3.png'
import rayaEggSpriteUrl from '../assets/companions/raya/raya-egg-animated.png'
import rayaLvl1SpriteUrl from '../assets/companions/raya/raya-lvl1-idle.png'
import rayaLvl2SpriteUrl from '../assets/companions/raya/raya-lvl2-idle.png'
import rayaLvl3SpriteUrl from '../assets/companions/raya/raya-lvl3-idle.png'
import tataEggSpriteUrl from '../assets/companions/tata/tata-egg-idle.png'
import tataLvl1SpriteUrl from '../assets/companions/tata/tata-lvl1-idle.png'
import tataLvl2SpriteUrl from '../assets/companions/tata/tata-lvl2-idle.png'
import tataLvl3SpriteUrl from '../assets/companions/tata/tata-lvl3-idle.png'
import toukEggSpriteUrl from '../assets/companions/touk/touk-egg-idle.png'
import toukLvl1SpriteUrl from '../assets/companions/touk/touk-lvl1-idle.png'
import toukLvl2SpriteUrl from '../assets/companions/touk/touk-lvl2-idle.png'
import toukLvl3SpriteUrl from '../assets/companions/touk/touk-lvl3-idle.png'
import {
  COMPANION_STORE_DEFINITIONS,
  STARTER_COMPANION_ID,
  STARTER_COMPANION_IDS
} from '../../../shared/companionStore'
import type { CompanionDefinition, CompanionSpriteStage } from './companionTypes'

export { STARTER_COMPANION_ID, STARTER_COMPANION_IDS }

export const GHOU_STAGES: CompanionSpriteStage[] = [
  {
    avatarOffsetX: -6,
    avatarOffsetY: 10,
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

export const RAYA_STAGES: CompanionSpriteStage[] = [
  {
    avatarOffsetX: -4,
    avatarOffsetY: 10,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'egg',
    minLevel: 0,
    spriteUrl: rayaEggSpriteUrl,
    width: 101
  },
  {
    frameColumns: 6,
    frameRows: 6,
    height: 90,
    id: 'lvl1',
    minLevel: 5,
    spriteUrl: rayaLvl1SpriteUrl,
    width: 201
  },
  {
    frameColumns: 6,
    frameRows: 6,
    height: 112,
    id: 'lvl2',
    minLevel: 25,
    spriteUrl: rayaLvl2SpriteUrl,
    width: 214
  },
  {
    frameColumns: 6,
    frameRows: 6,
    height: 118,
    id: 'lvl3',
    minLevel: 50,
    spriteUrl: rayaLvl3SpriteUrl,
    width: 217
  }
]

export const FROGO_STAGES: CompanionSpriteStage[] = [
  {
    avatarOffsetX: -4,
    avatarOffsetY: 10,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'egg',
    minLevel: 0,
    spriteUrl: frogoEggSpriteUrl,
    width: 118
  },
  {
    avatarOffsetX: -22,
    avatarOffsetY: 10,
    avatarScale: 0.78,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'lvl1',
    minLevel: 5,
    offsetY: 40,
    spriteUrl: frogoLvl1SpriteUrl,
    width: 165
  },
  {
    avatarOffsetX: -8,
    avatarOffsetY: 10,
    avatarScale: 0.82,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'lvl2',
    minLevel: 25,
    offsetY: 40,
    spriteUrl: frogoLvl2SpriteUrl,
    width: 137
  },
  {
    avatarOffsetX: -9,
    avatarOffsetY: 10,
    avatarScale: 0.82,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'lvl3',
    minLevel: 50,
    offsetY: 40,
    spriteUrl: frogoLvl3SpriteUrl,
    width: 151
  }
]

export const COMBOT_STAGES: CompanionSpriteStage[] = [
  {
    avatarOffsetX: 2,
    avatarOffsetY: 10,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'egg',
    minLevel: 0,
    spriteUrl: combotEggSpriteUrl,
    width: 104
  },
  {
    avatarHeight: 104,
    avatarOffsetX: 2,
    avatarWidth: 99,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'lvl1',
    minLevel: 5,
    spriteUrl: combotLvl1SpriteUrl,
    width: 142
  },
  {
    avatarHeight: 104,
    avatarOffsetX: 2,
    avatarWidth: 102,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'lvl2',
    minLevel: 25,
    spriteUrl: combotLvl2SpriteUrl,
    width: 146
  },
  {
    avatarHeight: 104,
    avatarOffsetX: 2,
    avatarWidth: 113,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'lvl3',
    minLevel: 50,
    spriteUrl: combotLvl3SpriteUrl,
    width: 162
  }
]

export const TATA_STAGES: CompanionSpriteStage[] = [
  {
    avatarOffsetX: -4,
    avatarOffsetY: 10,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'egg',
    minLevel: 0,
    spriteUrl: tataEggSpriteUrl,
    width: 110
  },
  {
    avatarOffsetY: 10,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'lvl1',
    minLevel: 5,
    offsetY: 40,
    spriteUrl: tataLvl1SpriteUrl,
    width: 93
  },
  {
    avatarOffsetY: 10,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'lvl2',
    minLevel: 25,
    offsetY: 40,
    spriteUrl: tataLvl2SpriteUrl,
    width: 132
  },
  {
    frameColumns: 6,
    frameRows: 6,
    height: 154,
    id: 'lvl3',
    minLevel: 50,
    offsetY: 40,
    spriteUrl: tataLvl3SpriteUrl,
    width: 136
  }
]

export const TOUK_STAGES: CompanionSpriteStage[] = [
  {
    avatarOffsetX: -4,
    avatarOffsetY: 10,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'egg',
    minLevel: 0,
    spriteUrl: toukEggSpriteUrl,
    width: 137
  },
  {
    avatarOffsetY: 10,
    frameColumns: 6,
    frameRows: 6,
    height: 149,
    id: 'lvl1',
    minLevel: 5,
    offsetY: 40,
    spriteUrl: toukLvl1SpriteUrl,
    width: 122
  },
  {
    frameColumns: 6,
    frameRows: 6,
    height: 135,
    id: 'lvl2',
    minLevel: 25,
    spriteUrl: toukLvl2SpriteUrl,
    width: 147
  },
  {
    frameColumns: 6,
    frameRows: 6,
    height: 154,
    id: 'lvl3',
    minLevel: 50,
    spriteUrl: toukLvl3SpriteUrl,
    width: 195
  }
]

function getStagesForCompanion(companionId: string): CompanionSpriteStage[] {
  if (companionId === 'raya') return RAYA_STAGES
  if (companionId === 'frogo') return FROGO_STAGES
  if (companionId === 'combot') return COMBOT_STAGES
  if (companionId === 'tata') return TATA_STAGES
  if (companionId === 'touk') return TOUK_STAGES

  return GHOU_STAGES
}

export const COMPANION_REGISTRY: CompanionDefinition[] = COMPANION_STORE_DEFINITIONS.map(
  (companion) => ({
    ...companion,
    stages: getStagesForCompanion(companion.id)
  })
)

export function getCompanionStageForLevel(
  companion: CompanionDefinition,
  level: number
): CompanionSpriteStage {
  const safeLevel = Math.max(0, Math.floor(level))

  return companion.stages.reduce((activeStage, stage) => {
    return safeLevel >= stage.minLevel ? stage : activeStage
  }, companion.stages[0])
}
