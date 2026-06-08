import { useMemo, useState } from "react";

import { Plus, Search, Star } from "lucide-react";

import { stations, type Station } from "./mockData";

import type { PosProduct } from "./VentasPosContext";

import { mergeSalesCategories } from "@/features/sales/lib/sales-categories";
import { useFavoriteProductIds } from "./sales-favorites";



const kitchenFilters = ["Todas", "Favoritos", ...stations] as const;

type KitchenFilter = (typeof kitchenFilters)[number];



const stationBadge: Record<Station, string> = {

  Parrilla: "bg-orange-100 text-orange-700",

  Barra: "bg-sky-100 text-sky-700",

  Cervecería: "bg-amber-100 text-amber-700",

  Cocina: "bg-emerald-100 text-emerald-700",

};



const pillClass = (active: boolean, favoritos = false) =>

  `whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition flex items-center gap-1 ${

    active

      ? favoritos

        ? "border-amber-500 bg-amber-500 text-white"

        : "border-emerald-600 bg-emerald-600 text-white"

      : "border-gray-200 bg-white text-gray-700"

  }`;



type PosProductPickerProps = {

  products: PosProduct[];

  onSelect: (product: PosProduct) => void;

  listClassName?: string;

};



export function PosProductPicker({

  products,

  onSelect,

  listClassName = "max-h-52 flex flex-col gap-2 overflow-y-auto",

}: PosProductPickerProps) {

  const [query, setQuery] = useState("");

  const [category, setCategory] = useState("Todos");

  const [kitchen, setKitchen] = useState<KitchenFilter>("Todas");

  const { favoriteIds, toggleFavorite, isFavorite } = useFavoriteProductIds();

  const categoryOptions = useMemo(
    () => ["Todos", ...mergeSalesCategories([], products.map((p) => p.category))],
    [products],
  );

  const filtered = useMemo(

    () =>

      products.filter((p) => {
        if (p.stock <= 0) return false;

        const q = query.trim().toLowerCase();
        if (q) {
          return p.name.toLowerCase().includes(q);
        }

        if (category !== "Todos" && p.category !== category) return false;
        if (kitchen === "Favoritos") return favoriteIds.includes(p.id);
        if (kitchen !== "Todas" && p.station !== kitchen) return false;
        return true;
      }),

    [products, category, kitchen, query, favoriteIds],

  );



  return (

    <div className="space-y-2">

      <div className="flex gap-2">

        <div className="relative min-w-0 flex-1">

          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

          <input

            value={query}

            onChange={(e) => setQuery(e.target.value)}

            placeholder="Buscar producto..."

            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"

          />

        </div>

        <select

          value={category}

          onChange={(e) => setCategory(e.target.value)}

          className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[9.5rem]"

          aria-label="Categoría"

        >

          {categoryOptions.map((c) => (

            <option key={c} value={c}>

              {c === "Todos" ? "Todas las categorías" : c}

            </option>

          ))}

        </select>

      </div>



      <div className="flex gap-1 overflow-x-auto pb-1">

        {kitchenFilters.map((k) => {

          const isFavoritos = k === "Favoritos";

          const active = kitchen === k;

          return (

            <button

              key={k}

              type="button"

              onClick={() => setKitchen(k)}

              className={pillClass(active, isFavoritos)}

            >

              {isFavoritos && <Star className={`h-3 w-3 ${active ? "fill-white" : "fill-amber-400 text-amber-500"}`} />}

              {k}

            </button>

          );

        })}

      </div>



      <div className={listClassName}>

        {filtered.length === 0 ? (

          <p className="py-6 text-center text-sm text-gray-400">

            {kitchen === "Favoritos"

              ? "Marcá productos con la estrella para agregarlos a Favoritos"

              : "No hay productos con stock para estos filtros"}

          </p>

        ) : (

          filtered.map((p) => (

            <div

              key={p.id}

              className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white transition hover:border-emerald-500 hover:shadow-sm"

            >

              <button

                type="button"

                onClick={(e) => {

                  e.stopPropagation();

                  toggleFavorite(p.id);

                }}

                className="shrink-0 rounded-l-xl p-2.5 text-amber-500 hover:bg-amber-50"

                title={isFavorite(p.id) ? "Quitar de favoritos" : "Agregar a favoritos"}

                aria-label={isFavorite(p.id) ? "Quitar de favoritos" : "Agregar a favoritos"}

              >

                <Star

                  className={`h-4 w-4 ${isFavorite(p.id) ? "fill-amber-400" : "fill-transparent"}`}

                />

              </button>

              <button

                type="button"

                onClick={() => onSelect(p)}

                className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-3 text-left active:scale-[0.99]"

              >

                <div className="w-10 shrink-0 text-center text-3xl">{p.emoji}</div>

                <div className="min-w-0 flex-1">

                  <div className="truncate text-gray-900">{p.name}</div>

                  <div className="flex items-center gap-1.5 text-xs text-gray-500">

                    <span>{p.category}</span>

                    <span

                      className={`rounded px-1.5 py-0.5 text-[10px] ${stationBadge[p.station]}`}

                    >

                      {p.station}

                    </span>

                  </div>

                </div>

                <div className="shrink-0 text-right">

                  <div className="text-emerald-600">${p.price.toLocaleString("es-AR")}</div>

                  <div className={`text-xs ${p.stock < 10 ? "text-red-500" : "text-gray-400"}`}>

                    Disp.: {p.stock}

                  </div>

                </div>

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">

                  <Plus className="h-4 w-4" />

                </div>

              </button>

            </div>

          ))

        )}

      </div>

    </div>

  );

}


