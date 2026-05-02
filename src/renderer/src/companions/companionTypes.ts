import type {
  CompanionAcquisition,
  CompanionRarity,
  CompanionStoreDefinition
} from '../../../shared/companionStore'

export type { CompanionAcquisition, CompanionRarity }

export type CompanionStageId = 'egg' | 'lvl1' | 'lvl2' | 'lvl3'

export type CompanionSpriteStage = {
  frameColumns: number
  frameRows: number
  avatarOffsetX?: number
  avatarOffsetY?: number
  avatarScale?: number
  height: number
  id: CompanionStageId
  minLevel: number
  offsetY?: number
  spriteUrl: string
  width: number
}

export type CompanionDefinition = CompanionStoreDefinition & {
  stages: CompanionSpriteStage[]
}

export type CompanionCardState = {
  currentXp: number
  level: number
  monsterPoints: number
  owned: boolean
  selected: boolean
  totalXp: number
}
