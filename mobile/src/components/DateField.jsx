import { useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toISODate } from '../utils/calendarEvents';

// Champ de date cross-plateforme : ouvre le sélecteur natif (roulette dans une feuille sur iOS,
// dialogue natif sur Android). `value`/`onChange` manipulent des chaînes ISO (YYYY-MM-DD).
export default function DateField({ label, value, onChange, minimumDate }) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const dateValue = value ? new Date(value) : new Date();

  const openPicker = () => {
    setTempDate(dateValue);
    setShow(true);
  };

  const handleAndroidChange = (event, selectedDate) => {
    setShow(false);
    if (event.type !== 'dismissed' && selectedDate) onChange(toISODate(selectedDate));
  };

  return (
    <View className="flex-1">
      {label && <Text className="text-xs font-semibold text-slate-500 mb-1">{label}</Text>}
      <TouchableOpacity onPress={openPicker} className="border border-slate-300 rounded-lg px-3 py-2.5 bg-white">
        <Text className="text-sm text-slate-700">{dateValue.toLocaleDateString('fr-FR')}</Text>
      </TouchableOpacity>

      {show && Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide" visible={show} onRequestClose={() => setShow(false)}>
          <View className="flex-1 justify-end bg-black/30">
            <View className="bg-white rounded-t-2xl p-4">
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                minimumDate={minimumDate ? new Date(minimumDate) : undefined}
                onChange={(_, selectedDate) => selectedDate && setTempDate(selectedDate)}
              />
              <TouchableOpacity
                onPress={() => { onChange(toISODate(tempDate)); setShow(false); }}
                className="bg-blue-600 rounded-lg py-3 items-center mt-2"
              >
                <Text className="text-white font-bold">Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={dateValue}
            mode="date"
            display="default"
            minimumDate={minimumDate ? new Date(minimumDate) : undefined}
            onChange={handleAndroidChange}
          />
        )
      )}
    </View>
  );
}
