import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, Plus, Trash2, RefreshCw, LogIn, LogOut, 
  ShieldCheck, UserCheck, Package, Info, Upload, ExternalLink, Loader2
} from 'lucide-react';

// =========================================================
// CONFIGURACIÓN DE APIS Y CLOUDINARY (Variables de Entorno Vite)
// =========================================================
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const LOGO_TESJO = "https://res.cloudinary.com/j2frsaie/image/upload/v1790570178/Logo-TESJo.jpg";
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "j2frsaie"; 
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "inventario_tesjo";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginRole, setLoginRole] = useState('student');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [components, setComponents] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Estado para el archivo local seleccionado y clave para reiniciar el input file
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(() => Date.now());

  const [form, setForm] = useState({
    name: '',
    category: 'Kits de Herramientas',
    value: '',
    quantity: 1,
    minQuantity: 2,
    location: '',
    description: '',
    imageUrl: ''
  });

  // Cargar inventario desde el backend
  const fetchComponents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/components`);
      setComponents(res.data);
    } catch (err) {
      console.error("Error al cargar inventario:", err);
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial al montar el componente
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/components`);
        if (isMounted) {
          setComponents(res.data);
        }
      } catch (err) {
        console.error("Error al cargar inventario:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    if (loginRole === 'admin') {
      if (passwordInput === 'admin123') {
        setCurrentUser('admin');
        setPasswordInput('');
      } else {
        setLoginError('Contraseña de administrador incorrecta.');
      }
    } else {
      setCurrentUser('student');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setPasswordInput('');
    setLoginError('');
  };

  // Subida de imagen a Cloudinary
  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const res = await axios.post(url, formData);
    return res.data.secure_url;
  };

  // Manejador del envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploadingImage(true);

    try {
      let finalImageUrl = form.imageUrl;

      // 1. Subir imagen a Cloudinary si existe un archivo seleccionado
      if (selectedFile) {
        try {
          finalImageUrl = await uploadToCloudinary(selectedFile);
        } catch (cloudinaryErr) {
          console.error("Error en Cloudinary:", cloudinaryErr);
          const errorMsg = cloudinaryErr.response?.data?.error?.message || cloudinaryErr.message;
          alert(`Error al subir la imagen: ${errorMsg}`);
          setUploadingImage(false);
          return;
        }
      }

      // 2. Mapeo y formateo de datos para el backend
      const allowedCategories = ['Resistencias', 'Capacitores', 'Semiconductores', 'Circuitos Integrados', 'Módulos y Sensores', 'Otros'];
      const safeCategory = allowedCategories.includes(form.category) ? form.category : 'Otros';

      const autoSku = `${form.name.replace(/\s+/g, '-').toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const numQuantity = Number(form.quantity) || 1;

      const isCustomCategory = safeCategory === 'Otros' && form.category !== 'Otros';
      const cleanDescription = form.description ? form.description.trim() : '';
      const finalDescription = isCustomCategory 
        ? `[Categoría: ${form.category}] ${cleanDescription}`.trim()
        : cleanDescription;

      const payload = {
        name: form.name,
        category: safeCategory,
        value: form.value || '',
        quantity: numQuantity,
        stock: numQuantity,
        minQuantity: Number(form.minQuantity) || 2,
        location: form.location || '',
        description: finalDescription,
        imageUrl: finalImageUrl || '',
        sku: autoSku
      };

      await axios.post(`${API_URL}/components`, payload);

      // Limpiar formulario y reiniciar input file
      setSelectedFile(null);
      setFileInputKey(prev => prev + 1);
      setForm({ 
        name: '', 
        category: 'Kits de Herramientas', 
        value: '', 
        quantity: 1, 
        minQuantity: 2, 
        location: '',
        description: '',
        imageUrl: '' 
      });
      
      fetchComponents();
      alert("¡Registro guardado con éxito!");

    } catch (err) {
      console.error("Error del backend:", err.response?.data || err);
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      alert(`Error en el servidor: ${msg}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Deseas eliminar este registro?')) return;
    try {
      await axios.delete(`${API_URL}/components/${id}`);
      fetchComponents();
    } catch (err) {
      console.error("Error al eliminar:", err);
    }
  };

  // Filtrado reactivo de componentes
  const filteredComponents = components.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || 
                          (c.value && c.value.toLowerCase().includes(search.toLowerCase())) ||
                          (c.description && c.description.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = category === 'Todas' || 
                            c.category === category || 
                            (c.description && c.description.includes(`[Categoría: ${category}]`));

    return matchesSearch && matchesCategory;
  });

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
          <div className="text-center space-y-2">
            <img src={LOGO_TESJO} alt="Logo TESJo" className="h-20 mx-auto object-contain mb-3" />
            <h1 className="text-2xl font-bold text-blue-900">Sistema de Inventario</h1>
            <p className="text-xs text-slate-500 font-medium">Tecnológico de Estudios Superiores de Jocotitlán</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Selecciona tu Rol de Acceso</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setLoginRole('student'); setLoginError(''); }}
                  className={`p-3 rounded-xl border font-medium text-sm flex items-center justify-center gap-2 transition ${
                    loginRole === 'student' ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <UserCheck className="w-4 h-4" /> Estudiante
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginRole('admin'); setLoginError(''); }}
                  className={`p-3 rounded-xl border font-medium text-sm flex items-center justify-center gap-2 transition ${
                    loginRole === 'admin' ? 'bg-blue-900 text-white border-blue-900 shadow-md' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" /> Administrador
                </button>
              </div>
            </div>

            {loginRole === 'admin' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña de Administrador</label>
                <input
                  type="password"
                  required
                  placeholder="Ingresa la contraseña"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-900"
                />
              </div>
            )}

            {loginError && (
              <p className="text-xs text-red-600 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200 text-center">{loginError}</p>
            )}

            <button type="submit" className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition shadow-lg flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" /> Ingresar al Sistema
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">Laboratorio de Arquitectura de Computadoras — TESJo</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={LOGO_TESJO} alt="Logo TESJo" className="h-12 object-contain" />
            <div className="border-l border-slate-200 pl-4">
              <h1 className="text-lg font-bold text-blue-900 leading-tight">Inventario de Laboratorio</h1>
              <p className="text-xs text-slate-500">Tecnológico de Estudios Superiores de Jocotitlán</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
              currentUser === 'admin' ? 'bg-blue-100 text-blue-900 border border-blue-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}>
              {currentUser === 'admin' ? <ShieldCheck className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
              {currentUser === 'admin' ? 'Administrador' : 'Estudiante'}
            </span>

            <button onClick={fetchComponents} className="p-2 text-slate-600 hover:text-blue-900 rounded-lg transition" title="Actualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 rounded-lg text-xs font-semibold transition border border-slate-200">
              <LogOut className="w-3.5 h-3.5" /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        {currentUser === 'admin' ? (
          <section className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm h-fit space-y-4">
            <h2 className="text-base font-bold text-blue-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Plus className="w-5 h-5 text-blue-600" /> Registrar Componente o Kit
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre / Identificador</label>
                <input 
                  type="text" required placeholder="Ej: Kit Manhattan"
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría</label>
                  <select 
                    value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-900"
                  >
                    <option>Kits de Herramientas</option>
                    <option>Microcontroladores y Entrenamiento</option>
                    <option>Resistencias</option>
                    <option>Capacitores</option>
                    <option>Semiconductores</option>
                    <option>Circuitos Integrados</option>
                    <option>Módulos y Sensores</option>
                    <option>Otros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Valor / Modelo</label>
                  <input 
                    type="text" placeholder="Ej: HNBG-234"
                    value={form.value} onChange={e => setForm({...form, value: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cantidad Stock</label>
                  <input 
                    type="number" min="0" required
                    value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Ubicación</label>
                  <input 
                    type="text" placeholder="Ej: B2"
                    value={form.location} onChange={e => setForm({...form, location: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción / Notas</label>
                <textarea 
                  rows="2" placeholder="Detalles del contenido..."
                  value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-900 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Seleccionar Foto</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg p-2">
                  <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                  <input 
                    key={fileInputKey}
                    type="file" 
                    accept="image/*"
                    disabled={uploadingImage}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      setSelectedFile(file || null);
                    }}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-900 hover:file:bg-blue-200 cursor-pointer disabled:opacity-50"
                  />
                </div>
                {selectedFile && (
                  <p className="text-[11px] text-emerald-600 font-medium mt-1">✓ Listo para subir: {selectedFile.name}</p>
                )}
              </div>

              <button 
                type="submit" 
                disabled={uploadingImage}
                className="w-full bg-blue-900 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-xl transition shadow-md text-sm mt-2 flex items-center justify-center gap-2"
              >
                {uploadingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Subiendo imagen...
                  </>
                ) : (
                  'Guardar en Inventario'
                )}
              </button>
            </form>
          </section>
        ) : (
          <section className="bg-blue-900 text-white p-6 rounded-2xl shadow-md h-fit space-y-4">
            <div className="flex items-center gap-3 border-b border-blue-800 pb-3">
              <Info className="w-6 h-6 text-blue-300" />
              <h2 className="text-base font-bold">Portal del Estudiante</h2>
            </div>
            <p className="text-xs text-blue-100 leading-relaxed">
              Consulta la disponibilidad de kits y componentes del laboratorio.
            </p>
          </section>
        )}

        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input 
                type="text" placeholder="Buscar por nombre, kit, modelo..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-900"
              />
            </div>
            <select 
              value={category} onChange={e => setCategory(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-900 font-medium"
            >
              <option>Todas</option>
              <option>Kits de Herramientas</option>
              <option>Microcontroladores y Entrenamiento</option>
              <option>Resistencias</option>
              <option>Capacitores</option>
              <option>Semiconductores</option>
              <option>Circuitos Integrados</option>
              <option>Módulos y Sensores</option>
              <option>Otros</option>
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
                  <th className="p-4">Elemento / Kit</th>
                  <th className="p-4">Categoría</th>
                  <th className="p-4">Ubicación</th>
                  <th className="p-4 text-center">Disponibilidad</th>
                  {currentUser === 'admin' && <th className="p-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredComponents.length === 0 ? (
                  <tr>
                    <td colSpan={currentUser === 'admin' ? 5 : 4} className="p-8 text-center text-slate-400">
                      No se encontraron elementos registrados.
                    </td>
                  </tr>
                ) : (
                  filteredComponents.map(c => {
                    const currentStock = c.quantity ?? c.stock ?? 0;
                    
                    let displayCategory = c.category;
                    let displayDescription = c.description || '';

                    if (c.description && c.description.includes('[Categoría: ')) {
                      const match = c.description.match(/\[Categoría:\s*([^\]]+)\]/);
                      if (match) {
                        displayCategory = match[1];
                        displayDescription = c.description.replace(/\[Categoría:\s*([^\]]+)\]\s*/, '');
                      }
                    }

                    return (
                      <tr key={c._id} className="hover:bg-slate-50/80 transition">
                        <td className="p-4">
                          <div className="flex items-start gap-3">
                            {c.imageUrl ? (
                              <a 
                                href={c.imageUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="relative group shrink-0" 
                                title="Haz clic para ver la foto completa"
                              >
                                <img 
                                  src={c.imageUrl} 
                                  alt={c.name} 
                                  className="w-14 h-14 object-cover rounded-lg border border-slate-200 shadow-sm group-hover:opacity-80 transition cursor-pointer" 
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 rounded-lg transition">
                                  <ExternalLink className="w-4 h-4 text-white" />
                                </div>
                              </a>
                            ) : (
                              <div className="w-14 h-14 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                                <Package className="w-6 h-6" />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-slate-800">{c.name}</p>
                              {c.value && <p className="text-xs text-blue-900 font-medium">{c.value}</p>}
                              {displayDescription && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{displayDescription}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-slate-600">
                          <span className="px-2.5 py-1 bg-slate-100 rounded-md text-xs font-medium border border-slate-200 text-slate-700 inline-block">
                            {displayCategory}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 text-xs font-medium">{c.location || '—'}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            currentStock > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'
                          }`}>
                            {currentStock > 0 ? `${currentStock} disponibles` : 'Agotado'}
                          </span>
                        </td>
                        {currentUser === 'admin' && (
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => handleDelete(c._id)}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}