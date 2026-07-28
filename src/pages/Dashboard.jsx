import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/dashboard.css";
import { ProductosSection } from "./ProductosSection";
import { CobrarSection } from "./CobrarSection";
import { AnalisisSection } from "./AnalisisSection";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyHhnwmVFDDdrWN3_1q9o7URaqFkyp35XqqFRAiK9gA56n18EJnivkF2wDpptIDmRAZ/exec";

const NOMBRE_BAR = "EL ÁMBAR";

/* ---------------- Helpers ---------------- */
const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v) => {
  const n = Number(clean(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
};
const money = (n) =>
  "$" + (Number(n) || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });

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

// Caché local: guarda/lee datos para mostrar AL INSTANTE mientras se refresca.
const cacheGet = (key) => {
  try { const v = localStorage.getItem("bar_" + key); return v ? JSON.parse(v) : null; }
  catch { return null; }
};
const cacheSet = (key, val) => {
  try { localStorage.setItem("bar_" + key, JSON.stringify(val)); } catch {}
};

/* ============================================================
   COMPONENTE PRINCIPAL
   Las mesas y el menú viven AQUÍ y se guardan en localStorage,
   así al abrir la app o cambiar de pestaña se ven al instante.
   ============================================================ */
export const Dashboard = ({ user: propUser, onLogout }) => {
  const [userData, setUserData] = useState(null);
  const [tab, setTab] = useState("pedir");
  const navigate = useNavigate();

  // Estado compartido, arrancando desde el caché local (instantáneo)
  const [mesas, setMesas] = useState(() => cacheGet("mesas") || []);
  const [menu, setMenu] = useState(() => cacheGet("menu") || []);
  const [baseLista, setBaseLista] = useState(() => (cacheGet("mesas") || []).length > 0);
  const cargandoRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("userSession");
    if (!propUser && !saved) { navigate("/"); return; }
    const u = propUser || JSON.parse(saved);
    setUserData(u);
  }, [propUser, navigate]);

  const logout = () => {
    localStorage.removeItem("userSession");
    if (onLogout) onLogout();
    navigate("/");
  };

  const rol = clean(userData?.rol).toLowerCase() || "mesero";
  const esAdmin = rol === "admin";
  const esCajero = rol === "cajero" || esAdmin;
  const nombre = clean(userData?.nombre) || "Staff";
  const primerNombre = nombre.split(" ")[0];
  const idMesero = clean(userData?.id_mesero) || clean(userData?.id) || "1";

  /* ---- Carga base: mesas + menú (refresca en segundo plano) ---- */
  const cargarBase = useCallback(async () => {
    if (cargandoRef.current) return;
    cargandoRef.current = true;
    const [ms, mn] = await Promise.all([
      fetchSheet("Mesas"),
      fetchJSON(`${API_URL}?menu=1`),
    ]);
    if (Array.isArray(ms)) { setMesas(ms); cacheSet("mesas", ms); }
    if (Array.isArray(mn)) { setMenu(mn); cacheSet("menu", mn); }
    setBaseLista(true);
    cargandoRef.current = false;
  }, []);

  // Refresco SOLO de mesas (rápido, en segundo plano)
  const refrescarMesas = useCallback(async () => {
    const ms = await fetchSheet("Mesas");
    if (Array.isArray(ms)) { setMesas(ms); cacheSet("mesas", ms); }
  }, []);

  // Refresco del menú (tras activar/desactivar/editar productos)
  const refrescarMenu = useCallback(async () => {
    const mn = await fetchJSON(`${API_URL}?menu=1`);
    if (Array.isArray(mn)) { setMenu(mn); cacheSet("menu", mn); }
  }, []);

  useEffect(() => {
    if (userData) cargarBase();
  }, [userData, cargarBase]);

  // Cada vez que cambian las mesas, las guardamos en caché local
  useEffect(() => { if (mesas.length) cacheSet("mesas", mesas); }, [mesas]);

  if (!userData) return <div className="bar-loader">Cargando…</div>;

  const NAV = [
    { id: "pedir", label: "Pedir", icon: "🍺" },
    ...(esCajero ? [{ id: "cobrar", label: "Cobrar", icon: "💵" }] : []),
    ...(esCajero ? [{ id: "productos", label: "Menú", icon: "📋" }] : []),
    ...(esAdmin ? [{ id: "analisis", label: "Análisis", icon: "📊" }] : []),
  ];

  return (
    <div className="bar-dash">
      <div className="bar-dash-glow" aria-hidden="true"></div>

      <header className="bar-topbar">
        <div className="bar-topbar-left">
          <span className="bar-topbar-brand">{NOMBRE_BAR}</span>
          <span className="bar-topbar-hi">
            Hola, {primerNombre} · <i>{rol}</i>
          </span>
        </div>
        <button className="bar-logout" onClick={logout} title="Cerrar sesión">⏻</button>
      </header>

      <main className="bar-dash-main">
        {/* PedirSection SIEMPRE montado, solo se oculta: nunca se recarga */}
        <div style={{ display: tab === "pedir" ? "block" : "none" }}>
          <PedirSection
            idMesero={idMesero}
            esAdmin={esAdmin}
            mesas={mesas}
            setMesas={setMesas}
            menu={menu}
            baseLista={baseLista}
            refrescarMesas={refrescarMesas}
          />
        </div>

        {tab === "cobrar" && esCajero && (
          <CobrarSection idCajero={idMesero} onCobrado={refrescarMesas} />
        )}
        {tab === "productos" && esCajero && (
          <ProductosSection esAdmin={esAdmin} onMenuCambiado={refrescarMenu} />
        )}
        {tab === "analisis" && esAdmin && <AnalisisSection />}
      </main>

      <nav className="bar-bottomnav">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`bar-navbtn ${tab === n.id ? "on" : ""}`}
            onClick={() => setTab(n.id)}
          >
            <span className="bar-navicon">{n.icon}</span>
            <span className="bar-navlabel">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

