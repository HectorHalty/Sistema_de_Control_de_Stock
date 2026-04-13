import { useMemo, useState } from 'react';
import { Plus, Edit, Trash2, X, Shield, User } from 'lucide-react';
import { useAppContext } from './AppContext';
import logoIcon from '../../assets/logo-LCH.png';
import logo10 from '../../assets/logo-10A.png';

import type { AppUser } from './store';

export function SettingsPage() {
  const { darkMode, setDarkMode, stockAlertDay, setStockAlertDay, currentUser, users, setUsers } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [tab, setTab] = useState<'users' | 'app'>('users');

  const handleSave = (user: AppUser) => {
    if (editing) {
      setUsers(prev => prev.map(u => u.id === user.id ? user : u));
    } else {
      if (currentUser.role !== 'Admin') return;
      setUsers(prev => [...prev, { ...user, id: `u${Date.now()}` }]);
    }
    setShowModal(false);
    setEditing(null);
  };

  const canManageUsers = currentUser.role === 'Admin';
  const canCreateUsers = currentUser.role === 'Admin';
  const canDeleteUsers = currentUser.role === 'Admin';

  const usersSorted = useMemo(
    () => [...users].sort((a, b) => a.role.localeCompare(b.role, 'es') || a.name.localeCompare(b.name, 'es')),
    [users]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestión de usuarios y ajustes</p>
      </div>

      <div className="flex gap-1 bg-card rounded-xl border border-border p-1 shadow-sm">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors ${tab === 'users' ? 'bg-[#3d7a3d] text-white' : 'text-muted-foreground hover:bg-muted'}`}
        >
          <User size={16} />
          Usuarios
        </button>
        <button
          onClick={() => setTab('app')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors ${tab === 'app' ? 'bg-[#3d7a3d] text-white' : 'text-muted-foreground hover:bg-muted'}`}
        >
          <Shield size={16} />
          Aplicación
        </button>
      </div>

      {tab === 'users' && (
        <>
          <div className="flex justify-end">
            {currentUser.role === 'Admin' ? (
              <button
                onClick={() => { setEditing(null); setShowModal(true); }}
                className="flex items-center gap-2 bg-[#3d7a3d] hover:bg-[#2f5f2f] text-white px-4 py-2.5 rounded-lg text-sm"
              >
                <Plus size={18} />
                Nuevo Usuario
              </button>
            ) : (
              <p className="text-xs text-muted-foreground self-center">
                Solo administradores pueden crear usuarios.
              </p>
            )}
          </div>

          {/* Mobile card list */}
          <div className="block sm:hidden space-y-3">
            {usersSorted.map(user => (
              <div key={user.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <img src={logoIcon} alt="" className="logo-sidebar w-10 h-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ fontWeight: 600 }}>{user.name}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${user.role === 'Admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                      user.role === 'Operador' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`} style={{ fontWeight: 500 }}>
                    {user.role}
                  </span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => { setEditing(user); setShowModal(true); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 text-primary text-xs"
                  >
                    <Edit size={14} /> Editar
                  </button>
                  {canDeleteUsers && (
                    <button
                      onClick={() => setDeleteConfirm(user.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs"
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[550px]">
                <thead>
                  <tr className="bg-secondary">
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Usuario</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Rol</th>
                    <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usersSorted.map(user => (
                    <tr key={user.id} className="border-b border-border hover:bg-background">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={logoIcon} alt="" className="logo-sidebar w-8 h-8 rounded-full" />
                          <span className="text-sm" style={{ fontWeight: 500 }}>{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full ${user.role === 'Admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                            user.role === 'Operador' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                              'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                          }`} style={{ fontWeight: 500 }}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setEditing(user); setShowModal(true); }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                            <Edit size={16} />
                          </button>
                          {canDeleteUsers && (
                            <button onClick={() => setDeleteConfirm(user.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}

      {tab === 'app' && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <img src={logo10} alt="La Chacra 10 años" className="logo-sidebar w-24 h-24 object-contain" />
            <div>
              <h3 className="text-foreground">La Chacra Fútbol</h3>
              <p className="text-sm text-muted-foreground">Control de Stock v1.0</p>
              <p className="text-xs text-muted-foreground mt-1">10 Años de pasión por el fútbol</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="text-sm" style={{ fontWeight: 500 }}>Notificaciones de Stock Bajo</p>
                <p className="text-xs text-muted-foreground">Recibir alertas cuando el stock baje del mínimo</p>
              </div>
              <div className="w-11 h-6 bg-[#3d7a3d] rounded-full relative cursor-pointer">
                <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow" />
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[rgba(0,0,0,0.04)]">
              <div>
                <p className="text-sm" style={{ fontWeight: 500 }}>Día de Alerta de Stock Faltante</p>
                <p className="text-xs text-muted-foreground">Elegí qué día de la semana querés que te avise si falta stock</p>
              </div>
              <select
                value={stockAlertDay}
                onChange={e => setStockAlertDay(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
              >
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm" style={{ fontWeight: 500 }}>Modo Oscuro</p>
                <p className="text-xs text-muted-foreground">Cambiar el tema de la aplicación</p>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`w-11 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-[#3d7a3d]' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${darkMode ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowModal(false); setEditing(null); }}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3>{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <UserForm
              initial={editing}
              onSave={handleSave}
              onCancel={() => { setShowModal(false); setEditing(null); }}
              disableCreate={!canCreateUsers && !editing}
            />
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-2">Confirmar Eliminación</h3>
            <p className="text-sm text-muted-foreground mb-4">¿Estás seguro de que querés eliminar este usuario?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancelar</button>
              <button onClick={() => { setUsers(prev => prev.filter(u => u.id !== deleteConfirm)); setDeleteConfirm(null); }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserForm({
  initial,
  onSave,
  onCancel,
  disableCreate,
}: {
  initial: AppUser | null;
  onSave: (u: AppUser) => void;
  onCancel: () => void;
  disableCreate: boolean;
}) {
  const [form, setForm] = useState<AppUser>(initial || { id: '', name: '', role: 'Operador' });

  return (
    <div className="px-6 py-4 space-y-4">
      <div>
        <label className="block text-sm mb-1">Nombre</label>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm" />
      </div>
      <div>
        <label className="block text-sm mb-1">Rol</label>
        <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as AppUser['role'] }))}
          className="w-full px-3 py-2 rounded-lg bg-input-background border border-border outline-none text-sm">
          <option value="Admin">Admin</option>
          <option value="Operador">Operador</option>
          <option value="Viewer">Viewer</option>
        </select>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm">Cancelar</button>
        <button
          onClick={() => form.name && !disableCreate && onSave(form)}
          disabled={disableCreate}
          className={`px-4 py-2 rounded-lg text-sm ${disableCreate ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-[#3d7a3d] text-white hover:bg-[#2f5f2f]'
            }`}
        >
          {initial ? 'Guardar' : 'Crear'}
        </button>
      </div>
    </div>
  );
}