import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
import { Calendar, Clock, User, UserPlus, Trash2, CheckCircle, XCircle, AlertCircle, Shield, Stethoscope, Users, Pencil, FileText } from 'lucide-react';

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

// --- UTILITY FUNCTIONS ---
const generateTimeSlots = (startHour = 8, endHour = 20) => {
  const slots = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === endHour && m > 0) break; // End at exactly endHour:00
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
  // Use midday to avoid timezone shifting the day
  return new Date(dateString + 'T12:00:00').getDay();
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

// --- COMPONENTS ---

// 1. ADMIN VIEW
const AdminView = ({ assistants, doctors }) => {
  const [activeTab, setActiveTab] = useState('assistants'); // 'assistants' o 'doctors'
  
  // Estados para Asistentes
  const [name, setName] = useState('');
  const defaultSchedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [editingId, setEditingId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [blockStart, setBlockStart] = useState('09:00');
  const [blockEnd, setBlockEnd] = useState('13:00');

  // Estados para Doctores
  const [docName, setDocName] = useState('');
  const [editingDocId, setEditingDocId] = useState(null);

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

  return (
    <div className="space-y-6">
      {/* Pestañas de Navegación Admin */}
      <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
        <button onClick={() => setActiveTab('assistants')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'assistants' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}>
          <UserPlus size={18} /> Asistentes
        </button>
        <button onClick={() => setActiveTab('doctors')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'doctors' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}>
          <Stethoscope size={18} /> Doctores
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
    </div>
  );
};

// 2. DOCTOR VIEW
const DoctorView = ({ assistants, bookings, doctors }) => {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [doctorId, setDoctorId] = useState(''); 
  const [patientName, setPatientName] = useState('');
  const [duration, setDuration] = useState(60); 
  const [comments, setComments] = useState('');
  const [bookingError, setBookingError] = useState('');
  const slots = useMemo(() => generateTimeSlots(8, 20), []);

  const handleBook = async (timeSlot) => {
    if (!doctorId) {
       setBookingError('⚠️ Ingresa el nombre del Doctor(a).');
       setTimeout(() => setBookingError(''), 3000);
       return;
    }
    if (!patientName.trim()) {
       setBookingError('⚠️ Ingresa el nombre del paciente.');
       setTimeout(() => setBookingError(''), 3000);
       return;
    }
    setBookingError('');

    const requiredSlots = getSlotsForDuration(timeSlot, duration);
    if (requiredSlots.length < duration / 15) {
       setBookingError('⚠️ La duración excede el horario disponible.');
       setTimeout(() => setBookingError(''), 3000);
       return;
    }

    const dayOfWeek = getDayOfWeek(selectedDate);

    // 1. Encontrar asistentes disponibles para todo el bloque
    const availableAssistants = assistants.filter(ast => {
       const workingAll = requiredSlots.every(slot => isTimeInAnyBlock(slot, ast.schedule?.[dayOfWeek]));
       if (!workingAll) return false;

       const bookedInAny = requiredSlots.some(slot => 
          bookings.some(b => b.date === selectedDate && b.time === slot && b.assistantId === ast.id)
       );
       return !bookedInAny;
    });

    if (availableAssistants.length === 0) {
       setBookingError('⚠️ No hay asistente disponible de forma continua para este horario y duración.');
       setTimeout(() => setBookingError(''), 4000);
       return;
    }

    // 3. Asignar aleatoriamente
    const randomIndex = Math.floor(Math.random() * availableAssistants.length);
    const assignedAssistant = availableAssistants[randomIndex];
    const groupId = Date.now().toString() + Math.random().toString(36).substr(2, 5);

    // 4. Guardar SOLO UN bloque en Firebase (La app se encarga de expandirlo visualmente)
    try {
      const collRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
      await addDoc(collRef, {
        groupId,
        date: selectedDate,
        time: timeSlot,
        assistantId: assignedAssistant.id,
        assistantName: assignedAssistant.name,
        doctorId: 'manual',
        doctorName: doctorId,
        patientName: patientName,
        duration: duration,
        comments: comments.trim(),
        isFirstSlot: true,
        createdAt: new Date().toISOString()
      });
      setPatientName('');
      setComments('');
    } catch (err) {
      console.error("Booking error:", err);
    }
  };

  const handleAssignToExisting = async (booking) => {
      const requiredSlots = getSlotsForDuration(booking.time, booking.duration);
      const dayOfWeek = getDayOfWeek(booking.date);

      const availableAssistants = assistants.filter(ast => {
         const workingAll = requiredSlots.every(slot => isTimeInAnyBlock(slot, ast.schedule?.[dayOfWeek]));
         if (!workingAll) return false;

         const bookedInAny = requiredSlots.some(slot =>
            bookings.some(b => b.date === booking.date && b.time === slot && b.assistantId === ast.id && b.id !== booking.id)
         );
         return !bookedInAny;
      });

      if (availableAssistants.length === 0) {
         setBookingError(`⚠️ No hay asistentes disponibles a las ${booking.time} por ${booking.duration}m.`);
         setTimeout(() => setBookingError(''), 4000);
         return;
      }

      const assignedAssistant = availableAssistants[Math.floor(Math.random() * availableAssistants.length)];

      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id);
        await updateDoc(docRef, {
          assistantId: assignedAssistant.id,
          assistantName: assignedAssistant.name
        });
      } catch (err) {
        console.error("Assign error:", err);
      }
  };

  const handleCancel = async (booking) => {
    try {
      if (booking.groupId && booking.assistantId !== 'pendiente') {
         // Para retrocompatibilidad con las pruebas viejas eliminamos todo el grupo
         const groupBookings = bookings.filter(b => b.groupId === booking.groupId);
         const promises = groupBookings.map(b => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bookings', b.id)));
         await Promise.all(promises);
      } else {
         const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id);
         await deleteDoc(docRef);
      }
    } catch (err) {
      console.error("Cancel error:", err);
    }
  };

  const dayOfWeek = getDayOfWeek(selectedDate);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-600 mb-1">Doctor(a)</label>
            <input 
              type="text" 
              value={doctorId} 
              onChange={(e) => setDoctorId(e.target.value)} 
              placeholder="Ej. Dr. Pérez (o llega por Dentalink)" 
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" 
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-600 mb-1">Fecha de Consulta</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-600 mb-1">Duración</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={45}>45 minutos</option>
              <option value={60}>1 hora</option>
              <option value={90}>1 hora 30 min</option>
            </select>
          </div>
          <div className="flex-1 w-full relative">
            <label className="block text-sm font-medium text-slate-600 mb-1">Paciente</label>
            <input type="text" value={patientName} onChange={(e) => {setPatientName(e.target.value); setBookingError('');}} placeholder="Ej. Juan Pérez" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            {bookingError && <span className="absolute -bottom-5 left-0 text-xs text-red-500 font-medium whitespace-nowrap">{bookingError}</span>}
          </div>
        </div>
        <div className="w-full">
          <label className="block text-sm font-medium text-slate-600 mb-1">Comentarios / Procedimiento (Opcional)</label>
          <input type="text" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Ej. Restauración en resina, profilaxis..." className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <h3 className="text-lg font-semibold text-slate-800 p-6 border-b border-slate-100 bg-slate-50">
          Disponibilidad para el {selectedDate}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {slots.map(slot => {
            const workingAssistants = assistants.filter(ast => isTimeInAnyBlock(slot, ast.schedule?.[dayOfWeek]));
            const slotBookings = bookings.filter(b => b.date === selectedDate && b.time === slot);
            const availableCount = workingAssistants.length - slotBookings.length;
            
            // Todas las reservas en este bloque (ya no filtramos por doctor)
            const myBookingsInSlot = slotBookings;

            let statusColor = "bg-slate-50 border-slate-200";
            
            if (availableCount <= 0 && workingAssistants.length > 0) {
              statusColor = "bg-red-50 border-red-200";
            } else if (availableCount > 0) {
              statusColor = "bg-blue-50 border-blue-200 hover:shadow-md transition-shadow";
            }

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
                   const isMyBooking = true; // Habilita la lectura universal y la cancelación/liberación directa de bloques
                   const isUnassigned = mb.assistantId === 'pendiente';
                   const cardColor = isUnassigned ? "bg-red-50 border-red-200 text-red-900" : "bg-amber-100 border-amber-200 text-amber-900";
                    
                    return (
                      <div key={mb.virtualId || mb.id} className={`${cardColor} border p-2 rounded-lg text-sm shadow-sm`}>
                         <div className="flex justify-between items-center mb-1">
                           <span className="font-semibold flex items-center gap-1">
                             {isUnassigned ? <AlertCircle size={14}/> : <CheckCircle size={14}/>} {mb.assistantName}
                           </span>
                         </div>
                         <div className="text-xs mb-1 font-medium text-slate-800">
                           <Stethoscope size={12} className="inline mr-1 opacity-70"/> Dr(a): {mb.doctorName}
                         </div>
                         <div className="text-xs mb-1 opacity-90">Px: {mb.patientName}</div>
                         {mb.comments && <div className="text-xs mb-2 opacity-80 italic">Nota: {mb.comments}</div>}
                         
                         {isUnassigned && mb.isFirstSlot !== false && (
                           <button onClick={() => handleAssignToExisting(mb)} className="w-full py-2 mt-2 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                             Asignar Asistente Disponible
                           </button>
                         )}

                         {!isUnassigned && isMyBooking && mb.isFirstSlot !== false && (
                           <button onClick={() => handleCancel(mb)} className="w-full py-1.5 mt-1 bg-white/80 text-red-600 rounded text-xs font-semibold hover:bg-white transition-colors shadow-sm">
                             Liberar Bloque ({mb.duration ? `${mb.duration}m` : '15m'})
                           </button>
                         )}

                         {mb.isFirstSlot === false && (
                            <div className={`text-center text-[10px] mt-1 opacity-60 font-medium ${isUnassigned ? 'text-red-700' : 'text-amber-700'}`}>
                              Bloque en curso
                            </div>
                         )}
                      </div>
                    );
                  })}
                </div>
                
                {availableCount > 0 && (
                  <button onClick={() => handleBook(slot)} className="w-full py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors shadow-sm mt-auto">
                    Agendar Manualmente
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 3. ASSISTANT VIEW
const AssistantView = ({ assistants, bookings }) => {
  const [selectedAssistantId, setSelectedAssistantId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [viewMode, setViewMode] = useState('personal'); // 'personal' | 'general'
  const slots = useMemo(() => generateTimeSlots(8, 20), []);

  useEffect(() => {
    if (!selectedAssistantId && assistants.length > 0) {
      setSelectedAssistantId(assistants[0].id);
    }
  }, [assistants, selectedAssistantId]);

  const selectedAssistant = assistants.find(a => a.id === selectedAssistantId);
  const dayOfWeek = getDayOfWeek(selectedDate);

  // Asistentes que trabajan ese día
  const activeAssistants = assistants.filter(ast => ast.schedule?.[dayOfWeek] && ast.schedule[dayOfWeek].length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-slate-600 mb-1">Soy la asistente:</label>
          <select value={selectedAssistantId} onChange={(e) => setSelectedAssistantId(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            <option value="" disabled>Seleccione...</option>
            {assistants.map(ast => (
              <option key={ast.id} value={ast.id}>{ast.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-slate-600 mb-1">Fecha ({DAYS_OF_WEEK[dayOfWeek]}):</label>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
        <button onClick={() => setViewMode('personal')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${viewMode === 'personal' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}>
          <User size={18} /> Mi Agenda
        </button>
        <button onClick={() => setViewMode('general')} className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${viewMode === 'general' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}>
          <Users size={18} /> Agenda General
        </button>
      </div>

      {viewMode === 'personal' && selectedAssistant && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <h3 className="text-lg font-semibold text-slate-800 p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Calendar size={20} className="text-blue-600" />
            Agenda de {selectedAssistant.name}
          </h3>
          <div className="divide-y divide-slate-100">
            {slots.map(slot => {
              if (!isTimeInAnyBlock(slot, selectedAssistant.schedule?.[dayOfWeek])) return null;
              const slotBooking = bookings.find(b => b.date === selectedDate && b.time === slot && b.assistantId === selectedAssistantId);

              return (
                <div key={slot} className={`p-4 flex flex-col md:flex-row md:items-center gap-4 transition-colors ${slotBooking ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                  <div className="w-24 font-bold text-slate-700 text-lg flex items-center gap-2">
                    <Clock size={16} className="text-slate-400" /> {slot}
                  </div>
                  <div className="flex-1">
                    {slotBooking ? (
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-blue-800 font-medium bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <span className="flex items-center gap-1"><Stethoscope size={16} className="text-blue-600"/> Dr(a): {slotBooking.doctorName}</span>
                        <span className="flex items-center gap-1"><User size={16} className="text-blue-600"/> Px: {slotBooking.patientName}</span>
                        {slotBooking.comments && <span className="flex items-center gap-1 text-sm italic"><FileText size={16} className="text-blue-600"/> {slotBooking.comments}</span>}
                      </div>
                    ) : (
                      <div className="text-green-600 font-medium text-sm flex items-center gap-2 px-2">
                         <CheckCircle size={16} /> Turno Libre
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {(!selectedAssistant.schedule?.[dayOfWeek] || selectedAssistant.schedule[dayOfWeek].length === 0) && (
              <div className="p-8 text-center text-slate-500">
                No tienes turnos programados para este día.
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'general' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
           <h3 className="text-lg font-semibold text-slate-800 p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
             <Calendar size={20} className="text-blue-600" />
             Agenda General - {DAYS_OF_WEEK[dayOfWeek]}
           </h3>
           <div className="overflow-x-auto">
             <table className="w-full min-w-max border-collapse">
               <thead>
                 <tr>
                   <th className="p-3 bg-slate-50 border-b border-slate-200 text-left sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] font-bold text-slate-700 w-24">Hora</th>
                   {activeAssistants.map(ast => (
                     <th key={ast.id} className="p-3 bg-slate-50 border-b border-slate-200 border-l border-slate-200 text-center font-semibold text-slate-700 min-w-[160px]">
                       {ast.name}
                     </th>
                   ))}
                 </tr>
               </thead>
               <tbody>
                 {slots.map(slot => (
                   <tr key={slot} className="hover:bg-slate-50/50">
                     <td className="p-3 border-b border-slate-100 text-slate-700 font-medium sticky left-0 bg-white z-10 shadow-[1px_0_0_0_#f1f5f9]">{slot}</td>
                     {activeAssistants.map(ast => {
                       const isWorking = isTimeInAnyBlock(slot, ast.schedule[dayOfWeek]);
                       const booking = bookings.find(b => b.date === selectedDate && b.time === slot && b.assistantId === ast.id);
                       
                       return (
                         <td key={ast.id} className="p-2 border-b border-l border-slate-100 text-center">
                           {!isWorking ? (
                             <div className="text-slate-300 flex justify-center"><XCircle size={16}/></div>
                           ) : booking ? (
                             <div className="bg-blue-100 border border-blue-200 text-blue-900 rounded p-1.5 text-xs text-left shadow-sm">
                               <div className="font-bold flex items-center gap-1 mb-1 truncate"><Stethoscope size={12}/> {booking.doctorName}</div>
                               <div className="opacity-90 flex items-center gap-1 truncate"><User size={12}/> {booking.patientName}</div>
                               {booking.comments && <div className="opacity-80 italic mt-1 truncate" title={booking.comments}>- {booking.comments}</div>}
                             </div>
                           ) : (
                             <div className="text-green-500 font-medium text-xs bg-green-50 border border-green-100 rounded p-2 flex items-center justify-center gap-1">
                               <CheckCircle size={14}/> Libre
                             </div>
                           )}
                         </td>
                       );
                     })}
                   </tr>
                 ))}
               </tbody>
             </table>
             {activeAssistants.length === 0 && (
               <div className="p-8 text-center text-slate-500">Ninguna asistente tiene turnos asignados este día.</div>
             )}
           </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('doctor'); // 'admin', 'doctor', 'assistant'
  const [assistants, setAssistants] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const processingIds = useRef(new Set());

  // Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Data
  useEffect(() => {
    if (!user) return;

    // Listen to Assistants
    const asstRef = collection(db, 'artifacts', appId, 'public', 'data', 'assistants');
    const unsubAssistants = onSnapshot(asstRef, (snapshot) => {
      const astData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      astData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setAssistants(astData);
    }, (error) => console.error(error));

    // Listen to Doctors
    const docRef = collection(db, 'artifacts', appId, 'public', 'data', 'doctors');
    const unsubDoctors = onSnapshot(docRef, (snapshot) => {
      const docData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setDoctors(docData);
    }, (error) => console.error(error));

    // Listen to Bookings
    const bookRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubBookings = onSnapshot(bookRef, (snapshot) => {
      let expandedBookings = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        let fechaCorregida = data.date;
        
        if (data.date && typeof data.date !== 'string' && data.date.toDate) {
          fechaCorregida = data.date.toDate().toISOString().split('T')[0];
        } else if (typeof data.date === 'string' && data.date.includes('T')) {
          fechaCorregida = data.date.split('T')[0];
        }

        const durationNum = Number(data.duration) || 15;
        const baseBooking = { id: doc.id, ...data, date: fechaCorregida, duration: durationNum };
        
        if (baseBooking.time) {
          const slotsCovered = getSlotsForDuration(baseBooking.time, durationNum);
          slotsCovered.forEach((slotTime, index) => {
            expandedBookings.push({
              ...baseBooking,
              time: slotTime,
              isFirstSlot: index === 0,
              virtualId: `${doc.id}_${index}`
            });
          });
        } else {
          expandedBookings.push(baseBooking);
        }
      });
      
      setBookings(expandedBookings);
      setLoading(false);
    }, (error) => console.error(error));

    return () => {
      unsubAssistants();
      unsubDoctors();
      unsubBookings();
    };
  }, [user]);

  // AUTO-ASIGNACIÓN INTELIGENTE
  useEffect(() => {
    if (assistants.length === 0 || bookings.length === 0) return;

    // Buscamos citas pendientes que sean el documento principal (isFirstSlot !== false)
    const unassignedBookings = bookings.filter(b => b.assistantId === 'pendiente' && b.isFirstSlot !== false);

    unassignedBookings.forEach(async (booking) => {
      // Evitar procesar el mismo documento múltiples veces simultáneamente
      if (processingIds.current.has(booking.id)) return;
      processingIds.current.add(booking.id);

      const requiredSlots = getSlotsForDuration(booking.time, booking.duration);
      const dayOfWeek = getDayOfWeek(booking.date);

      const availableAssistants = assistants.filter(ast => {
         const workingAll = requiredSlots.every(slot => isTimeInAnyBlock(slot, ast.schedule?.[dayOfWeek]));
         if (!workingAll) return false;

         const bookedInAny = requiredSlots.some(slot =>
            bookings.some(b => b.date === booking.date && b.time === slot && b.assistantId === ast.id && b.id !== booking.id)
         );
         return !bookedInAny;
      });

      if (availableAssistants.length > 0) {
         // Asignar aleatoriamente entre las que están libres
         const assignedAssistant = availableAssistants[Math.floor(Math.random() * availableAssistants.length)];
         try {
           const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'bookings', booking.id);
           await updateDoc(docRef, {
             assistantId: assignedAssistant.id,
             assistantName: assignedAssistant.name
           });
           // Una vez actualizado, Firebase enviará otro snapshot y ya no será 'pendiente'
         } catch (err) {
           console.error("Auto-assign error:", err);
           processingIds.current.delete(booking.id); // Permite reintentar si falla
         }
      } else {
         // Nadie disponible, liberar el candado después de un rato para reintentos si alguien se libera
         setTimeout(() => {
           processingIds.current.delete(booking.id);
         }, 10000);
      }
    });
  }, [bookings, assistants]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-blue-600 font-medium">Cargando Sistema...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700">
            <Stethoscope size={24} />
            <h1 className="text-xl font-bold tracking-tight">Molaria Assist<span className="text-blue-400 font-light">Hub</span></h1>
          </div>
          
          {/* Role Selector (For testing purposes) */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setRole('admin')}
              className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1 ${role === 'admin' ? 'bg-white shadow-sm text-blue-700 font-medium' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Shield size={16} /> Admin
            </button>
            <button 
              onClick={() => setRole('doctor')}
              className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1 ${role === 'doctor' ? 'bg-white shadow-sm text-blue-700 font-medium' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Stethoscope size={16} /> Doctor
            </button>
            <button 
              onClick={() => setRole('assistant')}
              className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1 ${role === 'assistant' ? 'bg-white shadow-sm text-blue-700 font-medium' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <User size={16} /> Asistente
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {role === 'admin' && <AdminView assistants={assistants} doctors={doctors} />}
        {role === 'doctor' && <DoctorView assistants={assistants} bookings={bookings} doctors={doctors} />}
        {role === 'assistant' && <AssistantView assistants={assistants} bookings={bookings} />}
      </main>
    </div>
  );
}
