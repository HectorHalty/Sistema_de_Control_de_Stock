import { useState, useMemo } from "react";
import { Calendar, Download, FileSpreadsheet, TrendingUp } from "lucide-react";
import { useStore } from "./VentasPosContext";
import { filterTicketsByDateRange } from "../sales-metrics";
import { Station, stations } from "./mockData";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type StationReport = {
  station: Station;
  products: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  totalRevenue: number;
  totalUnits: number;
};

export function ReportesModule() {
  const { salesTickets, products } = useStore();
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const report = useMemo(() => {
    const validTickets = filterTicketsByDateRange(salesTickets, dateFrom, dateTo);

    const stationData = new Map<
      Station,
      Map<string, { name: string; quantity: number; unitPrice: number; total: number }>
    >();

    stations.forEach((station) => stationData.set(station, new Map()));

    validTickets.forEach((ticket) => {
      ticket.items.forEach((item) => {
        const product = products.find((p) => p.id === item.salesProductId);
        if (!product) return;

        const stationMap = stationData.get(product.station);
        if (!stationMap) return;

        const existing = stationMap.get(item.salesProductId) || {
          name: item.name,
          quantity: 0,
          unitPrice: item.unitPrice,
          total: 0,
        };

        stationMap.set(item.salesProductId, {
          name: item.name,
          quantity: existing.quantity + item.quantity,
          unitPrice: item.unitPrice,
          total: existing.total + item.unitPrice * item.quantity,
        });
      });
    });

    const reports: StationReport[] = stations.map((station) => {
      const productsMap = stationData.get(station)!;
      const products = Array.from(productsMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "es")
      );
      const totalRevenue = products.reduce((sum, p) => sum + p.total, 0);
      const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0);

      return { station, products, totalRevenue, totalUnits };
    });

    return reports;
  }, [salesTickets, products, dateFrom, dateTo]);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Calcular total general
    const grandTotal = report.reduce((sum, r) => sum + r.totalRevenue, 0);
    const grandTotalUnits = report.reduce((sum, r) => sum + r.totalUnits, 0);

    // Construir datos en una sola hoja
    const data: any[][] = [
      ["REPORTE DE VENTAS POR COCINA"],
      [`Período: ${format(parseISO(dateFrom), "dd/MM/yyyy", { locale: es })} - ${format(parseISO(dateTo), "dd/MM/yyyy", { locale: es })}`],
      [],
      ["TOTAL RECAUDADO GENERAL", "", "", `$${grandTotal.toLocaleString("es-AR")}`],
      ["TOTAL UNIDADES VENDIDAS", "", "", grandTotalUnits],
      [],
      [],
    ];

    // Agregar tabla por cada cocina
    report.forEach((stationReport, index) => {
      // Encabezado de la cocina
      data.push([`${stationReport.station.toUpperCase()}`]);
      data.push(["Producto", "Cantidad", "Precio de Venta", "Total Recaudado"]);

      // Productos de la cocina
      if (stationReport.products.length > 0) {
        stationReport.products.forEach((p) => {
          data.push([
            p.name,
            p.quantity,
            `$${p.unitPrice.toLocaleString("es-AR")}`,
            `$${p.total.toLocaleString("es-AR")}`,
          ]);
        });
      } else {
        data.push(["Sin ventas en este período", "", "", "$0"]);
      }

      // Total por cocina
      data.push([
        `TOTAL ${stationReport.station.toUpperCase()}`,
        stationReport.totalUnits,
        "",
        `$${stationReport.totalRevenue.toLocaleString("es-AR")}`,
      ]);

      // Espaciado entre tablas
      if (index < report.length - 1) {
        data.push([]);
        data.push([]);
      }
    });

    // Crear hoja
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Configurar anchos de columna
    worksheet["!cols"] = [{ wch: 35 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];

    // Agregar hoja al workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte de Ventas");

    // Descargar archivo
    const fileName = `Reporte_Ventas_${format(parseISO(dateFrom), "yyyyMMdd")}_${format(parseISO(dateTo), "yyyyMMdd")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const totalGeneral = report.reduce((sum, r) => sum + r.totalRevenue, 0);
  const totalUnitsGeneral = report.reduce((sum, r) => sum + r.totalUnits, 0);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h3 className="text-2xl text-gray-900 dark:text-gray-100">Reportes de Ventas</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Resumen por estación de cocina
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
              Desde:
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg"
            />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
              Hasta:
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <FileSpreadsheet className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-sm opacity-90 mb-1">Total Recaudado</div>
          <div className="text-2xl">${totalGeneral.toLocaleString("es-AR")}</div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <FileSpreadsheet className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-sm opacity-90 mb-1">Unidades Vendidas</div>
          <div className="text-2xl">{totalUnitsGeneral}</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 opacity-80" />
          </div>
          <div className="text-sm opacity-90 mb-1">Período</div>
          <div className="text-sm">
            {format(parseISO(dateFrom), "dd/MM/yy", { locale: es })} -{" "}
            {format(parseISO(dateTo), "dd/MM/yy", { locale: es })}
          </div>
        </div>

        <button
          onClick={exportToExcel}
          className="bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl p-5 text-white shadow-lg transition flex flex-col items-start justify-center"
        >
          <Download className="w-8 h-8 mb-2" />
          <div className="text-sm opacity-90 mb-1">Descargar Excel</div>
          <div className="text-xs opacity-75">Todas las estaciones</div>
        </button>
      </div>

      <div className="flex-1 space-y-4 min-h-0">
        {report.map((stationReport) => (
          <div
            key={stationReport.station}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h4 className="text-lg text-gray-900 dark:text-gray-100">
                  {stationReport.station}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {stationReport.products.length} productos •{" "}
                  {stationReport.totalUnits} unidades •{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ${stationReport.totalRevenue.toLocaleString("es-AR")}
                  </span>
                </p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs ${
                  stationReport.station === "Parrilla"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    : stationReport.station === "Barra"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : stationReport.station === "Cervecería"
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                }`}
              >
                {stationReport.station}
              </div>
            </div>

            {stationReport.products.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No hay ventas en este período
              </div>
            ) : (
              <div className="p-4">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                        <th className="px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300">
                          Producto
                        </th>
                        <th className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                          Cantidad
                        </th>
                        <th className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                          Precio Unit.
                        </th>
                        <th className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stationReport.products.map((product, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                        >
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                            {product.name}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            {product.quantity}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            ${product.unitPrice.toLocaleString("es-AR")}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                            ${product.total.toLocaleString("es-AR")}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 dark:bg-gray-700/50">
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                          <strong>Total {stationReport.station}</strong>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                          <strong>{stationReport.totalUnits}</strong>
                        </td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                          <strong>${stationReport.totalRevenue.toLocaleString("es-AR")}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
