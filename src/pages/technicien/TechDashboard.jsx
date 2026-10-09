import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { apiClient } from '../../apiClient';
import { getSocket } from '../../socketClient';
import { useAuth } from '../../context/AuthContext';
import { FiTool, FiCheck, FiAlertCircle, FiAlertTriangle, FiFilter, FiX, FiClock, FiMessageSquare, FiFileText, FiKey, FiArrowLeft, FiStar } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import MessageThread from '../../components/MessageThread';
import { playNotificationSound } from '../../utils/notificationSound';
import { useOnlineStatus } from '../../context/PresenceContext';
import Avatar from '../../components/Avatar';
import { formatLastSeen } from '../../utils/lastSeen';
import { fireMessageToast } from '../../utils/messageToast';
import { deleteEventsByReparation } from '../../utils/calendarEvents';
import { fetchOverdueRepairs, formatDueDate } from '../../utils/overdueRepairs';
import OverdueRepairsWidget from '../../components/OverdueRepairsWidget';

function overdueLabel(daysLate) {
  return daysLate > 0 ? `En retard de ${daysLate} jour${daysLate > 1 ? 's' : ''}` : 'À rendre aujourd’hui';
}

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
  const { onlineIds } = useOnlineStatus();
  const [reparations, setReparations] = useState([]);
  const [statuts, setStatuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState('ALL');

  // --- RÉPARATIONS EN RETARD (mêmes règles que le manager, voir utils/overdueRepairs.js) ---
  const [overdueRepairs, setOverdueRepairs] = useState([]);
  const [isOverdueOpen, setIsOverdueOpen] = useState(false);
  const overdueToastShownRef = useRef(false);
  const overdueById = new Map(overdueRepairs.map((item) => [item.rep.id_reparation, item]));

  useEffect(() => {
    let cancelled = false;
    fetchOverdueRepairs(reparations).then((items) => { if (!cancelled) setOverdueRepairs(items); });
    return () => { cancelled = true; };
  }, [reparations]);

  // Rappel à la connexion (une seule fois), sans écraser la fenêtre de changement de mot de passe.
  useEffect(() => {
    if (overdueToastShownRef.current || overdueRepairs.length === 0) return;
    overdueToastShownRef.current = true;
    if (Swal.isVisible()) return;
    const late = overdueRepairs.filter((item) => item.daysLate > 0).length;
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 8000, timerProgressBar: true });
    Toast.fire({
      icon: 'warning',
      title: late > 0 ? `Vous avez ${late} réparation${late > 1 ? 's' : ''} en retard` : 'Réparations à rendre aujourd’hui',
      text: 'Cliquez pour voir le détail.',
      didOpen: (toast) => {
        toast.style.cursor = 'pointer';
        toast.addEventListener('click', () => { Swal.close(); setIsOverdueOpen(true); });
      }
    });
  }, [overdueRepairs]);

  // --- ÉTATS MODALE DOSSIER ---
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [history, setHistory] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [newStatusId, setNewStatusId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // --- ÉTATS MESSAGERIE ---
  const [contacts, setContacts] = useState([]);
  const [unreadByContact, setUnreadByContact] = useState({});
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [activeContact, setActiveContact] = useState(null);
  const activeContactIdRef = useRef(null);
  const contactsRef = useRef([]);

  useEffect(() => {
    activeContactIdRef.current = activeContact?.id_employe ?? null;
  }, [activeContact]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    if (user) {
      fetchData();

      // Vérification première connexion / mot de passe provisoire
      if (user.user_metadata?.must_change_password) {
        promptPasswordChange(true);
      }
    }
  }, [user]);

  // Abonnement Socket.IO aux nouvelles assignations : attend le profil employé, se refait
  // si l'utilisateur change et se désabonne au démontage.
  useEffect(() => {
    if (!userData?.id_employe) return;
    return setupRealtimeSubscription();
  }, [userData?.id_employe]);

  useEffect(() => {
    if (userData?.id_boutique) fetchContacts();
  }, [userData]);

  useEffect(() => {
    if (userData?.id_employe) {
      fetchUnreadByContact();
      return setupMessagesRealtimeSubscription();
    }
  }, [userData]);

  // --- MESSAGERIE : manager + collègues techniciens de la boutique ---
  const fetchContacts = async () => {
    const { data } = await supabase
      .from('employes')
      .select('id_employe, prenom, nom, role, avatar_url, last_seen')
      .eq('id_boutique', userData.id_boutique)
      .in('role', ['Responsable', 'Technicien'])
      .neq('id_employe', userData.id_employe);
    setContacts(data || []);
  };

  const fetchUnreadByContact = async () => {
    const { data } = await supabase
      .from('messages')
      .select('id_expediteur')
      .eq('id_destinataire', userData.id_employe)
      .eq('lu', false);

    const counts = {};
    (data || []).forEach(m => { counts[m.id_expediteur] = (counts[m.id_expediteur] || 0) + 1; });
    setUnreadByContact(counts);
  };

  const setupMessagesRealtimeSubscription = () => {
    const channel = supabase
      .channel('tech-messages-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `id_destinataire=eq.${userData.id_employe}` },
        (payload) => {
          playNotificationSound();
          if (payload.new.id_expediteur === activeContactIdRef.current) return;

          setUnreadByContact((prev) => ({ ...prev, [payload.new.id_expediteur]: (prev[payload.new.id_expediteur] || 0) + 1 }));

          const sender = contactsRef.current.find(c => c.id_employe === payload.new.id_expediteur);
          fireMessageToast(sender, payload.new.contenu, () => {
            if (sender) openContactThread(sender);
            setIsMessagesOpen(true);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const openMessages = () => {
    setIsMessagesOpen(true);
    setActiveContact(null);
  };

  const openContactThread = (contact) => {
    setActiveContact(contact);
    setUnreadByContact((prev) => ({ ...prev, [contact.id_employe]: 0 }));
  };

  const totalUnread = Object.values(unreadByContact).reduce((sum, n) => sum + n, 0);

  // --- MODALE CHANGEMENT DE MOT DE PASSE (FORCÉ OU VOLONTAIRE) ---
  const promptPasswordChange = async (isFirstLogin = false) => {
    const { value: newPassword } = await Swal.fire({
      title: isFirstLogin ? 'Première connexion 🔐' : 'Modifier mon mot de passe',
      text: isFirstLogin
        ? 'Pour sécuriser votre compte, veuillez définir votre mot de passe personnel.'
        : 'Saisissez votre nouveau mot de passe (6 caractères minimum).',
      icon: isFirstLogin ? 'warning' : 'info',
      allowOutsideClick: !isFirstLogin,
      allowEscapeKey: !isFirstLogin,
      showCancelButton: !isFirstLogin,
      cancelButtonText: 'Annuler',
      confirmButtonText: 'Enregistrer',
      confirmButtonColor: '#2563eb',
      html: `
        <input id="swal-new-pwd" type="password" class="swal2-input" placeholder="Nouveau mot de passe">
        <input id="swal-confirm-pwd" type="password" class="swal2-input" placeholder="Confirmer le mot de passe">
      `,
      focusConfirm: false,
      preConfirm: () => {
        const pwd = document.getElementById('swal-new-pwd').value;
        const confirm = document.getElementById('swal-confirm-pwd').value;

        if (!pwd || pwd.length < 6) {
          Swal.showValidationMessage('Le mot de passe doit comporter au moins 6 caractères');
          return false;
        }
        if (pwd !== confirm) {
          Swal.showValidationMessage('Les mots de passe ne correspondent pas');
          return false;
        }
        return pwd;
      }
    });

    if (newPassword) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
          data: { must_change_password: false }
        });

        if (error) throw error;

        Swal.fire({
          icon: 'success',
          title: 'Mot de passe enregistré !',
          text: 'Votre mot de passe a bien été mis à jour.',
          timer: 2500,
          showConfirmButton: false
        });
      } catch (err) {
        Swal.fire('Erreur', err.message, 'error');
      }
    }
  };

  // --- LOGIQUE REALTIME NOTIFICATIONS ---
  // Remplace tech-tasks-channel (Supabase Realtime) : même notification "nouvelle
  // tâche assignée", émise par le backend NestJS (ReparationsGateway) via Socket.IO.
  const setupRealtimeSubscription = () => {
    if (!userData?.id_employe) return;

    const socket = getSocket();
    if (!socket) return;

    const handleRepairAssigned = (repair) => {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 5000,
        timerProgressBar: true
      });

      Toast.fire({
        icon: 'info',
        title: 'Nouvelle tâche assignée ! 🛠️',
        text: `Ticket #${repair.numero_suivi} ajouté à votre atelier.`
      });

      fetchData();
    };

    socket.on('repair:assigned', handleRepairAssigned);

    return () => {
      socket.off('repair:assigned', handleRepairAssigned);
    };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!userData) return;

      // statuts reste sur Supabase pour l'instant (table hors périmètre du backend) ;
      // reparations est servi par le backend NestJS (module Réparations), qui filtre
      // déjà sur le technicien connecté via le JWT.
      const { data: statutsData } = await supabase
        .from('statuts')
        .select('*')
        .order('id_statut', { ascending: true });
      setStatuts(statutsData || []);

      const { data: repData } = await apiClient.get('/reparations');
      setReparations(repData || []);
    } catch (error) {
      console.error('Erreur:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (idReparation) => {
    const { data } = await apiClient.get(`/reparations/${idReparation}/history`);
    setHistory(data || []);
  };

  const openModal = (rep) => {
    setSelectedRepair(rep);
    setNewStatusId(rep.id_statut_actuel);
    setNewComment('');
    fetchHistory(rep.id_reparation);
  };

  const handleUpdateStatusAndComment = async (e) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      // Le backend NestJS met déjà à jour le commentaire de la ligne historique_statuts
      // créée par le trigger Postgres — plus besoin de le faire ici.
      await apiClient.patch(`/reparations/${selectedRepair.id_reparation}/status`, {
        idStatut: parseInt(newStatusId),
        commentaire: newComment.trim() || undefined
      });

      if ([6, 8].includes(parseInt(newStatusId))) {
        await deleteEventsByReparation(selectedRepair.id_reparation);
      }

      await fetchData();
      await fetchHistory(selectedRepair.id_reparation);

      setSelectedRepair({ ...selectedRepair, id_statut_actuel: parseInt(newStatusId) });
      setNewComment('');
    } catch (error) {
      Swal.fire('Erreur', error.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Les réparations en retard passent en tête (les plus en retard d'abord), l'ordre reste inchangé sinon.
  const urgencyRank = (rep) => overdueById.get(rep.id_reparation)?.daysLate ?? -1;
  const filteredReparations = reparations
    .filter((rep) => {
      if (filterStatut === 'ALL') return true;
      return rep.id_statut_actuel === parseInt(filterStatut);
    })
    .sort((a, b) => urgencyRank(b) - urgencyRank(a));

  if (loading) return <div className="p-10 text-center text-slate-500">Chargement de l'atelier...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* --- EN-TÊTE --- */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <FiTool className="text-blue-600" /> Bonjour, {userData?.prenom} !
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Vous avez {reparations.length} tâches assignées au total.
            {userData?.boutiques?.ville && <span className="text-slate-400"> · Atelier de {userData.boutiques.ville}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Bouton messagerie (manager + collègues) */}
          {contacts.length > 0 && (
            <button
              onClick={openMessages}
              className="relative flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-sm font-semibold transition border border-slate-200 dark:border-slate-600"
            >
              <FiMessageSquare className="text-blue-600" /> Messages
              {totalUnread > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{totalUnread}</span>
              )}
            </button>
          )}

          {/* Bouton pour changer de mot de passe à tout moment */}
          <button
            onClick={() => promptPasswordChange(false)}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-sm font-semibold transition border border-slate-200 dark:border-slate-600"
          >
            <FiKey className="text-blue-600" /> Mot de passe
          </button>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 flex-grow md:flex-grow-0">
            <FiFilter className="text-slate-400 ml-1" />
            <select
              className="bg-transparent border-none text-slate-700 dark:text-slate-200 font-semibold focus:ring-0 outline-none cursor-pointer text-sm"
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
            >
              <option value="ALL">Toutes les réparations</option>
              {statuts.map((s) => (
                <option key={s.id_statut} value={s.id_statut}>{s.libelle}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* --- GRILLE DES CARTES --- */}
      {reparations.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-12 text-center text-slate-500 dark:text-slate-400">
          <FiCheck className="mx-auto text-4xl text-emerald-400 mb-3" />
          <p className="text-lg font-medium">Aucune réparation assignée pour le moment.</p>
        </div>
      ) : filteredReparations.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-10 text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 rounded-2xl">
          Aucune réparation ne correspond à ce filtre.
        </motion.div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredReparations.map((rep) => {
              const overdue = overdueById.get(rep.id_reparation);
              return (
              <motion.div
                key={rep.id_reparation}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 hover:shadow-md flex flex-col ${
                  !overdue
                    ? 'border border-slate-200 dark:border-slate-700'
                    : overdue.daysLate > 0
                      ? 'border-2 border-red-400 dark:border-red-700'
                      : 'border-2 border-amber-400 dark:border-amber-700'
                }`}
              >
                {overdue && (
                  <div className={`-mt-2 mb-4 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold ${
                    overdue.daysLate > 0 ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>
                    <FiAlertTriangle className="shrink-0" />
                    {overdueLabel(overdue.daysLate)} · échéance le {formatDueDate(overdue.due)}
                  </div>
                )}
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold tracking-wider font-mono">
                    #{rep.numero_suivi}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeColor(rep.id_statut_actuel)}`}>
                    {rep.statuts?.libelle || 'Inconnu'}
                  </span>
                </div>

                <div className="mb-4 flex-grow">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {rep.appareils?.marque} {rep.appareils?.modele}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-start gap-2">
                    <FiAlertCircle className="text-red-400 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">Panne : {rep.description_panne}</span>
                  </p>
                </div>

                <div className="mt-auto pt-4 relative z-10 border-t border-slate-100 dark:border-slate-700">
                  <button
                    onClick={() => openModal(rep)}
                    className="w-full flex justify-center items-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2.5 rounded-lg transition border border-slate-200 dark:border-slate-600"
                  >
                    <FiFileText /> Ouvrir le dossier
                  </button>
                </div>
              </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* --- MODALE INTERVENTION --- */}
      <AnimatePresence>
        {selectedRepair && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRepair(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-slate-800 dark:bg-slate-950 p-6 text-white flex justify-between items-center shrink-0">
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

              <div className="flex flex-col md:flex-row flex-grow overflow-hidden bg-slate-50 dark:bg-slate-900">
                {/* Colonne Gauche : Formulaire */}
                <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  {overdueById.get(selectedRepair.id_reparation) && (() => {
                    const overdue = overdueById.get(selectedRepair.id_reparation);
                    return (
                      <div role="alert" className={`mb-6 flex items-start gap-2 rounded-xl border p-4 text-sm font-semibold ${
                        overdue.daysLate > 0
                          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300'
                          : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        <FiAlertTriangle className="mt-0.5 shrink-0" />
                        <span>{overdueLabel(overdue.daysLate)} — échéance le {formatDueDate(overdue.due)}. À traiter en priorité.</span>
                      </div>
                    );
                  })()}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Description de la panne</h3>
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-xl border border-red-100 dark:border-red-800 font-medium text-sm">
                      {selectedRepair.description_panne}
                    </div>
                  </div>

                  <div className="mb-8">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Informations Client</h3>
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-base">{selectedRepair.appareils.clients.prenom} {selectedRepair.appareils.clients.nom}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">{selectedRepair.appareils.clients.telephone}</p>
                    </div>
                  </div>

                  <form onSubmit={handleUpdateStatusAndComment} className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-800">
                    <h3 className="text-blue-800 dark:text-blue-300 font-bold mb-4 flex items-center gap-2">
                      <FiTool /> Mettre à jour l'intervention
                    </h3>

                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nouveau Statut</label>
                    <select
                      className="w-full mb-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium text-sm"
                      value={newStatusId}
                      onChange={(e) => setNewStatusId(e.target.value)}
                    >
                      {statuts.map((s) => (
                        <option key={s.id_statut} value={s.id_statut}>{s.libelle}</option>
                      ))}
                    </select>

                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Commentaire (Visible par le client)</label>
                    <textarea
                      placeholder="Ex : Écran commandé, réception prévue mardi..."
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 dark:text-slate-100 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[80px] text-sm resize-none mb-4"
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

                {/* Colonne Droite : Historique */}
                <div className="w-full md:w-1/2 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <FiClock /> Historique d'intervention
                  </h3>

                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 dark:before:via-slate-700 before:to-transparent">
                    {history.map((hist) => (
                      <div key={hist.id_historique} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-slate-800 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          <FiCheck className="text-lg" />
                        </div>

                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusBadgeColor(hist.id_statut)}`}>
                              {hist.statuts?.libelle}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              {new Date(hist.date_changement).toLocaleDateString('fr-FR')} à {new Date(hist.date_changement).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {hist.commentaire && (
                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-700 flex items-start gap-2">
                              <FiMessageSquare className="text-slate-400 mt-0.5 shrink-0" />
                              <span className="italic">« {hist.commentaire} »</span>
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

      {/* --- ALERTE FLOTTANTE : MES RÉPARATIONS EN RETARD --- */}
      <OverdueRepairsWidget
        items={overdueRepairs}
        showTechnicien={false}
        open={isOverdueOpen}
        onOpenChange={setIsOverdueOpen}
        onAction={({ rep }) => { setIsOverdueOpen(false); openModal(rep); }}
        actionLabel="Ouvrir"
        actionIcon={FiFileText}
        canAct={() => true}
      />

      {/* --- MODALE MESSAGERIE --- */}
      <AnimatePresence>
        {isMessagesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMessagesOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="bg-slate-800 dark:bg-slate-950 p-6 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  {activeContact && (
                    <button onClick={() => setActiveContact(null)} className="text-slate-300 hover:text-white transition">
                      <FiArrowLeft className="text-xl" />
                    </button>
                  )}
                  {activeContact && (
                    <Avatar
                      url={activeContact.avatar_url}
                      name={`${activeContact.prenom} ${activeContact.nom}`}
                      size={40}
                      online={onlineIds.has(activeContact.id_employe)}
                    />
                  )}
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      {!activeContact && <FiMessageSquare />} {activeContact ? `${activeContact.prenom} ${activeContact.nom}` : 'Messages'}
                    </h2>
                    {activeContact && (
                      <p className={`text-sm mt-1 ${onlineIds.has(activeContact.id_employe) ? 'text-emerald-400 font-semibold' : 'text-slate-300'}`}>
                        {onlineIds.has(activeContact.id_employe) ? 'En ligne' : formatLastSeen(activeContact.last_seen)}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setIsMessagesOpen(false)} className="text-slate-400 hover:text-white bg-slate-700/50 p-2 rounded-full transition">
                  <FiX className="text-xl" />
                </button>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-900">
                {activeContact ? (
                  <MessageThread
                    currentUserId={userData.id_employe}
                    otherUserId={activeContact.id_employe}
                    otherUserName={`${activeContact.prenom} ${activeContact.nom}`}
                    otherUserAvatar={activeContact.avatar_url}
                  />
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {contacts.map((contact) => (
                      <button
                        key={contact.id_employe}
                        onClick={() => openContactThread(contact)}
                        className="w-full flex items-center justify-between text-left bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 rounded-xl p-3 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            url={contact.avatar_url}
                            name={`${contact.prenom} ${contact.nom}`}
                            size={36}
                            online={onlineIds.has(contact.id_employe)}
                          />
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                              {contact.prenom} {contact.nom}
                              {contact.role === 'Responsable' && <FiStar className="text-amber-500 fill-amber-500" size={13} />}
                            </p>
                            <p className={`text-xs ${onlineIds.has(contact.id_employe) ? 'text-emerald-500 font-semibold' : 'text-slate-400'}`}>
                              {onlineIds.has(contact.id_employe) ? 'En ligne' : formatLastSeen(contact.last_seen)}
                            </p>
                          </div>
                        </div>
                        {unreadByContact[contact.id_employe] > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{unreadByContact[contact.id_employe]}</span>
                        )}
                      </button>
                    ))}
                    {contacts.length === 0 && (
                      <p className="text-center text-sm text-slate-400 italic py-6">Aucun contact disponible.</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}