import { useEffect, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiTrash2, FiPlus, FiEdit2, FiDownload } from 'react-icons/fi';
import Swal from 'sweetalert2';
import {
  EVENT_TYPES,
  MAX_RECURRING_OCCURRENCES,
  toISODate,
  addDays,
  formatDateRangeFr,
  fetchEventsForEmployees,
  createEvent,
  createEventsForTeam,
  updateEvent,
  deleteEvent
} from '../../utils/calendarEvents';
import { downloadICS } from '../../utils/icalExport';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildMonthGrid(monthDate) {
  const first = startOfMonth(monthDate);
  // Lundi = 0 ... Dimanche = 6
  const firstWeekday = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -firstWeekday);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

const emptyForm = { id_evenement: null, titre: '', type: 'reparation', date_debut: '', date_fin: '', recurring: false, recurringUntil: '', applyToTeam: false };

// Calendrier mensuel d'un employé : création/édition/suppression d'événements de disponibilité.
export default function EmployeeCalendar({ employeId, employeName, viewerRole, boutiqueEmployeIds }) {
  const [monthDate, setMonthDate] = useState(startOfMonth(new Date()));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null = formulaire fermé
  const [exporting, setExporting] = useState(false);

  const grid = buildMonthGrid(monthDate);
  const canApplyToTeam = viewerRole === 'Responsable' && boutiqueEmployeIds?.length > 1;
  const isEditing = Boolean(form?.id_evenement);

  useEffect(() => {
    if (!employeId) return;
    let active = true;
    setLoading(true);
    fetchEventsForEmployees([employeId], grid[0], grid[grid.length - 1]).then((data) => {
      if (active) {
        setEvents(data);
        setLoading(false);
      }
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeId, monthDate]);

  const eventsForDay = (day) => {
    const iso = toISODate(day);
    return events.filter((e) => e.date_debut <= iso && e.date_fin >= iso);
  };

  const openCreateForm = (day) => {
    const iso = toISODate(day);
    setForm({ ...emptyForm, date_debut: iso, date_fin: iso });
  };

  const openEditForm = (event) => {
    setForm({
      id_evenement: event.id_evenement,
      titre: event.titre,
      type: event.type,
      date_debut: event.date_debut,
      date_fin: event.date_fin,
      recurring: false,
      recurringUntil: '',
      applyToTeam: false
    });
  };

  const refresh = async () => {
    const data = await fetchEventsForEmployees([employeId], grid[0], grid[grid.length - 1]);
    setEvents(data);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!form.titre.trim()) return;

    try {
      if (isEditing) {
        await updateEvent(form.id_evenement, { titre: form.titre.trim(), type: form.type, date_debut: form.date_debut, date_fin: form.date_fin });
        setForm(null);
        refresh();
        return;
      }

      const occurrences = [{ date_debut: form.date_debut, date_fin: form.date_fin }];
      if (form.recurring && form.recurringUntil) {
        let start = new Date(form.date_debut);
        let end = new Date(form.date_fin);
        while (occurrences.length < MAX_RECURRING_OCCURRENCES) {
          start = addDays(start, 7);
          end = addDays(end, 7);
          if (toISODate(start) > form.recurringUntil) break;
          occurrences.push({ date_debut: toISODate(start), date_fin: toISODate(end) });
        }
      }

      for (const occ of occurrences) {
        if (form.applyToTeam && canApplyToTeam) {
          await createEventsForTeam(boutiqueEmployeIds, { titre: form.titre.trim(), type: form.type, ...occ });
        } else {
          await createEvent({ id_employe: employeId, titre: form.titre.trim(), type: form.type, ...occ });
        }
      }

      setForm(null);
      refresh();
    } catch (err) {
      Swal.fire('Erreur', err.message || "L'enregistrement de l'événement a échoué.", 'error');
    }
  };

  const handleDelete = async (idEvenement) => {
    const result = await Swal.fire({
      title: 'Supprimer cet événement ?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#ef4444'
    });
    if (!result.isConfirmed) return;
    await deleteEvent(idEvenement);
    refresh();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rangeStart = addDays(new Date(), -30);
      const rangeEnd = addDays(new Date(), 365);
      const allEvents = await fetchEventsForEmployees([employeId], rangeStart, rangeEnd);
      if (allEvents.length === 0) {
        Swal.fire('Aucun événement', "Il n'y a rien à exporter pour l'instant.", 'info');
        return;
      }
      downloadICS(allEvents, employeName);
    } finally {
      setExporting(false);
    }
  };

  const todayIso = toISODate(new Date());
  const upcoming = events
    .filter((e) => e.date_fin >= todayIso)
    .sort((a, b) => a.date_debut.localeCompare(b.date_debut));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
          <FiChevronLeft />
        </button>
        <h3 className="font-bold text-slate-800 dark:text-slate-100 capitalize">
          {monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </h3>
        <button onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
          <FiChevronRight />
        </button>
      </div>

      <div className="flex justify-end mb-2">
        <button
          onClick={handleExport}
          disabled={exporting}
          title="Exporter vers Google Calendar / Outlook / Apple Calendar"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition disabled:opacity-50"
        >
          <FiDownload size={12} /> {exporting ? 'Export...' : 'Exporter (.ics)'}
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 uppercase mb-1">
        {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((day) => {
          const inMonth = day.getMonth() === monthDate.getMonth();
          const dayEvents = eventsForDay(day);
          const isToday = toISODate(day) === todayIso;
          return (
            <button
              key={toISODate(day)}
              onClick={() => openCreateForm(day)}
              className={`relative aspect-square rounded-lg p-1 text-left border transition ${
                inMonth ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-blue-300' : 'bg-slate-50 dark:bg-slate-900 border-transparent text-slate-300 dark:text-slate-600'
              } ${isToday ? 'ring-2 ring-blue-400' : ''}`}
            >
              <span className="text-[11px] font-semibold">{day.getDate()}</span>
              <div className="flex flex-wrap gap-0.5 mt-1">
                {dayEvents.slice(0, 3).map((e) => (
                  <span key={e.id_evenement} className={`w-1.5 h-1.5 rounded-full ${EVENT_TYPES[e.type]?.dot || EVENT_TYPES.autre.dot}`} title={e.titre} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {loading && <p className="text-xs text-slate-400 italic mt-3">Chargement du calendrier...</p>}

      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2">Événements à venir</h4>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {upcoming.length === 0 && <p className="text-sm text-slate-400 italic">Aucun événement à venir.</p>}
        {upcoming.map((e) => (
          <div key={e.id_evenement} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${EVENT_TYPES[e.type]?.dot || EVENT_TYPES.autre.dot}`} />
                {e.titre}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{formatDateRangeFr(e.date_debut, e.date_fin)}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => openEditForm(e)} className="text-slate-400 hover:text-blue-500 p-1.5 transition">
                <FiEdit2 size={14} />
              </button>
              <button onClick={() => handleDelete(e.id_evenement)} className="text-slate-400 hover:text-red-500 p-1.5 transition">
                <FiTrash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setForm(null)} />
          <form onSubmit={handleSubmitForm} className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              {isEditing ? <FiEdit2 /> : <FiPlus />} {isEditing ? 'Modifier' : 'Nouvel'} événement — {employeName}
            </h3>
            <input
              autoFocus
              required
              placeholder="Titre (ex: Réparation atelier B)"
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(EVENT_TYPES).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
            </select>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500">Début</label>
                <input type="date" required value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500">Fin</label>
                <input type="date" required min={form.date_debut} value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {!isEditing && (
              <>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />
                  Se répète chaque semaine jusqu'au...
                </label>
                {form.recurring && (
                  <input type="date" min={form.date_debut} value={form.recurringUntil} onChange={(e) => setForm({ ...form, recurringUntil: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                )}

                {canApplyToTeam && (
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={form.applyToTeam} onChange={(e) => setForm({ ...form, applyToTeam: e.target.checked })} />
                    Appliquer à toute l'équipe de la boutique
                  </label>
                )}
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-lg py-2 text-sm font-bold">Annuler</button>
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-bold">{isEditing ? 'Enregistrer' : 'Créer'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
