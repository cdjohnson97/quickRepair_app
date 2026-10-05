import { useEffect, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { EVENT_TYPES, toISODate, addDays, fetchEventsForEmployees } from '../../utils/calendarEvents';

function startOfWeek(date) {
  const d = new Date(date);
  const weekday = (d.getDay() + 6) % 7; // Lundi = 0
  return addDays(d, -weekday);
}

// Planning hebdomadaire de toute l'équipe : une ligne par employé, une colonne par jour.
export default function TeamAvailabilityGrid({ employees }) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [events, setEvents] = useState([]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const ids = employees.map((e) => e.id_employe);

  useEffect(() => {
    if (ids.length === 0) return;
    let active = true;
    fetchEventsForEmployees(ids, days[0], days[6]).then((data) => {
      if (active) setEvents(data);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, employees.length]);

  if (employees.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
          <FiChevronLeft />
        </button>
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
          Semaine du {days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
        </h3>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
          <FiChevronRight />
        </button>
      </div>

      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left text-xs font-bold text-slate-400 uppercase pb-2 pr-2">Technicien</th>
            {days.map((d) => (
              <th key={toISODate(d)} className="text-center text-xs font-bold text-slate-400 uppercase pb-2">
                {d.toLocaleDateString('fr-FR', { weekday: 'short' })}<br />
                <span className="font-normal normal-case">{d.getDate()}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id_employe} className="border-t border-slate-100 dark:border-slate-700">
              <td className="py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{emp.prenom} {emp.nom}</td>
              {days.map((d) => {
                const iso = toISODate(d);
                const dayEvents = events.filter((e) => e.id_employe === emp.id_employe && e.date_debut <= iso && e.date_fin >= iso);
                const type = dayEvents[0]?.type;
                return (
                  <td key={iso} className="p-1">
                    <div
                      title={dayEvents.map((e) => e.titre).join(', ')}
                      className={`h-7 rounded-md ${type ? EVENT_TYPES[type]?.badge : 'bg-emerald-50 dark:bg-emerald-900/20'}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap gap-3 mt-3">
        <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800" /> Libre</span>
        {Object.entries(EVENT_TYPES).map(([key, val]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-slate-500"><span className={`w-3 h-3 rounded ${val.badge}`} /> {val.label}</span>
        ))}
      </div>
    </div>
  );
}
