type LoadingScreenProps = {
  label: string
  title: string
}

export function LoadingScreen({ label, title }: LoadingScreenProps): React.JSX.Element {
  return (
    <main className="onboarding-shell">
      <section className="onboarding-panel onboarding-panel--loading" aria-label={label}>
        <span className="eyebrow">Pixel Companion</span>
        <h1>{title}</h1>
      </section>
    </main>
  )
}
