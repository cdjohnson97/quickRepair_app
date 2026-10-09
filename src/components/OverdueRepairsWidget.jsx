// eslint-disable-next-line no-unused-vars -- `motion` est utilisé en JSX (<motion.div>), que la config ESLint ne détecte pas.
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertTriangle, FiCheckCircle, FiSend, FiX } from 'react-icons/fi';
import Avatar from './Avatar';

function formatDueDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

// Alerte flottante (coin inférieur gauche) des réparations en retard ou à rendre aujourd'hui.
// Toujours visible : un clic rouvre la liste, et « Prévenir » ouvre la conversation avec le
// technicien en charge, message d'urgence prérempli.
// `items` : [{ rep, due: 'AAAA-MM-JJ', daysLate }] (daysLate = 0 → échéance aujourd'hui).
export default function OverdueRepairsWidget({ items, techniciens, open, onOpenChange, onWarn }) {
  const lateCount = items.filter((item) => item.daysLate > 0).length;
  const todayCount = items.length - lateCount;
  const hasLate = lateCount > 0;

  const buttonTone = items.length === 0
    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-slate-200 dark:border-slate-700'
    : hasLate
      ? 'bg-red-600 text-white border-red-700'
      : 'bg-amber-500 text-white border-amber-600';

  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Réparations en retard"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="w-[min(24rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
          >
            <div className={`flex items-center justify-between px-4 py-3 text-white ${hasLate ? 'bg-red-600' : items.length ? 'bg-amber-500' : 'bg-emerald-600'}`}>
              <div className="flex items-center gap-2 font-bold">
                <FiAlertTriangle />
                Réparations à surveiller
              </div>
              <button onClick={() => onOpenChange(false)} aria-label="Fermer" className="rounded-full p-1 transition hover:bg-white/20">
                <FiX />
              </button>
            </div>

            <div className="max-h-[55vh] space-y-2 overflow-y-auto bg-slate-50 p-3 dark:bg-slate-900">
              {items.length === 0 && (
                <p className="flex items-center gap-2 p-3 text-sm text-slate-500 dark:text-slate-400">
                  <FiCheckCircle className="text-emerald-500" /> Aucune réparation en retard.
                </p>
              )}

              {items.map((item) => {
                const { rep, due, daysLate } = item;
                const tech = techniciens.find((t) => t.id_employe === rep.id_technicien);
                const techName = tech ? `${tech.prenom} ${tech.nom}` : `${rep.employes?.prenom || ''} ${rep.employes?.nom || ''}`.trim();
                return (
                  <div
                    key={rep.id_reparation}
                    className={`rounded-xl border bg-white p-3 dark:bg-slate-800 ${daysLate > 0 ? 'border-red-200 dark:border-red-900' : 'border-amber-200 dark:border-amber-900'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{rep.numero_suivi}</p>
                        <p className="truncate text-sm text-slate-800 dark:text-slate-100">{rep.appareils?.marque} {rep.appareils?.modele}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${daysLate > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                        {daysLate > 0 ? `Retard ${daysLate} j` : 'Aujourd’hui'}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar url={tech?.avatar_url} name={techName || '?'} size={24} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{techName || 'Non assigné'}</p>
                          <p className="text-[11px] text-slate-400">Échéance : {formatDueDate(due)}</p>
                        </div>
                      </div>
                      {rep.id_technicien && (
                        <button
                          onClick={() => onWarn(item)}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-red-700"
                        >
                          <FiSend size={12} /> Prévenir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        title="Réparations en retard"
        className={`relative flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold shadow-lg transition hover:scale-105 ${buttonTone}`}
      >
        {hasLate && !open && <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-red-500/40" />}
        {items.length === 0 ? <FiCheckCircle /> : <FiAlertTriangle />}
        {items.length === 0
          ? 'Aucun retard'
          : [lateCount > 0 && `${lateCount} en retard`, todayCount > 0 && `${todayCount} aujourd’hui`].filter(Boolean).join(' · ')}
      </button>
    </div>
  );
}
