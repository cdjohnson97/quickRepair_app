import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { apiClient } from '../../apiClient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { FiTool, FiClock, FiCheckCircle, FiTrendingUp, FiPieChart, FiPlus, FiX, FiSearch, FiUser, FiCheck, FiPrinter, FiAlertCircle, FiMessageSquare, FiFileText, FiKey, FiRefreshCw, FiArrowLeft } from 'react-icons/fi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';
import emailjs from '@emailjs/browser';
import { getStatusBadgeColor, STATUS_COLORS } from '../../constants/statuts';
import MessageThread from '../../components/MessageThread';
import { playNotificationSound } from '../../utils/notificationSound';
import { useOnlineStatus } from '../../context/PresenceContext';
import { useTypingIndicator } from '../../hooks/useTypingIndicator';
import Avatar from '../../components/Avatar';
import TypingDots from '../../components/TypingDots';
import { formatLastSeen } from '../../utils/lastSeen';
import { fireMessageToast } from '../../utils/messageToast';
import { addDays, toISODate, formatDateRangeFr, fetchEventsForEmployees, createEvent, deleteEventsByReparation, getAvailability } from '../../utils/calendarEvents';
import { sendPushNotification } from '../../utils/pushNotifications';
import { getStatusLine } from '../../utils/statusLine';
import TeamAvailabilityGrid from '../../components/calendar/TeamAvailabilityGrid';

