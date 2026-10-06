import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SignatureScreen from 'react-native-signature-canvas';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../supabaseClient';
import { deleteEventsByReparation } from '../../utils/calendarEvents';

const PAYMENT_METHODS = ['CB', 'Espèces', 'Virement'];

// Port de handleGenerateInvoice (ManagerDashboard.jsx web) : mêmes calculs (TTC/HT/TVA),
// même insertion dans `factures`, même clôture du ticket en "Livrée" (statut 8) + nettoyage
// du calendrier. Le reçu PDF est généré via expo-print (HTML) plutôt que jsPDF, plus fiable
// sur React Native, puis proposé au partage/enregistrement via expo-sharing.
//
// Le pavé de signature (WebView) n'est PAS mis dans un ScrollView : les deux se disputent
// les gestes tactiles et ça fait trembler l'écran pendant qu'on signe. La mise en page est
// donc en `flex` fixe plutôt que défilante.
//
// react-native-signature-canvas ne déclenche `onOK` (avec les données de l'image) que
// lorsqu'on appelle explicitement `readSignature()` sur la ref — dessiner seul ne suffit
// pas. Le bouton "Valider" appelle donc `readSignature()`, et c'est `onOK`/`onEmpty` qui
// pilote ensuite la validation et la soumission.
export default function InvoiceScreen({ route, navigation }) {
  const { repairId } = route.params;
  const [repair, setRepair] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CB');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const signatureRef = useRef(null);

  const fetchRepair = useCallback(async () => {
    const { data } = await supabase
      .from('reparations')
      .select('id_reparation, numero_suivi, description_panne, id_statut_actuel, appareils ( marque, modele, clients ( nom, prenom, email ) )')
      .eq('id_reparation', repairId)
      .single();
    setRepair(data);
    setLoading(false);
  }, [repairId]);

  useEffect(() => {
    fetchRepair();
  }, [fetchRepair]);

  const buildReceiptHtml = (numFacture, montantTTC, montantHT, tva, signature) => `
    <html>
      <body style="font-family: Helvetica, Arial, sans-serif; padding: 32px; color: #0f172a;">
        <h1 style="color: #2563eb; margin-bottom: 0;">FiXeo</h1>
        <p style="color: #64748b; margin-top: 4px;">FACTURE ACQUITTÉE</p>
        <table style="width: 100%; margin-top: 24px; font-size: 13px;">
          <tr>
            <td>
              <p><b>Facture N°</b> : ${numFacture}</p>
              <p><b>Date</b> : ${new Date().toLocaleDateString('fr-FR')}</p>
              <p><b>Ticket</b> : ${repair.numero_suivi}</p>
            </td>
            <td style="text-align: right;">
              <p><b>Client</b></p>
              <p>${repair.appareils.clients.prenom} ${repair.appareils.clients.nom}</p>
              <p>${repair.appareils.clients.email || ''}</p>
            </td>
          </tr>
        </table>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <table style="width: 100%; font-size: 13px;">
          <tr><td>Prestation de réparation - ${repair.appareils.marque} ${repair.appareils.modele}</td><td style="text-align:right;">${montantTTC} €</td></tr>
        </table>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <table style="width: 100%; font-size: 13px;">
          <tr><td>Total HT</td><td style="text-align:right;">${montantHT} €</td></tr>
          <tr><td>TVA (20%)</td><td style="text-align:right;">${tva} €</td></tr>
          <tr><td style="font-weight:bold; font-size: 16px; padding-top: 8px;">Net à payer</td><td style="text-align:right; font-weight:bold; font-size: 16px; color:#2563eb; padding-top: 8px;">${montantTTC} €</td></tr>
        </table>
        <p style="color: #10b981; font-weight: bold; margin-top: 24px;">PAYÉ PAR ${paymentMethod.toUpperCase()}</p>
        <p style="margin-top: 24px;">Signature du client :</p>
        <img src="${signature}" style="width: 200px; border: 1px solid #e2e8f0; border-radius: 8px;" />
        <p style="color: #94a3b8; font-size: 11px; margin-top: 32px;">Merci de votre confiance !</p>
      </body>
    </html>
  `;

  const submitInvoice = async (signature) => {
    setSubmitting(true);
    try {
      const numFacture = 'FAC-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 10000);
      const montantTTC = parseFloat(amount).toFixed(2);
      const montantHT = (montantTTC / 1.2).toFixed(2);
      const tva = (montantTTC - montantHT).toFixed(2);

      const { error: invoiceError } = await supabase.from('factures').insert([{
        numero_facture: numFacture,
        id_reparation: repair.id_reparation,
        montant_total: montantTTC,
        mode_paiement: paymentMethod,
        date_emission: new Date().toISOString()
      }]);
      if (invoiceError) throw invoiceError;

      await supabase.from('reparations').update({ id_statut_actuel: 8 }).eq('id_reparation', repair.id_reparation);
      await deleteEventsByReparation(repair.id_reparation);

      const { uri } = await Print.printToFileAsync({ html: buildReceiptHtml(numFacture, montantTTC, montantHT, tva, signature) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Facture ${numFacture}` });
      }

      Alert.alert('Clôturé !', 'Appareil restitué et facture générée.', [{ text: 'OK', onPress: () => navigation.popToTop() }]);
    } catch (err) {
      Alert.alert('Erreur', err.message || "La facture n'a pas pu être générée.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePressValider = () => {
    if (!amount || isNaN(amount)) {
      Alert.alert('Montant invalide', 'Merci de saisir un montant valide.');
      return;
    }
    // Déclenche la lecture du pavé : la suite se passe dans onOK / onEmpty ci-dessous.
    signatureRef.current?.readSignature();
  };

  if (loading || !repair) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-slate-50">
      <View className="flex-1 p-5">
        <View className="bg-emerald-600 rounded-2xl p-4 items-center mb-3">
          <Text className="text-white text-lg font-bold">Encaissement</Text>
          <Text className="text-emerald-100 text-sm mt-1">{repair.appareils?.marque} {repair.appareils?.modele}</Text>
        </View>

        <View className="bg-white rounded-2xl border border-slate-200 p-4 mb-3">
          <Text className="text-xs font-semibold text-slate-500 mb-1">Montant TTC</Text>
          <TextInput
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            className="border border-slate-300 rounded-lg px-3 py-3 text-lg font-bold mb-3"
          />
          <Text className="text-xs font-semibold text-slate-500 mb-1">Mode de paiement</Text>
          <View className="flex-row gap-2">
            {PAYMENT_METHODS.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setPaymentMethod(m)}
                className={`flex-1 py-2.5 rounded-lg items-center border ${paymentMethod === m ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-200'}`}
              >
                <Text className={`text-xs font-bold ${paymentMethod === m ? 'text-white' : 'text-slate-600'}`}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="bg-white rounded-2xl border border-slate-200 p-3 mb-3 flex-1">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-bold text-slate-500 uppercase">Signature client</Text>
            <TouchableOpacity onPress={() => signatureRef.current?.clearSignature()}>
              <Text className="text-xs text-blue-600 font-semibold underline">Effacer</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <SignatureScreen
              ref={signatureRef}
              onOK={(sig) => submitInvoice(sig)}
              onEmpty={() => Alert.alert('Signature manquante', 'Le client doit signer avant de valider.')}
              autoClear={false}
              descriptionText=""
              webStyle={'.m-signature-pad--footer { display: none; margin: 0; } body,html { height: 100%; }'}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handlePressValider}
          disabled={submitting}
          className={`flex-row items-center justify-center gap-2 rounded-xl py-4 shadow-sm ${submitting ? 'bg-emerald-300' : 'bg-emerald-600'}`}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-extrabold text-base">Valider & Générer le reçu</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
