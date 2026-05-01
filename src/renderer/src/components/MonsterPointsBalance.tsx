import { formatMonsterPoints } from '../companions/companionEconomy'

type MonsterPointsBalanceProps = {
  monsterPoints: number
}

export function MonsterPointsBalance({
  monsterPoints
}: MonsterPointsBalanceProps): React.JSX.Element {
  return (
    <aside className="monster-points-balance" aria-label="Monster Points balance">
      <span>MP</span>
      <strong>{formatMonsterPoints(monsterPoints)}</strong>
    </aside>
  )
}