export default function ManagerDashboard() {
  const { userData } = useAuth();
  const { onlineIds } = useOnlineStatus();
  const typingIds = useTypingIndicator(userData?.id_employe);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  
  // --- ÉTATS CRÉATION TICKET ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [techniciens, setTechniciens] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ nom: '', prenom: '', email: '', telephone: '', marque: '', modele: '', description: '', id_technicien: '', duree: '1' });

  // --- ÉTATS SUIVI ATELIER ---
  const [reparationsList, setReparationsList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [techFilter, setTechFilter] = useState('ALL');

  // --- ÉTATS DÉTAIL RÉPARATION (lecture seule) ---
  const [selectedRepairDetail, setSelectedRepairDetail] = useState(null);
  const [repairHistory, setRepairHistory] = useState([]);

  // --- ÉTAT FICHE TECHNICIEN ---
  const [selectedTechnicien, setSelectedTechnicien] = useState(null);
  const [unreadByTech, setUnreadByTech] = useState({});
  const [resettingPassword, setResettingPassword] = useState(false);
  const selectedTechnicienIdRef = useRef(null);
  const techniciensRef = useRef([]);
  const techStatsRef = useRef([]);

  // --- ÉTAT MESSAGERIE AVEC L'ADMINISTRATION ---
  const [admins, setAdmins] = useState([]);
  const [unreadByAdmin, setUnreadByAdmin] = useState({});
  const [isAdminMessagesOpen, setIsAdminMessagesOpen] = useState(false);
  const [activeAdmin, setActiveAdmin] = useState(null);
  const activeAdminIdRef = useRef(null);
  const adminsRef = useRef([]);

  useEffect(() => {
    activeAdminIdRef.current = activeAdmin?.id_employe ?? null;
  }, [activeAdmin]);

  useEffect(() => {
    adminsRef.current = admins;
  }, [admins]);

  useEffect(() => {
    selectedTechnicienIdRef.current = selectedTechnicien?.technicien.id_employe ?? null;
  }, [selectedTechnicien]);

  useEffect(() => {
    techniciensRef.current = techniciens;
  }, [techniciens]);

  // --- ÉTATS POUR LA FACTURATION ---
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedRepairForInvoice, setSelectedRepairForInvoice] = useState(null);
  const [invoiceData, setInvoiceData] = useState({ amount: '', paymentMethod: 'CB' });
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const sigCanvas = useRef({});

  useEffect(() => {
    if (userData?.id_boutique) fetchDashboardData();
  }, [userData]);

  // --- MESSAGERIE : compteur de non-lus par technicien ---
  const fetchUnreadByTech = async () => {
    if (!userData?.id_employe) return;
    const { data } = await supabase
      .from('messages')
      .select('id_expediteur')
      .eq('id_destinataire', userData.id_employe)
      .eq('lu', false);

    const counts = {};
    (data || []).forEach(m => { counts[m.id_expediteur] = (counts[m.id_expediteur] || 0) + 1; });
    setUnreadByTech(counts);
  };

  // --- MESSAGERIE : administrateurs (contacts globaux, non liés à une boutique) ---
  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    const { data } = await supabase
      .from('employes')
      .select('id_employe, prenom, nom, avatar_url, last_seen')
      .eq('role', 'Administrateur');
    setAdmins(data || []);
  };

  const fetchUnreadByAdmin = async () => {
    if (!userData?.id_employe) return;
    const { data } = await supabase
      .from('messages')
      .select('id_expediteur')
      .eq('id_destinataire', userData.id_employe)
      .eq('lu', false);

    const adminIds = new Set(adminsRef.current.map(a => a.id_employe));
    const counts = {};
    (data || []).forEach(m => { if (adminIds.has(m.id_expediteur)) counts[m.id_expediteur] = (counts[m.id_expediteur] || 0) + 1; });
    setUnreadByAdmin(counts);
  };

  const openAdminMessages = () => {
    setIsAdminMessagesOpen(true);
    setActiveAdmin(null);
  };

  const openAdminThread = (admin) => {
    setActiveAdmin(admin);
    setUnreadByAdmin((prev) => ({ ...prev, [admin.id_employe]: 0 }));
  };

  const totalUnreadFromAdmins = Object.values(unreadByAdmin).reduce((sum, n) => sum + n, 0);

  // --- RÉINITIALISATION DU MOT DE PASSE D'UN TECHNICIEN ---
  const resetTechnicienPassword = async (technicien) => {
    const result = await Swal.fire({
      title: 'Réinitialiser le mot de passe ?',
      text: `${technicien.prenom} ${technicien.nom} recevra un nouveau mot de passe temporaire.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Réinitialiser',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#2563eb'
    });
    if (!result.isConfirmed) return;

    setResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-employee-password', {
        body: { id_employe: technicien.id_employe }
      });

      if (error) {
        let detail = error.message;
        try {
          const body = await error.context.json();
          if (body?.error) detail = body.error;
        } catch {
          // pas de corps JSON exploitable, on garde le message générique
        }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);

      const tempPassword = data.password;

      await supabase.from('messages').insert([{
        id_expediteur: userData.id_employe,
        id_destinataire: technicien.id_employe,
        contenu: `Votre mot de passe a été réinitialisé. Nouveau mot de passe temporaire : ${tempPassword}. Vous devrez le changer à votre prochaine connexion.`
      }]);

      Swal.fire({
        icon: 'success',
        title: 'Mot de passe réinitialisé',
        html: `Le nouveau mot de passe a été envoyé par message à ${technicien.prenom}.<br/><span style="font-size:0.85rem;color:#64748b;">Mot de passe temporaire : ${tempPassword}</span>`,
        confirmButtonColor: '#2563eb'
      });
    } catch (err) {
      Swal.fire('Erreur', err.message || "La réinitialisation a échoué.", 'error');
    } finally {
      setResettingPassword(false);
    }
  };

  useEffect(() => {
    if (!userData?.id_employe) return;
    fetchUnreadByTech();
    fetchUnreadByAdmin();

    const channel = supabase
      .channel('manager-messages-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `id_destinataire=eq.${userData.id_employe}` },
        (payload) => {
          const senderId = payload.new.id_expediteur;
          const techSender = techniciensRef.current.find(t => t.id_employe === senderId);

          if (techSender) {
            fetchUnreadByTech();
            playNotificationSound();
            if (senderId === selectedTechnicienIdRef.current) return;

            fireMessageToast(techSender, payload.new.contenu, () => {
              const stats = techStatsRef.current.find(s => s.technicien.id_employe === senderId);
              if (stats) setSelectedTechnicien(stats);
            });
            return;
          }

          const adminSender = adminsRef.current.find(a => a.id_employe === senderId);
          if (adminSender) {
            fetchUnreadByAdmin();
            playNotificationSound();
            if (senderId === activeAdminIdRef.current) return;

            fireMessageToast(adminSender, payload.new.contenu, () => {
              setIsAdminMessagesOpen(true);
              openAdminThread(adminSender);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userData]);

  // --- CALENDRIER : disponibilité de l'équipe (aujourd'hui + fenêtre de 90 jours pour les conflits d'assignation) ---
  const [teamEvents, setTeamEvents] = useState([]);

  const fetchTeamEvents = async () => {
    if (techniciens.length === 0) return;
    const data = await fetchEventsForEmployees(techniciens.map(t => t.id_employe), new Date(), addDays(new Date(), 90));
    setTeamEvents(data);
  };

  useEffect(() => {
    fetchTeamEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [techniciens]);

  // --- RAPPEL : bloc "réparation" arrivant à échéance sans que le ticket soit clôturé ---
  const expiringCheckedRef = useRef(false);

  const checkExpiringRepairs = () => {
    const todayIso = toISODate(new Date());
    const yesterdayIso = toISODate(addDays(new Date(), -1));

    const expiring = teamEvents
      .filter(ev => ev.type === 'reparation' && ev.id_reparation && (ev.date_fin === todayIso || ev.date_fin === yesterdayIso))
      .map(ev => reparationsList.find(r => r.id_reparation === ev.id_reparation))
      .filter(rep => rep && ![6, 8].includes(rep.id_statut_actuel));

    if (expiring.length === 0) return;

    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 8000, timerProgressBar: true });
    Toast.fire({
      icon: 'warning',
      title: 'Réparations en retard possible',
      html: expiring.map(rep => `Ticket <b>${rep.numero_suivi}</b> (${rep.employes?.prenom || ''} ${rep.employes?.nom || ''}) devait être terminé`).join('<br/>')
    });
  };

  useEffect(() => {
    if (expiringCheckedRef.current) return;
    if (teamEvents.length === 0 && techniciens.length === 0) return;
    expiringCheckedRef.current = true;
    checkExpiringRepairs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamEvents]);

  const stats = useMemo(() => ({
    total: reparationsList.length,
    enCours: reparationsList.filter(r => r.id_statut_actuel === 5).length,
    terminees: reparationsList.filter(r => [6, 8].includes(r.id_statut_actuel)).length,
  }), [reparationsList]);

  // Charge de travail par technicien : dérivée de reparationsList, déjà chargée (pas de requête en plus).
  const techStats = useMemo(() => {
    const map = new Map();
    techniciens.forEach(t => map.set(t.id_employe, { technicien: t, total: 0, terminees: 0, restantes: 0 }));
    reparationsList.forEach(rep => {
      const entry = map.get(rep.id_technicien);
      if (!entry) return;
      entry.total += 1;
      if ([6, 8].includes(rep.id_statut_actuel)) entry.terminees += 1;
      else entry.restantes += 1;
    });
    return Array.from(map.values());
  }, [techniciens, reparationsList]);

  useEffect(() => {
    techStatsRef.current = techStats;
  }, [techStats]);

  const evolutionData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      return { key: `${d.getFullYear()}-${d.getMonth()}`, mois: label.charAt(0).toUpperCase() + label.slice(1), reparations: 0 };
    });

    reparationsList.forEach(rep => {
      const d = new Date(rep.date_prise_en_charge);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = months.find(m => m.key === key);
      if (bucket) bucket.reparations += 1;
    });

    return months.map(({ mois, reparations }) => ({ mois, reparations }));
  }, [reparationsList]);

  const statusData = useMemo(() => {
    const counts = new Map();
    reparationsList.forEach(rep => {
      const idStatut = rep.id_statut_actuel;
      if (!counts.has(idStatut)) {
        counts.set(idStatut, { name: rep.statuts?.libelle || 'Inconnu', value: 0, idStatut });
      }
      counts.get(idStatut).value += 1;
    });
    return Array.from(counts.values()).sort((a, b) => a.idStatut - b.idStatut);
  }, [reparationsList]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: techs } = await supabase.from('employes').select('id_employe, nom, prenom, email, telephone, avatar_url, last_seen, push_token').eq('role', 'Technicien').eq('id_boutique', userData.id_boutique);
      setTechniciens(techs || []);

      if (techs && techs.length > 0) {
        // Réparations : servies par le backend NestJS (module Réparations), qui filtre
        // déjà par boutique via le JWT — plus besoin de passer la liste des techIds.
        const { data: repData } = await apiClient.get('/reparations');
        setReparationsList(repData || []);
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- DÉTAIL D'UNE RÉPARATION (lecture seule pour le manager) ---
  const openRepairDetail = async (rep) => {
    setSelectedRepairDetail(rep);
    const { data } = await apiClient.get(`/reparations/${rep.id_reparation}/history`);
    setRepairHistory(data || []);
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

  // --- EMAIL DE CONFIRMATION (EmailJS) ---
  // Non bloquant : un échec d'envoi n'annule jamais la création du ticket (déjà réussie en base à ce stade).
  const sendConfirmationEmail = async (clientInfo, numeroSuivi) => {
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
      console.warn("EmailJS non configuré (variables VITE_EMAILJS_* manquantes) : email de confirmation non envoyé.");
      return;
    }

    try {
      await emailjs.send(serviceId, templateId, {
        to_email: clientInfo.email,
        to_name: `${clientInfo.prenom} ${clientInfo.nom}`,
        tracking_number: numeroSuivi,
        device: `${clientInfo.marque} ${clientInfo.modele}`,
        description: clientInfo.description,
      }, publicKey);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email de confirmation :", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const idTechnicien = parseInt(formData.id_technicien, 10);
    const duree = parseInt(formData.duree, 10) || 1;
    const dateDebut = new Date();
    const dateFin = addDays(dateDebut, duree - 1);
    const hasConflict = teamEvents.some(ev => ev.id_employe === idTechnicien && ev.date_debut <= toISODate(dateFin) && ev.date_fin >= toISODate(dateDebut));

    if (hasConflict) {
      const conflictResult = await Swal.fire({
        title: 'Technicien déjà occupé',
        text: 'Ce technicien a déjà un événement sur cette période dans son calendrier. Assigner quand même ?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Assigner quand même',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#f59e0b'
      });
      if (!conflictResult.isConfirmed) return;
    }

    setIsSubmitting(true); const submittedData = { ...formData };
    try {
      // Client + appareil + réparation créés en une seule transaction côté backend
      // NestJS (module Réparations) ; numero_suivi est généré côté serveur.
      const { data: newRep } = await apiClient.post('/reparations', {
        clientNom: formData.nom,
        clientPrenom: formData.prenom,
        clientEmail: formData.email,
        clientTelephone: formData.telephone,
        marque: formData.marque,
        modele: formData.modele,
        descriptionPanne: formData.description,
        idTechnicien: idTechnicien
      });
      const numeroSuivi = newRep.numero_suivi;

      try {
        await createEvent({
          id_employe: idTechnicien,
          titre: `Réparation ${numeroSuivi}`,
          type: 'reparation',
          date_debut: dateDebut,
          date_fin: dateFin,
          id_reparation: newRep.id_reparation
        });
        fetchTeamEvents();
      } catch (calErr) {
        console.error('Erreur lors de la création du bloc calendrier :', calErr.message);
      }

      const assignedTech = techniciensRef.current.find(t => t.id_employe === idTechnicien);
      if (assignedTech?.push_token) {
        sendPushNotification(assignedTech.push_token, 'Nouveau ticket assigné 🛠️', `Ticket ${numeroSuivi} vous a été assigné.`, { type: 'repair', repairId: newRep.id_reparation });
      }

      setIsModalOpen(false);
      sendConfirmationEmail(submittedData, numeroSuivi);
      Swal.fire({ title: 'Ticket Créé !', html: `Numéro :<br><b style="font-size: 1.5rem; color: #2563eb;">${numeroSuivi}</b>`, icon: 'success', showCancelButton: true, confirmButtonColor: '#10b981', cancelButtonColor: '#3b82f6', confirmButtonText: 'Terminer', cancelButtonText: '📄 Télécharger le reçu' }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) generateDepositPDF(submittedData, numeroSuivi);
      });
      setFormData({ nom: '', prenom: '', email: '', telephone: '', marque: '', modele: '', description: '', id_technicien: '', duree: '1' });
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
      
      const montantTTC = parseFloat(invoiceData.amount).toFixed(2);
      const montantHT = (montantTTC / 1.20).toFixed(2);
      const tva = (montantTTC - montantHT).toFixed(2);

      // Facture + clôture du ticket (statut 8) en une transaction côté backend NestJS ;
      // numero_facture est généré côté serveur.
      const { data: facture } = await apiClient.post(`/reparations/${selectedRepairForInvoice.id_reparation}/invoice`, {
        montantTotal: parseFloat(montantTTC),
        modePaiement: invoiceData.paymentMethod
      });
      const numFacture = facture.numero_facture;

      await deleteEventsByReparation(selectedRepairForInvoice.id_reparation);
      fetchTeamEvents();

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
        <div><h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Tableau de Bord</h1><p className="text-slate-500 dark:text-slate-400 mt-1">{userData?.boutiques?.ville ? `Boutique de ${userData.boutiques.ville}` : 'Boutique'} : Vue analytique et gestion de l'équipe</p></div>
        <div className="flex gap-3">
          <button onClick={fetchDashboardData} title="Rafraîchir" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm">
            <FiRefreshCw />
          </button>
          {admins.length > 0 && (
            <button
              onClick={openAdminMessages}
              className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
              title="Messages avec l'administration"
            >
              <FiMessageSquare />
              {totalUnreadFromAdmins > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{totalUnreadFromAdmins}</span>
              )}
            </button>
          )}
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-sm hover:bg-blue-700 transition font-bold flex items-center gap-2"><FiPlus className="text-xl" /> Nouveau Ticket</button>
        </div>
      </div>

      {/* --- AUJOURD'HUI : disponibilité de l'équipe en un coup d'œil --- */}
      {techniciens.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Aujourd'hui</h3>
          <div className="flex flex-wrap gap-4">
            {techniciens.map((t) => {
              const avail = getAvailability(teamEvents, t.id_employe);
              const stats = techStatsRef.current.find(s => s.technicien.id_employe === t.id_employe);
              return (
                <button
                  key={t.id_employe}
                  onClick={() => stats && setSelectedTechnicien(stats)}
                  className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 rounded-full pl-1 pr-3 py-1 transition"
                >
                  <Avatar url={t.avatar_url} name={`${t.prenom} ${t.nom}`} size={28} online={onlineIds.has(t.id_employe)} />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t.prenom}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${avail.busy ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
                    {avail.busy ? 'Occupé' : 'Libre'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* --- KPIs --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-5 hover:shadow-md transition-shadow"><div className="p-4 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl"><FiTool className="text-2xl" /></div><div><p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Total Réparations</p><p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{stats.total}</p></div></div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-5 hover:shadow-md transition-shadow"><div className="p-4 bg-amber-50 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 rounded-xl"><FiClock className="text-2xl" /></div><div><p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">En cours / Attente</p><p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{stats.enCours}</p></div></div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-5 hover:shadow-md transition-shadow"><div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400 rounded-xl"><FiCheckCircle className="text-2xl" /></div><div><p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Terminées / Livrées</p><p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{stats.terminees}</p></div></div>
      </div>

      {/* --- ÉQUIPE TECHNIQUE --- */}
      {techStats.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><FiUser className="text-blue-500" /> Équipe technique</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {techStats.map(({ technicien, total, terminees, restantes }) => (
              <button
                key={technicien.id_employe}
                onClick={() => setSelectedTechnicien({ technicien, total, terminees, restantes })}
                className="relative text-left bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 rounded-xl p-4 transition"
              >
                {unreadByTech[technicien.id_employe] > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{unreadByTech[technicien.id_employe]}</span>
                )}
                <div className="flex items-center gap-2.5">
                  <Avatar url={technicien.avatar_url} name={`${technicien.prenom} ${technicien.nom}`} size={44} online={onlineIds.has(technicien.id_employe)} />
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">{technicien.prenom} {technicien.nom} {unreadByTech[technicien.id_employe] > 0 && <FiMessageSquare className="text-blue-500" size={13} />}</p>
                    {typingIds.has(technicien.id_employe) ? (
                      <p className="text-[11px] mt-0.5 text-blue-500 font-semibold flex items-center gap-1.5">
                        en train d'écrire <TypingDots size={4} className="bg-blue-400" />
                      </p>
                    ) : (() => {
                      const status = getStatusLine({ online: onlineIds.has(technicien.id_employe), events: teamEvents, idEmploye: technicien.id_employe, lastSeen: technicien.last_seen });
                      return <p className={`text-[11px] mt-0.5 ${status.className}`}>{status.text}</p>;
                    })()}
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">{total} réparation{total > 1 ? 's' : ''} assignée{total > 1 ? 's' : ''}</p>
                <div className="flex gap-2 mt-3">
                  <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full text-xs font-bold">{restantes} restante{restantes > 1 ? 's' : ''}</span>
                  <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full text-xs font-bold">{terminees} terminée{terminees > 1 ? 's' : ''}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- PLANNING DE L'ÉQUIPE --- */}
      {techniciens.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><FiClock className="text-blue-500" /> Planning de l'équipe</h2>
          <TeamAvailabilityGrid employees={techniciens} />
        </div>
      )}

      {/* --- GRAPHES --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2"><FiTrendingUp className="text-blue-500" /> Évolution</h2>
          {reparationsList.length === 0 ? (
            <div className="h-72 w-full flex items-center justify-center text-slate-400 font-medium text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">Pas encore de données</div>
          ) : (
            <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="colorRep" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} /><XAxis dataKey="mois" axisLine={false} tickLine={false} tick={{fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12}} allowDecimals={false} /><RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#e2e8f0' : '#0f172a' }}/><Area type="monotone" dataKey="reparations" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRep)" /></AreaChart></ResponsiveContainer></div>
          )}
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2"><FiPieChart className="text-indigo-500" /> Répartition</h2>
          {statusData.length === 0 ? (
            <div className="h-72 w-full flex items-center justify-center text-slate-400 font-medium text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">Pas encore de données</div>
          ) : (
            <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} cx="50%" cy="45%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{statusData.map((entry) => <Cell key={entry.idStatut} fill={STATUS_COLORS[entry.idStatut] || '#94a3b8'} />)}</Pie><RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#e2e8f0' : '#0f172a' }}/><Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: isDark ? '#cbd5e1' : '#475569' }} /></PieChart></ResponsiveContainer></div>
          )}
        </div>
      </div>

      {/* --- TABLEAU --- */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><FiUser className="text-blue-500" /> État Atelier</h2>
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64"><FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <select className="bg-white dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm font-medium outline-none" value={techFilter} onChange={(e) => setTechFilter(e.target.value)}><option value="ALL">Tous les techniciens</option>{techniciens.map(t => <option key={t.id_employe} value={t.id_employe}>{t.prenom} {t.nom}</option>)}</select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider"><th className="p-4 border-b dark:border-slate-700">Ticket</th><th className="p-4 border-b dark:border-slate-700">Client</th><th className="p-4 border-b dark:border-slate-700">Appareil</th><th className="p-4 border-b dark:border-slate-700">Technicien</th><th className="p-4 border-b dark:border-slate-700">Statut</th><th className="p-4 border-b dark:border-slate-700 text-right">Action</th></tr></thead>
            <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-700">
              {filteredRepairs.map(rep => (
                <tr key={rep.id_reparation} onClick={() => openRepairDetail(rep)} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition cursor-pointer">
                  <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-200">{rep.numero_suivi}</td>
                  <td className="p-4 font-medium text-slate-800 dark:text-slate-100">{rep.appareils?.clients?.prenom} {rep.appareils?.clients?.nom}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{rep.appareils?.marque} {rep.appareils?.modele}</td>
                  <td className="p-4"><span className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-md text-xs font-bold">{rep.employes?.prenom}</span></td>
                  <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${getStatusBadgeColor(rep.id_statut_actuel)}`}>{rep.statuts?.libelle}</span></td>
                  <td className="p-4 text-right">
                    {[6, 7].includes(rep.id_statut_actuel) ? (
                      <button onClick={(e) => { e.stopPropagation(); openInvoiceModal(rep); }} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg transition shadow-sm font-bold flex items-center justify-end gap-2 ml-auto"><FiPrinter /> Facturer</button>
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
             <motion.div initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="relative w-full max-w-3xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
               <div className="bg-slate-800 dark:bg-slate-950 p-6 text-white flex justify-between items-center shrink-0"><h2 className="text-2xl font-bold flex items-center gap-3"><FiPlus /> Nouveau Ticket</h2><button onClick={() => setIsModalOpen(false)} className="bg-slate-700/50 p-2 rounded-full hover:text-white transition"><FiX className="text-xl" /></button></div>
               <div className="p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                 <form onSubmit={handleSubmit} className="space-y-6">
                   <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><h3 className="text-blue-800 dark:text-blue-300 font-bold mb-4 uppercase text-sm tracking-wide">1. Client</h3><div className="grid grid-cols-2 gap-4">
                     <input required type="text" placeholder="Prénom" className="border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.prenom} onChange={(e)=>setFormData({...formData, prenom: e.target.value})} />
                     <input required type="text" placeholder="Nom" className="border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.nom} onChange={(e)=>setFormData({...formData, nom: e.target.value})} />
                     <input required type="email" placeholder="Email" className="border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.email} onChange={(e)=>setFormData({...formData, email: e.target.value})} />
                     <input required type="tel" placeholder="Téléphone" className="border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.telephone} onChange={(e)=>setFormData({...formData, telephone: e.target.value})} />
                   </div></div>
                   <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><h3 className="text-blue-800 dark:text-blue-300 font-bold mb-4 uppercase text-sm tracking-wide">2. Appareil</h3><div className="grid grid-cols-2 gap-4 mb-4">
                     <input required placeholder="Marque" type="text" className="border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.marque} onChange={(e)=>setFormData({...formData, marque: e.target.value})} />
                     <input required placeholder="Modèle" type="text" className="border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.modele} onChange={(e)=>setFormData({...formData, modele: e.target.value})} />
                   </div><textarea required placeholder="Description panne" className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-blue-500" value={formData.description} onChange={(e)=>setFormData({...formData, description: e.target.value})} /></div>
                   <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><h3 className="text-blue-800 dark:text-blue-300 font-bold mb-4 uppercase text-sm tracking-wide">3. Technicien</h3>
                     <select required className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.id_technicien} onChange={(e)=>setFormData({...formData, id_technicien: e.target.value})}><option value="">Sélectionner...</option>{techniciens.map(t => <option key={t.id_employe} value={t.id_employe}>{t.prenom} {t.nom}</option>)}</select>
                     {formData.id_technicien && (() => {
                       const avail = getAvailability(teamEvents, parseInt(formData.id_technicien, 10));
                       return (
                         <p className={`text-xs font-semibold mt-2 ${avail.busy ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                           {avail.busy ? `🟠 Occupé jusqu'au ${formatDateRangeFr(avail.until, avail.until)}` : '🟢 Disponible aujourd\'hui'}
                         </p>
                       );
                     })()}
                     <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-1">Durée estimée</label>
                     <select className="w-full border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={formData.duree} onChange={(e)=>setFormData({...formData, duree: e.target.value})}>
                       <option value="1">1 jour</option>
                       <option value="2">2 jours</option>
                       <option value="3">3 jours</option>
                       <option value="5">5 jours</option>
                     </select>
                     <p className="text-[11px] text-slate-400 mt-1">Bloque automatiquement le calendrier du technicien pour cette durée.</p>
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
            <motion.div initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="bg-emerald-600 p-6 text-white text-center relative"><button onClick={() => setIsInvoiceModalOpen(false)} className="absolute right-4 top-4 text-emerald-200 hover:text-white transition"><FiX className="text-2xl" /></button><div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"><FiCheck className="text-3xl text-white" /></div><h2 className="text-2xl font-bold">Encaissement</h2><p className="text-emerald-100 text-sm">{selectedRepairForInvoice.appareils.marque} {selectedRepairForInvoice.appareils.modele}</p></div>
              <div className="p-8 bg-slate-50 dark:bg-slate-900 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Montant TTC</label><div className="relative"><input type="number" placeholder="0.00" value={invoiceData.amount} onChange={(e) => setInvoiceData({ ...invoiceData, amount: e.target.value })} className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-emerald-500" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span></div></div>
                  <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Paiement</label><select value={invoiceData.paymentMethod} onChange={(e) => setInvoiceData({ ...invoiceData, paymentMethod: e.target.value })} className="w-full px-4 py-3 bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"><option value="CB">Carte Bancaire</option><option value="Espèces">Espèces</option><option value="Virement">Virement</option></select></div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm"><div className="flex justify-between items-center mb-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Signature Client</label><button onClick={() => sigCanvas.current.clear()} className="text-xs text-blue-500 font-semibold underline">Effacer</button></div>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 h-32 touch-none relative"><SignatureCanvas ref={sigCanvas} penColor={isDark ? '#e2e8f0' : 'black'} canvasProps={{ className: 'w-full h-full' }} /><p className="absolute bottom-2 left-0 right-0 text-center text-slate-300 dark:text-slate-600 text-xs pointer-events-none">Signez ici</p></div>
                </div>
                <button onClick={handleGenerateInvoice} disabled={isGeneratingInvoice} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2">{isGeneratingInvoice ? 'Génération...' : <><FiPrinter className="text-xl" /> Valider & Imprimer</>}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODALE DÉTAIL RÉPARATION (lecture seule) --- */}
      <AnimatePresence>
        {selectedRepairDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedRepairDetail(null)}
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
                    {selectedRepairDetail.appareils?.marque} {selectedRepairDetail.appareils?.modele}
                  </h2>
                  <p className="text-slate-300 font-mono text-sm mt-1">Ticket N° {selectedRepairDetail.numero_suivi}</p>
                </div>
                <button onClick={() => setSelectedRepairDetail(null)} className="text-slate-400 hover:text-white bg-slate-700/50 p-2 rounded-full transition">
                  <FiX className="text-xl" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row flex-grow overflow-hidden bg-slate-50 dark:bg-slate-900">
                <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Description de la panne</h3>
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-xl border border-red-100 dark:border-red-800 font-medium text-sm flex items-start gap-2">
                      <FiAlertCircle className="mt-0.5 shrink-0" />
                      <span>{selectedRepairDetail.description_panne}</span>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Informations Client</h3>
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-base">{selectedRepairDetail.appareils?.clients?.prenom} {selectedRepairDetail.appareils?.clients?.nom}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">{selectedRepairDetail.appareils?.clients?.email}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">{selectedRepairDetail.appareils?.clients?.telephone}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Technicien assigné</h3>
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{selectedRepairDetail.employes?.prenom} {selectedRepairDetail.employes?.nom}</span>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${getStatusBadgeColor(selectedRepairDetail.id_statut_actuel)}`}>{selectedRepairDetail.statuts?.libelle}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-1/2 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <FiClock /> Historique d'intervention
                  </h3>

                  {repairHistory.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Aucun changement de statut enregistré pour le moment.</p>
                  ) : (
                    <div className="space-y-4">
                      {repairHistory.map((hist) => (
                        <div key={hist.id_historique} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
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
                          <p className="text-[10px] text-slate-400 mt-2 text-right flex items-center justify-end gap-1">
                            <FiFileText /> Par {hist.employes?.prenom} {hist.employes?.nom}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODALE FICHE TECHNICIEN --- */}
      <AnimatePresence>
        {selectedTechnicien && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setSelectedTechnicien(null); fetchUnreadByTech(); }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="bg-slate-800 dark:bg-slate-950 p-6 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <Avatar
                    url={selectedTechnicien.technicien.avatar_url}
                    name={`${selectedTechnicien.technicien.prenom} ${selectedTechnicien.technicien.nom}`}
                    size={48}
                    online={onlineIds.has(selectedTechnicien.technicien.id_employe)}
                  />
                  <div>
                    <h2 className="text-2xl font-bold">{selectedTechnicien.technicien.prenom} {selectedTechnicien.technicien.nom}</h2>
                    {(() => {
                      const status = getStatusLine({ online: onlineIds.has(selectedTechnicien.technicien.id_employe), events: teamEvents, idEmploye: selectedTechnicien.technicien.id_employe, lastSeen: selectedTechnicien.technicien.last_seen, variant: 'darkHeader' });
                      return <p className={`text-sm mt-1 ${status.className}`}>{status.text}</p>;
                    })()}
                  </div>
                </div>
                <button onClick={() => { setSelectedTechnicien(null); fetchUnreadByTech(); }} className="text-slate-400 hover:text-white bg-slate-700/50 p-2 rounded-full transition">
                  <FiX className="text-xl" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-6 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedTechnicien.technicien.email || 'Email non renseigné'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedTechnicien.technicien.telephone || 'Téléphone non renseigné'}</p>
                  </div>
                  <button
                    onClick={() => resetTechnicienPassword(selectedTechnicien.technicien)}
                    disabled={resettingPassword}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition disabled:opacity-50"
                  >
                    <FiKey /> Réinitialiser le mot de passe
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedTechnicien.total}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Assignées</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-800 text-center">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{selectedTechnicien.restantes}</p>
                    <p className="text-[10px] font-bold text-amber-600/70 dark:text-amber-400/70 uppercase mt-1">Restantes</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800 text-center">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{selectedTechnicien.terminees}</p>
                    <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase mt-1">Terminées</p>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Réparations en cours</h3>
                <div className="space-y-2">
                  {reparationsList.filter(r => r.id_technicien === selectedTechnicien.technicien.id_employe && !([6, 8].includes(r.id_statut_actuel))).map(rep => (
                    <div key={rep.id_reparation} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <div>
                        <p className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{rep.numero_suivi}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-200">{rep.appareils?.marque} {rep.appareils?.modele}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${getStatusBadgeColor(rep.id_statut_actuel)}`}>{rep.statuts?.libelle}</span>
                    </div>
                  ))}
                  {selectedTechnicien.restantes === 0 && (
                    <p className="text-sm text-slate-400 italic">Aucune réparation en cours.</p>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 mt-6 flex items-center gap-2"><FiMessageSquare /> Messagerie</h3>
                <MessageThread
                  currentUserId={userData.id_employe}
                  otherUserId={selectedTechnicien.technicien.id_employe}
                  otherUserName={`${selectedTechnicien.technicien.prenom} ${selectedTechnicien.technicien.nom}`}
                  otherUserAvatar={selectedTechnicien.technicien.avatar_url}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODALE MESSAGERIE AVEC L'ADMINISTRATION --- */}
      <AnimatePresence>
        {isAdminMessagesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAdminMessagesOpen(false)}
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
                  {activeAdmin && (
                    <button onClick={() => setActiveAdmin(null)} className="text-slate-300 hover:text-white transition">
                      <FiArrowLeft className="text-xl" />
                    </button>
                  )}
                  {activeAdmin && (
                    <Avatar
                      url={activeAdmin.avatar_url}
                      name={`${activeAdmin.prenom} ${activeAdmin.nom}`}
                      size={40}
                      online={onlineIds.has(activeAdmin.id_employe)}
                    />
                  )}
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      {!activeAdmin && <FiMessageSquare />} {activeAdmin ? `${activeAdmin.prenom} ${activeAdmin.nom}` : 'Administration'}
                    </h2>
                    {activeAdmin && (
                      <p className={`text-sm mt-1 ${onlineIds.has(activeAdmin.id_employe) ? 'text-emerald-400 font-semibold' : 'text-slate-300'}`}>
                        {onlineIds.has(activeAdmin.id_employe) ? 'En ligne' : formatLastSeen(activeAdmin.last_seen)}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setIsAdminMessagesOpen(false)} className="text-slate-400 hover:text-white bg-slate-700/50 p-2 rounded-full transition">
                  <FiX className="text-xl" />
                </button>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-900">
                {activeAdmin ? (
                  <MessageThread
                    currentUserId={userData.id_employe}
                    otherUserId={activeAdmin.id_employe}
                    otherUserName={`${activeAdmin.prenom} ${activeAdmin.nom}`}
                    otherUserAvatar={activeAdmin.avatar_url}
                  />
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {admins.map((admin) => (
                      <button
                        key={admin.id_employe}
                        onClick={() => openAdminThread(admin)}
                        className="w-full flex items-center justify-between text-left bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 rounded-xl p-3 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar url={admin.avatar_url} name={`${admin.prenom} ${admin.nom}`} size={36} online={onlineIds.has(admin.id_employe)} />
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100">{admin.prenom} {admin.nom}</p>
                            <p className={`text-xs ${onlineIds.has(admin.id_employe) ? 'text-emerald-500 font-semibold' : 'text-slate-400'}`}>
                              {onlineIds.has(admin.id_employe) ? 'En ligne' : formatLastSeen(admin.last_seen)}
                            </p>
                          </div>
                        </div>
                        {unreadByAdmin[admin.id_employe] > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{unreadByAdmin[admin.id_employe]}</span>
                        )}
                      </button>
                    ))}
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