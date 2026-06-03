import { Shield, User as UserIcon, UserCheck } from "lucide-react";
import { useStore } from './VentasPosContext';

export function UsersModule() {
  const { users, toggleRole, currentUser, setCurrentUser } = useStore();

  return (
    <div className="space-y-3 pb-20 lg:pb-4">
      <div className="flex justify-between items-center">
        <h3 className="text-gray-900">Usuarios y Roles ({users.length})</h3>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
        Los <strong>Administradores</strong> tienen acceso total. Los <strong>Operadores</strong>{" "}
        solo acceden a Mostrador y Mesas. La sesión activa registrará las ventas y anulaciones a su
        nombre.
      </div>

      <div className="space-y-2">
        {users.map((u) => {
          const active = u.id === currentUser.id;
          return (
            <div
              key={u.id}
              className={`bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                active ? "border-emerald-500 ring-2 ring-emerald-100" : "border-gray-200"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                {u.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-gray-900 flex items-center gap-2">
                  {u.name}
                  {active && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                      Activo
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 truncate">{u.email}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                    u.role === "Admin"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {u.role === "Admin" ? (
                    <Shield className="w-3.5 h-3.5" />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5" />
                  )}
                  {u.role}
                </span>
                <button
                  onClick={() => toggleRole(u.id)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition"
                >
                  Cambiar a {u.role === "Admin" ? "Operador" : "Admin"}
                </button>
                {!active && (
                  <button
                    onClick={() => setCurrentUser(u.id)}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm flex items-center gap-1"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Iniciar sesión
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
