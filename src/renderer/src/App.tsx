import { TerminalPane } from './components/TerminalPane'

function App(): React.JSX.Element {
  return (
    <main className="app-shell">
      <aside className="workspace-rail">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <strong>Pixel Coding Companion</strong>
            <span>Local agent desk</span>
          </div>
        </div>

        <section className="project-list" aria-label="Projects">
          <button className="project-item project-item--active">
            <span className="project-dot project-dot--corax" aria-hidden="true" />
            <span>Corax</span>
            <small>working</small>
          </button>
          <button className="project-item">
            <span className="project-dot project-dot--engelmig" aria-hidden="true" />
            <span>Engelmig</span>
            <small>idle</small>
          </button>
          <button className="project-item">
            <span className="project-dot project-dot--personal" aria-hidden="true" />
            <span>Personal</span>
            <small>draft</small>
          </button>
        </section>
      </aside>

      <section className="session-panel" aria-label="Session preview">
        <header className="session-header">
          <div>
            <span className="eyebrow">Corax</span>
            <h1>Codex session</h1>
          </div>
          <span className="status-pill">running</span>
        </header>

        <TerminalPane />
      </section>

      <aside className="companion-panel" aria-label="Companion preview">
        <div className="companion-stage">
          <div className="speech-bubble">
            <span>Corax</span>
            <p>Estou trabalhando nessa sessao.</p>
          </div>
          <div className="pixel-companion" aria-hidden="true">
            <span className="pixel-eye pixel-eye--left" />
            <span className="pixel-eye pixel-eye--right" />
            <span className="pixel-mouth" />
          </div>
          <div className="shadow" />
        </div>
      </aside>
    </main>
  )
}

export default App
