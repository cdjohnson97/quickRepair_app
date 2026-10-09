import { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '../../supabaseClient';
import { apiClient } from '../../apiClient';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import {
  FiUsers,
  FiTool,
  FiTrendingUp,
  FiStar,
  FiUserMinus,
  FiPlus,
  FiX,
  FiMapPin,
  FiLock,
  FiLoader,
  FiMail,
  FiPhone,
  FiMessageSquare,
  FiList,
  FiSearch,
  FiChevronRight
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import 'leaflet/dist/leaflet.css';
import { getStatusBadgeColor } from '../../constants/statuts';
import { useAuth } from '../../context/AuthContext';
import { useOnlineStatus } from '../../context/PresenceContext';
import Avatar from '../../components/Avatar';
import MessageThread from '../../components/MessageThread';
import { fireMessageToast } from '../../utils/messageToast';
import { playNotificationSound } from '../../utils/notificationSound';
import { fetchEventsForEmployees } from '../../utils/calendarEvents';
import { getStatusLine } from '../../utils/statusLine';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// Fond de carte OpenStreetMap : gratuit et sans clé API (les tuiles CARTO en exigent une désormais).
// L'attribution est obligatoire selon la politique d'usage d'OpenStreetMap.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

// Clic sur la carte de la modale "Nouvelle boutique" : place directement le marqueur
// aux coordonnées cliquées, plus simple que de deviner latitude/longitude à la main.
function LocationPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

export default function AdminDashboard() {
  const { userData } = useAuth();
  const { onlineIds } = useOnlineStatus();
  const [boutiques, setBoutiques] = useState([]);
  const [selectedBoutique, setSelectedBoutique] = useState(null);
  const [equipe, setEquipe] = useState([]);
  const [equipeEvents, setEquipeEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [unreadByAdmin, setUnreadByAdmin] = useState({});
  const [isBoutiqueListOpen, setIsBoutiqueListOpen] = useState(false);
  const [boutiqueSearch, setBoutiqueSearch] = useState('');

  // Modales
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isAddBoutiqueModalOpen, setIsAddBoutiqueModalOpen] = useState(false);
  const [selectedEmploye, setSelectedEmploye] = useState(null);
  const [selectedEmployeStats, setSelectedEmployeStats] = useState(null);
  const [selectedEmployeRepairs, setSelectedEmployeRepairs] = useState([]);

  // Formulaires
  const [newUser, setNewUser] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    role: 'Technicien',
    password: ''
  });

  const [newBoutique, setNewBoutique] = useState({
    nom: '',
    ville: '',
    adresse: '',
    latitude: 48.8566,
    longitude: 2.3522
  });
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    fetchBoutiques();
  }, []);

  // --- MESSAGERIE : notifications globales des managers (l'admin n'est pas lié à une boutique) ---
  const fetchUnreadByAdmin = async () => {
    if (!userData?.id_employe) return;
    const { data } = await supabase
      .from('messages')
      .select('id_expediteur')
      .eq('id_destinataire', userData.id_employe)
      .eq('lu', false);

    const counts = {};
    (data || []).forEach(m => { counts[m.id_expediteur] = (counts[m.id_expediteur] || 0) + 1; });
    setUnreadByAdmin(counts);
  };

  useEffect(() => {
    if (!userData?.id_employe) return;
    fetchUnreadByAdmin();

    const channel = supabase
      .channel('admin-messages-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `id_destinataire=eq.${userData.id_employe}` },
        async (payload) => {
          fetchUnreadByAdmin();
          playNotificationSound();

          const { data: sender } = await supabase
            .from('employes')
            .select('*, boutiques (*)')
            .eq('id_employe', payload.new.id_expediteur)
            .maybeSingle();

          fireMessageToast(sender, payload.new.contenu, async () => {
            if (sender?.boutiques) await handleSelectBoutique(sender.boutiques);
            if (sender) openEmployeeDetail(sender);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userData?.id_employe]);

  const fetchBoutiques = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/boutiques');
      setBoutiques(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des boutiques :', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBoutique = async (boutique) => {
    setSelectedBoutique(boutique);
    const { data } = await supabase
      .from('employes')
      .select('*')
      .eq('id_boutique', boutique.id_boutique)
      .order('role', { ascending: true });
    const emp = data || [];
    setEquipe(emp);

    const today = new Date();
    const events = await fetchEventsForEmployees(emp.map(e => e.id_employe), today, today);
    setEquipeEvents(events);
  };

  // --- FICHE EMPLOYÉ (infos + charge de travail si technicien) ---
  const openEmployeeDetail = async (emp) => {
    setSelectedEmploye(emp);
    setSelectedEmployeStats(null);
    setSelectedEmployeRepairs([]);
    if (emp.role === 'Responsable') {
      setUnreadByAdmin((prev) => ({ ...prev, [emp.id_employe]: 0 }));
    }

    const { data } = await supabase
      .from('reparations')
      .select('id_reparation, numero_suivi, id_statut_actuel, statuts ( libelle ), appareils ( marque, modele )')
      .eq('id_technicien', emp.id_employe)
      .order('date_prise_en_charge', { ascending: false });

    const repairs = data || [];
    const terminees = repairs.filter(r => [6, 8].includes(r.id_statut_actuel)).length;
    setSelectedEmployeStats({ total: repairs.length, terminees, restantes: repairs.length - terminees });
    setSelectedEmployeRepairs(repairs.filter(r => !([6, 8].includes(r.id_statut_actuel))));
  };

  // --- CRÉATION DE L'EMPLOYÉ DANS AUTH + TABLE EMPLOYES ---
  // --- CRÉATION DE L'EMPLOYÉ DANS AUTH + TABLE EMPLOYES ---
  const handleAddUser = async (e) => {
    e.preventDefault();

    if (newUser.password.length < 6) {
      return Swal.fire('Attention', 'Le mot de passe doit comporter au moins 6 caractères.', 'warning');
    }

    setActionLoading(true);

    try {
      // 1. Création du compte dans Supabase Auth (client isolé pour ne pas remplacer la session admin)
      const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
        email: newUser.email.trim(),
        password: newUser.password,
        options: {
          data: {
            prenom: newUser.prenom.trim(),
            nom: newUser.nom.trim(),
            role: newUser.role,
            must_change_password: true
          }
        }
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("L'identifiant de connexion n'a pas pu être généré.");
      }

      // 2. Insertion dans la table employes
      const { error: dbError } = await supabase.from('employes').insert([
  {
    id_auth: authData.user.id, // Liaison avec Supabase Auth
    nom: newUser.nom.trim(),
    prenom: newUser.prenom.trim(),
    email: newUser.email.trim(),
    telephone: newUser.telephone.trim(),
    role: newUser.role,
    id_boutique: selectedBoutique.id_boutique
  }
]);

      if (dbError) throw dbError;

      // Fermeture immédiate de la modale et reset formulaire
      setIsAddUserModalOpen(false);
      setNewUser({
        nom: '',
        prenom: '',
        email: '',
        telephone: '',
        role: 'Technicien',
        password: ''
      });

      Swal.fire({
        icon: 'success',
        title: 'Employé créé !',
        html: `Le compte de <b>${newUser.prenom} ${newUser.nom}</b> est prêt.<br/><span style="font-size:0.85rem;color:#64748b;">Mot de passe temporaire : ${newUser.password}</span>`,
        confirmButtonColor: '#2563eb'
      });

      handleSelectBoutique(selectedBoutique);
    } catch (err) {
      // Si on se prend l'erreur 429 ou autre
      const isRateLimit = err.status === 429 || err.message?.toLowerCase().includes('rate limit');

      // On ferme quand même la modale pour ne pas bloquer l'écran
      setIsAddUserModalOpen(false);

      Swal.fire({
        icon: 'error',
        title: isRateLimit ? 'Trop de requêtes (429)' : 'Erreur de création',
        text: isRateLimit 
          ? "Supabase limite le nombre d'inscriptions par heure. Attends quelques minutes ou augmente le 'Signup Rate Limit' dans Authentication > Rate Limits sur ton projet Supabase."
          : err.message,
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // --- PROMOTION AU RÔLE DE RESPONSABLE ---
  const promouvoirManager = async (idEmploye) => {
    const result = await Swal.fire({
      title: 'Désigner comme Responsable ?',
      text: "L'actuel responsable passera au rôle de technicien.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#2563eb'
    });

    if (result.isConfirmed) {
      // Rétrograde l'ancien responsable de la boutique
      await supabase
        .from('employes')
        .update({ role: 'Technicien' })
        .eq('id_boutique', selectedBoutique.id_boutique)
        .eq('role', 'Responsable');

      // Promeut le nouveau
      await supabase
        .from('employes')
        .update({ role: 'Responsable' })
        .eq('id_employe', idEmploye);

      handleSelectBoutique(selectedBoutique);
      Swal.fire('Mis à jour', 'Le rôle a été modifié avec succès.', 'success');
    }
  };

  // --- SUPPRESSION D'UN EMPLOYÉ ---
  const supprimerEmploye = async (idEmploye, nom) => {
    const result = await Swal.fire({
      title: 'Supprimer cet employé ?',
      text: `Retirer ${nom} de l'effectif de la boutique ?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
      await supabase.from('employes').delete().eq('id_employe', idEmploye);
      handleSelectBoutique(selectedBoutique);
      Swal.fire('Supprimé', "L'employé a été retiré.", 'success');
    }
  };

  // --- LOCALISATION AUTOMATIQUE PAR ADRESSE (Nominatim/OpenStreetMap, gratuit, sans clé) ---
  const handleGeocodeAddress = async () => {
    const query = `${newBoutique.adresse}, ${newBoutique.ville}`.trim();
    if (!newBoutique.adresse && !newBoutique.ville) {
      Swal.fire('Adresse manquante', "Renseigne au moins la ville ou l'adresse avant de localiser.", 'warning');
      return;
    }
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
      const results = await res.json();
      if (results.length === 0) {
        Swal.fire('Introuvable', "Aucune correspondance pour cette adresse. Clique directement sur la carte.", 'warning');
        return;
      }
      setNewBoutique((prev) => ({ ...prev, latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) }));
    } catch (error) {
      Swal.fire('Erreur', "La recherche d'adresse a échoué. Clique directement sur la carte.", 'error');
    } finally {
      setGeocoding(false);
    }
  };

  // --- CRÉATION DE BOUTIQUE ---
  const handleAddBoutique = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/boutiques', newBoutique);
      setIsAddBoutiqueModalOpen(false);
      setNewBoutique({ nom: '', ville: '', adresse: '', latitude: 48.8566, longitude: 2.3522 });
      fetchBoutiques();
      Swal.fire('Boutique créée', '', 'success');
    } catch (error) {
      Swal.fire('Erreur', error.response?.data?.message || error.message, 'error');
    }
  };

  const searchTerm = boutiqueSearch.trim().toLowerCase();
  const filteredBoutiques = boutiques
    .filter((b) => !searchTerm || [b.nom, b.ville, b.adresse].some((field) => field?.toLowerCase().includes(searchTerm)))
    .sort((a, b) => (a.ville || '').localeCompare(b.ville || '', 'fr') || (a.nom || '').localeCompare(b.nom || '', 'fr'));

  if (loading) {
    return <div className="h-[calc(100vh-76px)] flex items-center justify-center text-slate-400 font-medium">Chargement du réseau...</div>;
  }

  return (
    <div className="flex h-[calc(100vh-76px)] bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-700 dark:text-slate-300">
      {/* GAUCHE : CARTE */}
      <div className={`transition-all duration-500 ${selectedBoutique ? 'w-2/3' : 'w-full'} relative`}>
        <MapContainer center={[48.86, 2.33]} zoom={12} className="h-full w-full">
          <ChangeView
            center={selectedBoutique ? [selectedBoutique.latitude, selectedBoutique.longitude] : [48.86, 2.33]}
            zoom={selectedBoutique ? 15 : 12}
          />
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          {boutiques.filter((b) => b.latitude != null && b.longitude != null).map((b) => (
            <Marker
              key={b.id_boutique}
              position={[b.latitude, b.longitude]}
              eventHandlers={{ click: () => handleSelectBoutique(b) }}
            >
              <Popup>
                <div className="text-sm">
                  <strong className="block mb-0.5 text-slate-800">{b.nom}</strong>
                  <span className="text-xs text-slate-500 block mb-2">{b.ville}</span>
                  <button
                    onClick={() => handleSelectBoutique(b)}
                    className="text-blue-600 font-semibold text-xs underline"
                  >
                    Gérer cette boutique
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Bouton création boutique */}
        <button
          onClick={() => setIsAddBoutiqueModalOpen(true)}
          className="absolute bottom-6 left-6 z-[1000] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl shadow-md flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-semibold text-sm"
        >
          <FiPlus className="text-blue-600" /> Ajouter une boutique
        </button>

        {/* Liste de toutes les boutiques du réseau (recherche par nom, ville ou adresse) */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
          <button
            onClick={() => setIsBoutiqueListOpen((v) => !v)}
            aria-expanded={isBoutiqueListOpen}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl shadow-md flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-semibold text-sm"
          >
            <FiList className="text-blue-600" /> Toutes les boutiques
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full">{boutiques.length}</span>
          </button>

          <AnimatePresence>
            {isBoutiqueListOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden"
              >
                <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="search"
                      value={boutiqueSearch}
                      onChange={(e) => setBoutiqueSearch(e.target.value)}
                      placeholder="Nom, ville ou adresse…"
                      aria-label="Rechercher une boutique"
                      className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <ul className="max-h-[55vh] overflow-y-auto p-2 space-y-1">
                  {filteredBoutiques.map((b) => {
                    const isSelected = selectedBoutique?.id_boutique === b.id_boutique;
                    const hasPosition = b.latitude != null && b.longitude != null;
                    return (
                      <li key={b.id_boutique}>
                        <button
                          onClick={() => handleSelectBoutique(b)}
                          className={`w-full text-left flex items-center justify-between gap-2 p-3 rounded-xl transition ${
                            isSelected ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-700/60'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{b.nom}</span>
                            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                              <FiMapPin size={11} className="shrink-0" /> {[b.adresse, b.ville].filter(Boolean).join(', ') || 'Adresse non renseignée'}
                            </span>
                            {!hasPosition && <span className="block text-[10px] font-bold uppercase text-amber-600 mt-0.5">Non placée sur la carte</span>}
                          </span>
                          <FiChevronRight className="shrink-0 text-slate-400" />
                        </button>
                      </li>
                    );
                  })}

                  {filteredBoutiques.length === 0 && (
                    <li className="text-center p-4 text-xs text-slate-400">
                      {boutiques.length === 0 ? 'Aucune boutique pour le moment.' : 'Aucune boutique ne correspond à la recherche.'}
                    </li>
                  )}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* DROITE : PANNEAU BOUTIQUE */}
      <AnimatePresence>
        {selectedBoutique && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="w-1/3 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-xl overflow-y-auto z-10 flex flex-col"
          >
            {/* Header boutique */}
            <div className="p-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 relative">
              <button
                onClick={() => setSelectedBoutique(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <FiX size={20} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedBoutique.nom}</h2>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <FiMapPin /> {selectedBoutique.adresse}, {selectedBoutique.ville}
              </p>
            </div>

            {/* Statistiques rapides */}
            <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-3 text-center">
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Équipe</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{equipe.length} pers.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Statut</p>
                <p className="text-lg font-bold text-emerald-600">Active</p>
              </div>
            </div>

            {/* Liste de l'équipe */}
            <div className="p-6 flex-grow">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Équipe assignée</h3>
                <button
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="text-blue-600 flex items-center gap-1 text-xs font-bold hover:underline"
                >
                  <FiPlus /> Nouvel employé
                </button>
              </div>

              <div className="space-y-3">
                {equipe.map((emp) => (
                  <div
                    key={emp.id_employe}
                    onClick={() => openEmployeeDetail(emp)}
                    className={`relative p-4 rounded-xl border cursor-pointer transition hover:shadow-sm ${
                      emp.role === 'Responsable' ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {emp.role === 'Responsable' && unreadByAdmin[emp.id_employe] > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{unreadByAdmin[emp.id_employe]}</span>
                    )}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Avatar url={emp.avatar_url} name={`${emp.prenom} ${emp.nom}`} size={44} online={onlineIds.has(emp.id_employe)} />
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            {emp.prenom} {emp.nom}
                            {emp.role === 'Responsable' && <FiStar className="text-amber-500 fill-amber-500" size={13} />}
                            {emp.role === 'Responsable' && unreadByAdmin[emp.id_employe] > 0 && <FiMessageSquare className="text-blue-500" size={13} />}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{emp.email}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block uppercase ${
                              emp.role === 'Responsable' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              {emp.role}
                            </span>
                            {(() => {
                              const status = getStatusLine({ online: onlineIds.has(emp.id_employe), events: equipeEvents, idEmploye: emp.id_employe, lastSeen: emp.last_seen });
                              return <span className={`text-[10px] ${status.className}`}>{status.text}</span>;
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-1">
                        {emp.role !== 'Responsable' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); promouvoirManager(emp.id_employe); }}
                            className="p-2 text-slate-400 hover:text-indigo-600 transition"
                            title="Promouvoir Manager"
                          >
                            <FiTrendingUp size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); supprimerEmploye(emp.id_employe, `${emp.prenom} ${emp.nom}`); }}
                          className="p-2 text-slate-400 hover:text-red-500 transition"
                          title="Retirer de l'équipe"
                        >
                          <FiUserMinus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {equipe.length === 0 && (
                  <div className="text-center p-6 text-slate-400 border border-dashed dark:border-slate-700 rounded-xl text-xs">
                    Aucun employé rattaché à cette boutique.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODALE CRÉATION D'EMPLOYÉ */}
      <AnimatePresence>
        {isAddUserModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-5 border-b dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 flex justify-between items-center">
                <span>Créer un accès employé</span>
                <FiLock className="text-slate-400" />
              </div>

              <form onSubmit={handleAddUser} className="p-6 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">Prénom</label>
                    <input
                      required
                      placeholder="Jean"
                      className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg p-2 outline-none focus:border-blue-500"
                      value={newUser.prenom}
                      onChange={(e) => setNewUser({ ...newUser, prenom: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">Nom</label>
                    <input
                      required
                      placeholder="Dupont"
                      className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg p-2 outline-none focus:border-blue-500"
                      value={newUser.nom}
                      onChange={(e) => setNewUser({ ...newUser, nom: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">Email (Identifiant)</label>
                  <input
                    required
                    type="email"
                    placeholder="jean.dupont@fixeo.fr"
                    className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg p-2 outline-none focus:border-blue-500"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">Téléphone</label>
                  <input
                    required
                    placeholder="06 12 34 56 78"
                    className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg p-2 outline-none focus:border-blue-500"
                    value={newUser.telephone}
                    onChange={(e) => setNewUser({ ...newUser, telephone: e.target.value })}
                  />
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Mot de passe initial
                  </label>
                  <input
                    required
                    type="password"
                    placeholder="6 caractères min."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 dark:text-slate-100 rounded p-2 text-sm outline-none focus:border-blue-500"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    L'employé devra le changer lors de son 1er accès.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">Rôle</label>
                  <select
                    className="w-full border dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="Technicien">Technicien</option>
                    <option value="Responsable">Responsable (Manager)</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddUserModalOpen(false)}
                    className="flex-1 py-2 text-sm font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition"
                  >
                    {actionLoading ? <FiLoader className="animate-spin" /> : 'Créer le compte'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODALE CRÉATION BOUTIQUE */}
      <AnimatePresence>
        {isAddBoutiqueModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-5 border-b dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 flex justify-between items-center">
                <span>Nouvelle boutique</span>
                <button onClick={() => setIsAddBoutiqueModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <FiX size={18} />
                </button>
              </div>

              <form onSubmit={handleAddBoutique} className="p-6 space-y-4 text-sm">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">Nom</label>
                  <input
                    required
                    placeholder="FiXeo - République"
                    className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg p-2 outline-none focus:border-blue-500"
                    value={newBoutique.nom}
                    onChange={(e) => setNewBoutique({ ...newBoutique, nom: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">Ville</label>
                    <input
                      required
                      placeholder="Paris"
                      className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg p-2 outline-none focus:border-blue-500"
                      value={newBoutique.ville}
                      onChange={(e) => setNewBoutique({ ...newBoutique, ville: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">Adresse</label>
                    <input
                      required
                      placeholder="12 rue de Rivoli"
                      className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg p-2 outline-none focus:border-blue-500"
                      value={newBoutique.adresse}
                      onChange={(e) => setNewBoutique({ ...newBoutique, adresse: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase">Localisation</label>
                    <button
                      type="button"
                      onClick={handleGeocodeAddress}
                      disabled={geocoding}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {geocoding ? <FiLoader className="animate-spin" size={12} /> : <FiMapPin size={12} />}
                      Localiser l'adresse
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">Ou clique directement sur la carte pour placer le marqueur.</p>
                  <div className="rounded-lg overflow-hidden border dark:border-slate-600" style={{ height: 180 }}>
                    <MapContainer center={[newBoutique.latitude, newBoutique.longitude]} zoom={13} style={{ height: '100%', width: '100%' }}>
                      <ChangeView center={[newBoutique.latitude, newBoutique.longitude]} zoom={13} />
                      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
                      <Marker position={[newBoutique.latitude, newBoutique.longitude]} />
                      <LocationPicker onPick={(lat, lng) => setNewBoutique((prev) => ({ ...prev, latitude: lat, longitude: lng }))} />
                    </MapContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <input
                      type="number"
                      step="any"
                      aria-label="Latitude"
                      className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg p-2 outline-none focus:border-blue-500 text-xs font-mono"
                      value={newBoutique.latitude}
                      onChange={(e) => setNewBoutique({ ...newBoutique, latitude: parseFloat(e.target.value) })}
                    />
                    <input
                      type="number"
                      step="any"
                      aria-label="Longitude"
                      className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg p-2 outline-none focus:border-blue-500 text-xs font-mono"
                      value={newBoutique.longitude}
                      onChange={(e) => setNewBoutique({ ...newBoutique, longitude: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddBoutiqueModalOpen(false)}
                    className="flex-1 py-2 text-sm font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-slate-800 text-white py-2 rounded-lg font-bold hover:bg-slate-900 transition"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODALE FICHE EMPLOYÉ */}
      <AnimatePresence>
        {selectedEmploye && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="bg-slate-800 dark:bg-slate-950 p-6 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <Avatar
                    url={selectedEmploye.avatar_url}
                    name={`${selectedEmploye.prenom} ${selectedEmploye.nom}`}
                    size={48}
                    online={onlineIds.has(selectedEmploye.id_employe)}
                  />
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      {selectedEmploye.prenom} {selectedEmploye.nom}
                      {selectedEmploye.role === 'Responsable' && <FiStar className="text-amber-400 fill-amber-400" size={18} />}
                    </h2>
                    {(() => {
                      const status = getStatusLine({ online: onlineIds.has(selectedEmploye.id_employe), events: equipeEvents, idEmploye: selectedEmploye.id_employe, lastSeen: selectedEmploye.last_seen, variant: 'darkHeader' });
                      return <p className={`text-sm mt-1 ${status.className}`}>{status.text}</p>;
                    })()}
                  </div>
                </div>
                <button onClick={() => setSelectedEmploye(null)} className="text-slate-400 hover:text-white bg-slate-700/50 p-2 rounded-full transition">
                  <FiX className="text-xl" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-6 space-y-1">
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2"><FiMail /> {selectedEmploye.email || 'Non renseigné'}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2"><FiPhone /> {selectedEmploye.telephone || 'Non renseigné'}</p>
                </div>

                {!selectedEmployeStats ? (
                  <p className="text-sm text-slate-400 italic">Chargement de la charge de travail...</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedEmployeStats.total}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Assignées</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-800 text-center">
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{selectedEmployeStats.restantes}</p>
                        <p className="text-[10px] font-bold text-amber-600/70 dark:text-amber-400/70 uppercase mt-1">Restantes</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800 text-center">
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{selectedEmployeStats.terminees}</p>
                        <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase mt-1">Terminées</p>
                      </div>
                    </div>

                    {selectedEmployeStats.total > 0 && (
                      <>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Réparations en cours</h3>
                        <div className="space-y-2">
                          {selectedEmployeRepairs.map(rep => (
                            <div key={rep.id_reparation} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                              <div>
                                <p className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{rep.numero_suivi}</p>
                                <p className="text-sm text-slate-700 dark:text-slate-200">{rep.appareils?.marque} {rep.appareils?.modele}</p>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${getStatusBadgeColor(rep.id_statut_actuel)}`}>{rep.statuts?.libelle}</span>
                            </div>
                          ))}
                          {selectedEmployeRepairs.length === 0 && (
                            <p className="text-sm text-slate-400 italic">Aucune réparation en cours.</p>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}

                {selectedEmploye.role === 'Responsable' && userData?.id_employe && (
                  <>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 mt-6 flex items-center gap-2"><FiMessageSquare /> Messagerie</h3>
                    <MessageThread
                      currentUserId={userData.id_employe}
                      otherUserId={selectedEmploye.id_employe}
                      otherUserName={`${selectedEmploye.prenom} ${selectedEmploye.nom}`}
                      otherUserAvatar={selectedEmploye.avatar_url}
                    />
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}