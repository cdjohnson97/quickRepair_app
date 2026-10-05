import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Platform, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../supabaseClient';

// Sur iOS, react-native-maps utilise Apple Maps nativement (aucune clé API requise).
// Sur Android, il faudrait une clé Google Maps API : on reste sur une simple liste pour l'instant.
let MapView = null;
let Marker = null;
if (Platform.OS === 'ios') {
  // eslint-disable-next-line global-require
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
}

export default function BoutiquesScreen({ navigation }) {
  const [boutiques, setBoutiques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [focusedId, setFocusedId] = useState(null);
  const mapRef = useRef(null);

  const fetchBoutiques = useCallback(async () => {
    const { data } = await supabase.from('boutiques').select('*');
    setBoutiques(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchBoutiques();
  }, [fetchBoutiques]);

  // Cadre automatiquement toutes les boutiques dès qu'elles sont chargées.
  useEffect(() => {
    if (Platform.OS === 'ios' && mapRef.current && boutiques.length > 0) {
      mapRef.current.fitToCoordinates(
        boutiques.map((b) => ({ latitude: b.latitude, longitude: b.longitude })),
        { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true }
      );
    }
  }, [boutiques]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBoutiques();
  };

  const openBoutique = (boutique) => navigation.navigate('BoutiqueTeam', { boutique });

  // Tap sur la liste : anime la carte vers la boutique choisie avant d'ouvrir son équipe,
  // pour que le lien liste ↔ carte soit visible plutôt qu'une navigation instantanée.
  const focusAndOpen = (boutique) => {
    setFocusedId(boutique.id_boutique);
    if (Platform.OS === 'ios' && mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: boutique.latitude, longitude: boutique.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
        450
      );
      setTimeout(() => openBoutique(boutique), 500);
    } else {
      openBoutique(boutique);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
        <Text className="text-2xl font-extrabold text-slate-800">Boutiques</Text>
        <TouchableOpacity onPress={() => navigation.navigate('NewBoutique')} className="bg-blue-600 w-10 h-10 rounded-full items-center justify-center">
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {Platform.OS === 'ios' && MapView && boutiques.length > 0 && (
        <MapView
          ref={mapRef}
          style={{ height: 220, marginHorizontal: 20, borderRadius: 16, marginBottom: 12 }}
          initialRegion={{
            latitude: boutiques[0].latitude,
            longitude: boutiques[0].longitude,
            latitudeDelta: 5,
            longitudeDelta: 5
          }}
        >
          {boutiques.map((b) => (
            <Marker
              key={b.id_boutique}
              coordinate={{ latitude: b.latitude, longitude: b.longitude }}
              title={b.nom}
              description={b.ville}
              pinColor={focusedId === b.id_boutique ? '#2563eb' : undefined}
              onPress={() => setFocusedId(b.id_boutique)}
              onCalloutPress={() => openBoutique(b)}
            />
          ))}
        </MapView>
      )}

      <FlatList
        data={boutiques}
        keyExtractor={(item) => String(item.id_boutique)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => focusAndOpen(item)}
            activeOpacity={0.7}
            className={`bg-white rounded-2xl border p-4 mb-3 flex-row items-center justify-between shadow-sm ${focusedId === item.id_boutique ? 'border-blue-400' : 'border-slate-200'}`}
          >
            <View className="flex-1">
              <Text className="font-bold text-slate-800 text-base">{item.nom}</Text>
              <Text className="text-sm text-slate-500 mt-0.5">{item.adresse}, {item.ville}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#cbd5e1" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={!loading && (
          <View className="flex-1 items-center justify-center pt-16">
            <Text className="text-center text-slate-400 italic">Aucune boutique pour le moment.</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
