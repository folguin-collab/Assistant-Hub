import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  addDoc, 
  updateDoc, 
  getDocs 
} from 'firebase/firestore';
import { 
  Calendar, Clock, User, UserPlus, Trash2, CheckCircle, XCircle, 
  AlertCircle, Shield, Stethoscope, Users, Pencil, FileText, LayoutGrid, 
  RefreshCw, Bell, ClipboardList, Send, Filter, Check, LogOut, Lock, Mail, Key, ShieldCheck
} from 'lucide-react';

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDXrbo8NzD1PxsHlFivP8_bvTBuUdieCMU",
  authDomain: "assistanthub-15619.firebaseapp.com",
  projectId: "assistanthub-15619",
  storageBucket: "assistanthub-15619.firebasestorage.app",
  messagingSenderId: "960583553018",
  appId: "1:960583553018:web:fbc3789bf0d09957ac5e43"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'dental-assist-app-id';

// --- CONFIGURACIÓN DE INTEGRACIÓN ---
const N8N_SYNC_AGENDA_WEBHOOK_URL = "https://automatizaciones-n8n.ani4cn.easypanel.host/webhook/sincronizar-agenda-global"; 

// --- UTILITY FUNCTIONS ---
const generateTimeSlots = (startHour = 8, endHour = 20) => {
  const slots = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === endHour && m > 0) break; 
      const hour = h.toString().padStart(2, '0');
      const min = m.toString().padStart(2, '0');
      slots.push(`${hour}:${min}`);
    }
  }
  return slots;
};

const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const DAYS_OF_WEEK = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const formatCleanTime = (timeStr) => {
  if (!timeStr) return '09:00';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return timeStr;
};

const isTimeInAnyBlock = (time, blocks) => {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return false;
  const cleanTime = formatCleanTime(time);
  return blocks.some(block => {
    const start = formatCleanTime(block.start);
    const end = formatCleanTime(block.end);
    return cleanTime >= start && cleanTime < end;
  });
};

const getDayOfWeek = (dateString) => {
  if (!dateString) return new Date().getDay();
  const cleanDate = dateString.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d).getDay();
  }
  return new Date(dateString).getDay();
};

const getSlotsForDuration = (startTime, durationMinutes) => {
  if (!startTime) return [];
  const cleanTime = formatCleanTime(startTime);
  const slots = [];
  let [h, m] = cleanTime.split(':').map(Number);
  const totalSlots = Math.ceil(durationMinutes / 15);
  for (let i = 0; i < totalSlots; i++) {
    if (h >= 24) break;
    const hour = h.toString().padStart(2, '0');
    const min = m.toString().padStart(2, '0');
    slots.push(`${hour}:${min}`);
    m += 15;
    if (m >= 60) { m -= 60; h += 1; }
  }
  return slots;
};

const safeFormatDate = (dateVal) => {
    if (!dateVal) return getTodayString();
    if (typeof dateVal === 'object' && dateVal.toDate) {
        return dateVal.toDate().toISOString().split('T')[0];
    }
    if (typeof dateVal === 'string') {
        return dateVal.split('T')[0];
    }
    return dateVal;
};

const getAssistantScheduleForDay = (assistant, dayIndex) => {
  if (!assistant || !assistant.schedule) return [];
  return assistant.schedule[dayIndex] || assistant.schedule[String(dayIndex)] || [];
};

