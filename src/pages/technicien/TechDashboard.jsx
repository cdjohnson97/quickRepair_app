import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { FiTool, FiCheck, FiAlertCircle, FiFilter, FiX, FiClock, FiMessageSquare, FiFileText } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function TechDashboard() {
  const { user, userData } = useAuth();
  const [reparations, setReparations] = useState([]);
  const [statuts, setStatuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState('ALL');

  // --- NOUVEAUX ÉTATS POUR LA MODALE (Dossier Complet) ---
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [history, setHistory] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [newStatusId, setNewStatusId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!userData) return;

      const { data: statutsData } = await supabase.from('statuts').select('*').order('id_statut', { ascending: true });
      setStatuts(statutsData || []);

      const { data: repData, error } = await supabase
        .from('reparations')
        .select(`
          id_reparation, numero_suivi, description_panne, date_prise_en_charge, id_statut_actuel,
          statuts ( libelle ),
          appareils ( marque, modele, clients ( nom, prenom, telephone ) )
        `)
        .eq('id_technicien', userData.id_employe)
        .order('date_prise_en_charge', { ascending: false });

      if (error) throw error;
      setReparations(repData || []);
    } catch (error) {
      console.error("Erreur:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- NOUVELLE FONCTION : Charger l'historique ---
  const fetchHistory = async (idReparation) => {
    const { data } = await supabase
      .from('historique_statuts')
      .select('*, statuts(libelle), employes(prenom, nom)')
      .eq('id_reparation', idReparation)
      .order('date_changement', { ascending: false });
    setHistory(data || []);
  };

  // --- NOUVELLE FONCTION : Ouvrir le dossier ---
  const openModal = (rep) => {
    setSelectedRepair(rep);
    setNewStatusId(rep.id_statut_actuel);
    setNewComment('');
    fetchHistory(rep.id_reparation);
  };

  // --- FONCTION AMÉLIORÉE : Mise à jour + Commentaire ---
  const handleUpdateStatusAndComment = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    
    try {
      // 1. On met à jour le statut (Le Trigger SQL va créer une ligne d'historique automatique)
      const { error: updateError } = await supabase
        .from('reparations')
        .update({ id_statut_actuel: parseInt(newStatusId) })
        .eq('id_reparation', selectedRepair.id_reparation);
        
      if (updateError) throw updateError;

      // 2. Si le technicien a tapé un commentaire, on remplace le commentaire générique
      if (newComment.trim() !== '') {
        // On cherche la ligne d'historique que le Trigger vient tout juste de créer
        const { data: latestHistory } = await supabase
          .from('historique_statuts')
          .select('id_historique')
          .eq('id_reparation', selectedRepair.id_reparation)
          .order('date_changement', { ascending: false })
          .limit(1)
          .single();

        if (latestHistory) {
          await supabase
            .from('historique_statuts')
            .update({ commentaire: newComment })
            .eq('id_historique', latestHistory.id_historique);
        }
      }

      // 3. On rafraîchit tout
      await fetchData();
      await fetchHistory(selectedRepair.id_reparation);
      
      // On met à jour la sélection locale pour refléter le changement
      setSelectedRepair({ ...selectedRepair, id_statut_actuel: parseInt(newStatusId) });
      setNewComment('');
      
    } catch (error) {
      alert("Erreur lors de la mise à jour : " + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredReparations = reparations.filter(rep => {
    if (filterStatut === 'ALL') return true;
    return rep.id_statut_actuel === parseInt(filterStatut);
  });

  if (loading) return <div className="p-10 text-center text-slate-500">Chargement de l'atelier...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      
      {/* --- EN-TÊTE --- */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <FiTool className="text-blue-600" /> Bonjour, {userData?.prenom} !
          </h1>
          <p className="text-slate-500 mt-1">Vous avez {reparations.length} tâches assignées au total.</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full md:w-auto">
          <FiFilter className="text-slate-400 ml-2" />
          <select 
            className="bg-transparent border-none text-slate-700 font-semibold focus:ring-0 outline-none cursor-pointer w-full md:w-auto"
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
          >
            <option value="ALL">Toutes les réparations</option>
            {statuts.map(s => (
              <option key={s.id_statut} value={s.id_statut}>{s.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      {/* --- GRILLE DES CARTES --- */}
      {reparations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          <FiCheck className="mx-auto text-4xl text-emerald-400 mb-3" />
          <p className="text-lg font-medium">Aucune réparation assignée pour le moment.</p>
        </div>
      ) : filteredReparations.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-10 text-slate-500 font-medium bg-slate-100 rounded-2xl">
          Aucune réparation ne correspond à ce filtre.
        </motion.div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredReparations.map((rep) => (
              <motion.div 
                key={rep.id_reparation}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold tracking-wider font-mono">
                    #{rep.numero_suivi}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeColor(rep.id_statut_actuel)}`}>
                    {rep.statuts?.libelle || 'Inconnu'}
                  </span>
                </div>

                <div className="mb-4 flex-grow">
                  <h3 className="text-lg font-bold text-slate-800">
                    {rep.appareils?.marque} {rep.appareils?.modele}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 flex items-start gap-2">
                    <FiAlertCircle className="text-red-400 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">Panne : {rep.description_panne}</span>
                  </p>
                </div>

                {/* BOUTON OUVRIR LE DOSSIER */}
                <div className="mt-auto pt-4 relative z-10 border-t border-slate-100">
                  <button 
                    onClick={() => openModal(rep)}
                    className="w-full flex justify-center items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-2.5 rounded-lg transition border border-slate-200"
                  >
                    <FiFileText /> Ouvrir le dossier
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* --- FENÊTRE MODALE (DOSSIER COMPLET) --- */}
      <AnimatePresence>
        {selectedRepair && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Arrière-plan flou */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedRepair(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            {/* Contenu de la Modale */}
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* En-tête Modale */}
              <div className="bg-slate-800 p-6 text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    {selectedRepair.appareils.marque} {selectedRepair.appareils.modele}
                  </h2>
                  <p className="text-slate-300 font-mono text-sm mt-1">Ticket N° {selectedRepair.numero_suivi}</p>
                </div>
                <button onClick={() => setSelectedRepair(null)} className="text-slate-400 hover:text-white bg-slate-700/50 p-2 rounded-full transition">
                  <FiX className="text-xl" />
                </button>
              </div>

              {/* Corps Modale : Divisé en 2 colonnes */}
              <div className="flex flex-col md:flex-row flex-grow overflow-hidden bg-slate-50">
                
                {/* Colonne Gauche : Infos & Action */}
                <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-slate-200 bg-white">
                  
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Description de la panne</h3>
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 font-medium">
                      {selectedRepair.description_panne}
                    </div>
                  </div>

                  <div className="mb-8">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Informations Client</h3>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="font-bold text-slate-800 text-lg">{selectedRepair.appareils.clients.prenom} {selectedRepair.appareils.clients.nom}</p>
                      <p className="text-slate-500">{selectedRepair.appareils.clients.telephone}</p>
                    </div>
                  </div>

                  {/* Formulaire de mise à jour */}
                  <form onSubmit={handleUpdateStatusAndComment} className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                    <h3 className="text-blue-800 font-bold mb-4 flex items-center gap-2">
                      <FiTool /> Mettre à jour l'intervention
                    </h3>
                    
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nouveau Statut</label>
                    <select 
                      className="w-full mb-4 bg-white border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
                      value={newStatusId}
                      onChange={(e) => setNewStatusId(e.target.value)}
                    >
                      {statuts.map(s => (
                        <option key={s.id_statut} value={s.id_statut}>{s.libelle}</option>
                      ))}
                    </select>

                    <label className="block text-sm font-semibold text-slate-700 mb-1">Commentaire (Visible par le client)</label>
                    <textarea
                      placeholder="Ex: Écran commandé, réception prévue mardi..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[80px] text-sm resize-none mb-4"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />

                    <button 
                      type="submit" 
                      disabled={actionLoading || (selectedRepair.id_statut_actuel === parseInt(newStatusId) && newComment.trim() === '')}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-lg transition shadow-sm"
                    >
                      {actionLoading ? 'Enregistrement...' : 'Valider la mise à jour'}
                    </button>
                  </form>
                </div>

                {/* Colonne Droite : L'historique (Timeline) */}
                <div className="w-full md:w-1/2 p-6 overflow-y-auto bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <FiClock /> Historique d'intervention
                  </h3>
                  
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                    {history.map((hist, index) => (
                      <div key={hist.id_historique} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* L'icône centrale */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          <FiCheck className="text-lg" />
                        </div>
                        
                        {/* Le contenu */}
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusBadgeColor(hist.id_statut)}`}>
                              {hist.statuts?.libelle}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              {new Date(hist.date_changement).toLocaleDateString('fr-FR')} à {new Date(hist.date_changement).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          {hist.commentaire && (
                            <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2 rounded border border-slate-100 flex items-start gap-2">
                              <FiMessageSquare className="text-slate-400 mt-0.5 shrink-0" />
                              <span className="italic">"{hist.commentaire}"</span>
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-2 text-right">
                            Par {hist.employes?.prenom} {hist.employes?.nom}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}