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
          '--companion-avatar-height': `${stage.height}px`,
          '--companion-avatar-image': `url(${stage.spriteUrl})`,
          '--companion-avatar-width': `${stage.width}px`,
          '--companion-sprite-columns': stage.frameColumns,
          '--companion-sprite-rows': stage.frameRows
        } as CSSProperties
      }
    />
  )
}
