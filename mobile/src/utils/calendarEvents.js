import { supabase } from '../supabaseClient';

// Port de src/utils/calendarEvents.js (web) : même table `calendrier_evenements`,
// donc un événement créé sur mobile apparaît immédiatement côté web et vice-versa.
export const EVENT_TYPES = {
  reparation: { label: 'Réparation', badge: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', hex: '#3b82f6' },
  conge: { label: 'Congé', badge: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', hex: '#f59e0b' },
  formation: { label: 'Formation', badge: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', hex: '#a855f7' },
  reunion: { label: 'Réunion', badge: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-500', hex: '#14b8a6' },
  autre: { label: 'Autre', badge: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', hex: '#94a3b8' }
};

export const MAX_RECURRING_OCCURRENCES = 26; // ~6 mois hebdomadaires

export function toISODate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function formatDateRangeFr(start, end) {
  const opts = { day: 'numeric', month: 'long' };
  const s = new Date(start).toLocaleDateString('fr-FR', opts);
  const e = new Date(end).toLocaleDateString('fr-FR', opts);
  return toISODate(start) === toISODate(end) ? s : `${s} au ${e}`;
}

export async function fetchEventsForEmployees(idEmployeArray, rangeStart, rangeEnd) {
  if (!idEmployeArray || idEmployeArray.length === 0) return [];
  const { data, error } = await supabase
    .from('calendrier_evenements')
    .select('*')
    .in('id_employe', idEmployeArray)
    .lte('date_debut', toISODate(rangeEnd))
    .gte('date_fin', toISODate(rangeStart))
    .order('date_debut', { ascending: true });

  if (error) {
    console.error('Erreur lors du chargement du calendrier :', error.message);
    return [];
  }
  return data || [];
}

export async function createEvent({ id_employe, titre, type, date_debut, date_fin, id_reparation = null }) {
  const { data, error } = await supabase
    .from('calendrier_evenements')
    .insert([{ id_employe, titre, type, date_debut: toISODate(date_debut), date_fin: toISODate(date_fin), id_reparation }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// "Appliquer à toute l'équipe" : une ligne par employé, et pour chaque occurrence si récurrent.
export async function createEventsForTeam(idEmployeArray, { titre, type, date_debut, date_fin }) {
  const rows = idEmployeArray.map((id_employe) => ({
    id_employe,
    titre,
    type,
    date_debut: toISODate(date_debut),
    date_fin: toISODate(date_fin)
  }));
  const { error } = await supabase.from('calendrier_evenements').insert(rows);
  if (error) throw error;
}

export async function updateEvent(idEvenement, { titre, type, date_debut, date_fin }) {
  const { data, error } = await supabase
    .from('calendrier_evenements')
    .update({ titre, type, date_debut: toISODate(date_debut), date_fin: toISODate(date_fin) })
    .eq('id_evenement', idEvenement)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEvent(idEvenement) {
  const { error } = await supabase.from('calendrier_evenements').delete().eq('id_evenement', idEvenement);
  if (error) throw error;
}

export async function deleteEventsByReparation(idReparation) {
  await supabase.from('calendrier_evenements').delete().eq('id_reparation', idReparation);
}

// Disponibilité d'un employé à une date donnée (par défaut aujourd'hui) :
// { busy, type, until } — `until` est la fin du blocage en cours, pour l'affichage "Occupé jusqu'au...".
export function getAvailability(events, idEmploye, onDate = new Date()) {
  const iso = toISODate(onDate);
  const current = events.find((e) => e.id_employe === idEmploye && e.date_debut <= iso && e.date_fin >= iso);
  if (!current) return { busy: false, type: null, until: null };
  return { busy: true, type: current.type, until: current.date_fin };
}