/* ============================================================
   SECCIÓN PEDIR — optimista y rápida
   ============================================================ */
function PedirSection({ idMesero, esAdmin, mesas, setMesas, menu, baseLista, refrescarMesas }) {
  const [mesaSel, setMesaSel] = useState(null);
  const [cuenta, setCuenta] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [modalProd, setModalProd] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [toast, setToast] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [modalMesa, setModalMesa] = useState(false);
  const [nombreMesa, setNombreMesa] = useState("");
  const [creandoMesa, setCreandoMesa] = useState(false);

  const mostrarToast = (msg, dur = 2000) => {
    setToast(msg);
    setTimeout(() => setToast(""), dur);
  };

  /* ---- ABRIR MESA (optimista) ---- */
  const abrirMesa = async (mesa) => {
    setMesaSel(mesa);
    const idCuentaLocal = clean(mesa.id_cuenta_activa);
    setItems([]);
    setTotal(0);

    if (idCuentaLocal) {
      setCuenta({ id_cuenta: idCuentaLocal });
      setSincronizando(true);
      const r = await fetchJSON(`${API_URL}?cuenta_mesa=1&id_mesa=${encodeURIComponent(clean(mesa.id_mesa))}`);
      if (r && r.status === "success") {
        setItems(r.items || []);
        setTotal(r.total || 0);
        if (r.cuenta) setCuenta(r.cuenta);
      }
      setSincronizando(false);
    } else {
      setSincronizando(true);
      const r = await postAction({ action: "abrir_mesa", id_mesa: clean(mesa.id_mesa), id_mesero: idMesero });
      if (r && r.status === "success") {
        setCuenta({ id_cuenta: clean(r.id_cuenta) });
        setItems(r.items || []);
        setTotal(r.total || 0);
        setMesas((prev) => prev.map((m) =>
          clean(m.id_mesa) === clean(mesa.id_mesa)
            ? { ...m, id_cuenta_activa: clean(r.id_cuenta), estado: "ocupada" }
            : m));
      } else {
        mostrarToast(r?.message || "No se pudo abrir la mesa");
        setMesaSel(null);
      }
      setSincronizando(false);
    }
  };

  /* ---- AGREGAR PRODUCTO (optimista) ---- */
  const confirmarAgregar = async () => {
    if (!cuenta || !modalProd) return;
    const prod = modalProd;
    const cant = cantidad;
    const notaTxt = nota;
    const precio = num(prod.precio);
    const subtotal = precio * cant;

    const tempId = "tmp_" + Date.now();
    const nuevoItem = {
      id_detalle: tempId,
      nombre_producto: clean(prod.nombre),
      cantidad: cant,
      subtotal: subtotal,
      nota: notaTxt,
      _pendiente: true,
    };
    setItems((prev) => [...prev, nuevoItem]);
    setTotal((prev) => prev + subtotal);

    setModalProd(null);
    setCantidad(1);
    setNota("");

    const r = await postAction({
      action: "agregar_producto",
      id_cuenta: clean(cuenta.id_cuenta),
      id_producto: clean(prod.id_producto),
      cantidad: cant,
      id_mesero: idMesero,
      nota: notaTxt,
    });

    if (r && r.status === "success") {
      setItems((prev) => prev.map((it) =>
        it.id_detalle === tempId
          ? { ...it, id_detalle: r.id_detalle, _pendiente: false }
          : it));
      if (typeof r.total === "number") setTotal(r.total);
      mostrarToast(`✓ ${cant}× ${clean(prod.nombre)} guardado`, 2600);
    } else {
      setItems((prev) => prev.filter((it) => it.id_detalle !== tempId));
      setTotal((prev) => prev - subtotal);
      // Si el backend lo rechazó por estar inactivo, muestra su mensaje real
      mostrarToast(r?.message || "No se pudo guardar, intenta de nuevo", 2800);
    }
  };

  /* ---- QUITAR PRODUCTO (optimista) ---- */
  const anularItem = async (item) => {
    const idDetalle = item.id_detalle;
    if (item._pendiente) {
      mostrarToast("Espera a que termine de guardar");
      return;
    }
    const subtotal = num(item.subtotal);

    setItems((prev) => prev.filter((it) => it.id_detalle !== idDetalle));
    setTotal((prev) => prev - subtotal);
    mostrarToast("Producto quitado");

    const r = await postAction({ action: "anular_detalle", id_detalle: idDetalle });
    if (!r || r.status !== "success") {
      setItems((prev) => [...prev, item]);
      setTotal((prev) => prev + subtotal);
      mostrarToast("No se pudo quitar, intenta de nuevo");
    }
  };

  const volverAMesas = () => {
    setMesaSel(null);
    setCuenta(null);
    setItems([]);
    setTotal(0);
    refrescarMesas();
  };

  /* ---- CREAR MESA (admin) ---- */
  const crearMesa = async () => {
    const nombreFinal = clean(nombreMesa);
    if (!nombreFinal) { mostrarToast("Escribe un nombre para la mesa"); return; }
    setCreandoMesa(true);

    const token = "m" + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 5);

    const r = await postAction({
      action: "create",
      sheet: "Mesas",
      data: { nombre_mesa: nombreFinal, token_qr: token, id_cuenta_activa: "", estado: "libre" },
    });
    setCreandoMesa(false);

    if (r && r.status === "success") {
      setMesas((prev) => [...prev, {
        id_mesa: r.id, nombre_mesa: nombreFinal, token_qr: token,
        id_cuenta_activa: "", estado: "libre",
      }]);
      setModalMesa(false);
      setNombreMesa("");
      mostrarToast(`✓ ${nombreFinal} creada`, 2600);
    } else {
      mostrarToast(r?.message || "No se pudo crear la mesa");
    }
  };

  const categorias = useMemo(() => {
    const set = new Set(["Todas"]);
    menu.forEach((p) => { const c = clean(p.categoria); if (c) set.add(c); });
    return [...set];
  }, [menu]);

  const menuFiltrado = useMemo(() => {
    return menu.filter((p) => {
      const okCat = categoria === "Todas" || clean(p.categoria) === categoria;
      const okBusq = !busqueda || clean(p.nombre).toLowerCase().includes(busqueda.toLowerCase());
      return okCat && okBusq;
    });
  }, [menu, categoria, busqueda]);

  // Solo "cargando" la primerísima vez, si no hay nada en caché
  if (!baseLista && mesas.length === 0) {
    return (
      <div className="bar-sec-loading">
        <span className="bar-spinner-amber"></span>
        <p>Cargando mesas…</p>
      </div>
    );
  }

  /* ---- VISTA 1: grid de mesas ---- */
  if (!mesaSel) {
    return (
      <div className="bar-sec">
        <div className="bar-sec-head">
          <div className="bar-sec-head-row">
            <div>
              <h2 className="bar-sec-title">Mesas</h2>
              <p className="bar-sec-sub">Toca una mesa para tomar su pedido</p>
            </div>
            <button className="bar-refresh-btn" onClick={refrescarMesas} aria-label="Actualizar mesas">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6"></path>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            </button>
          </div>
        </div>
        <div className="bar-mesas-grid">
          {mesas.map((m) => {
            const ocupada = clean(m.estado).toLowerCase() === "ocupada" || !!clean(m.id_cuenta_activa);
            return (
              <button
                key={clean(m.id_mesa)}
                className={`bar-mesa-card ${ocupada ? "ocupada" : "libre"}`}
                onClick={() => abrirMesa(m)}
              >
                <span className="bar-mesa-icon">{ocupada ? "🍽️" : "＋"}</span>
                <span className="bar-mesa-nombre">{clean(m.nombre_mesa) || `Mesa ${clean(m.id_mesa)}`}</span>
                <span className="bar-mesa-estado">{ocupada ? "Ocupada" : "Libre"}</span>
              </button>
            );
          })}

          {/* Botón crear mesa (SOLO ADMIN) */}
          {esAdmin && (
            <button
              className="bar-mesa-card nueva"
              onClick={() => { setModalMesa(true); setNombreMesa(""); }}
            >
              <span className="bar-mesa-icon">➕</span>
              <span className="bar-mesa-nombre">Nueva mesa</span>
              <span className="bar-mesa-estado">Crear</span>
            </button>
          )}
        </div>

        {/* Modal crear mesa */}
        {modalMesa && (
          <div className="bar-modal-overlay" onClick={() => setModalMesa(false)}>
            <div className="bar-modal" onClick={(e) => e.stopPropagation()}>
              <div className="bar-modal-head">
                <h3>Nueva mesa</h3>
                <span>Se crea libre y con su QR listo</span>
              </div>
              <div className="bar-form-field">
                <label>Nombre de la mesa</label>
                <input
                  value={nombreMesa}
                  onChange={(e) => setNombreMesa(e.target.value)}
                  placeholder="Ej. Mesa 6, Barra 1, Terraza…"
                  autoFocus
                />
              </div>
              <div className="bar-modal-actions">
                <button className="bar-modal-cancel" onClick={() => setModalMesa(false)}>Cancelar</button>
                <button className="bar-modal-ok" onClick={crearMesa} disabled={creandoMesa}>
                  {creandoMesa ? "Creando…" : "Crear mesa"}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && <div className="bar-toast">{toast}</div>}
      </div>
    );
  }

  /* ---- VISTA 2: pedido de una mesa ---- */
  return (
    <div className="bar-sec bar-pedido">
      <div className="bar-pedido-head">
        <button className="bar-back-btn" onClick={volverAMesas}>← Mesas</button>
        <span className="bar-pedido-mesa">
          {clean(mesaSel.nombre_mesa) || `Mesa ${clean(mesaSel.id_mesa)}`}
        </span>
        {sincronizando && <span className="bar-sync-dot" title="Sincronizando…"></span>}
      </div>

      <div className="bar-cuenta-box">
        <div className="bar-cuenta-box-head">
          <span>Cuenta actual</span>
          <b>{money(total)}</b>
        </div>
        {items.length === 0 ? (
          <p className="bar-cuenta-vacia">Sin productos aún. Agrega del menú abajo.</p>
        ) : (
          <ul className="bar-cuenta-list">
            {items.map((it) => (
              <li key={clean(it.id_detalle)} className={it._pendiente ? "pendiente" : ""}>
                <span className="bar-ci-qty">{clean(it.cantidad)}×</span>
                <span className="bar-ci-name">
                  {clean(it.nombre_producto)}
                  {clean(it.nota) && <i className="bar-ci-nota"> · {clean(it.nota)}</i>}
                </span>
                <span className="bar-ci-price">{money(it.subtotal)}</span>
                <button className="bar-ci-del" onClick={() => anularItem(it)} aria-label="Quitar">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bar-menu-head">
        <input
          className="bar-search"
          placeholder="Buscar producto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="bar-cats">
        {categorias.map((c) => (
          <button key={c} className={`bar-cat ${categoria === c ? "on" : ""}`} onClick={() => setCategoria(c)}>{c}</button>
        ))}
      </div>

      <div className="bar-prod-grid">
        {menuFiltrado.map((p) => (
          <button
            key={clean(p.id_producto)}
            className="bar-prod-card"
            onClick={() => { setModalProd(p); setCantidad(1); setNota(""); }}
          >
            <span className="bar-prod-nombre">{clean(p.nombre)}</span>
            <span className="bar-prod-precio">{money(p.precio)}</span>
          </button>
        ))}
        {menuFiltrado.length === 0 && (
          <p className="bar-empty-inline">No hay productos con ese filtro.</p>
        )}
      </div>

      {modalProd && (
        <div className="bar-modal-overlay" onClick={() => setModalProd(null)}>
          <div className="bar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bar-modal-head">
              <h3>{clean(modalProd.nombre)}</h3>
              <span>{money(modalProd.precio)} c/u</span>
            </div>

            <div className="bar-qty-row">
              <button className="bar-qty-btn" onClick={() => setCantidad((c) => Math.max(1, c - 1))}>−</button>
              <span className="bar-qty-num">{cantidad}</span>
              <button className="bar-qty-btn" onClick={() => setCantidad((c) => c + 1)}>＋</button>
            </div>

            <input
              className="bar-nota-input"
              placeholder="Nota (opcional): sin hielo, bien fría…"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />

            <div className="bar-modal-total">
              <span>Subtotal</span>
              <b>{money(num(modalProd.precio) * cantidad)}</b>
            </div>

            <div className="bar-modal-actions">
              <button className="bar-modal-cancel" onClick={() => setModalProd(null)}>Cancelar</button>
              <button className="bar-modal-ok" onClick={confirmarAgregar}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="bar-toast">{toast}</div>}
    </div>
  );
}