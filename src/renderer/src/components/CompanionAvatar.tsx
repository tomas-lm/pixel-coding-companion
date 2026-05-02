import type { CSSProperties } from 'react'
import type { CompanionSpriteStage } from '../companions/companionTypes'

type CompanionAvatarProps = {
  animated?: boolean
  className?: string
  isDimmed?: boolean
  stage: CompanionSpriteStage
}

export function CompanionAvatar({
  animated = false,
  className,
  isDimmed = false,
  stage
}: CompanionAvatarProps): React.JSX.Element {
  return (
    <div
      className={[
        'companion-avatar',
        animated ? 'companion-avatar--animated' : undefined,
        isDimmed ? 'companion-avatar--dimmed' : undefined,
        className
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--companion-avatar-background-size': `${stage.frameColumns * 100}% ${
            stage.frameRows * 100
          }%`,
          '--companion-avatar-height': `${stage.avatarHeight ?? stage.height}px`,
          '--companion-avatar-image': `url(${stage.spriteUrl})`,
          '--companion-avatar-offset-x': `${stage.avatarOffsetX ?? 0}px`,
          '--companion-avatar-offset-y': `${stage.avatarOffsetY ?? 0}px`,
          '--companion-avatar-scale': stage.avatarScale ?? 1,
          '--companion-avatar-width': `${stage.avatarWidth ?? stage.width}px`,
          '--companion-sprite-columns': stage.frameColumns,
          '--companion-sprite-rows': stage.frameRows
        } as CSSProperties
      }
    />
  )
}
