import { useState } from "react";
import { Plus, Users, DollarSign, X, Trash2 } from "lucide-react";
import { TeamAccount, initialTeams } from "./mockData";
import { useStore } from "./VentasPosContext";

export function TablesModule() {
  const { products: initialProducts } = useStore();
  const [teams, setTeams] = useState<TeamAccount[]>(initialTeams);
  const [selected, setSelected] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);

  const current = teams.find((t) => t.id === selected);

  const openTeam = () => {
    if (!newName.trim()) return;
    const id = `t${Date.now()}`;
    setTeams([
      ...teams,
      {
        id,
        team: newName,
        openedAt: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
        status: "abierta",
        items: [],
      },
    ]);
    setNewName("");
    setShowNew(false);
    setSelected(id);
  };

  const addProductToTeam = (productId: string) => {
    const p = initialProducts.find((x) => x.id === productId);
    if (!p || !current) return;
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id !== current.id) return t;
        const ex = t.items.find((i) => i.productId === productId);
        if (ex)
          return {
            ...t,
            items: t.items.map((i) =>
              i.productId === productId ? { ...i, qty: i.qty + 1 } : i
            ),
          };
        return {
          ...t,
          items: [...t.items, { productId, name: p.name, price: p.price, qty: 1 }],
        };
      })
    );
  };

  const removeItem = (pid: string) => {
    if (!current) return;
    setTeams((prev) =>
      prev.map((t) =>
        t.id === current.id ? { ...t, items: t.items.filter((i) => i.productId !== pid) } : t
      )
    );
  };

  const closeAccount = () => {
    if (!current) return;
    if (!confirm(`¿Cobrar y cerrar cuenta de ${current.team}?`)) return;
    setTeams((prev) => prev.filter((t) => t.id !== current.id));
    setSelected(null);
  };

  const total = current?.items.reduce((s, i) => s + i.price * i.qty, 0) || 0;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      <div className={`${selected ? "hidden lg:flex" : "flex"} flex-col flex-1 lg:max-w-md`}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-gray-900">Cuentas Abiertas ({teams.length})</h3>
          <button
            onClick={() => setShowNew(true)}
            className="bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Nueva
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto pb-20 lg:pb-0">
          {teams.map((t) => {
            const tot = t.items.reduce((s, i) => s + i.price * i.qty, 0);
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full text-left bg-white rounded-xl border p-4 transition ${
                  selected === t.id ? "border-emerald-500 ring-2 ring-emerald-100" : "border-gray-200"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                    <span className="text-gray-900">{t.team}</span>
                  </div>
                  <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded">
                    Abierta
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Desde {t.openedAt} · {t.items.length} ítems</span>
                  <span className="text-emerald-600">${tot.toLocaleString()}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {current && (
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div>
              <button
                onClick={() => setSelected(null)}
                className="lg:hidden text-emerald-600 mb-1"
              >
                ← Volver
              </button>
              <h3 className="text-gray-900">{current.team}</h3>
              <span className="text-sm text-gray-500">Abierta {current.openedAt}</span>
            </div>
            <button
              onClick={() => setShowAddProduct(true)}
              className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Producto
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {current.items.length === 0 ? (
              <div className="text-center py-12 text-gray-400">Sin productos aún</div>
            ) : (
              current.items.map((i) => (
                <div
                  key={i.productId}
                  className="flex justify-between items-center bg-gray-50 rounded-lg p-3"
                >
                  <div>
                    <div className="text-gray-900">{i.name}</div>
                    <div className="text-sm text-gray-500">
                      {i.qty} × ${i.price.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-600">
                      ${(i.qty * i.price).toLocaleString()}
                    </span>
                    <button
                      onClick={() => removeItem(i.productId)}
                      className="text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Total acumulado</span>
              <span className="text-2xl text-emerald-600">${total.toLocaleString()}</span>
            </div>
            <button
              onClick={closeAccount}
              disabled={current.items.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <DollarSign className="w-5 h-5" />
              Cobrar y Cerrar Cuenta
            </button>
          </div>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm">
            <div className="flex justify-between items-center mb-3">
              <h3>Abrir cuenta de equipo</h3>
              <button onClick={() => setShowNew(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej: Los Pibes FC"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-3"
            />
            <button
              onClick={openTeam}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg"
            >
              Abrir cuenta
            </button>
          </div>
        </div>
      )}

      {showAddProduct && current && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3>Agregar a {current.team}</h3>
              <button onClick={() => setShowAddProduct(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto">
              {initialProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProductToTeam(p.id)}
                  className="border border-gray-200 rounded-lg p-3 text-left hover:border-emerald-500"
                >
                  <div className="text-2xl">{p.emoji}</div>
                  <div className="text-sm text-gray-900">{p.name}</div>
                  <div className="text-xs text-emerald-600">${p.price.toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
