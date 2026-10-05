import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCamera } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

// Modale "Mon profil" : upload de la photo de profil, ouverte depuis la nav.
export default function ProfileModal({ isOpen, onClose }) {
  const { user, userData, refreshUserData } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  if (!userData) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return Swal.fire('Fichier invalide', 'Merci de choisir une image.', 'warning');
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/photo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('employes')
        .update({ avatar_url: avatarUrl })
        .eq('id_employe', userData.id_employe);

      if (dbError) throw dbError;

      refreshUserData();
      Swal.fire({ icon: 'success', title: 'Photo mise à jour', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Erreur', err.message || "L'envoi de la photo a échoué.", 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="bg-slate-800 dark:bg-slate-950 p-5 text-white flex justify-between items-center">
              <h2 className="font-bold text-lg">Mon profil</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-700/50 p-2 rounded-full transition">
                <FiX />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar url={userData.avatar_url} name={`${userData.prenom} ${userData.nom}`} size={96} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Changer la photo"
                  className="absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-md transition disabled:opacity-50"
                >
                  <FiCamera size={16} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-800 dark:text-slate-100">{userData.prenom} {userData.nom}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{userData.role}</p>
              </div>
              {uploading && <p className="text-xs text-slate-400 italic">Envoi en cours...</p>}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
