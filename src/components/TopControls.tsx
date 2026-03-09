import { useMemo } from 'react';

const getMondayForWeek = (anchor: Date): Date => {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diffFromMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffFromMonday);
  return start;
};

const formatWeekRange = (anchor: Date): string => {
  const start = getMondayForWeek(anchor);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

interface TopControlsProps {
  weekOffset: number;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

export function TopControls({ weekOffset, onPreviousWeek, onNextWeek, onToday }: TopControlsProps): JSX.Element {
  const selectedRange = useMemo(() => {
    const anchor = new Date();
    anchor.setDate(anchor.getDate() + weekOffset * 7);
    return formatWeekRange(anchor);
  }, [weekOffset]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="flex items-center rounded-lg border border-line bg-panel px-2 py-1">
        <button
          type="button"
          onClick={onPreviousWeek}
          className="rounded-md px-2 py-1 text-lg text-textMuted transition hover:bg-panelSoft hover:text-accent"
          aria-label="Previous week"
        >
          ‹
        </button>
        <span className="px-2 text-sm font-semibold text-textMain">{selectedRange}</span>
        <button
          type="button"
          onClick={onNextWeek}
          className="rounded-md px-2 py-1 text-lg text-textMuted transition hover:bg-panelSoft hover:text-accent"
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      <button
        type="button"
        onClick={onToday}
        className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-textMain transition hover:border-accent hover:text-accent"
      >
        Vandaag
      </button>
    </div>
  );
}
