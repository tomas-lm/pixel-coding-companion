import type { CompanionBoxImage as CompanionBoxImageDefinition } from '../boxes/companionBoxImages'

type CompanionBoxImageProps = {
  image?: CompanionBoxImageDefinition
  name: string
}

export function CompanionBoxImage({
  image,
  name
}: CompanionBoxImageProps): React.JSX.Element {
  if (!image) return <span className="companion-box-image companion-box-image--fallback" />

  return <img className="companion-box-image" src={image.imageUrl} alt="" aria-label={name} />
}
