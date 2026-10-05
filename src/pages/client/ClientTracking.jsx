import { useState } from 'react';
import { apiClient } from '../../apiClient';
import { FiSearch, FiSmartphone, FiCheckCircle, FiClock, FiAlertCircle, FiMessageSquare, FiLoader, FiCheck } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { getStatusBorderBadgeColor as getStatusBadgeColor } from '../../constants/statuts';

export default function ClientTracking() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [repairData, setRepairData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- Fonction de génération de facture PDF ---
  const downloadInvoice = (rep, invoice) => {
    const doc = new jsPDF();
    doc.setFontSize(22); doc.setTextColor(37, 99, 235); doc.text("QuickRepair", 20, 20);
    doc.setFontSize(12); doc.setTextColor(100); doc.text("FACTURE ACQUITTÉE", 20, 30);
    doc.setTextColor(0); doc.text(`Facture N° : ${invoice.numero_facture}`, 20, 45);
    doc.text(`Date d'émission : ${new Date(invoice.date_emission).toLocaleDateString('fr-FR')}`, 20, 52);
    doc.text(`Ticket : ${rep.numero_suivi}`, 20, 59);
    doc.text("Client :", 120, 45); doc.setFontSize(10); doc.setTextColor(80);
    doc.text(`${rep.appareils.clients.prenom} ${rep.appareils.clients.nom}`, 120, 52);
    doc.setDrawColor(200); doc.line(20, 75, 190, 75);
    doc.setFontSize(12); doc.setTextColor(0); doc.text("Désignation", 20, 82); doc.text("Total TTC", 165, 82);
    doc.line(20, 85, 190, 85);
    doc.setFontSize(10); doc.setTextColor(80);
    doc.text(`Réparation : ${rep.appareils.marque} ${rep.appareils.modele}`, 20, 95);
    doc.text(`${invoice.montant_total} €`, 165, 95);
    doc.setFontSize(14); doc.setTextColor(37, 99, 235);
    doc.text(`Total réglé par ${invoice.mode_paiement} : ${invoice.montant_total} €`, 20, 120);
    doc.save(`Facture_${rep.numero_suivi}.pdf`);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!trackingNumber.trim()) return;

    setLoading(true);
    setError('');
    setRepairData(null);
    setHistory([]);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Animation de scan

      // Recherche publique servie par le backend NestJS (module Réparations) — pas de
      // session requise, comme l'ancienne requête Supabase directe.
      const { historique_statuts, ...repData } = (
        await apiClient.get(`/reparations/track/${encodeURIComponent(trackingNumber.trim())}`)
      ).data;

      setRepairData(repData);

      if (repData.id_statut_actuel === 8) {
        Swal.fire({
          title: 'Appareil Livré ! 🎉',
          html: `Votre <b>${repData.appareils.marque} ${repData.appareils.modele}</b> est de nouveau entre vos mains.`,
          icon: 'success',
          showCancelButton: repData.factures?.length > 0,
          confirmButtonColor: '#10b981',
          cancelButtonColor: '#3b82f6',
          confirmButtonText: 'Fermer',
          cancelButtonText: '📄 Télécharger ma facture'
        }).then((result) => {
          if (result.dismiss === Swal.DismissReason.cancel) {
            downloadInvoice(repData, repData.factures[0]);
          }
        });
      }

      setHistory(historique_statuts || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-76px)] bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4 font-sans">
      
      {/* --- Section Recherche --- */}
      <div className="max-w-xl w-full text-center mb-12">
        <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-extrabold text-slate-800 dark:text-slate-100 mb-4 tracking-tight">
          Où en est mon appareil ?
        </motion.h1>
        <form onSubmit={handleSearch} className="relative flex items-center shadow-xl rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
          <div className="pl-6 text-slate-400"><FiSearch /></div>
          <input
            type="text"
            placeholder="Entrez votre N° de suivi (ex: QR-12345)"
            className="w-full py-5 pl-4 pr-32 text-lg text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 outline-none uppercase font-bold"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
          />
          <button type="submit" disabled={loading} className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white px-8 rounded-xl font-black tracking-wide transition hover:bg-blue-700">
            {loading ? <FiLoader className="animate-spin text-xl" /> : 'SUIVRE'}
          </button>
        </form>
        {error && <div className="mt-4 text-red-500 font-bold flex items-center justify-center gap-2"><FiAlertCircle /> {error}</div>}
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-10">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-400 font-bold uppercase tracking-widest">Analyse du ticket...</p>
          </motion.div>
        )}

        {repairData && !loading && (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl">
            
            {/* --- Résumé de l'appareil --- */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 p-8 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 bg-blue-600 text-white font-mono text-xs rounded-bl-2xl">
                 SUIVI OFFICIEL
               </div>
               <div className="flex items-center gap-6">
                 <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-3xl flex items-center justify-center border border-blue-100 dark:border-blue-800 shadow-inner">
                   <FiSmartphone className="text-4xl" />
                 </div>
                 <div>
                   <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 uppercase italic leading-none">{repairData.appareils.marque}</h2>
                   <p className="text-xl font-bold text-slate-500 dark:text-slate-400">{repairData.appareils.modele}</p>
                   <p className="text-sm font-mono text-blue-600 mt-2">Ticket ID: {repairData.numero_suivi}</p>
                 </div>
               </div>
               <div className="text-center md:text-right">
                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">État Actuel</p>
                 <span className={`px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-tighter border-2 shadow-sm ${getStatusBadgeColor(repairData.id_statut_actuel)}`}>
                   {repairData.statuts.libelle}
                 </span>
               </div>
            </div>

            {/* --- LA TIMELINE (ANCIENNE INTERFACE) --- */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 p-8 md:p-12 relative">
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-10 flex items-center gap-3">
                <FiClock className="text-blue-600" /> PARCOURS DE RÉPARATION
              </h3>

              <div className="relative">
                {/* Ligne verticale de fond */}
                <div className="absolute left-[19px] top-2 bottom-2 w-1 bg-slate-100 dark:bg-slate-700 rounded-full"></div>

                <div className="space-y-12">
                  {history.map((hist, index) => (
                    <motion.div 
                      key={hist.id_historique}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative pl-14 group"
                    >
                      {/* Le point sur la ligne */}
                      <div className={`absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-white shadow-md flex items-center justify-center z-10 transition-transform group-hover:scale-110 ${index === 0 ? 'bg-blue-600 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}>
                        {index === 0 ? <FiClock className="text-lg" /> : <FiCheck className="text-lg" />}
                      </div>

                      {/* Le contenu de l'étape */}
                      <div className={`p-6 rounded-2xl border-2 transition-all ${index === 0 ? 'bg-blue-50/30 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-blue-100 dark:shadow-none shadow-lg' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-700 opacity-80'}`}>
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-2 mb-3">
                          <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wide border ${getStatusBadgeColor(hist.id_statut)}`}>
                            {hist.statuts.libelle}
                          </span>
                          <span className="text-xs font-black text-slate-400 font-mono italic">
                            {new Date(hist.date_changement).toLocaleDateString('fr-FR')} — {new Date(hist.date_changement).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        
                        {hist.commentaire ? (
                          <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner italic text-slate-600 dark:text-slate-300 text-sm flex gap-3">
                            <FiMessageSquare className="text-blue-400 shrink-0 mt-1" />
                            <span>"{hist.commentaire}"</span>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">Étape validée par nos techniciens.</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Message de fin si livré */}
              {repairData.id_statut_actuel === 8 && (
                <div className="mt-12 p-6 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-dashed border-emerald-200 dark:border-emerald-700 rounded-3xl text-center">
                  <FiCheckCircle className="text-5xl text-emerald-500 mx-auto mb-3" />
                  <p className="text-emerald-800 dark:text-emerald-300 font-black uppercase">Dossier clôturé avec succès</p>
                  <p className="text-emerald-600 dark:text-emerald-400 text-sm mt-1 font-medium">L'appareil a été restitué au client.</p>
                </div>
              )}
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-20 text-slate-400 text-sm font-bold opacity-50 uppercase tracking-widest">
        QuickRepair System v2.0 — Excellence Technique
      </footer>
    </div>
  );
}