// --- AUTH SCREEN COMPONENT ---
const AuthScreen = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) {
          setError('Por favor ingresa tu nombre completo.');
          setLoading(false);
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
        const snapshot = await getDocs(usersRef);
        
        const isFirstUser = snapshot.empty;
        const initialRole = isFirstUser ? 'admin' : 'pendiente';
        const initialStatus = isFirstUser ? 'active' : 'pending';

        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', cred.user.uid), {
          uid: cred.user.uid,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: initialRole,
          status: initialStatus,
          createdAt: new Date().toISOString()
        });

      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Correo electrónico o contraseña incorrectos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError('Error al procesar la solicitud: ' + (err.message || ''));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        <div className="bg-blue-600 p-8 text-white text-center">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Molaria Assist<span className="text-blue-200 font-light">Hub</span></h2>
          <p className="text-xs text-blue-100 mt-1">Control Operativo y Gestión Clínica</p>
        </div>

        <div className="p-8">
          <div className="flex border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${!isRegister ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${isRegister ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Registrarse
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Dra. Diana Antelo"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@clinica.com"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña</label>
              <div className="relative">
                <Key size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-blue-600/20 mt-2"
            >
              {loading ? 'Procesando...' : isRegister ? 'Crear Cuenta' : 'Entrar al Sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- ROTATION MODAL ---
const RotationModal = ({ isOpen, onClose, assistants, selectedAssistantId, selectedDate, timeSlot, onSave }) => {
  const [assistantId, setAssistantId] = useState(selectedAssistantId || '');
  const [activity, setActivity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedAssistantId) setAssistantId(selectedAssistantId);
  }, [selectedAssistantId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assistantId || !activity.trim()) return;
    setSubmitting(true);
    const assistant = assistants.find(a => a.id === assistantId);
    await onSave({
      assistantId,
      assistantName: assistant ? assistant.name : 'Desconocida',
      date: selectedDate,
      time: timeSlot,
      activity: activity.trim(),
      timestamp: new Date().toISOString()
    });
    setActivity('');
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-amber-500 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-xl">
              <Bell className="w-6 h-6 text-white animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg font-bold">¡Hora de Salir a Rotar!</h3>
              <p className="text-xs text-amber-100">Registro obligatorio de actividades de la hora ({timeSlot})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <XCircle size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Asistente Responsable que sale a rotar:
            </label>
            <select
              value={assistantId}
              onChange={(e) => setAssistantId(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-white text-sm font-medium"
              required
            >
              <option value="" disabled>Seleccionar asistente...</option>
              {assistants.map(ast => (
                <option key={ast.id} value={ast.id}>{ast.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              ¿Qué actividades o tareas realizaste en la rotación?
            </label>
            <textarea
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="Ej: Desinfección de sillón 3, esterilización de instrumental y reordenamiento de bodega..."
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none h-28 text-sm resize-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !assistantId || !activity.trim()}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-semibold text-sm transition-colors flex items-center gap-2 shadow-md shadow-amber-500/20"
            >
              <Send size={16} />
              {submitting ? 'Guardando...' : 'Registrar Rotación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- ADMIN VIEW WITH USERS MANAGEMENT ---
const AdminView = ({ assistants, doctors, rotations, usersList }) => {
  const [activeTab, setActiveTab] = useState('assistants'); 
  const [name, setName] = useState('');
  const defaultSchedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [editingId, setEditingId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [blockStart, setBlockStart] = useState('09:00');
  const [blockEnd, setBlockEnd] = useState('13:00');
  const [docName, setDocName] = useState('');
  const [editingDocId, setEditingDocId] = useState(null);
  const [filterRotationDate, setFilterRotationDate] = useState(getTodayString());

  const handleAddBlock = () => {
    if (blockStart >= blockEnd) return;
    setSchedule(prev => ({
      ...prev,
      [selectedDay]: [...prev[selectedDay], { start: blockStart, end: blockEnd }]
    }));
  };

  const handleRemoveBlock = (day, index) => {
    setSchedule(prev => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index)
    }));
  };

  const handleSaveAssistant = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (editingId) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'assistants', editingId);
        await updateDoc(docRef, { name, schedule });
        setEditingId(null);
      } else {
        const collRef = collection(db, 'artifacts', appId, 'public', 'data', 'assistants');
        await addDoc(collRef, { name, schedule });
      }
      setName('');
      setSchedule(defaultSchedule);
    } catch (err) {
      console.error("Error saving assistant:", err);
    }
  };

  const handleEdit = (ast) => {
    setName(ast.name);
    setSchedule(ast.schedule || defaultSchedule);
    setEditingId(ast.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setName('');
    setSchedule(defaultSchedule);
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'assistants', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting assistant:", err);
    }
  };

  const handleSaveDoctor = async (e) => {
    e.preventDefault();
    if (!docName.trim()) return;
    try {
      if (editingDocId) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'doctors', editingDocId);
        await updateDoc(docRef, { name: docName });
        setEditingDocId(null);
      } else {
        const collRef = collection(db, 'artifacts', appId, 'public', 'data', 'doctors');
        await addDoc(collRef, { name: docName });
      }
      setDocName('');
    } catch (err) {
      console.error("Error saving doctor:", err);
    }
  };

  const handleEditDoctor = (d) => {
    setDocName(d.name);
    setEditingDocId(d.id);
  };

  const handleDeleteDoctor = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'doctors', id));
    } catch (err) {
      console.error("Error deleting doctor:", err);
    }
  };

  const handleDeleteRotation = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rotations', id));
    } catch (err) {
      console.error("Error deleting rotation:", err);
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), {
        role: newRole,
        status: newRole === 'pendiente' ? 'pending' : 'active'
      });
    } catch (err) {
      console.error("Error updating user role:", err);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'pending' : 'active';
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), {
        status: newStatus
      });
    } catch (err) {
      console.error("Error toggling user status:", err);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("¿Seguro que deseas eliminar este usuario del sistema?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId));
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  const filteredRotations = useMemo(() => {
    return rotations.filter(r => r.date === filterRotationDate);
  }, [rotations, filterRotationDate]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex-wrap">
        <button onClick={() => setActiveTab('assistants')} className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm ${activeTab === 'assistants' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
          <UserPlus size={16} /> Asistentes
        </button>
        <button onClick={() => setActiveTab('doctors')} className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm ${activeTab === 'doctors' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
          <Stethoscope size={16} /> Doctores
        </button>
        <button onClick={() => setActiveTab('users')} className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm ${activeTab === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
          <ShieldCheck size={16} /> Usuarios & Permisos
        </button>
        <button onClick={() => setActiveTab('rotations')} className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm ${activeTab === 'rotations' ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
          <ClipboardList size={16} /> Bitácora
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-indigo-50/50 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck size={20} className="text-indigo-600" />
                Control de Accesos y Permisos
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Aprueba cuentas y asigna roles (Admin, Doctor, Asistente) para restringir acciones críticas.</p>
            </div>
            <span className="text-xs font-semibold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full">{usersList.length} registrados</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold">
                  <th className="p-4">Usuario</th>
                  <th className="p-4">Correo</th>
                  <th className="p-4">Rol Asignado</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">No hay usuarios registrados.</td>
                  </tr>
                ) : (
                  usersList.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs">
                          {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        {u.name || 'Sin Nombre'}
                      </td>
                      <td className="p-4 text-slate-600 font-mono text-xs">{u.email}</td>
                      <td className="p-4">
                        <select
                          value={u.role || 'pendiente'}
                          onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                          className="p-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="pendiente">-- Pendiente --</option>
                          <option value="admin">Administrador (Control Total)</option>
                          <option value="doctor">Doctor(a)</option>
                          <option value="assistant">Asistente</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.status)}
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${u.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                        >
                          {u.status === 'active' ? 'Activo' : 'Pendiente'}
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Eliminar usuario"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'assistants' && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <UserPlus size={20} className="text-blue-600" />
              Agregar Nueva Asistente y Horarios
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">Nombre</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej. María Pérez" />
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
              <h4 className="font-medium text-slate-700 mb-3">Configurar Turnos</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Día</label>
                  <select value={selectedDay} onChange={(e) => setSelectedDay(parseInt(e.target.value))} className="w-full p-2 border border-slate-300 rounded-lg outline-none">
                    {DAYS_OF_WEEK.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Hora Inicio</label>
                  <input type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} step="900" className="w-full p-2 border border-slate-300 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Hora Fin</label>
                  <input type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} step="900" className="w-full p-2 border border-slate-300 rounded-lg outline-none" />
                </div>
                <div className="flex items-end">
                  <button onClick={handleAddBlock} type="button" className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition-colors text-sm">
                    + Añadir Bloque
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {DAYS_OF_WEEK.map((day, dayIndex) => {
                  const blocks = getAssistantScheduleForDay({ schedule }, dayIndex);
                  if (!blocks || blocks.length === 0) return null;
                  return (
                    <div key={dayIndex} className="flex flex-wrap items-center gap-2 bg-white p-2 border border-slate-200 rounded-md">
                      <span className="font-medium w-24 text-sm text-slate-700">{day}:</span>
                      {blocks.map((block, i) => (
                        <span key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center gap-1">
                          {block.start} - {block.end}
                          <button onClick={() => handleRemoveBlock(dayIndex, i)} className="text-red-500 hover:text-red-700"><XCircle size={14} /></button>
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              {editingId && (
                <button onClick={handleCancelEdit} type="button" className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-300 transition-colors font-medium">
                  Cancelar
                </button>
              )}
              <button onClick={handleSaveAssistant} disabled={!name.trim()} className="bg-blue-600 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                {editingId ? 'Actualizar Asistente' : 'Guardar Asistente'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <h3 className="text-lg font-semibold text-slate-800 p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Users size={20} className="text-blue-600" />
              Asistentes Configurados
            </h3>
            <div className="divide-y divide-slate-100">
              {assistants.length === 0 ? (
                <p className="p-6 text-slate-500 text-center">No hay asistentes configuradas.</p>
              ) : (
                assistants.map(ast => (
                  <div key={ast.id} className="p-4 flex items-start justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                        {ast.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 mb-1">{ast.name}</p>
                        <div className="text-xs text-slate-500 space-y-1">
                          {DAYS_OF_WEEK.map((day, i) => {
                            const blocks = getAssistantScheduleForDay(ast, i);
                            if (!blocks || blocks.length === 0) return null;
                            return (
                              <div key={i}><strong className="text-slate-600">{day}:</strong> {blocks.map(b => `${b.start}-${b.end}`).join(', ')}</div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(ast)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-full transition-colors" title="Editar">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => handleDelete(ast.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors" title="Eliminar">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'doctors' && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Stethoscope size={20} className="text-blue-600" />
              Agregar Nuevo Doctor(a)
            </h3>
            <form onSubmit={handleSaveDoctor} className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-600 mb-1">Nombre del Doctor(a)</label>
                <input type="text" value={docName} onChange={(e) => setDocName(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej. Dra. Ana Gómez" />
              </div>
              <div className="flex gap-2">
                {editingDocId && (
                  <button type="button" onClick={() => {setDocName(''); setEditingDocId(null);}} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors font-medium">
                    Cancelar
                  </button>
                )}
                <button type="submit" disabled={!docName.trim()} className="bg-blue-600 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  {editingDocId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <h3 className="text-lg font-semibold text-slate-800 p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Users size={20} className="text-blue-600" />
              Doctores Configurados
            </h3>
            <div className="divide-y divide-slate-100">
              {doctors.length === 0 ? (
                <p className="p-6 text-slate-500 text-center">No hay doctores registrados.</p>
              ) : (
                doctors.map(d => (
                  <div key={d.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                        {d.name.charAt(0)}
                      </div>
                      <p className="font-medium text-slate-800">{d.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEditDoctor(d)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-full transition-colors" title="Editar">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => handleDeleteDoctor(d.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors" title="Eliminar">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'rotations' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-amber-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardList size={20} className="text-amber-500" />
              Bitácora de Rotaciones
            </h3>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-amber-600" />
              <label className="text-sm font-medium text-slate-700">Filtrar Fecha:</label>
              <input
                type="date"
                value={filterRotationDate}
                onChange={(e) => setFilterRotationDate(e.target.value)}
                className="p-1.5 border border-slate-300 rounded-lg outline-none text-sm bg-white font-medium focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 flex justify-between items-center">
            <span>Mostrando registros para: <strong className="text-slate-800">{filterRotationDate}</strong></span>
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{filteredRotations.length} rotación(es)</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredRotations.length === 0 ? (
              <p className="p-8 text-slate-500 text-center text-sm">No hay registros de rotaciones para el {filterRotationDate}.</p>
            ) : (
              filteredRotations.map(rot => (
                <div key={rot.id} className="p-4 flex items-start justify-between hover:bg-slate-50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{rot.assistantName}</span>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">{rot.date} @ {rot.time}</span>
                    </div>
                    <p className="text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-1">{rot.activity}</p>
                    <p className="text-[10px] text-slate-400">Registrado el: {new Date(rot.timestamp).toLocaleString()}</p>
                  </div>
                  <button onClick={() => handleDeleteRotation(rot.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors" title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- DOCTOR VIEW ---
const DoctorView = ({ assistants, bookings, doctors, rawBookings, userProfile }) => {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [doctorId, setDoctorId] = useState(userProfile?.name || ''); 
  const [patientName, setPatientName] = useState('');
  const [duration, setDuration] = useState(60); 
  const [comments, setComments] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [selectedAssistantManual, setSelectedAssistantManual] = useState({});
  const [cardError, setCardError] = useState({});
  const slots = useMemo(() => generateTimeSlots(8, 20), []);

  const handleBook = async (timeSlot) => {
    if (!doctorId) { setBookingError('⚠️ Ingresa el nombre del Doctor(a).'); setTimeout(() => setBookingError(''), 3000); return; }
    if (!patientName.trim()) { setBookingError('⚠️ Ingresa el nombre del paciente.'); setTimeout(() => setBookingError(''), 3000); return; }
    setBookingError('');

    const bookingData = {
        date: selectedDate,
        time: formatCleanTime(timeSlot),
        doctorName: doctorId,
        patientName: patientName,
        duration: duration,
        comments: comments.trim(),
        assistantId: 'pendiente',
        assistantName: 'Por Asignar',
        createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), bookingData);
      setPatientName(''); setComments('');
    } catch (err) { console.error("Booking error:", err); }
  };

  // ASIGNACIÓN MANUAL INMUTABLE
  const handleAssignSelectedAssistant = async (booking) => {
    const chosenAstId = selectedAssistantManual[booking.virtualId];
    
    // Si se seleccionó una asistente específica del desplegable
    if (chosenAstId) {
      const ast = assistants.find(a => a.id === chosenAstId);
      if (!ast) return;
      try {
        // Encontramos la cita raíz en rawBookings para usar su hora original real
        const rootDoc = rawBookings.find(r => r.id === booking.id) || booking;
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id), {
          [booking.dbKeyId]: ast.id, 
          [booking.dbKeyName]: ast.name,
          last_synced_date: rootDoc.date,
          last_synced_time: rootDoc.time,
          last_synced_duration: rootDoc.duration,
          isManual: true // <-- CANDADO: Nunca será tocada por el motor automático
        });
        setCardError(prev => ({ ...prev, [booking.virtualId]: '' }));
      } catch (err) {
        console.error("Assign error:", err);
      }
      return;
    }

    // Si pulsó el botón para auto-asignar la primera disponible
    const rootDoc = rawBookings.find(r => r.id === booking.id) || booking;
    const requiredSlots = getSlotsForDuration(rootDoc.time, rootDoc.duration);
    const dayOfWeek = getDayOfWeek(rootDoc.date);

    const availableAssistants = assistants.filter(ast => {
       if (booking.siblingIdValue === ast.id) return false;

       const scheduleBlocks = getAssistantScheduleForDay(ast, dayOfWeek);
       const workingAll = requiredSlots.every(slot => isTimeInAnyBlock(slot, scheduleBlocks));
       if (!workingAll) return false;
       
       const bookedInAny = requiredSlots.some(slot => rawBookings.some(b => {
         if (b.id === booking.id) return false;
         if (b.date !== rootDoc.date) return false;
         const otherSlots = getSlotsForDuration(b.time, b.duration);
         return otherSlots.includes(slot) && (b.assistantId === ast.id || b.assistantId2 === ast.id);
       }));
       return !bookedInAny;
    });

    if (availableAssistants.length === 0) {
       setCardError(prev => ({ ...prev, [booking.virtualId]: '⚠️ No hay asistentes libres de turno para este rango.' }));
       setTimeout(() => setCardError(prev => ({ ...prev, [booking.virtualId]: '' })), 5000);
       return;
    }

    const assignedAssistant = availableAssistants[0];
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id), {
        [booking.dbKeyId]: assignedAssistant.id, 
        [booking.dbKeyName]: assignedAssistant.name,
        last_synced_date: rootDoc.date,
        last_synced_time: rootDoc.time,
        last_synced_duration: rootDoc.duration,
        isManual: true // Queda protegida como fijada
      });
      setCardError(prev => ({ ...prev, [booking.virtualId]: '' }));
    } catch (err) { console.error("Assign error:", err); }
  };

  const handleUnassign = async (booking) => {
      if (userProfile?.role !== 'admin') {
        alert("Acción restringida: Solo un Administrador puede liberar a una asistente asignada.");
        return;
      }
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id), {
          [booking.dbKeyId]: 'pendiente', 
          [booking.dbKeyName]: 'Por Asignar',
          isManual: false
        });
      } catch (err) { console.error("Unassign error:", err); }
  };

  const handleCancel = async (booking) => {
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id));
    } catch (err) { console.error("Cancel error:", err); }
  };

  const dayOfWeek = getDayOfWeek(selectedDate);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-600 mb-1">Doctor(a)</label>
            <input list="doctors-datalist" type="text" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} placeholder="Ej. Dr. Pérez" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
            <datalist id="doctors-datalist">
                {doctors.map(d => <option key={d.id} value={d.name} />)}
            </datalist>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-600 mb-1">Fecha de Consulta</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-600 mb-1">Duración</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={45}>45 minutos</option><option value={60}>1 hora</option><option value={90}>1 hora 30 min</option>
            </select>
          </div>
          <div className="flex-1 w-full relative">
            <label className="block text-sm font-medium text-slate-600 mb-1">Paciente</label>
            <input type="text" value={patientName} onChange={(e) => {setPatientName(e.target.value); setBookingError('');}} placeholder="Ej. Juan Pérez" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            {bookingError && <span className="absolute -bottom-5 left-0 text-xs text-red-500 font-medium whitespace-nowrap">{bookingError}</span>}
          </div>
        </div>
        <div className="w-full">
          <label className="block text-sm font-medium text-slate-600 mb-1">Comentarios / Procedimiento (Opcional - Escribe #doble para 2 asistentes)</label>
          <input type="text" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Ej. Cirugía compleja #doble" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <h3 className="text-lg font-semibold text-slate-800 p-6 border-b border-slate-100 bg-slate-50">Citas y Disponibilidad - {selectedDate}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {slots.map(slot => {
            const workingAssistants = assistants.filter(ast => {
              const scheduleBlocks = getAssistantScheduleForDay(ast, dayOfWeek);
              return isTimeInAnyBlock(slot, scheduleBlocks);
            });

            const occupiedAssistantsCount = rawBookings.filter(b => {
              if (b.date !== selectedDate) return false;
              const coveredSlots = getSlotsForDuration(b.time, b.duration);
              if (!coveredSlots.includes(slot)) return false;
              return (b.assistantId && b.assistantId !== 'pendiente');
            }).length;

            const availableCount = workingAssistants.length - occupiedAssistantsCount;
            const myBookingsInSlot = bookings.filter(b => b.date === selectedDate && formatCleanTime(b.time) === formatCleanTime(slot));

            let statusColor = "bg-slate-50 border-slate-200";
            if (availableCount <= 0 && workingAssistants.length > 0) statusColor = "bg-red-50 border-red-200";
            else if (availableCount > 0) statusColor = "bg-blue-50 border-blue-200 hover:shadow-md transition-shadow";

            return (
              <div key={slot} className={`p-4 rounded-xl border ${statusColor} flex flex-col justify-between`}>
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-lg text-slate-700">{slot}</span>
                  {availableCount <= 0 && workingAssistants.length > 0 ? <AlertCircle size={20} className="text-red-500" /> : null}
                </div>
                <div className="mb-3">
                  {workingAssistants.length === 0 ? (
                    <span className="text-sm text-slate-500">Nadie en turno</span>
                  ) : (
                    <span className={`text-sm font-medium ${availableCount > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {availableCount > 0 ? `${availableCount} Asistente(s) disponible(s)` : 'Turnos ocupados'}
                    </span>
                  )}
                </div>
                <div className="space-y-2 mb-3">
                  {myBookingsInSlot.map(mb => {
                   const isUnassigned = mb.assistantId === 'pendiente';
                   const cardColor = isUnassigned ? "bg-red-50 border-red-200 text-red-900" : "bg-amber-100 border-amber-200 text-amber-900";
                    return (
                      <div key={mb.virtualId} className={`${cardColor} border p-3 rounded-lg text-sm shadow-sm space-y-1.5`}>
                         <div className="flex justify-between items-center mb-1">
                           <span className="font-bold flex items-center gap-1">
                             {isUnassigned ? <AlertCircle size={15} className="text-red-600"/> : <CheckCircle size={15} className="text-green-600"/>} 
                             {mb.assistantName}
                           </span>
                         </div>
                         <div className="text-xs font-medium text-slate-800"><Stethoscope size={12} className="inline mr-1 opacity-70"/> Dr(a): {mb.doctorName}</div>
                         <div className="text-xs opacity-90"><User size={12} className="inline mr-1 opacity-70"/> Px: {mb.patientName}</div>
                         {mb.comments && <div className="text-xs opacity-80 italic flex items-start gap-1"><FileText size={12} className="mt-0.5 flex-shrink-0 opacity-70"/> <span>{mb.comments}</span></div>}
                         
                         {/* Selector manual para elegir/cambiar a CUALQUIER asistente, SIEMPRE visible en el primer slot */}
                         {mb.isFirstSlot !== false && (
                           <div className="pt-2 space-y-2 border-t border-black/5 mt-2">
                             <div className="space-y-1">
                               <label className="text-[11px] font-semibold text-slate-600 block">
                                 {isUnassigned ? 'Elegir Asistente Manual:' : 'Cambiar Asistente:'}
                               </label>
                               <select
                                 value={selectedAssistantManual[mb.virtualId] || ''}
                                 onChange={(e) => setSelectedAssistantManual(prev => ({ ...prev, [mb.virtualId]: e.target.value }))}
                                 className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white font-medium outline-none"
                               >
                                 <option value="">-- Auto-asignar libre --</option>
                                 {assistants.map(a => {
                                   const blocks = getAssistantScheduleForDay(a, dayOfWeek);
                                   const onShift = isTimeInAnyBlock(mb.time, blocks);
                                   return (
                                     <option key={a.id} value={a.id}>
                                       {a.name} {onShift ? ' (En turno)' : ' (Fuera de turno)'}
                                     </option>
                                   );
                                 })}
                               </select>
                             </div>

                             <button 
                               onClick={() => handleAssignSelectedAssistant(mb)} 
                               className="w-full py-2 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                             >
                               <Check size={14} /> {isUnassigned ? 'Asignar' : 'Actualizar'} Asistente
                             </button>

                             {cardError[mb.virtualId] && (
                               <p className="text-[11px] text-red-600 font-semibold bg-red-100 p-1.5 rounded text-center">
                                 {cardError[mb.virtualId]}
                               </p>
                             )}
                           </div>
                         )}
                         
                         {/* SEGURIDAD: Solo el Administrador puede liberar una asistente a "Pendiente" */}
                         {!isUnassigned && mb.isFirstSlot !== false && userProfile?.role === 'admin' && (
                           <button 
                             onClick={() => handleUnassign(mb)} 
                             className="w-full py-1.5 mt-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-xs font-semibold transition-colors shadow-sm flex items-center justify-center gap-1"
                           >
                             <Lock size={12} /> Liberar Asistente (Admin)
                           </button>
                         )}
                         
                         {mb.isFirstSlot !== false && userProfile?.role === 'admin' && (
                           <button onClick={() => handleCancel(mb)} className="w-full py-1 mt-1 bg-white/80 text-red-600 rounded text-xs font-semibold hover:bg-white transition-colors shadow-sm">
                             Eliminar Cita
                           </button>
                         )}
                         
                         {mb.isFirstSlot === false && (
                           <div className={`text-center text-[10px] pt-1 opacity-60 font-medium ${isUnassigned ? 'text-red-700' : 'text-amber-700'}`}>
                             Bloque en curso
                           </div>
                         )}
                      </div>
                    );
                  })}
                </div>
                {availableCount > 0 && <button onClick={() => handleBook(slot)} className="w-full py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors shadow-sm mt-auto">Agendar Asistente Manualmente</button>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- ASSISTANT VIEW ---
const AssistantView = ({ assistants, bookings, doctors, globalAgenda, rotations, onSaveRotation, userProfile }) => {
  const [selectedAssistantId, setSelectedAssistantId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [viewMode, setViewMode] = useState('personal'); 
  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSlotForModal, setCurrentSlotForModal] = useState('09:00');
  const [notifPermission, setNotifPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const lastNotifiedHour = useRef('');
  const slots = useMemo(() => generateTimeSlots(8, 20), []);

  useEffect(() => {
    if (userProfile?.name) {
      const match = assistants.find(a => a.name.toLowerCase().trim() === userProfile.name.toLowerCase().trim());
      if (match) {
        setSelectedAssistantId(match.id);
        return;
      }
    }
    if (!selectedAssistantId && assistants.length > 0) {
      setSelectedAssistantId(assistants[0].id);
    }
  }, [assistants, selectedAssistantId, userProfile]);

  const requestNotificationPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    }
  };

  const selectedAssistant = assistants.find(a => a.id === selectedAssistantId);
  const dayOfWeek = getDayOfWeek(selectedDate);
  const activeAssistants = assistants.filter(ast => {
    const blocks = getAssistantScheduleForDay(ast, dayOfWeek);
    return blocks && blocks.length > 0;
  });

  // MOTOR DE CHEQUEO HORA A HORA (09:00 - 20:00)
  useEffect(() => {
    const checkRotationHour = () => {
      const now = new Date();
      const currentHour = now.getHours();

      if (currentHour >= 9 && currentHour <= 20) {
        const hourSlot = `${currentHour.toString().padStart(2, '0')}:00`;
        const dateStr = getTodayString();

        if (lastNotifiedHour.current === `${dateStr}_${hourSlot}`) return;

        const workingAssistants = assistants.filter(ast => {
          const blocks = getAssistantScheduleForDay(ast, dayOfWeek);
          return isTimeInAnyBlock(hourSlot, blocks);
        });
        const busyCount = bookings.filter(b => b.date === dateStr && formatCleanTime(b.time) === formatCleanTime(hourSlot)).length;
        const availableCount = workingAssistants.length - busyCount;

        if (availableCount > 0) {
          lastNotifiedHour.current = `${dateStr}_${hourSlot}`;
          setCurrentSlotForModal(hourSlot);
          setIsModalOpen(true);

          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('🔔 ¡Hora de salir a rotar!', {
              body: `Son las ${hourSlot}. Hay ${availableCount} asistente(s) disponible(s). Haz clic aquí para registrar tu rotación.`,
              icon: '/favicon.ico'
            });
          }
        }
      }
    };

    const timer = setInterval(checkRotationHour, 30000);
    checkRotationHour();
    return () => clearInterval(timer);
  }, [assistants, bookings, dayOfWeek]);

  const activeDoctorsNames = useMemo(() => {
    const names = new Set(doctors.map(d => d.name));
    globalAgenda.forEach(b => {
        if (b.date === selectedDate && b.doctorName) {
            names.add(b.doctorName);
        }
    });
    return Array.from(names).sort();
  }, [doctors, globalAgenda, selectedDate]);

  const handleSyncAgenda = async () => {
      if (!N8N_SYNC_AGENDA_WEBHOOK_URL) {
          alert("Falta configurar la URL del Webhook de n8n para la sincronización.");
          return;
      }
      setIsSyncing(true);
      try {
          await fetch(N8N_SYNC_AGENDA_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fecha: selectedDate })
          });
          setTimeout(() => setIsSyncing(false), 3000);
      } catch (err) {
          console.error("Error syncing agenda:", err);
          setIsSyncing(false);
          alert("Hubo un error al conectar con n8n.");
      }
  };

  const handleManualOpenModal = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const hourSlot = currentHour >= 9 && currentHour <= 20 ? `${currentHour.toString().padStart(2, '0')}:00` : '09:00';
    setCurrentSlotForModal(hourSlot);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {notifPermission !== 'granted' && typeof Notification !== 'undefined' && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Bell className="text-amber-600 flex-shrink-0 animate-bounce" size={20} />
            <p className="text-sm text-amber-800 font-medium">
              Activa las notificaciones del navegador para recibir avisos automáticos de rotación cada hora.
            </p>
          </div>
          <button
            onClick={requestNotificationPermission}
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm whitespace-nowrap"
          >
            Activar Alertas
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-slate-600 mb-1">Soy la asistente:</label>
          <select value={selectedAssistantId} onChange={(e) => setSelectedAssistantId(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            <option value="" disabled>Seleccione...</option>
            {assistants.map(ast => <option key={ast.id} value={ast.id}>{ast.name}</option>)}
          </select>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-slate-600 mb-1">Fecha ({DAYS_OF_WEEK[dayOfWeek]}):</label>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <button
            onClick={handleManualOpenModal}
            className="w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            <ClipboardList size={18} />
            Registrar Rotación
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        <button onClick={() => setViewMode('personal')} className={`flex-1 min-w-[150px] py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${viewMode === 'personal' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}><User size={18} /> Mi Agenda</button>
        <button onClick={() => setViewMode('assistants')} className={`flex-1 min-w-[150px] py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${viewMode === 'assistants' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}><Users size={18} /> Citas con Asistencia</button>
        <button onClick={() => setViewMode('doctors')} className={`flex-1 min-w-[150px] py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${viewMode === 'doctors' ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}><LayoutGrid size={18} /> Agenda Global Completa</button>
      </div>

      {viewMode === 'personal' && selectedAssistant && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <h3 className="text-lg font-semibold text-slate-800 p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2"><Calendar size={20} className="text-blue-600" /> Agenda de {selectedAssistant.name}</h3>
          <div className="divide-y divide-slate-100">
            {slots.map(slot => {
              const blocks = getAssistantScheduleForDay(selectedAssistant, dayOfWeek);
              if (!isTimeInAnyBlock(slot, blocks)) return null;
              const slotBooking = bookings.find(b => b.date === selectedDate && formatCleanTime(b.time) === formatCleanTime(slot) && (b.assistantId === selectedAssistantId || b.assistantId2 === selectedAssistantId));
              return (
                <div key={slot} className={`p-4 flex flex-col md:flex-row md:items-start gap-4 transition-colors ${slotBooking ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                  <div className="w-24 font-bold text-slate-700 text-lg flex items-center gap-2 mt-1"><Clock size={16} className="text-slate-400" /> {slot}</div>
                  <div className="flex-1">
                    {slotBooking ? (
                      <div className="flex flex-col text-blue-800 font-medium bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 mb-1">
                            <span className="flex items-center gap-1"><Stethoscope size={16} className="text-blue-600"/> Dr(a): {slotBooking.doctorName}</span>
                            <span className="flex items-center gap-1"><User size={16} className="text-blue-600"/> Px: {slotBooking.patientName}</span>
                        </div>
                        {slotBooking.comments && (
                            <div className="text-sm mt-1 opacity-80 italic flex items-start gap-1">
                                <FileText size={14} className="mt-0.5 flex-shrink-0 text-blue-600" />
                                <span>{slotBooking.comments}</span>
                            </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-green-600 font-medium text-sm flex items-center gap-2 px-2 mt-1"><CheckCircle size={16} /> Turno Libre</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'assistants' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
           <h3 className="text-lg font-semibold text-slate-800 p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2"><Calendar size={20} className="text-blue-600" /> Agenda de Asistentes - {DAYS_OF_WEEK[dayOfWeek]}</h3>
           <div className="overflow-auto max-h-[70vh]">
             <table className="w-full min-w-max border-collapse relative">
               <thead>
                 <tr>
                   <th className="p-3 bg-slate-100 border-b border-slate-200 text-left sticky left-0 top-0 z-30 font-bold text-slate-700 w-24">Hora</th>
                   {activeAssistants.map(ast => <th key={ast.id} className="p-3 bg-slate-100 border-b border-slate-200 border-l border-slate-200 text-center font-semibold text-slate-700 min-w-[160px] sticky top-0 z-20">{ast.name}</th>)}
                 </tr>
               </thead>
               <tbody>
                 {slots.map(slot => (
                   <tr key={slot} className="hover:bg-slate-50/50">
                     <td className="p-3 border-b border-slate-100 text-slate-700 font-medium sticky left-0 bg-white z-10">{slot}</td>
                     {activeAssistants.map(ast => {
                       const blocks = getAssistantScheduleForDay(ast, dayOfWeek);
                       const isWorking = isTimeInAnyBlock(slot, blocks);
                       const booking = bookings.find(b => b.date === selectedDate && formatCleanTime(b.time) === formatCleanTime(slot) && (b.assistantId === ast.id || b.assistantId2 === ast.id));
                       return (
                         <td key={ast.id} className="p-2 border-b border-l border-slate-100 text-center align-top">
                           {!isWorking ? <div className="text-slate-300 flex justify-center mt-1"><XCircle size={16}/></div> : booking ? (
                             <div className="bg-blue-100 border border-blue-200 text-blue-900 rounded p-2 text-xs text-left shadow-sm">
                               <div className="font-bold flex items-center gap-1 mb-1 truncate"><Stethoscope size={12}/> {booking.doctorName}</div>
                               <div className="opacity-90 flex items-center gap-1 truncate"><User size={12}/> {booking.patientName}</div>
                               {booking.comments && (
                                 <div className="opacity-80 italic mt-1.5 text-[10px] leading-tight overflow-hidden text-ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={booking.comments}>
                                   - {booking.comments}
                                 </div>
                               )}
                             </div>
                           ) : <div className="text-green-500 font-medium text-xs bg-green-50 border border-green-100 rounded p-2 flex items-center justify-center gap-1"><CheckCircle size={14}/> Libre</div>}
                         </td>
                       );
                     })}
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {viewMode === 'doctors' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-slate-100 bg-indigo-50 gap-4">
               <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><LayoutGrid size={20} className="text-indigo-600" /> Agenda Global (Dentalink) - {DAYS_OF_WEEK[dayOfWeek]}</h3>
               <button onClick={handleSyncAgenda} disabled={isSyncing} className="bg-indigo-600 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm flex items-center gap-2 shadow-sm">
                  <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Sincronizando...' : 'Actualizar Agenda'}
               </button>
           </div>
           
           <div className="overflow-auto max-h-[70vh]">
             <table className="w-full min-w-max border-collapse relative table-fixed">
               <thead>
                 <tr>
                   <th className="p-2 bg-slate-100 border-b border-slate-200 text-center sticky left-0 top-0 z-30 font-bold text-slate-700 w-20 shadow-[1px_0_0_0_#e2e8f0]">Hora</th>
                   {activeDoctorsNames.map(docName => <th key={docName} className="p-2 bg-slate-100 border-b border-slate-200 border-l border-slate-200 text-center font-semibold text-slate-700 min-w-[140px] w-48 sticky top-0 z-20 truncate" title={docName}>{docName}</th>)}
                 </tr>
               </thead>
               <tbody>
                 {slots.map(slot => (
                   <tr key={slot} className="hover:bg-slate-50/50 h-8">
                     <td className="p-1 border-b border-slate-100 text-slate-700 font-medium sticky left-0 bg-white z-10 text-xs text-center shadow-[1px_0_0_0_#f1f5f9]">{slot}</td>
                     {activeDoctorsNames.map(docName => {
                       const globalAppt = globalAgenda.find(b => b.date === selectedDate && formatCleanTime(b.time) === formatCleanTime(slot) && b.doctorName === docName);
                       
                       if (!globalAppt) return <td key={docName} className="p-0 border-b border-l border-slate-100"></td>;

                       const requiresAssistant = bookings.find(b => b.date === selectedDate && formatCleanTime(b.time) === formatCleanTime(slot) && b.doctorName === docName && !b.isSecondSlot);
                       const isUnassigned = requiresAssistant ? (requiresAssistant.assistantId === 'pendiente') : false;
                       
                       let bgColor = "bg-sky-50";
                       let borderColor = "border-sky-200";
                       let textColor = "text-sky-900";
                       
                       if (requiresAssistant) {
                           bgColor = isUnassigned ? "bg-red-50" : "bg-indigo-50";
                           borderColor = isUnassigned ? "border-red-300" : "border-indigo-300";
                           textColor = isUnassigned ? "text-red-900" : "text-indigo-900";
                       }

                       return (
                         <td key={docName} className="p-0 border-l border-slate-100 align-top">
                           <div className={`w-full h-full ${bgColor} border-l-4 ${borderColor} ${globalAppt.isFirstSlot ? 'border-t border-t-slate-200' : ''}`}>
                               {globalAppt.isFirstSlot && (
                                   <div className={`p-1.5 flex flex-col justify-start h-full ${textColor}`}>
                                       <div className="font-bold text-[11px] leading-tight truncate" title={globalAppt.patientName}>{globalAppt.patientName}</div>
                                       {globalAppt.comments && (
                                           <div className="text-[10px] opacity-80 mt-0.5 leading-tight truncate" title={globalAppt.comments}>{globalAppt.comments}</div>
                                       )}
                                       {requiresAssistant && (
                                           <div className="text-[9px] opacity-70 font-bold mt-0.5 truncate">
                                               {isUnassigned ? '⚠️ Faltan Manos' : `✔ Asist: ${requiresAssistant.assistantName}`}
                                           </div>
                                       )}
                                   </div>
                               )}
                           </div>
                         </td>
                       );
                     })}
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      <RotationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        assistants={assistants}
        selectedAssistantId={selectedAssistantId}
        selectedDate={selectedDate}
        timeSlot={currentSlotForModal}
        onSave={onSaveRotation}
      />
    </div>
  );
};

// --- MAIN APP COMPONENT ---
const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [roleView, setRoleView] = useState('doctor'); 
  const [assistants, setAssistants] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [rawBookings, setRawBookings] = useState([]);
  const [globalAgenda, setGlobalAgenda] = useState([]);
  const [rotations, setRotations] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleSaveRotation = async (rotationData) => {
    try {
      const collRef = collection(db, 'artifacts', appId, 'public', 'data', 'rotations');
      await addDoc(collRef, rotationData);
    } catch (err) {
      console.error("Error saving rotation:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
      setCurrentUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  // 1. Escuchar estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      if (usr && usr.isAnonymous) {
        await signOut(auth);
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }
      setCurrentUser(usr);
      if (!usr) {
        setUserProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Escuchar perfil de usuario conectado y lista de usuarios
  useEffect(() => {
    if (!currentUser) return;

    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUser.uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile(data);
        if (data.role === 'admin') setRoleView('admin');
        else if (data.role === 'doctor') setRoleView('doctor');
        else if (data.role === 'assistant') setRoleView('assistant');
      } else {
        setUserProfile({ role: 'pendiente', status: 'pending' });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching user profile:", error);
      setLoading(false);
    });

    const usersCollRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubUsersList = onSnapshot(usersCollRef, (snap) => {
      setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubUser(); unsubUsersList(); };
  }, [currentUser]);

  // 3. Cargar datos clínicos generales de Firestore (SIN el loop de reseteo destructivo)
  useEffect(() => {
    if (!currentUser) return;

    const asstRef = collection(db, 'artifacts', appId, 'public', 'data', 'assistants');
    const unsubAssistants = onSnapshot(asstRef, (snap) => setAssistants(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => (a.name||'').localeCompare(b.name||''))));
    const docRef = collection(db, 'artifacts', appId, 'public', 'data', 'doctors');
    const unsubDoctors = onSnapshot(docRef, (snap) => setDoctors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => (a.name||'').localeCompare(b.name||''))));

    const rotRef = collection(db, 'artifacts', appId, 'public', 'data', 'rotations');
    const unsubRotations = onSnapshot(rotRef, (snap) => setRotations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => (b.timestamp||'').localeCompare(a.timestamp||''))));

    const bookRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubBookings = onSnapshot(bookRef, (snapshot) => {
      let docsList = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const idEstado = Number(data.id_estado);

        // Eliminar si es cancelada/anulada en Dentalink
        if (idEstado === 1 || idEstado === 8 || idEstado === 14 || data.bloqueo_anulado) {
           deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', docSnap.id)).catch(()=>{});
           return;
        }

        const fechaCorregida = safeFormatDate(data.date);
        const durationNum = Number(data.duration) || 15;
        const cleanTimeStr = formatCleanTime(data.time);

        docsList.push({ 
          id: docSnap.id, 
          ...data, 
          time: cleanTimeStr, 
          date: fechaCorregida, 
          duration: durationNum,
          isManual: data.isManual === true 
        });
      });
      setRawBookings(docsList);
    });

    const agendaRef = collection(db, 'artifacts', appId, 'public', 'data', 'agenda_global');
    const unsubGlobalAgenda = onSnapshot(agendaRef, (snapshot) => {
      let expandedGlobal = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const fechaCorregida = safeFormatDate(data.date);
        const durationNum = Number(data.duration) || 15;
        const cleanTimeStr = formatCleanTime(data.time);
        const baseBooking = { id: docSnap.id, ...data, time: cleanTimeStr, date: fechaCorregida, duration: durationNum };
        
        if (baseBooking.time) {
          const slotsCovered = getSlotsForDuration(baseBooking.time, durationNum);
          slotsCovered.forEach((slotTime, index) => {
            expandedGlobal.push({ ...baseBooking, time: slotTime, isFirstSlot: index === 0, virtualId: `${docSnap.id}_global_${index}` });
          });
        }
      });
      setGlobalAgenda(expandedGlobal);
    });

    return () => { unsubAssistants(); unsubDoctors(); unsubBookings(); unsubGlobalAgenda(); unsubRotations(); };
  }, [currentUser]);

  // EXPANDIR CITAS A SLOTS DE 15 MINUTOS PARA LA VISTA
  const expandedBookings = useMemo(() => {
    let result = [];
    rawBookings.forEach(data => {
      const durationNum = Number(data.duration) || 15;
      const isDoble = typeof data.comments === 'string' && data.comments.toLowerCase().includes('#doble');
      if (data.time) {
        const slotsCovered = getSlotsForDuration(data.time, durationNum);
        slotsCovered.forEach((slotTime, index) => {
          result.push({ 
              ...data, time: slotTime, isFirstSlot: index === 0, virtualId: `${data.id}_1_${index}`,
              assistantId: data.assistantId || 'pendiente', assistantName: data.assistantName || 'Por Asignar',
              dbKeyId: 'assistantId', dbKeyName: 'assistantName', siblingIdValue: data.assistantId2 
          });

          if (isDoble) {
              result.push({ 
                  ...data, time: slotTime, isFirstSlot: index === 0, virtualId: `${data.id}_2_${index}`,
                  assistantId: data.assistantId2 || 'pendiente', assistantName: data.assistantName2 || 'Por Asignar',
                  dbKeyId: 'assistantId2', dbKeyName: 'assistantName2', siblingIdValue: data.assistantId 
              });
          }
        });
      }
    });
    return result;
  }, [rawBookings]);

  // MOTOR DE AUTO-ASIGNACIÓN (SOLO PARA CITAS PENDIENTES, NUNCA TOCA CITAS MANUALES NI ASIGNADAS)
  useEffect(() => {
    if (assistants.length === 0 || rawBookings.length === 0) return;

    let simulatedBookings = rawBookings.map(b => ({ ...b }));

    for (let i = 0; i < simulatedBookings.length; i++) {
      let pendingDoc = simulatedBookings[i];
      const isDoble = typeof pendingDoc.comments === 'string' && pendingDoc.comments.toLowerCase().includes('#doble');
      const needsFirst = !pendingDoc.assistantId || pendingDoc.assistantId === 'pendiente';
      const needsSecond = isDoble && (!pendingDoc.assistantId2 || pendingDoc.assistantId2 === 'pendiente');

      // REGLA DE ORO: Si fue asignada manualmente o ya tiene asistente, el robot NO la toca
      if (pendingDoc.isManual || (!needsFirst && !needsSecond)) continue;

      const dbKeyId = needsFirst ? 'assistantId' : 'assistantId2';
      const dbKeyName = needsFirst ? 'assistantName' : 'assistantName2';
      const siblingIdValue = needsFirst ? pendingDoc.assistantId2 : pendingDoc.assistantId;

      const requiredSlots = getSlotsForDuration(pendingDoc.time, pendingDoc.duration);
      const dayOfWeek = getDayOfWeek(pendingDoc.date);

      const availableAssistants = assistants.filter(ast => {
        if (siblingIdValue === ast.id) return false;

        const scheduleBlocks = getAssistantScheduleForDay(ast, dayOfWeek);
        const workingAll = requiredSlots.every(slot => isTimeInAnyBlock(slot, scheduleBlocks));
        if (!workingAll) return false;

        const bookedInAny = requiredSlots.some(slot => 
          simulatedBookings.some(otherDoc => {
            if (otherDoc.id === pendingDoc.id) return false;
            if (otherDoc.date !== pendingDoc.date) return false;

            const otherSlots = getSlotsForDuration(otherDoc.time, otherDoc.duration);
            const overlaps = otherSlots.includes(slot);
            if (!overlaps) return false;

            return (otherDoc.assistantId && otherDoc.assistantId === ast.id) ||
                   (otherDoc.assistantId2 && otherDoc.assistantId2 === ast.id);
          })
        );

        return !bookedInAny;
      });

      if (availableAssistants.length > 0) {
        const assignedAssistant = availableAssistants[0];

        pendingDoc[dbKeyId] = assignedAssistant.id;
        pendingDoc[dbKeyName] = assignedAssistant.name;

        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', pendingDoc.id), {
          [dbKeyId]: assignedAssistant.id,
          [dbKeyName]: assignedAssistant.name,
          last_synced_date: pendingDoc.date,
          last_synced_time: pendingDoc.time,
          last_synced_duration: pendingDoc.duration,
          isManual: false
        }).catch((err) => console.error("Error auto-assigning:", err));
      }
    }
  }, [rawBookings, assistants]);

  // PANTALLA 1: No autenticado
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={() => setLoading(false)} />;
  }

  // PANTALLA 2: Cargando sesión
  if (loading || !userProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-blue-600 font-medium">
        Cargando Sistema Clínico...
      </div>
    );
  }

  // PANTALLA 3: Cuenta pendiente de aprobación
  if (userProfile.status !== 'active') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-200">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Cuenta en Espera de Aprobación</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Hola <strong>{userProfile.name || currentUser.email}</strong>. Tu cuenta ha sido registrada con éxito, pero requiere que el <strong>Administrador de la clínica</strong> te asigne un rol y apruebe tu acceso.
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  const roleBadgeColor = {
    admin: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    doctor: 'bg-blue-100 text-blue-800 border-blue-200',
    assistant: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  }[userProfile.role] || 'bg-slate-100 text-slate-800';

  const roleLabel = {
    admin: 'Administrador',
    doctor: 'Doctor(a)',
    assistant: 'Asistente'
  }[userProfile.role] || 'Usuario';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700">
            <Stethoscope size={24} />
            <h1 className="text-xl font-bold tracking-tight">Molaria Assist<span className="text-blue-400 font-light">Hub</span></h1>
          </div>

          <div className="flex items-center gap-3">
            {userProfile.role === 'admin' ? (
              <div className="hidden sm:flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setRoleView('admin')} className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1 ${roleView === 'admin' ? 'bg-white shadow-sm text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'}`}><Shield size={14} /> Admin</button>
                <button onClick={() => setRoleView('doctor')} className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1 ${roleView === 'doctor' ? 'bg-white shadow-sm text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'}`}><Stethoscope size={14} /> Doctor</button>
                <button onClick={() => setRoleView('assistant')} className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1 ${roleView === 'assistant' ? 'bg-white shadow-sm text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'}`}><User size={14} /> Asistente</button>
              </div>
            ) : null}

            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-800 leading-tight">{userProfile.name || currentUser.email}</p>
                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleBadgeColor}`}>
                  {roleLabel}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {userProfile.role === 'admin' && (
          <>
            {roleView === 'admin' && <AdminView assistants={assistants} doctors={doctors} rotations={rotations} usersList={usersList} />}
            {roleView === 'doctor' && <DoctorView assistants={assistants} bookings={expandedBookings} doctors={doctors} rawBookings={rawBookings} userProfile={userProfile} />}
            {roleView === 'assistant' && (
              <AssistantView
                assistants={assistants}
                bookings={expandedBookings}
                doctors={doctors}
                globalAgenda={globalAgenda}
                rotations={rotations}
                onSaveRotation={handleSaveRotation}
                userProfile={userProfile}
              />
            )}
          </>
        )}

        {userProfile.role === 'doctor' && (
          <DoctorView assistants={assistants} bookings={expandedBookings} doctors={doctors} rawBookings={rawBookings} userProfile={userProfile} />
        )}

        {userProfile.role === 'assistant' && (
          <AssistantView
            assistants={assistants}
            bookings={expandedBookings}
            doctors={doctors}
            globalAgenda={globalAgenda}
            rotations={rotations}
            onSaveRotation={handleSaveRotation}
            userProfile={userProfile}
          />
        )}
      </main>
    </div>
  );
};

export default App;
