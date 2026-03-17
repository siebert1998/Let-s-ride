import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGroupAndJoinAsAdmin, type GroupVisibility } from '../services/groups';

interface GroupCreatePageProps {
  userId: string;
}

const mainGroupOptions = ['VZW', 'AquaMundo Cycling Team', 'Vitessen'] as const;

export function GroupCreatePage({ userId }: GroupCreatePageProps): JSX.Element {
  const navigate = useNavigate();
  const [name, setName] = useState<string>('');
  const [mainGroup, setMainGroup] = useState<string>(mainGroupOptions[0]);
  const [subgroup, setSubgroup] = useState<string>('');
  const [visibilityType, setVisibilityType] = useState<GroupVisibility>('open');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const createdGroup = await createGroupAndJoinAsAdmin(userId, {
        name,
        mainGroup,
        subgroup: subgroup || undefined,
        visibilityType,
      });

      navigate(`/group/${createdGroup.slug}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Kon groep niet aanmaken.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[760px] items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-xl2 border border-line bg-panel/90 p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Nieuwe groep</p>
        <h1 className="mt-2 text-2xl font-extrabold text-textMain">Groep aanmaken</h1>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Groepsnaam"
            required
            className="w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
          />

          <select
            value={mainGroup}
            onChange={(event) => setMainGroup(event.target.value)}
            className="w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
          >
            {mainGroupOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <input
            value={subgroup}
            onChange={(event) => setSubgroup(event.target.value)}
            placeholder="Subgroep (optioneel)"
            className="w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
          />

          <select
            value={visibilityType}
            onChange={(event) => setVisibilityType(event.target.value as GroupVisibility)}
            className="w-full rounded-lg border border-line bg-panelSoft px-3 py-2 text-sm text-textMain outline-none transition focus:border-accent"
          >
            <option value="open">Open groep</option>
            <option value="closed">Gesloten groep</option>
          </select>

          {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg border border-line bg-panel px-4 py-2 text-sm font-semibold text-textMain transition hover:border-accent hover:text-accent"
            >
              Terug
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-black transition hover:bg-accentStrong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Aanmaken...' : 'Groep aanmaken'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
