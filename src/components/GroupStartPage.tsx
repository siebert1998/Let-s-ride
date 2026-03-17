import { useNavigate } from 'react-router-dom';

export function GroupStartPage(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[900px] items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-xl2 border border-line bg-panel/90 p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Groepen</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-textMain">Kies je volgende stap</h1>
        <p className="mt-2 text-sm text-textMuted">
          Maak een nieuwe groep aan of voeg je toe aan een bestaande groep.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate('/groups/new')}
            className="rounded-xl border border-line bg-panelSoft px-4 py-5 text-left transition hover:border-accent hover:bg-panel"
          >
            <p className="text-sm font-bold text-textMain">Groep aanmaken</p>
            <p className="mt-1 text-xs text-textMuted">Je wordt automatisch admin van deze groep.</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/groups')}
            className="rounded-xl border border-line bg-panelSoft px-4 py-5 text-left transition hover:border-accent hover:bg-panel"
          >
            <p className="text-sm font-bold text-textMain">Bestaande groep zoeken</p>
            <p className="mt-1 text-xs text-textMuted">Zoek en vraag toegang of word direct lid.</p>
          </button>
        </div>
      </section>
    </div>
  );
}
