import { FormEvent, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';

interface AuthPageProps {
  onAuthenticated: () => void;
}

type Mode = 'sign-in' | 'sign-up';

export function AuthPage({ onAuthenticated }: AuthPageProps): JSX.Element {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const supabase = getSupabaseClient();

      if (mode === 'sign-up') {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          throw signUpError;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          throw signInError;
        }
      }

      onAuthenticated();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authenticatie mislukt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center justify-center px-4 py-8">
      <section className="w-full rounded-xl2 border border-line bg-panel/90 p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Account</p>
        <h1 className="mt-2 text-2xl font-extrabold text-textMain">{mode === 'sign-in' ? 'Inloggen' : 'Account maken'}</h1>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-line bg-panelSoft p-1">
          <button
            type="button"
            onClick={() => setMode('sign-in')}
            className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
              mode === 'sign-in' ? 'bg-accent text-black' : 'text-textMain hover:text-accent'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setMode('sign-up')}
            className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
              mode === 'sign-up' ? 'bg-accent text-black' : 'text-textMain hover:text-accent'
            }`}
          >
            Maak account aan
          </button>
        </div>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="E-mail"
            required
            className="w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Wachtwoord"
            required
            minLength={6}
            className="w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
          />

          {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-bold text-black transition hover:bg-accentStrong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Bezig...' : mode === 'sign-in' ? 'Inloggen' : 'Account maken'}
          </button>
        </form>
      </section>
    </div>
  );
}
