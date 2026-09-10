import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { FiUsers, FiTool, FiTrendingUp, FiStar, FiUserMinus, FiPlus, FiX, FiCheck, FiMail, FiPhone, FiMapPin } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function AdminDashboard() {
  const [boutiques, setBoutiques] = useState([]);
  const [selectedBoutique, setSelectedBoutique] = useState(null);
  const [equipe, setEquipe] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isAddBoutiqueModalOpen, setIsAddBoutiqueModalOpen] = useState(false);
  
  const [newUser, setNewUser] = useState({ nom: '', prenom: '', email: '', telephone: '', role: 'Technicien' });
  const [newBoutique, setNewBoutique] = useState({ nom: '', ville: '', adresse: '', latitude: 48.8566, longitude: 2.3522 });

  useEffect(() => { fetchBoutiques(); }, []);

  const fetchBoutiques = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('boutiques').select('*');
    if (!error && data) setBoutiques(data);
    setLoading(false);
  };

  const handleSelectBoutique = async (boutique) => {
    setSelectedBoutique(boutique);
    const { data } = await supabase
      .from('employes')
      .select('*')
      .eq('id_boutique', boutique.id_boutique)
      .order('role', { ascending: true });
    setEquipe(data || []);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      // Correction : On s'assure que les noms de colonnes correspondent à votre BDD
      const { error } = await supabase.from('employes').insert([{
        nom: newUser.nom,
        prenom: newUser.prenom,
        email: newUser.email,
        telephone: newUser.telephone, // Assurez-vous d'avoir lancé le SQL d'ajout de colonne
        role: newUser.role,
        id_boutique: selectedBoutique.id_boutique
      }]);
      
      if (error) throw error;
      
      Swal.fire('Succès', 'Employé ajouté', 'success');
      setIsAddUserModalOpen(false);
      setNewUser({ nom: '', prenom: '', email: '', telephone: '', role: 'Technicien' });
      handleSelectBoutique(selectedBoutique);
    } catch (err) {
      Swal.fire('Erreur', "Vérifiez que la colonne 'telephone' existe dans la table employes", 'error');
    }
  };

  const promouvoirManager = async (idEmploye) => {
    const result = await Swal.fire({
      title: 'Promouvoir ?',
      text: "L'ancien responsable deviendra technicien.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6'
    });

    if (result.isConfirmed) {
      await supabase.from('employes').update({ role: 'Technicien' }).eq('id_boutique', selectedBoutique.id_boutique).eq('role', 'Responsable');
      await supabase.from('employes').update({ role: 'Responsable' }).eq('id_employe', idEmploye);
      handleSelectBoutique(selectedBoutique);
    }
  };

  const supprimerEmploye = async (idEmploye, nom) => {
    const result = await Swal.fire({
      title: 'Supprimer ?',
      text: `Retirer ${nom} de l'équipe ?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
      await supabase.from('employes').delete().eq('id_employe', idEmploye);
      handleSelectBoutique(selectedBoutique);
    }
  };

  const handleAddBoutique = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('boutiques').insert([newBoutique]);
    if (!error) {
      setIsAddBoutiqueModalOpen(false);
      fetchBoutiques();
      Swal.fire('Boutique ajoutée', '', 'success');
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-400">Chargement...</div>;

  return (
    <div className="flex h-[calc(100vh-76px)] bg-slate-50 overflow-hidden text-slate-700">
      
      {/* GAUCHE : CARTE */}
      <div className={`transition-all duration-500 ${selectedBoutique ? 'w-2/3' : 'w-full'} relative`}>
        <MapContainer center={[48.86, 2.33]} zoom={12} className="h-full w-full">
          <ChangeView center={selectedBoutique ? [selectedBoutique.latitude, selectedBoutique.longitude] : [48.86, 2.33]} zoom={selectedBoutique ? 15 : 12} />
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          {boutiques.map(b => (
            <Marker key={b.id_boutique} position={[b.latitude, b.longitude]} eventHandlers={{ click: () => handleSelectBoutique(b) }}>
              <Popup>
                <div className="text-sm">
                  <strong className="block mb-1">{b.nom}</strong>
                  <button onClick={() => handleSelectBoutique(b)} className="text-blue-600 font-semibold underline">Gérer l'équipe</button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <button 
          onClick={() => setIsAddBoutiqueModalOpen(true)}
          className="absolute bottom-6 left-6 z-[1000] bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all font-semibold text-sm"
        >
          <FiPlus className="text-blue-500" /> Ajouter une boutique
        </button>
      </div>

      {/* DROITE : PANEL */}
      <AnimatePresence>
        {selectedBoutique && (
          <motion.div 
            initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }}
            className="w-1/3 bg-white border-l border-slate-200 shadow-xl overflow-y-auto z-10 flex flex-col"
          >
            <div className="p-6 bg-slate-50 border-b border-slate-200 relative">
              <button onClick={() => setSelectedBoutique(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"><FiX size={20} /></button>
              <h2 className="text-xl font-bold text-slate-800">{selectedBoutique.nom}</h2>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><FiMapPin /> {selectedBoutique.ville}</p>
            </div>

            <div className="p-6 flex-grow">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Équipe</h3>
                <button onClick={() => setIsAddUserModalOpen(true)} className="text-blue-600 flex items-center gap-1 text-sm font-bold hover:underline">
                  <FiPlus /> Ajouter
                </button>
              </div>

              <div className="space-y-3">
                {equipe.map(emp => (
                  <div key={emp.id_employe} className={`p-4 rounded-xl border ${emp.role === 'Responsable' ? 'border-blue-100 bg-blue-50/50' : 'border-slate-100'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          {emp.prenom} {emp.nom}
                          {emp.role === 'Responsable' && <FiStar className="text-amber-500" size={12} />}
                        </p>
                        <p className="text-[11px] text-slate-500 uppercase font-semibold mt-1">{emp.role}</p>
                      </div>
                      <div className="flex gap-1">
                        {emp.role !== 'Responsable' && (
                          <button onClick={() => promouvoirManager(emp.id_employe)} className="p-2 text-slate-400 hover:text-blue-600 transition" title="Promouvoir"><FiTrendingUp size={16}/></button>
                        )}
                        <button onClick={() => supprimerEmploye(emp.id_employe, emp.nom)} className="p-2 text-slate-400 hover:text-red-500 transition"><FiUserMinus size={16}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODALE USER */}
      <AnimatePresence>
        {isAddUserModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
              <div className="p-5 border-b font-bold">Nouvel employé</div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input required placeholder="Prénom" className="w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500" value={newUser.prenom} onChange={e => setNewUser({...newUser, prenom: e.target.value})} />
                  <input required placeholder="Nom" className="w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500" value={newUser.nom} onChange={e => setNewUser({...newUser, nom: e.target.value})} />
                </div>
                <input required type="email" placeholder="Email" className="w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                <input required placeholder="Téléphone" className="w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500" value={newUser.telephone} onChange={e => setNewUser({...newUser, telephone: e.target.value})} />
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={()=>setIsAddUserModalOpen(false)} className="flex-1 py-2 text-sm font-semibold text-slate-400">Annuler</button>
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold shadow-md">Ajouter</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODALE BOUTIQUE */}
      <AnimatePresence>
        {isAddBoutiqueModalOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
              <div className="p-5 border-b font-bold">Nouvelle boutique</div>
              <form onSubmit={handleAddBoutique} className="p-6 space-y-4">
                <input required placeholder="Nom boutique" className="w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500" value={newBoutique.nom} onChange={e => setNewBoutique({...newBoutique, nom: e.target.value})} />
                <div className="grid grid-cols-2 gap-3">
                  <input required placeholder="Ville" className="w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500" value={newBoutique.ville} onChange={e => setNewBoutique({...newBoutique, ville: e.target.value})} />
                  <input required placeholder="Adresse" className="w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500" value={newBoutique.adresse} onChange={e => setNewBoutique({...newBoutique, adresse: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" step="any" placeholder="Latitude" className="w-full border rounded-lg p-2 text-sm" value={newBoutique.latitude} onChange={e => setNewBoutique({...newBoutique, latitude: parseFloat(e.target.value)})} />
                  <input type="number" step="any" placeholder="Longitude" className="w-full border rounded-lg p-2 text-sm" value={newBoutique.longitude} onChange={e => setNewBoutique({...newBoutique, longitude: parseFloat(e.target.value)})} />
                </div>
                <button type="submit" className="w-full bg-slate-800 text-white py-3 rounded-lg text-sm font-bold mt-2">Créer la boutique</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}