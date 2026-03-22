import { useEffect, useMemo, useState } from 'react';

const weekDayLabels = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'] as const;

const getMondayForWeek = (anchor: Date): Date => {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diffFromMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffFromMonday);
  return start;
};

const getStartOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatWeekRange = (weekStart: Date): string => {
  const start = getMondayForWeek(weekStart);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const formatter = new Intl.DateTimeFormat('nl-BE', {
    month: 'short',
    day: 'numeric',
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

interface TopControlsProps {
  selectedMainGroupLabel: string;
  showVitessenSubgroups: boolean;
  vitessenSubgroups: readonly string[];
  selectedVitessenSubgroup: string;
  onVitessenSubgroupChange: (group: string) => void;
  weekStartDate: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onSelectWeekDate: (date: Date) => void;
  filledDateKeys: string[];
  selectedDayIndexes: number[];
  onSaveDayIndexes: (indexes: number[]) => void;
}

export function TopControls({
  selectedMainGroupLabel,
  showVitessenSubgroups,
  vitessenSubgroups,
  selectedVitessenSubgroup,
  onVitessenSubgroupChange,
  weekStartDate,
  onPreviousWeek,
  onNextWeek,
  onToday,
  onSelectWeekDate,
  filledDateKeys,
  selectedDayIndexes,
  onSaveDayIndexes,
}: TopControlsProps): JSX.Element {
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [isDayFilterOpen, setIsDayFilterOpen] = useState<boolean>(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(getStartOfMonth(weekStartDate));
  const [draftDayIndexes, setDraftDayIndexes] = useState<number[]>(selectedDayIndexes);

  useEffect(() => {
    setCalendarMonth(getStartOfMonth(weekStartDate));
  }, [weekStartDate]);

  useEffect(() => {
    setDraftDayIndexes(selectedDayIndexes);
  }, [selectedDayIndexes]);

  const selectedRange = useMemo(() => formatWeekRange(weekStartDate), [weekStartDate]);

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat('nl-BE', {
        month: 'long',
        year: 'numeric',
      }).format(calendarMonth),
    [calendarMonth],
  );

  const filledDates = useMemo(() => new Set(filledDateKeys), [filledDateKeys]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = getStartOfMonth(calendarMonth);
    const gridStart = getMondayForWeek(firstDayOfMonth);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [calendarMonth]);

  const toggleDraftDay = (dayIndex: number): void => {
    setDraftDayIndexes((current) =>
      current.includes(dayIndex) ? current.filter((value) => value !== dayIndex) : [...current, dayIndex],
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="max-w-[240px] rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-textMain">
        {selectedMainGroupLabel}
      </div>

      {showVitessenSubgroups ? (
        <select
          value={selectedVitessenSubgroup}
          onChange={(event) => onVitessenSubgroupChange(event.target.value)}
          className="max-w-[160px] rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-textMain outline-none transition focus:border-accent"
        >
          {vitessenSubgroups.map((subgroup) => (
            <option key={subgroup} value={subgroup}>
              {subgroup}
            </option>
          ))}
        </select>
      ) : null}

      <div className="relative flex items-center rounded-lg border border-line bg-panel px-2 py-1">
        <button
          type="button"
          onClick={onPreviousWeek}
          className="rounded-md px-2 py-1 text-lg text-textMuted transition hover:bg-panelSoft hover:text-accent"
          aria-label="Previous week"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={() => {
            setIsCalendarOpen((value) => !value);
            setIsDayFilterOpen(false);
          }}
          className="rounded-md px-2 py-1 text-sm font-semibold text-textMain transition hover:bg-panelSoft"
          aria-label="Open calendar"
        >
          {selectedRange}
        </button>

        <button
          type="button"
          onClick={onNextWeek}
          className="rounded-md px-2 py-1 text-lg text-textMuted transition hover:bg-panelSoft hover:text-accent"
          aria-label="Next week"
        >
          ›
        </button>

        {isCalendarOpen ? (
          <div className="absolute left-1/2 top-12 z-[1000] w-[320px] -translate-x-1/2 rounded-xl border border-line bg-panel p-3 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
                }
                className="rounded-md px-2 py-1 text-textMuted transition hover:bg-panelSoft hover:text-accent"
                aria-label="Previous month"
              >
                ‹
              </button>
              <p className="text-sm font-bold capitalize text-textMain">{monthTitle}</p>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
                }
                className="rounded-md px-2 py-1 text-textMuted transition hover:bg-panelSoft hover:text-accent"
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-textMuted">
              {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1">
              {calendarDays.map((date) => {
                const dateKey = toDateKey(date);
                const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                const hasGpx = filledDates.has(dateKey);

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => {
                      onSelectWeekDate(date);
                      setIsCalendarOpen(false);
                    }}
                    className={`relative h-9 rounded-md text-xs font-semibold transition ${
                      isCurrentMonth ? 'text-textMain hover:bg-panelSoft' : 'text-textMuted/60 hover:bg-panelSoft'
                    }`}
                  >
                    {date.getDate()}
                    {hasGpx ? (
                      <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-accent" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsDayFilterOpen((value) => !value);
            setIsCalendarOpen(false);
          }}
          className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-textMain transition hover:border-accent hover:text-accent"
        >
          Filter dagen
        </button>

        {isDayFilterOpen ? (
          <div className="absolute right-0 top-12 z-[1000] w-56 rounded-xl border border-line bg-panel p-3 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Toon dagen</p>
            <div className="mt-2 space-y-1">
              {weekDayLabels.map((label, dayIndex) => (
                <label key={label} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm text-textMain">
                  <input
                    type="checkbox"
                    checked={draftDayIndexes.includes(dayIndex)}
                    onChange={() => toggleDraftDay(dayIndex)}
                    className="h-4 w-4 accent-accent"
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onSaveDayIndexes([...draftDayIndexes].sort((a, b) => a - b));
                setIsDayFilterOpen(false);
              }}
              className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black transition hover:bg-accentStrong"
            >
              Opslaan
            </button>
          </div>
        ) : null}
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
