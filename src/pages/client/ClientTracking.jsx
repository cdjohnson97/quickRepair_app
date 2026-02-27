import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { FiSearch, FiSmartphone, FiCheckCircle, FiClock, FiAlertCircle, FiMessageSquare, FiLoader } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

// Palette de couleurs pour les statuts
const getStatusBadgeColor = (idStatut) => {
  switch (idStatut) {
    case 1: return 'bg-slate-100 text-slate-700'; 
    case 2: return 'bg-purple-100 text-purple-700'; 
    case 3: return 'bg-yellow-100 text-yellow-800'; 
    case 4: return 'bg-rose-100 text-rose-700'; 
    case 5: return 'bg-blue-100 text-blue-700'; 
    case 6: return 'bg-emerald-100 text-emerald-700'; 
    case 7: return 'bg-teal-100 text-teal-700'; 
    case 8: return 'bg-gray-200 text-gray-800'; 
    case 9: return 'bg-red-100 text-red-800'; 
    default: return 'bg-slate-100 text-slate-700';
  }
};

export default function ClientTracking() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [repairData, setRepairData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!trackingNumber.trim()) return;

    setLoading(true);
    setError('');
    setRepairData(null);
    setHistory([]);

    try {
      // ASTUCE : On ajoute un délai de 1.5s pour laisser l'animation jouer (Effet pro garanti)
      await new Promise(resolve => setTimeout(resolve, 1500));

      const { data: repData, error: repError } = await supabase
        .from('reparations')
        .select(`
          id_reparation, numero_suivi, date_prise_en_charge, id_statut_actuel,
          statuts ( libelle ),
          appareils ( marque, modele )
        `)
        .ilike('numero_suivi', trackingNumber.trim())
        .single();

      if (repError || !repData) throw new Error("Aucun appareil trouvé avec ce numéro de suivi.");

      setRepairData(repData);

      const { data: histData } = await supabase
        .from('historique_statuts')
        .select('*, statuts(libelle)')
        .eq('id_reparation', repData.id_reparation)
        .order('date_changement', { ascending: false });

      setHistory(histData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-76px)] bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans overflow-hidden">
      
      <div className="max-w-xl w-full text-center mb-10 animate-fade-in relative z-10">
        <h1 className="text-4xl font-extrabold text-slate-800 mb-4 tracking-tight">Suivez votre réparation</h1>
        <p className="text-slate-500 mb-8 text-lg">Entrez le numéro de suivi présent sur votre ticket de dépôt.</p>
        
        <form onSubmit={handleSearch} className="relative flex items-center shadow-lg rounded-2xl overflow-hidden bg-white border border-slate-200 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
          <div className="pl-6 text-slate-400"><FiSearch className="text-xl" /></div>
          <input
            type="text"
            placeholder="Ex: QR-45892"
            className="w-full py-4 pl-4 pr-32 text-lg text-slate-800 placeholder-slate-300 outline-none font-medium uppercase"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
          />
          <button type="submit" disabled={loading || !trackingNumber} className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 rounded-xl font-bold transition shadow-sm flex items-center gap-2">
            {loading ? <><FiLoader className="animate-spin" /> Scan...</> : 'Suivre'}
          </button>
        </form>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center justify-center gap-2 font-medium shadow-sm">
            <FiAlertCircle className="text-xl" /> {error}
          </motion.div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* L'ANIMATION DE CHARGEMENT */}
        {loading && (
          <motion.div 
            key="loader"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              <FiSmartphone className="text-3xl text-blue-600 animate-pulse" />
            </div>
            <p className="mt-6 text-slate-500 font-bold tracking-widest uppercase animate-pulse">Recherche sécurisée...</p>
          </motion.div>
        )}

        {/* LES RÉSULTATS */}
        {repairData && !loading && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-full max-w-3xl relative z-10"
          >
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 md:p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
              {/* Décoration d'arrière-plan */}
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
              
              <div className="flex items-center gap-5 relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 border border-blue-200 shadow-sm">
                  <FiSmartphone className="text-3xl" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Votre appareil</p>
                  <h2 className="text-2xl font-extrabold text-slate-800">{repairData.appareils?.marque} {repairData.appareils?.modele}</h2>
                  <p className="text-slate-500 font-mono text-sm mt-1">Ticket N° {repairData.numero_suivi}</p>
                </div>
              </div>
              <div className="text-center md:text-right flex flex-col items-center md:items-end relative z-10">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Statut Actuel</p>
                <span className={`px-4 py-2 rounded-full text-sm font-black uppercase tracking-wide border shadow-sm ${getStatusBadgeColor(repairData.id_statut_actuel).replace('bg-', 'bg-').replace('text-', 'text- border-')}`}>
                  {repairData.statuts?.libelle}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 md:p-8">
              <h3 className="text-lg font-bold text-slate-800 mb-8 flex items-center gap-2"><FiClock className="text-blue-500" /> Historique des interventions</h3>
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-blue-200 before:to-slate-100">
                {history.map((hist, index) => (
                  <motion.div initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} key={hist.id_historique} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shadow-md shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${index === 0 ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <FiCheckCircle className="text-lg" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition duration-300">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-1">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border shadow-sm ${getStatusBadgeColor(hist.id_statut).replace('bg-', 'bg-').replace('text-', 'text- border-')}`}>
                          {hist.statuts?.libelle}
                        </span>
                        <span className="text-xs font-bold text-slate-400">{new Date(hist.date_changement).toLocaleDateString('fr-FR')} - {new Date(hist.date_changement).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      {hist.commentaire && (
                        <p className="text-sm text-slate-600 mt-3 bg-white p-3 rounded-xl border border-slate-200 flex items-start gap-2 shadow-sm">
                          <FiMessageSquare className="text-blue-400 mt-0.5 shrink-0" />
                          <span className="font-medium">"{hist.commentaire}"</span>
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}