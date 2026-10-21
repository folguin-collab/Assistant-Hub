import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import { Calendar, Clock, User, UserPlus, Trash2, CheckCircle, XCircle, AlertCircle, Shield, Stethoscope, Users, Pencil, FileText, LayoutGrid, RefreshCw, Bell, ClipboardList, Send, Filter } from 'lucide-react';

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

const isTimeInAnyBlock = (time, blocks) => {
  if (!blocks || blocks.length === 0) return false;
  return blocks.some(block => time >= block.start && time < block.end);
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
  const slots = [];
  let [h, m] = startTime.split(':').map(Number);
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

// --- COMPONENTS ---

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

const AdminView = ({ assistants, doctors, rotations }) => {
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

  const filteredRotations = useMemo(() => {
    return rotations.filter(r => r.date === filterRotationDate);
  }, [rotations, filterRotationDate]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
        <button onClick={() => setActiveTab('assistants')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'assistants' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}>
          <UserPlus size={18} /> Asistentes
        </button>
        <button onClick={() => setActiveTab('doctors')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'doctors' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}>
          <Stethoscope size={18} /> Doctores
        </button>
        <button onClick={() => setActiveTab('rotations')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'rotations' ? 'bg-amber-500 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}>
          <ClipboardList size={18} /> Bitácora de Rotaciones
        </button>
      </div>

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
                  const blocks = schedule[dayIndex];
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
                            const blocks = ast.schedule?.[i];
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

const DoctorView = ({ assistants, bookings, doctors, onManualAssign }) => {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [doctorId, setDoctorId] = useState(''); 
  const [patientName, setPatientName] = useState('');
  const [duration, setDuration] = useState(60); 
  const [comments, setComments] = useState('');
  const [bookingError, setBookingError] = useState('');
  const slots = useMemo(() => generateTimeSlots(8, 20), []);

  const handleBook = async (timeSlot) => {
    if (!doctorId) { setBookingError('⚠️ Ingresa el nombre del Doctor(a).'); setTimeout(() => setBookingError(''), 3000); return; }
    if (!patientName.trim()) { setBookingError('⚠️ Ingresa el nombre del paciente.'); setTimeout(() => setBookingError(''), 3000); return; }
    setBookingError('');

    const requiredSlots = getSlotsForDuration(timeSlot, duration);
    const dayOfWeek = getDayOfWeek(selectedDate);
    
    const workingAssistants = assistants.filter(ast => requiredSlots.every(slot => isTimeInAnyBlock(slot, ast.schedule?.[dayOfWeek])));

    if (workingAssistants.length === 0) {
       setBookingError('⚠️ Nadie de turno continuo en este horario.');
       setTimeout(() => setBookingError(''), 4000);
       return;
    }

    const bookingData = {
        date: selectedDate,
        time: timeSlot,
        doctorName: doctorId,
        patientName: patientName,
        duration: duration,
        comments: comments.trim(),
        createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), bookingData);
      setPatientName(''); setComments('');
    } catch (err) { console.error("Booking error:", err); }
  };

  const handleAssignToExisting = async (booking) => {
      const requiredSlots = getSlotsForDuration(booking.time, booking.duration);
      const dayOfWeek = getDayOfWeek(booking.date);

      const availableAssistants = assistants.filter(ast => {
         if (booking.siblingIdValue === ast.id) return false;

         const workingAll = requiredSlots.every(slot => isTimeInAnyBlock(slot, ast.schedule?.[dayOfWeek]));
         if (!workingAll) return false;
         
         const bookedInAny = requiredSlots.some(slot => bookings.some(b => b.date === booking.date && b.time === slot && (b.assistantId === ast.id || b.assistantId2 === ast.id) && b.id !== booking.id));
         return !bookedInAny;
      });

      if (availableAssistants.length === 0) {
         setBookingError(`⚠️ No hay asistentes libres a las ${booking.time}.`);
         setTimeout(() => setBookingError(''), 4000);
         return;
      }

      const assignedAssistant = availableAssistants[Math.floor(Math.random() * availableAssistants.length)];
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id), {
          [booking.dbKeyId]: assignedAssistant.id, 
          [booking.dbKeyName]: assignedAssistant.name
        });
      } catch (err) { console.error("Assign error:", err); }
  };

  const handleUnassign = async (booking) => {
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id), {
          [booking.dbKeyId]: 'pendiente', 
          [booking.dbKeyName]: 'Por Asignar'
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
        <h3 className="text-lg font-semibold text-slate-800 p-6 border-b border-slate-100 bg-slate-50">Citas Pendientes de Asignación - {selectedDate}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {slots.map(slot => {
            const workingAssistants = assistants.filter(ast => isTimeInAnyBlock(slot, ast.schedule?.[dayOfWeek]));
            const slotBookings = bookings.filter(b => b.date === selectedDate && b.time === slot);
            const availableCount = workingAssistants.length - slotBookings.length;
            const myBookingsInSlot = slotBookings;
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
                  {workingAssistants.length === 0 ? <span className="text-sm text-slate-500">Nadie en turno</span> : <span className={`text-sm font-medium ${availableCount > 0 ? 'text-blue-700' : 'text-red-700'}`}>{availableCount > 0 ? `${availableCount} Asistente(s) disponible(s)` : 'Turnos ocupados'}</span>}
                </div>
                <div className="space-y-2 mb-3">
                  {myBookingsInSlot.map(mb => {
                   const isUnassigned = mb.assistantId === 'pendiente';
                   const cardColor = isUnassigned ? "bg-red-50 border-red-200 text-red-900" : "bg-amber-100 border-amber-200 text-amber-900";
                    return (
                      <div key={mb.virtualId} className={`${cardColor} border p-2 rounded-lg text-sm shadow-sm`}>
                         <div className="flex justify-between items-center mb-1">
                           <span className="font-semibold flex items-center gap-1">{isUnassigned ? <AlertCircle size={14}/> : <CheckCircle size={14}/>} {mb.assistantName}</span>
                         </div>
                         <div className="text-xs mb-1 font-medium text-slate-800"><Stethoscope size={12} className="inline mr-1 opacity-70"/> Dr(a): {mb.doctorName}</div>
                         <div className="text-xs mb-1 opacity-90">Px: {mb.patientName}</div>
                         {mb.comments && <div className="text-xs mb-2 opacity-80 italic flex items-start gap-1"><FileText size={12} className="mt-0.5 flex-shrink-0 opacity-70"/> <span>{mb.comments}</span></div>}
                         
                         {isUnassigned && mb.isFirstSlot !== false && (<button onClick={() => handleAssignToExisting(mb)} className="w-full py-2 mt-2 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm">Asignar Asistente Disponible</button>)}
                         
                         {!isUnassigned && mb.isFirstSlot !== false && (<button onClick={() => handleUnassign(mb)} className="w-full py-1.5 mt-1 bg-white/80 text-orange-600 rounded text-xs font-semibold hover:bg-white transition-colors shadow-sm">Liberar Asistente</button>)}
                         
                         {mb.isFirstSlot !== false && (<button onClick={() => handleCancel(mb)} className="w-full py-1.5 mt-1 bg-white/80 text-red-600 rounded text-xs font-semibold hover:bg-white transition-colors shadow-sm">Eliminar Cita</button>)}
                         
                         {mb.isFirstSlot === false && (<div className={`text-center text-[10px] mt-1 opacity-60 font-medium ${isUnassigned ? 'text-red-700' : 'text-amber-700'}`}>Bloque en curso</div>)}
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

const AssistantView = ({ assistants, bookings, doctors, globalAgenda, rotations, onSaveRotation }) => {
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
    if (!selectedAssistantId && assistants.length > 0) {
      setSelectedAssistantId(assistants[0].id);
    }
  }, [assistants, selectedAssistantId]);

  const requestNotificationPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    }
  };

  const selectedAssistant = assistants.find(a => a.id === selectedAssistantId);
  const dayOfWeek = getDayOfWeek(selectedDate);
  const activeAssistants = assistants.filter(ast => ast.schedule?.[dayOfWeek] && ast.schedule[dayOfWeek].length > 0);

  // MOTOR DE CHEQUEO HORA A HORA (09:00 - 20:00)
  useEffect(() => {
    const checkRotationHour = () => {
      const now = new Date();
      const currentHour = now.getHours();

      if (currentHour >= 9 && currentHour <= 20) {
        const hourSlot = `${currentHour.toString().padStart(2, '0')}:00`;
        const dateStr = getTodayString();

        if (lastNotifiedHour.current === `${dateStr}_${hourSlot}`) return;

        const workingAssistants = assistants.filter(ast => isTimeInAnyBlock(hourSlot, ast.schedule?.[dayOfWeek]));
        const busyCount = bookings.filter(b => b.date === dateStr && b.time === hourSlot).length;
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
      {/* BARRA DE ESTADO DE NOTIFICACIONES */}
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
              if (!isTimeInAnyBlock(slot, selectedAssistant.schedule?.[dayOfWeek])) return null;
              const slotBooking = bookings.find(b => b.date === selectedDate && b.time === slot && (b.assistantId === selectedAssistantId || b.assistantId2 === selectedAssistantId));
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
                       const isWorking = isTimeInAnyBlock(slot, ast.schedule[dayOfWeek]);
                       const booking = bookings.find(b => b.date === selectedDate && b.time === slot && (b.assistantId === ast.id || b.assistantId2 === ast.id));
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
                       const globalAppt = globalAgenda.find(b => b.date === selectedDate && b.time === slot && b.doctorName === docName);
                       
                       if (!globalAppt) return <td key={docName} className="p-0 border-b border-l border-slate-100"></td>;

                       const requiresAssistant = bookings.find(b => b.date === selectedDate && b.time === slot && b.doctorName === docName && !b.isSecondSlot);
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

      {/* MODAL POP-UP DE REGISTRO DE ROTACIÓN */}
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

const App = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('doctor'); 
  const [assistants, setAssistants] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [rawBookings, setRawBookings] = useState([]);
  const [globalAgenda, setGlobalAgenda] = useState([]);
  const [rotations, setRotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const processingIds = useRef(new Set());

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (error) { console.error("Auth error:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (usr) => setUser(usr));
    return () => unsubscribe();
  }, []);

  // Fetch data
  useEffect(() => {
    if (!user) return;
    const asstRef = collection(db, 'artifacts', appId, 'public', 'data', 'assistants');
    const unsubAssistants = onSnapshot(asstRef, (snap) => setAssistants(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => (a.name||'').localeCompare(b.name||''))));
    const docRef = collection(db, 'artifacts', appId, 'public', 'data', 'doctors');
    const unsubDoctors = onSnapshot(docRef, (snap) => setDoctors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => (a.name||'').localeCompare(b.name||''))));

    // COBERTURA DE ROTACIONES
    const rotRef = collection(db, 'artifacts', appId, 'public', 'data', 'rotations');
    const unsubRotations = onSnapshot(rotRef, (snap) => setRotations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => (b.timestamp||'').localeCompare(a.timestamp||''))));

    // COBERTURA 1: Citas que requieren asistente (Robot Activo)
    const bookRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubBookings = onSnapshot(bookRef, (snapshot) => {
      let docsList = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const idEstado = Number(data.id_estado);

        if (idEstado === 1 || idEstado === 8 || idEstado === 14 || data.bloqueo_anulado) {
           deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', docSnap.id)).catch(()=>{});
           return;
        }

        const fechaCorregida = safeFormatDate(data.date);
        const durationNum = Number(data.duration) || 15;
        
        const isAssigned = (data.assistantId && data.assistantId !== 'pendiente') || (data.assistantId2 && data.assistantId2 !== 'pendiente');
        const changedDate = data.last_synced_date && data.last_synced_date !== fechaCorregida;
        const changedTime = data.last_synced_time && data.last_synced_time !== data.time;
        const changedDuration = data.last_synced_duration && data.last_synced_duration !== durationNum;

        if (isAssigned && (changedDate || changedTime || changedDuration)) {
             updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', docSnap.id), {
                assistantId: 'pendiente',
                assistantName: 'Por Asignar',
                assistantId2: data.assistantId2 ? 'pendiente' : null,
                assistantName2: data.assistantName2 ? 'Por Asignar' : null,
                last_synced_date: fechaCorregida,
                last_synced_time: data.time,
                last_synced_duration: durationNum
             }).catch(()=>{});
             return; 
        }

        docsList.push({ id: docSnap.id, ...data, date: fechaCorregida, duration: durationNum });
      });
      setRawBookings(docsList);
    });

    // COBERTURA 2: Agenda Global Completa (Visual Espejo)
    const agendaRef = collection(db, 'artifacts', appId, 'public', 'data', 'agenda_global');
    const unsubGlobalAgenda = onSnapshot(agendaRef, (snapshot) => {
      let expandedGlobal = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const fechaCorregida = safeFormatDate(data.date);
        const durationNum = Number(data.duration) || 15;
        const baseBooking = { id: docSnap.id, ...data, date: fechaCorregida, duration: durationNum };
        
        if (baseBooking.time) {
          const slotsCovered = getSlotsForDuration(baseBooking.time, durationNum);
          slotsCovered.forEach((slotTime, index) => {
            expandedGlobal.push({ ...baseBooking, time: slotTime, isFirstSlot: index === 0, virtualId: `${docSnap.id}_global_${index}` });
          });
        }
      });
      setGlobalAgenda(expandedGlobal);
      setLoading(false);
    });

    return () => { unsubAssistants(); unsubDoctors(); unsubBookings(); unsubGlobalAgenda(); unsubRotations(); };
  }, [user]);

  // EXPANDIR CITAS A SLOTS DE 15 MINUTOS
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

  // MOTOR DE AUTO-ASIGNACIÓN (Robustecido)
  useEffect(() => {
    if (assistants.length === 0 || rawBookings.length === 0) return;

    // Buscar una cita que tenga assistantId === 'pendiente' O assistantId2 === 'pendiente' (si es #doble)
    const pendingDoc = rawBookings.find(docData => {
      const isDoble = typeof docData.comments === 'string' && docData.comments.toLowerCase().includes('#doble');
      const needsFirst = !docData.assistantId || docData.assistantId === 'pendiente';
      const needsSecond = isDoble && (!docData.assistantId2 || docData.assistantId2 === 'pendiente');
      return needsFirst || needsSecond;
    });

    if (!pendingDoc) return;

    const isDoble = typeof pendingDoc.comments === 'string' && pendingDoc.comments.toLowerCase().includes('#doble');
    const needsFirst = !pendingDoc.assistantId || pendingDoc.assistantId === 'pendiente';
    const dbKeyId = needsFirst ? 'assistantId' : 'assistantId2';
    const dbKeyName = needsFirst ? 'assistantName' : 'assistantName2';
    const siblingIdValue = needsFirst ? pendingDoc.assistantId2 : pendingDoc.assistantId;

    const processKey = `${pendingDoc.id}_${dbKeyId}`;
    if (processingIds.current.has(processKey)) return;
    processingIds.current.add(processKey);

    const requiredSlots = getSlotsForDuration(pendingDoc.time, pendingDoc.duration);
    const dayOfWeek = getDayOfWeek(pendingDoc.date);

    // Buscar asistentes que trabajen durante TODO el bloque de la cita
    const availableAssistants = assistants.filter(ast => {
       if (siblingIdValue === ast.id) return false;

       // 1. Debe estar en turno durante TODOS los slots requeridos
       const workingAll = requiredSlots.every(slot => isTimeInAnyBlock(slot, ast.schedule?.[dayOfWeek]));
       if (!workingAll) return false;
       
       // 2. NO debe tener ninguna cita asignada en NINGUNO de los slots requeridos
       const bookedInAny = requiredSlots.some(slot => 
         rawBookings.some(otherDoc => {
           if (otherDoc.id === pendingDoc.id) return false; // ignorar la misma cita
           const otherSlots = getSlotsForDuration(otherDoc.time, otherDoc.duration);
           const overlaps = otherSlots.includes(slot) && otherDoc.date === pendingDoc.date;
           if (!overlaps) return false;
           return otherDoc.assistantId === ast.id || otherDoc.assistantId2 === ast.id;
         })
       );

       return !bookedInAny;
    });

    if (availableAssistants.length > 0) {
       const assignedAssistant = availableAssistants[Math.floor(Math.random() * availableAssistants.length)];
       
       updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', pendingDoc.id), {
           [dbKeyId]: assignedAssistant.id,
           [dbKeyName]: assignedAssistant.name,
           last_synced_date: pendingDoc.date,
           last_synced_time: pendingDoc.time,
           last_synced_duration: pendingDoc.duration
       }).then(() => {
           processingIds.current.delete(processKey);
       }).catch((err) => {
           console.error("Auto-assign error:", err);
           processingIds.current.delete(processKey);
       });
    } else {
       // Liberar el bloqueo tras un par de segundos para reintentar si cambian los turnos/citas
       setTimeout(() => processingIds.current.delete(processKey), 3000);
    }
  }, [rawBookings, assistants]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-blue-600 font-medium">Cargando Sistema...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700">
            <Stethoscope size={24} />
            <h1 className="text-xl font-bold tracking-tight">Molaria Assist<span className="text-blue-400 font-light">Hub</span></h1>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setRole('admin')} className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1 ${role === 'admin' ? 'bg-white shadow-sm text-blue-700 font-medium' : 'text-slate-600 hover:text-slate-900'}`}><Shield size={16} /> Admin</button>
            <button onClick={() => setRole('doctor')} className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1 ${role === 'doctor' ? 'bg-white shadow-sm text-blue-700 font-medium' : 'text-slate-600 hover:text-slate-900'}`}><Stethoscope size={16} /> Doctor</button>
            <button onClick={() => setRole('assistant')} className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1 ${role === 'assistant' ? 'bg-white shadow-sm text-blue-700 font-medium' : 'text-slate-600 hover:text-slate-900'}`}><User size={16} /> Asistente</button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        {role === 'admin' && <AdminView assistants={assistants} doctors={doctors} rotations={rotations} />}
        {role === 'doctor' && <DoctorView assistants={assistants} bookings={expandedBookings} doctors={doctors} />}
        {role === 'assistant' && (
          <AssistantView
            assistants={assistants}
            bookings={expandedBookings}
            doctors={doctors}
            globalAgenda={globalAgenda}
            rotations={rotations}
            onSaveRotation={handleSaveRotation}
          />
        )}
      </main>
    </div>
  );
}

export default App;
