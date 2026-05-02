import commonChestUrl from '../assets/boxes/common-chest.png'
import dailyChestUrl from '../assets/boxes/daily-chest.png'
import legendaryChestUrl from '../assets/boxes/legendary-chest.png'
import rareChestUrl from '../assets/boxes/rare-chest.png'
import ultraRareChestUrl from '../assets/boxes/ultra-rare-chest.png'
import uncommonChestUrl from '../assets/boxes/uncommon-chest.png'

export type CompanionBoxImage = {
  imageUrl: string
}

export const COMPANION_BOX_IMAGES: Record<string, CompanionBoxImage> = {
  basic_egg_box: {
    imageUrl: commonChestUrl
  },
  daily_egg_box: {
    imageUrl: dailyChestUrl
  },
  legendary_egg_box: {
    imageUrl: legendaryChestUrl
  },
  rare_egg_box: {
    imageUrl: rareChestUrl
  },
  ultra_rare_egg_box: {
    imageUrl: ultraRareChestUrl
  },
  uncommon_egg_box: {
    imageUrl: uncommonChestUrl
  }
}

export function getCompanionBoxImage(boxId: string): CompanionBoxImage | undefined {
  return COMPANION_BOX_IMAGES[boxId]
}
