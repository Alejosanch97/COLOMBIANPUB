import React, { useState, useEffect, useCallback } from "react";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyHhnwmVFDDdrWN3_1q9o7URaqFkyp35XqqFRAiK9gA56n18EJnivkF2wDpptIDmRAZ/exec";

const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v) => { const n = Number(clean(v).replace(",", ".")); return isNaN(n) ? 0 : n; };
const money = (n) => "$" + (Number(n) || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });

const fetchJSON = async (url, opts) => {
  const res = await fetch(url, opts);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return null; }
};
const fetchSheet = async (sheet) => {
  const data = await fetchJSON(`${API_URL}?sheet=${encodeURIComponent(sheet)}`);
  return Array.isArray(data) ? data : [];
};
const postAction = async (payload) =>
  fetchJSON(API_URL, { method: "POST", body: JSON.stringify(payload) });

/* ============================================================
   SECCIÓN COBRAR — solo cajero
   Ve mesas ocupadas → revisa la cuenta → registra pago → libera
   ============================================================ */
export function CobrarSection({ idCajero }) {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesaSel, setMesaSel] = useState(null);
  const [detalle, setDetalle] = useState(null); // {mesa, cuenta, items, total}
  const [cargando, setCargando] = useState(false);
  const [metodo, setMetodo] = useState("efectivo");
  const [cobrando, setCobrando] = useState(false);
  const [toast, setToast] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    const ms = await fetchSheet("Mesas");
    // Solo mesas ocupadas (con cuenta activa)
    setMesas(ms.filter((m) => clean(m.id_cuenta_activa) || clean(m.estado).toLowerCase() === "ocupada"));
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const mostrarToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const verMesa = async (mesa) => {
    setMesaSel(mesa);
    setCargando(true);
    const r = await fetchJSON(`${API_URL}?cuenta_mesa=1&id_mesa=${encodeURIComponent(clean(mesa.id_mesa))}`);
    setCargando(false);
    if (r && r.status === "success") {
      setDetalle(r);
    } else {
      mostrarToast(r?.message || "No se pudo cargar la cuenta");
      setMesaSel(null);
    }
  };

  const cobrar = async () => {
    if (!detalle?.cuenta) return;
    setCobrando(true);
    const r = await postAction({
      action: "cerrar_cuenta",
      id_cuenta: clean(detalle.cuenta.id_cuenta),
      id_cajero_cierre: idCajero,
      metodo_pago: metodo,
    });
    setCobrando(false);
    if (r && r.status === "success") {
      mostrarToast(`Cobrado ${money(r.total)} · mesa liberada`);
      setMesaSel(null);
      setDetalle(null);
      cargar();
    } else {
      mostrarToast(r?.message || "No se pudo cerrar la cuenta");
    }
  };

  if (loading) {
    return (
      <div className="bar-sec-loading">
        <span className="bar-spinner-amber"></span>
        <p>Cargando caja…</p>
      </div>
    );
  }

  /* ---- Detalle de una mesa para cobrar ---- */
  if (mesaSel) {
    return (
      <div className="bar-sec bar-pedido">
        <div className="bar-pedido-head">
          <button className="bar-back-btn" onClick={() => { setMesaSel(null); setDetalle(null); }}>← Mesas</button>
          <span className="bar-pedido-mesa">
            {clean(mesaSel.nombre_mesa) || `Mesa ${clean(mesaSel.id_mesa)}`}
          </span>
        </div>

        {cargando ? (
          <div className="bar-sec-loading">
            <span className="bar-spinner-amber"></span>
            <p>Cargando cuenta…</p>
          </div>
        ) : detalle ? (
          <>
            <div className="bar-cuenta-box">
              <div className="bar-cuenta-box-head">
                <span>Cuenta</span>
                <b>{money(detalle.total)}</b>
              </div>
              {detalle.items.length === 0 ? (
                <p className="bar-cuenta-vacia">Esta mesa no tiene consumo.</p>
              ) : (
                <ul className="bar-cuenta-list">
                  {detalle.items.map((it) => (
                    <li key={clean(it.id_detalle)}>
                      <span className="bar-ci-qty">{clean(it.cantidad)}×</span>
                      <span className="bar-ci-name">{clean(it.nombre_producto)}</span>
                      <span className="bar-ci-price">{money(it.subtotal)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Método de pago */}
            <div className="bar-pago-box">
              <span className="bar-pago-label">Método de pago</span>
              <div className="bar-pago-metodos">
                {[
                  { id: "efectivo", label: "Efectivo", icon: "💵" },
                  { id: "tarjeta", label: "Tarjeta", icon: "💳" },
                  { id: "transferencia", label: "Transfer.", icon: "📱" },
                ].map((m) => (
                  <button
                    key={m.id}
                    className={`bar-pago-metodo ${metodo === m.id ? "on" : ""}`}
                    onClick={() => setMetodo(m.id)}
                  >
                    <span>{m.icon}</span>{m.label}
                  </button>
                ))}
              </div>

              <div className="bar-pago-total">
                <span>Total a cobrar</span>
                <b>{money(detalle.total)}</b>
              </div>

              <button className="bar-cobrar-btn" onClick={cobrar} disabled={cobrando || detalle.items.length === 0}>
                {cobrando ? "Procesando…" : `Cobrar y cerrar mesa`}
              </button>
            </div>
          </>
        ) : null}

        {toast && <div className="bar-toast">{toast}</div>}
      </div>
    );
  }

  /* ---- Grid de mesas ocupadas ---- */
  return (
    <div className="bar-sec">
      <div className="bar-sec-head">
        <h2 className="bar-sec-title">Cobrar</h2>
        <p className="bar-sec-sub">Mesas con cuenta abierta</p>
      </div>

      {mesas.length === 0 ? (
        <div className="bar-cli-empty" style={{ margin: "40px auto" }}>
          <span className="bar-cli-emoji">✨</span>
          <h2>No hay mesas para cobrar</h2>
          <p>Todas las mesas están libres por ahora.</p>
          <button className="bar-btn-ghost" onClick={cargar}>Actualizar</button>
        </div>
      ) : (
        <div className="bar-mesas-grid">
          {mesas.map((m) => (
            <button
              key={clean(m.id_mesa)}
              className="bar-mesa-card ocupada"
              onClick={() => verMesa(m)}
            >
              <span className="bar-mesa-icon">💵</span>
              <span className="bar-mesa-nombre">{clean(m.nombre_mesa) || `Mesa ${clean(m.id_mesa)}`}</span>
              <span className="bar-mesa-estado">Cobrar</span>
            </button>
          ))}
        </div>
      )}

      {toast && <div className="bar-toast">{toast}</div>}
    </div>
  );
}