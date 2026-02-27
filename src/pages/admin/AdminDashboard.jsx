import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { FiUsers, FiTool, FiTrendingUp, FiStar, FiUserMinus } from 'react-icons/fi';

// Fix pour les icônes Leaflet qui buggent parfois avec Vite
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

export default function AdminDashboard() {
  const [boutiques, setBoutiques] = useState([]);
  const [selectedBoutique, setSelectedBoutique] = useState(null);
  const [equipe, setEquipe] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBoutiques();
  }, []);

  const fetchBoutiques = async () => {
    setLoading(true);
    // On récupère toutes les boutiques avec leurs coordonnées
    const { data, error } = await supabase.from('boutiques').select('*');
    if (!error && data) setBoutiques(data);
    setLoading(false);
  };

  const handleSelectBoutique = async (boutique) => {
    setSelectedBoutique(boutique);
    // Quand on clique sur une boutique, on charge son équipe
    const { data } = await supabase
      .from('employes')
      .select('*')
      .eq('id_boutique', boutique.id_boutique)
      .order('role', { ascending: true }); // Responsable en premier
    setEquipe(data || []);
  };

  const promouvoirManager = async (idEmploye) => {
    if (!window.confirm("Voulez-vous vraiment promouvoir ce technicien au rang de Responsable ?")) return;
    
    // 1. On rétrograde l'ancien responsable (optionnel, selon votre logique)
    await supabase.from('employes').update({ role: 'Technicien' })
      .eq('id_boutique', selectedBoutique.id_boutique).eq('role', 'Responsable');
      
    // 2. On promeut le nouveau
    await supabase.from('employes').update({ role: 'Responsable' }).eq('id_employe', idEmploye);
    
    // 3. On rafraîchit la liste
    handleSelectBoutique(selectedBoutique);
  };

  const supprimerEmploye = async (idEmploye, nom) => {
    if (!window.confirm(`Voulez-vous retirer ${nom} de cette boutique ?`)) return;
    await supabase.from('employes').delete().eq('id_employe', idEmploye);
    handleSelectBoutique(selectedBoutique);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Chargement de l'empire...</div>;

  return (
    <div className="flex h-[calc(100vh-76px)] bg-slate-50 overflow-hidden">
      
      {/* PARTIE GAUCHE : La Carte Interactive */}
      <div className={`transition-all duration-300 ${selectedBoutique ? 'w-2/3' : 'w-full'} relative z-0`}>
        <MapContainer center={[48.87, 2.3]} zoom={12} className="h-full w-full">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {boutiques.map(b => (
            b.latitude && b.longitude && (
              <Marker 
                key={b.id_boutique} 
                position={[b.latitude, b.longitude]}
                eventHandlers={{ click: () => handleSelectBoutique(b) }}
              >
                <Popup className="font-sans">
                  <strong className="text-lg">{b.nom}</strong><br/>
                  <span className="text-slate-500">{b.ville}</span><br/>
                  <button 
                    onClick={() => handleSelectBoutique(b)}
                    className="mt-2 text-blue-600 font-bold hover:underline"
                  >
                    Gérer cette boutique
                  </button>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
        
        {/* Overlay Titre sur la carte */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-lg border border-slate-200 pointer-events-none">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FiTrendingUp className="text-blue-600" />
            Supervision Globale ({boutiques.length} Boutiques)
          </h1>
        </div>
      </div>

      {/* PARTIE DROITE : Panneau de gestion (S'affiche si une boutique est cliquée) */}
      {selectedBoutique && (
        <div className="w-1/3 bg-white border-l border-slate-200 shadow-xl overflow-y-auto z-10 animate-fade-in-right">
          
          <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{selectedBoutique.nom}</h2>
              <p className="text-slate-300 text-sm">{selectedBoutique.adresse}, {selectedBoutique.ville}</p>
            </div>
            <button onClick={() => setSelectedBoutique(null)} className="text-slate-400 hover:text-white text-2xl">&times;</button>
          </div>

          {/* Section : Statistiques Rapides */}
          <div className="p-6 border-b border-slate-100 bg-slate-50 grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
              <FiUsers className="mx-auto text-blue-500 text-2xl mb-1" />
              <p className="text-xs text-slate-500 uppercase font-bold">Équipe</p>
              <p className="text-xl font-black text-slate-800">{equipe.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
              <FiTool className="mx-auto text-amber-500 text-2xl mb-1" />
              <p className="text-xs text-slate-500 uppercase font-bold">Réparations</p>
              <p className="text-xl font-black text-slate-800">Voir Détails</p>
            </div>
          </div>

          {/* Section : Gestion de l'équipe */}
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Équipe Actuelle</h3>
              <button className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-medium hover:bg-blue-200 transition">
                + Ajouter
              </button>
            </div>

            <div className="space-y-3">
              {equipe.map(emp => (
                <div key={emp.id_employe} className={`p-4 rounded-xl border flex items-center justify-between ${emp.role === 'Responsable' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                  <div>
                    <p className="font-bold text-slate-800 flex items-center gap-2">
                      {emp.prenom} {emp.nom}
                      {emp.role === 'Responsable' && <FiStar className="text-amber-500" title="Manager" />}
                    </p>
                    <p className="text-xs text-slate-500">{emp.email}</p>
                    <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full mt-1 inline-block ${emp.role === 'Responsable' ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>
                      {emp.role}
                    </span>
                  </div>
                  
                  {/* Actions Administrateur */}
                  <div className="flex gap-2">
                    {emp.role !== 'Responsable' && (
                      <button 
                        onClick={() => promouvoirManager(emp.id_employe)}
                        className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition"
                        title="Promouvoir Manager"
                      >
                        <FiTrendingUp />
                      </button>
                    )}
                    <button 
                      onClick={() => supprimerEmploye(emp.id_employe, emp.nom)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Retirer de la boutique"
                    >
                      <FiUserMinus />
                    </button>
                  </div>
                </div>
              ))}

              {equipe.length === 0 && (
                <div className="text-center p-6 text-slate-400 border-2 border-dashed rounded-xl">
                  Aucun employé assigné à cette boutique.
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}