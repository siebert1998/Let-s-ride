import { useMemo, useState } from 'react';
import { RouteCard } from './components/RouteCard';
import { TopControls } from './components/TopControls';

interface RouteSlot {
  key: string;
  title: string;
}

const getMondayForWeek = (anchor: Date): Date => {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diffFromMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffFromMonday);
  return start;
};

const formatRouteTitle = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  return formatter.format(date);
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function App(): JSX.Element {
  const [weekOffset, setWeekOffset] = useState<number>(0);

  const routeSlots = useMemo<RouteSlot[]>(() => {
    const anchor = new Date();
    anchor.setDate(anchor.getDate() + weekOffset * 7);
    const monday = getMondayForWeek(anchor);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return {
        key: toDateKey(date),
        title: formatRouteTitle(date),
      };
    });
  }, [weekOffset]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 rounded-xl2 border border-line bg-panel/80 p-4 shadow-card md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-textMuted">Cycling Dashboard</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-textMain">Let&apos;s ride</h1>
        </div>
        <TopControls
          weekOffset={weekOffset}
          onPreviousWeek={() => setWeekOffset((value) => value - 1)}
          onNextWeek={() => setWeekOffset((value) => value + 1)}
          onToday={() => setWeekOffset(0)}
        />
      </header>

      <main className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {routeSlots.map((slot, index) => (
          <RouteCard
            key={slot.key}
            title={slot.title}
            storageId={`day-${slot.key}`}
            initialNotes={index > 3 ? 'Weekend focus route.' : ''}
          />
        ))}
      </main>
    </div>
  );
}

export default App;
