import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { FiTool, FiClock, FiCheckCircle, FiTrendingUp, FiPieChart, FiPlus, FiX, FiSearch, FiUser, FiCheck, FiPrinter } from 'react-icons/fi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';

// --- Palette de couleurs pour les statuts ---
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

const evolutionData = [ { mois: 'Sept', reparations: 45 }, { mois: 'Oct', reparations: 52 }, { mois: 'Nov', reparations: 38 }, { mois: 'Déc', reparations: 65 }, { mois: 'Jan', reparations: 48 }, { mois: 'Fév', reparations: 74 } ];
const statusData = [ { name: 'En cours', value: 35 }, { name: 'Terminées', value: 45 }, { name: 'En attente pièce', value: 15 }, { name: 'Annulées', value: 5 } ];
const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

export default function ManagerDashboard() {
  const { userData } = useAuth();
  const [stats, setStats] = useState({ total: 0, enCours: 0, terminees: 0 });
  const [loading, setLoading] = useState(true);
  
  // --- ÉTATS CRÉATION TICKET ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [techniciens, setTechniciens] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ nom: '', prenom: '', email: '', telephone: '', marque: '', modele: '', description: '', id_technicien: '' });

  // --- ÉTATS SUIVI ATELIER ---
  const [reparationsList, setReparationsList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [techFilter, setTechFilter] = useState('ALL');

  // --- ÉTATS POUR LA FACTURATION ---
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedRepairForInvoice, setSelectedRepairForInvoice] = useState(null);
  const [invoiceData, setInvoiceData] = useState({ amount: '', paymentMethod: 'CB' });
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const sigCanvas = useRef({}); 

  useEffect(() => {
    if (userData?.id_boutique) fetchDashboardData();
  }, [userData]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { count: totalCount } = await supabase.from('reparations').select('*', { count: 'exact', head: true });
      const { count: enCoursCount } = await supabase.from('reparations').select('*', { count: 'exact', head: true }).eq('id_statut_actuel', 5);
      const { count: termineesCount } = await supabase.from('reparations').select('*', { count: 'exact', head: true }).in('id_statut_actuel', [6, 8]);
      setStats({ total: totalCount || 0, enCours: enCoursCount || 0, terminees: termineesCount || 0 });

      const { data: techs } = await supabase.from('employes').select('id_employe, nom, prenom').eq('role', 'Technicien').eq('id_boutique', userData.id_boutique);
      setTechniciens(techs || []);

      if (techs && techs.length > 0) {
        const techIds = techs.map(t => t.id_employe);
        const { data: repData } = await supabase
          .from('reparations')
          .select(`
            id_reparation, numero_suivi, date_prise_en_charge, id_statut_actuel, id_technicien, description_panne,
            statuts ( libelle ),
            appareils ( marque, modele, clients ( nom, prenom, email, telephone ) ),
            employes ( nom, prenom )
          `)
          .in('id_technicien', techIds)
          .order('date_prise_en_charge', { ascending: false });
        setReparationsList(repData || []);
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- PDF DE DÉPÔT ---
  const generateDepositPDF = (clientInfo, numeroSuivi) => {
    const doc = new jsPDF();
    doc.setFontSize(22); doc.setTextColor(37, 99, 235); doc.text("QuickRepair", 20, 20);
    doc.setFontSize(12); doc.setTextColor(100); doc.text("TICKET DE PRISE EN CHARGE", 20, 30);
    doc.setTextColor(0); doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}`, 20, 45);
    doc.text(`N° de Suivi :`, 20, 55); doc.setFontSize(16); doc.setTextColor(37, 99, 235); doc.text(numeroSuivi, 55, 55);
    doc.setFontSize(14); doc.setTextColor(0); doc.text("Informations Client :", 20, 75); doc.setFontSize(12); doc.setTextColor(80);
    doc.text(`${clientInfo.prenom} ${clientInfo.nom}`, 20, 83); doc.text(`${clientInfo.email}`, 20, 90); doc.text(`${clientInfo.telephone}`, 20, 97);
    doc.setFontSize(14); doc.setTextColor(0); doc.text("Appareil déposé :", 110, 75); doc.setFontSize(12); doc.setTextColor(80);
    doc.text(`Marque : ${clientInfo.marque}`, 110, 83); doc.text(`Modèle : ${clientInfo.modele}`, 110, 90);
    doc.setFontSize(14); doc.setTextColor(0); doc.text("Description de la panne :", 20, 115); doc.setFontSize(12); doc.setTextColor(80);
    doc.text(doc.splitTextToSize(clientInfo.description, 170), 20, 123);
    doc.setFontSize(10); doc.setTextColor(150); doc.text("Conservez précieusement ce numéro de suivi.", 20, 270);
    doc.save(`Ticket_Depot_${numeroSuivi}.pdf`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true); const submittedData = { ...formData }; 
    try {
      let idClient;
      const { data: existingClient } = await supabase.from('clients').select('id_client').eq('email', formData.email).maybeSingle();
      if (existingClient) idClient = existingClient.id_client;
      else {
        const { data: newClient, error: clientErr } = await supabase.from('clients').insert([{ nom: formData.nom, prenom: formData.prenom, email: formData.email, telephone: formData.telephone }]).select().single();
        if (clientErr) throw clientErr; idClient = newClient.id_client;
      }
      const { data: newAppareil, error: appErr } = await supabase.from('appareils').insert([{ id_client: idClient, marque: formData.marque, modele: formData.modele }]).select().single();
      if (appErr) throw appErr;
      const numeroSuivi = 'QR-' + Math.floor(Math.random() * 90000 + 10000);
      const { error: repErr } = await supabase.from('reparations').insert([{ numero_suivi: numeroSuivi, description_panne: formData.description, id_statut_actuel: 1, id_appareil: newAppareil.id_appareil, id_technicien: formData.id_technicien }]);
      if (repErr) throw repErr;

      setIsModalOpen(false);
      Swal.fire({ title: 'Ticket Créé !', html: `Numéro :<br><b style="font-size: 1.5rem; color: #2563eb;">${numeroSuivi}</b>`, icon: 'success', showCancelButton: true, confirmButtonColor: '#10b981', cancelButtonColor: '#3b82f6', confirmButtonText: 'Terminer', cancelButtonText: '📄 Télécharger le reçu' }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) generateDepositPDF(submittedData, numeroSuivi);
      });
      setFormData({ nom: '', prenom: '', email: '', telephone: '', marque: '', modele: '', description: '', id_technicien: '' });
      fetchDashboardData(); 
    } catch (error) { Swal.fire('Oups...', error.message, 'error'); } finally { setIsSubmitting(false); }
  };

  const openInvoiceModal = (rep) => {
    setSelectedRepairForInvoice(rep);
    setInvoiceData({ amount: '', paymentMethod: 'CB' });
    setIsInvoiceModalOpen(true);
    setTimeout(() => { if (sigCanvas.current) sigCanvas.current.clear(); }, 100);
  };

  // --- GÉNÉRER LA FACTURE (CORRIGÉ) ---
  const handleGenerateInvoice = async () => {
    if (!invoiceData.amount || isNaN(invoiceData.amount)) return Swal.fire('Erreur', 'Veuillez entrer un montant valide.', 'warning');
    if (sigCanvas.current.isEmpty()) return Swal.fire('Erreur', 'Le client doit signer la facture.', 'warning');

    setIsGeneratingInvoice(true);
    try {
      // CORRECTION : Utilisation de getCanvas() pour éviter le bug d'import
      const signatureImage = sigCanvas.current.getCanvas().toDataURL('image/png');
      
      const numFacture = 'FAC-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 10000);
      const montantTTC = parseFloat(invoiceData.amount).toFixed(2);
      const montantHT = (montantTTC / 1.20).toFixed(2);
      const tva = (montantTTC - montantHT).toFixed(2);

      const { error: invoiceError } = await supabase.from('factures').insert([{
        numero_facture: numFacture,
        id_reparation: selectedRepairForInvoice.id_reparation,
        montant_total: montantTTC,
        mode_paiement: invoiceData.paymentMethod,
        date_emission: new Date().toISOString()
      }]);
      if (invoiceError) throw invoiceError;

      await supabase.from('reparations').update({ id_statut_actuel: 8 }).eq('id_reparation', selectedRepairForInvoice.id_reparation);

      const doc = new jsPDF();
      doc.setFontSize(22); doc.setTextColor(37, 99, 235); doc.text("QuickRepair", 20, 20);
      doc.setFontSize(12); doc.setTextColor(100); doc.text("FACTURE ACQUITTÉE", 20, 30);
      doc.setTextColor(0); doc.text(`Facture N° : ${numFacture}`, 20, 45);
      doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 20, 52);
      doc.text(`Ticket Suivi : ${selectedRepairForInvoice.numero_suivi}`, 20, 59);
      doc.text("Client :", 120, 45); doc.setFontSize(10); doc.setTextColor(80);
      doc.text(`${selectedRepairForInvoice.appareils.clients.prenom} ${selectedRepairForInvoice.appareils.clients.nom}`, 120, 52);
      doc.text(`${selectedRepairForInvoice.appareils.clients.email}`, 120, 59);
      doc.setDrawColor(200); doc.line(20, 75, 190, 75);
      doc.setFontSize(12); doc.setTextColor(0); doc.text("Désignation", 20, 82); doc.text("Total TTC", 165, 82);
      doc.line(20, 85, 190, 85);
      doc.setFontSize(10); doc.setTextColor(80);
      doc.text(`Prestation de réparation - ${selectedRepairForInvoice.appareils.marque} ${selectedRepairForInvoice.appareils.modele}`, 20, 95);
      doc.text(`${montantTTC} €`, 165, 95); doc.line(20, 105, 190, 105);
      doc.setTextColor(0); doc.text(`Total HT :`, 135, 115); doc.text(`${montantHT} €`, 165, 115);
      doc.text(`TVA (20%) :`, 135, 122); doc.text(`${tva} €`, 165, 122);
      doc.setFontSize(14); doc.text(`Net à payer :`, 130, 132); doc.setTextColor(37, 99, 235); doc.text(`${montantTTC} €`, 165, 132);
      doc.setFontSize(12); doc.setTextColor(16, 185, 129); doc.text(`PAYÉ PAR ${invoiceData.paymentMethod.toUpperCase()}`, 20, 150);
      doc.setTextColor(0); doc.setFontSize(10); doc.text("Signature du client :", 20, 165);
      
      // Ajout de la signature
      doc.addImage(signatureImage, 'PNG', 20, 170, 60, 30);
      doc.rect(20, 170, 60, 30);

      doc.setFontSize(10); doc.setTextColor(150); doc.text("Merci de votre confiance !", 85, 270);
      doc.save(`${numFacture}_${selectedRepairForInvoice.appareils.clients.nom}.pdf`);

      setIsInvoiceModalOpen(false);
      fetchDashboardData();
      Swal.fire({ title: 'Clôturé !', text: 'Appareil restitué et facture générée.', icon: 'success', timer: 2500, showConfirmButton: false });

    } catch (error) {
      Swal.fire('Erreur', "La facture n'a pas pu être générée.", 'error');
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const filteredRepairs = reparationsList.filter(rep => {
    const searchString = searchTerm.toLowerCase();
    const matchSearch = rep.numero_suivi.toLowerCase().includes(searchString) || rep.appareils?.clients?.nom.toLowerCase().includes(searchString) || rep.appareils?.clients?.prenom.toLowerCase().includes(searchString);
    const matchTech = techFilter === 'ALL' || rep.id_technicien === parseInt(techFilter);
    return matchSearch && matchTech;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in space-y-8">
      {/* --- EN-TÊTE --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Tableau de Bord</h1><p className="text-slate-500 mt-1">Boutique : Vue analytique et gestion de l'équipe</p></div>
        <div className="flex gap-3">
          <button onClick={fetchDashboardData} className="bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl hover:bg-slate-50 transition font-medium shadow-sm">Rafraîchir</button>
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-sm hover:bg-blue-700 transition font-bold flex items-center gap-2"><FiPlus className="text-xl" /> Nouveau Ticket</button>
        </div>
      </div>

      {/* --- KPIs --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow"><div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><FiTool className="text-2xl" /></div><div><p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Total Réparations</p><p className="text-3xl font-bold text-slate-800">{stats.total}</p></div></div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow"><div className="p-4 bg-amber-50 text-amber-500 rounded-xl"><FiClock className="text-2xl" /></div><div><p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">En cours / Attente</p><p className="text-3xl font-bold text-slate-800">{stats.enCours}</p></div></div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow"><div className="p-4 bg-emerald-50 text-emerald-500 rounded-xl"><FiCheckCircle className="text-2xl" /></div><div><p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Terminées / Livrées</p><p className="text-3xl font-bold text-slate-800">{stats.terminees}</p></div></div>
      </div>

      {/* --- GRAPHES --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><FiTrendingUp className="text-blue-500" /> Évolution</h2>
          <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="colorRep" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="mois" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} /><RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/><Area type="monotone" dataKey="reparations" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRep)" /></AreaChart></ResponsiveContainer></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><FiPieChart className="text-indigo-500" /> Répartition</h2>
          <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} cx="50%" cy="45%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/><Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#475569' }} /></PieChart></ResponsiveContainer></div>
        </div>
      </div>

      {/* --- TABLEAU --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FiUser className="text-blue-500" /> État Atelier</h2>
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64"><FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <select className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium outline-none" value={techFilter} onChange={(e) => setTechFilter(e.target.value)}><option value="ALL">Tous les techniciens</option>{techniciens.map(t => <option key={t.id_employe} value={t.id_employe}>{t.prenom} {t.nom}</option>)}</select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider"><th className="p-4 border-b">Ticket</th><th className="p-4 border-b">Client</th><th className="p-4 border-b">Appareil</th><th className="p-4 border-b">Technicien</th><th className="p-4 border-b">Statut</th><th className="p-4 border-b text-right">Action</th></tr></thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {filteredRepairs.map(rep => (
                <tr key={rep.id_reparation} className="hover:bg-slate-50/50 transition">
                  <td className="p-4 font-mono font-bold text-slate-700">{rep.numero_suivi}</td>
                  <td className="p-4 font-medium text-slate-800">{rep.appareils?.clients?.prenom} {rep.appareils?.clients?.nom}</td>
                  <td className="p-4 text-slate-600">{rep.appareils?.marque} {rep.appareils?.modele}</td>
                  <td className="p-4"><span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold">{rep.employes?.prenom}</span></td>
                  <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${getStatusBadgeColor(rep.id_statut_actuel)}`}>{rep.statuts?.libelle}</span></td>
                  <td className="p-4 text-right">
                    {[6, 7].includes(rep.id_statut_actuel) ? (
                      <button onClick={() => openInvoiceModal(rep)} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg transition shadow-sm font-bold flex items-center justify-end gap-2 ml-auto"><FiPrinter /> Facturer</button>
                    ) : rep.id_statut_actuel === 8 ? (<span className="text-xs text-slate-400 font-bold italic">Archivé</span>) : (<span className="text-xs text-slate-400">En atelier</span>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODALE CRÉATION --- */}
      <AnimatePresence>
        {isModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
               <div className="bg-slate-800 p-6 text-white flex justify-between items-center shrink-0"><h2 className="text-2xl font-bold flex items-center gap-3"><FiPlus /> Nouveau Ticket</h2><button onClick={() => setIsModalOpen(false)} className="bg-slate-700/50 p-2 rounded-full hover:text-white transition"><FiX className="text-xl" /></button></div>
               <div className="p-6 overflow-y-auto bg-slate-50">
                 <form onSubmit={handleSubmit} className="space-y-6">
                   <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h3 className="text-blue-800 font-bold mb-4 uppercase text-sm tracking-wide">1. Client</h3><div className="grid grid-cols-2 gap-4">
                     <input required type="text" placeholder="Prénom" className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.prenom} onChange={(e)=>setFormData({...formData, prenom: e.target.value})} />
                     <input required type="text" placeholder="Nom" className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.nom} onChange={(e)=>setFormData({...formData, nom: e.target.value})} />
                     <input required type="email" placeholder="Email" className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.email} onChange={(e)=>setFormData({...formData, email: e.target.value})} />
                     <input required type="tel" placeholder="Téléphone" className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.telephone} onChange={(e)=>setFormData({...formData, telephone: e.target.value})} />
                   </div></div>
                   <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h3 className="text-blue-800 font-bold mb-4 uppercase text-sm tracking-wide">2. Appareil</h3><div className="grid grid-cols-2 gap-4 mb-4">
                     <input required placeholder="Marque" type="text" className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.marque} onChange={(e)=>setFormData({...formData, marque: e.target.value})} />
                     <input required placeholder="Modèle" type="text" className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.modele} onChange={(e)=>setFormData({...formData, modele: e.target.value})} />
                   </div><textarea required placeholder="Description panne" className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-blue-500" value={formData.description} onChange={(e)=>setFormData({...formData, description: e.target.value})} /></div>
                   <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h3 className="text-blue-800 font-bold mb-4 uppercase text-sm tracking-wide">3. Technicien</h3>
                     <select required className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.id_technicien} onChange={(e)=>setFormData({...formData, id_technicien: e.target.value})}><option value="">Sélectionner...</option>{techniciens.map(t => <option key={t.id_employe} value={t.id_employe}>{t.prenom} {t.nom}</option>)}</select>
                   </div>
                   <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-md text-lg transition">{isSubmitting ? 'Création...' : 'Valider Ticket'}</button>
                 </form>
               </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>

      {/* --- MODALE FACTURATION --- */}
      <AnimatePresence>
        {isInvoiceModalOpen && selectedRepairForInvoice && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="bg-emerald-600 p-6 text-white text-center relative"><button onClick={() => setIsInvoiceModalOpen(false)} className="absolute right-4 top-4 text-emerald-200 hover:text-white transition"><FiX className="text-2xl" /></button><div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"><FiCheck className="text-3xl text-white" /></div><h2 className="text-2xl font-bold">Encaissement</h2><p className="text-emerald-100 text-sm">{selectedRepairForInvoice.appareils.marque} {selectedRepairForInvoice.appareils.modele}</p></div>
              <div className="p-8 bg-slate-50 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Montant TTC</label><div className="relative"><input type="number" placeholder="0.00" value={invoiceData.amount} onChange={(e) => setInvoiceData({ ...invoiceData, amount: e.target.value })} className="w-full pl-4 pr-10 py-3 bg-white border border-slate-300 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-emerald-500" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span></div></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Paiement</label><select value={invoiceData.paymentMethod} onChange={(e) => setInvoiceData({ ...invoiceData, paymentMethod: e.target.value })} className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"><option value="CB">Carte Bancaire</option><option value="Espèces">Espèces</option><option value="Virement">Virement</option></select></div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><div className="flex justify-between items-center mb-2"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Signature Client</label><button onClick={() => sigCanvas.current.clear()} className="text-xs text-blue-500 font-semibold underline">Effacer</button></div>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50 h-32 touch-none relative"><SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{ className: 'w-full h-full' }} /><p className="absolute bottom-2 left-0 right-0 text-center text-slate-300 text-xs pointer-events-none">Signez ici</p></div>
                </div>
                <button onClick={handleGenerateInvoice} disabled={isGeneratingInvoice} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2">{isGeneratingInvoice ? 'Génération...' : <><FiPrinter className="text-xl" /> Valider & Imprimer</>}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}