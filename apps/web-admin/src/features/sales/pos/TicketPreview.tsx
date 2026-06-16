import { Ticket, TicketTemplate } from "./VentasPosContext";
import logo from "@/assets/baner-chacra.png";

const sizes = { sm: "text-[11px]", md: "text-xs", lg: "text-sm" } as const;

export function TicketPreview({
  ticket,
  template,
  paperWidth = 80,
}: {
  ticket: Ticket;
  template: TicketTemplate;
  paperWidth?: 58 | 80;
}) {
  const w = paperWidth === 58 ? "w-[220px]" : "w-[280px]";
  const isVoid = ticket.status === "anulado";
  const isReturn = ticket.kind === "devolucion";

  return (
    <div
      className={`${w} mx-auto bg-white border border-dashed border-gray-300 p-3 font-mono ${
        sizes[template.fontSize]
      } text-gray-900 relative`}
    >
      {isVoid && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="border-4 border-red-500 text-red-500 px-3 py-1 rounded -rotate-12 text-base">
            ANULADO
          </span>
        </div>
      )}

      {template.showLogo && (
        <div className="flex justify-center mb-1">
          <img src={logo} alt="La Chacra Fútbol" className="h-10 object-contain" />
        </div>
      )}
      <div className="text-center uppercase">{template.header}</div>
      {isReturn && (
        <div className="text-center bg-amber-100 text-amber-800 my-1 py-0.5 rounded uppercase">
          ** Comprobante de Devolución **
        </div>
      )}
      {template.subheader && (
        <div className="text-center text-[10px] mb-1">{template.subheader}</div>
      )}
      <div className="border-t border-dashed border-gray-400 my-2" />

      <div className="flex justify-between">
        <span>Ticket Nº</span>
        <span>{ticket.number.toString().padStart(6, "0")}</span>
      </div>
      {template.showDate && (
        <div className="flex justify-between">
          <span>Fecha</span>
          <span>{ticket.createdAt}</span>
        </div>
      )}
      {template.showOperator && (
        <div className="flex justify-between">
          <span>Operador</span>
          <span>{ticket.operator}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span>Origen</span>
        <span>
          {ticket.source}
          {ticket.context ? ` · ${ticket.context}` : ""}
        </span>
      </div>

      <div className="border-t border-dashed border-gray-400 my-2" />

      <div className="space-y-0.5">
        {ticket.items.map((i) => (
          <div key={i.productId}>
            <div className="flex justify-between items-baseline gap-1">
              <span className="truncate pr-1 font-bold text-sm">
                {i.qty}× {i.name}
              </span>
              <span className="shrink-0 font-bold text-sm">
                ${(i.qty * i.price).toLocaleString()}
              </span>
            </div>
            {i.station && (
              <div className="text-[10px] uppercase tracking-wide text-gray-600 pl-3">
                Retirar en: {i.station}
              </div>
            )}
            {template.showItemDetails && (
              <div className="text-[10px] text-gray-500 pl-3">
                @ ${i.price.toLocaleString()} c/u
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-gray-400 my-2" />

      <div className="flex justify-between">
        <span>{isReturn ? "TOTAL DEVOLUCIÓN" : "TOTAL"}</span>
        <span className={isReturn ? "text-red-600" : ""}>
          {isReturn ? "-" : ""}${ticket.total.toLocaleString()}
        </span>
      </div>

      {isVoid && (
        <div className="border-t border-dashed border-red-400 mt-2 pt-2 text-red-600 text-[10px]">
          <div>** COMANDA ANULADA **</div>
          <div>Anulado: {ticket.voidedAt}</div>
        </div>
      )}

      <div className="border-t border-dashed border-gray-400 my-2" />
      <div className="text-center text-[10px]">{template.footer}</div>
    </div>
  );
}
