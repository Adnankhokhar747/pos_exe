import { useState } from 'react';
import type { DayAvailability } from '../api';

interface Props {
  availability: DayAvailability[];
  onSelect: (day: DayAvailability) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function CalendarPicker({ availability, onSelect }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState('');

  const availMap = new Map(availability.map((d) => [d.date, d]));

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function pad(n: number) { return String(n).padStart(2, '0'); }
  function dateStr(day: number) { return `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`; }

  function getClass(day: number): string {
    const ds = dateStr(day);
    const d = new Date(viewYear, viewMonth, day);
    if (d < today) return 'cal-day cal-day-past';
    const avail = availMap.get(ds);
    if (!avail) return 'cal-day cal-day-unavail';
    if (!avail.available) return 'cal-day cal-day-unavail';
    if (ds === selected) return 'cal-day cal-day-avail cal-day-selected';
    return 'cal-day cal-day-avail';
  }

  function handleClick(day: number) {
    const ds = dateStr(day);
    const d = new Date(viewYear, viewMonth, day);
    if (d < today) return;
    const avail = availMap.get(ds);
    if (!avail || !avail.available) return;
    setSelected(ds);
    onSelect(avail);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="calendar">
      <div className="cal-header">
        <button className="btn btn-secondary btn-sm" onClick={prevMonth}>‹</button>
        <h3>{MONTHS[viewMonth]} {viewYear}</h3>
        <button className="btn btn-secondary btn-sm" onClick={nextMonth}>›</button>
      </div>
      <div className="cal-grid">
        {DAYS.map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="cal-day cal-day-empty" />;
          const ds = dateStr(day);
          const avail = availMap.get(ds);
          const d = new Date(viewYear, viewMonth, day);
          const isPast = d < today;
          return (
            <div
              key={ds}
              className={getClass(day)}
              onClick={() => handleClick(day)}
              title={avail?.available ? `Token #${avail.nextToken}` : undefined}
            >
              {day}
              {!isPast && avail?.available && (
                <span className="cal-token">#{avail.nextToken}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
