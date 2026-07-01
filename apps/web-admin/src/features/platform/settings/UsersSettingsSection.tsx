import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import logoIcon from '@/assets/logo-LCH.png';
import { usersApi, getApiErrorMessage, type ApiUser } from '@/app/api/client';
import { ASSIGNABLE_ROLES, getRoleLabel } from '@/features/platform/config/modules';
import type { UserRole } from '@/features/platform/types';

function roleBadgeClass(role: UserRole | string) {
  if (role === 'Admin' || role === 'SuperAdmin') {
    return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
  }
  if (role === 'Gerente_Ventas' || role === 'Gerente_Operaciones') {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
  }
  if (role === 'Vendedor' || role === 'Operador') {
    return 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300';
  }
  if (role === 'Operador_Futbol' || role === 'Encargado_Futbol') {
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  }
  if (role === 'Operador_Cocina') {
    return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
  }
  return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
}

interface UsersSettingsSectionProps {
  canManageUsers: boolean;
}

export function UsersSettingsSection({ canManageUsers }: UsersSettingsSectionProps) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ApiUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!canManageUsers) return;
    setLoading(true);
    setError(null);
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (e) {
      setError(getApiErrorMessage(e, 'No se pudieron cargar los usuarios'));
    } finally {
      setLoading(false);
    }
  }, [canManageUsers]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const usersSorted = useMemo(
    () => [...users].sort((a, b) => a.role.localeCompare(b.role, 'es') || a.name.localeCompare(b.name, 'es')),
    [users],
  );

  const handleSave = async (payload: {
    id?: string;
    username: string;
    name: string;
    role: UserRole;
    password?: string;
  }) => {
    setError(null);
    try {
      if (payload.id) {
        await usersApi.update(payload.id, { name: payload.name, role: payload.role });
      } else if (canManageUsers && payload.password) {
        await usersApi.create({
          username: payload.username,
          password: payload.password,
          name: payload.name,
          role: payload.role,
        });
      }
      setShowModal(false);
      setEditing(null);
      await loadUsers();
    } catch (e) {
      setError(getApiErrorMessage(e, 'No se pudo guardar el usuario'));
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await usersApi.remove(id);
      setDeleteConfirm(null);
      await loadUsers();
    } catch (e) {
      setError(getApiErrorMessage(e, 'No se pudo eliminar el usuario'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-foreground">Administracion de Usuarios</h3>
          <p className="text-sm text-muted-foreground mt-1">Gestion de cuentas y roles del personal LCH.</p>
        </div>
        {canManageUsers ? (
          <button
            onClick={() => { setEditing(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-[#3d7a3d] hover:bg-[#2f5f2f] text-white px-4 py-2.5 rounded-lg text-sm self-start"
          >
            <Plus size={18} />
            Nuevo Usuario
          </button>
        ) : (
          <p className="text-xs text-muted-foreground sm:pt-1">
            Solo Super Admin puede crear usuarios y asignar roles.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground">Cargando usuarios…</p>
      )}

      <div className="block sm:hidden space-y-3">
        {usersSorted.map(user => (
          <div key={user.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center gap-3 mb-3">
              <img src={logoIcon} alt="" className="logo-sidebar w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={{ fontWeight: 600 }}>{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.username}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${roleBadgeClass(user.role)}`} style={{ fontWeight: 500 }}>
                {getRoleLabel(user.role as UserRole)}
              </span>
            </div>
            {canManageUsers && (
              <div className="flex gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => { setEditing(user); setShowModal(true); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 text-primary text-xs"
                >
                  <Edit size={14} /> Editar
                </button>
                <button
                  onClick={() => setDeleteConfirm(user.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs"
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[550px]">
            <thead>
              <tr className="bg-secondary">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Usuario</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Rol</th>
                {canManageUsers && (
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {usersSorted.map(user => (
                <tr key={user.id} className="border-b border-border hover:bg-background">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={logoIcon} alt="" className="logo-sidebar w-8 h-8 rounded-full" />
                      <div>
                        <span className="text-sm block" style={{ fontWeight: 500 }}>{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${roleBadgeClass(user.role)}`} style={{ fontWeight: 500 }}>
                      {getRoleLabel(user.role as UserRole)}
                    </span>
                  </td>
                  {canManageUsers && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(user); setShowModal(true); }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => setDeleteConfirm(user.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
              disableCreate={!canManageUsers && !editing}
            />
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-2">Confirmar Eliminacion</h3>
            <p className="text-sm text-muted-foreground mb-4">¿Estas seguro de que queres eliminar este usuario?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancelar</button>
              <button onClick={() => void handleDelete(deleteConfirm)} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm">Eliminar</button>
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
  initial: ApiUser | null;
  onSave: (payload: { id?: string; username: string; name: string; role: UserRole; password?: string }) => void;
  onCancel: () => void;
  disableCreate: boolean;
}) {
  const [username, setUsername] = useState(initial?.username ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState<UserRole>((initial?.role as UserRole) ?? 'Vendedor');
  const [password, setPassword] = useState('');

  return (
    <div className="px-6 py-4 space-y-4">
      {!initial && (
        <div>
          <label className="block text-sm mb-1">Usuario (login)</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase())}
            className="w-full px-3 py-2 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
            autoComplete="off"
          />
        </div>
      )}
      <div>
        <label className="block text-sm mb-1">Nombre</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
        />
      </div>
      {!initial && (
        <div>
          <label className="block text-sm mb-1">Contraseña (mín. 8 caracteres)</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-input-background border border-border focus:border-[#3d7a3d] outline-none text-sm"
            autoComplete="new-password"
          />
        </div>
      )}
      <div>
        <label className="block text-sm mb-1">Rol</label>
        <select
          value={role}
          onChange={e => setRole(e.target.value as UserRole)}
          className="w-full px-3 py-2 rounded-lg bg-input-background border border-border outline-none text-sm"
        >
          {ASSIGNABLE_ROLES.map(r => (
            <option key={r} value={r}>{getRoleLabel(r)}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm">Cancelar</button>
        <button
          onClick={() => {
            if (!name.trim() || disableCreate) return;
            if (!initial && (!username.trim() || password.length < 8)) return;
            onSave({
              id: initial?.id,
              username: initial?.username ?? username.trim(),
              name: name.trim(),
              role,
              password: initial ? undefined : password,
            });
          }}
          disabled={disableCreate}
          className={`px-4 py-2 rounded-lg text-sm ${disableCreate ? 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 cursor-not-allowed' : 'bg-[#3d7a3d] text-white hover:bg-[#2f5f2f]'}`}
        >
          {initial ? 'Guardar' : 'Crear'}
        </button>
      </div>
    </div>
  );
}
