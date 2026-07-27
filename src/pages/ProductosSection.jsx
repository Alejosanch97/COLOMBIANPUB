import React, { useState, useEffect, useCallback, useMemo } from "react";
import { UsuariosSection } from "./UsuariosSection";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyHhnwmVFDDdrWN3_1q9o7URaqFkyp35XqqFRAiK9gA56n18EJnivkF2wDpptIDmRAZ/exec";

const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v) => { const n = Number(clean(v).replace(",", ".")); return isNaN(n) ? 0 : n; };
const money = (n) => "$" + (Number(n) || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
const esActivo = (v) => ["SI", "TRUE", "VERDADERO", "1"].indexOf(clean(v).toUpperCase()) !== -1;

const fetchJSON = async (url, opts) => {
  const res = await fetch(url, opts);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return null; }
};
const postAction = async (payload) =>
  fetchJSON(API_URL, { method: "POST", body: JSON.stringify(payload) });

/* ============================================================
   WRAPPER: SECCIÓN MENÚ
   - Cajero: solo ve el panel de Productos.
   - Admin:  ve un switch para alternar Productos / Usuarios.
   ============================================================ */
export function ProductosSection({ esAdmin }) {
  const [vista, setVista] = useState("productos"); // productos | usuarios

  // El cajero (no admin) solo ve productos, sin switch.
  if (!esAdmin) {
    return (
      <div className="bar-sec">
        <div className="bar-sec-head">
          <h2 className="bar-sec-title">Menú</h2>
          <p className="bar-sec-sub">Activa o desactiva productos disponibles</p>
        </div>
        <ProductosPanel esAdmin={false} />
      </div>
    );
  }

  // Admin: switch Productos / Usuarios
  return (
    <div className="bar-sec">
      <div className="bar-sec-head">
        <h2 className="bar-sec-title">Administración</h2>
        <p className="bar-sec-sub">Gestiona tu menú y tu equipo</p>
      </div>

      <div className="bar-switch">
        <button
          className={vista === "productos" ? "on" : ""}
          onClick={() => setVista("productos")}
        >📋 Productos</button>
        <button
          className={vista === "usuarios" ? "on" : ""}
          onClick={() => setVista("usuarios")}
        >👤 Usuarios</button>
      </div>

      {vista === "productos" ? <ProductosPanel esAdmin={true} /> : <UsuariosSection />}
    </div>
  );
}

/* ============================================================
   PANEL DE PRODUCTOS
   - Cajero: activar / desactivar
   - Admin: además crear / editar / borrar
   ============================================================ */
function ProductosPanel({ esAdmin }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(null); // {modo:'crear'|'editar', data}
  const [form, setForm] = useState({ nombre: "", categoria: "", precio: "", activo: "SI" });
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const data = await fetchJSON(`${API_URL}?sheet=Productos`);
    setProductos(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const mostrarToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  // Activar / desactivar (cajero y admin)
  const toggleActivo = async (p) => {
    const nuevo = esActivo(p.activo) ? "NO" : "SI";
    // Optimista
    setProductos((prev) => prev.map((x) =>
      clean(x.id_producto) === clean(p.id_producto) ? { ...x, activo: nuevo } : x));
    const r = await postAction({
      action: "update",
      sheet: "Productos",
      idField: "id_producto",
      idValue: clean(p.id_producto),
      data: { activo: nuevo },
    });
    if (!r || r.status !== "success") {
      mostrarToast("No se pudo actualizar");
      cargar();
    } else {
      mostrarToast(nuevo === "SI" ? "Producto activado" : "Producto desactivado");
    }
  };

  const abrirCrear = () => {
    setForm({ nombre: "", categoria: "", precio: "", activo: "SI" });
    setModal({ modo: "crear" });
  };
  const abrirEditar = (p) => {
    setForm({
      nombre: clean(p.nombre),
      categoria: clean(p.categoria),
      precio: clean(p.precio),
      activo: esActivo(p.activo) ? "SI" : "NO",
    });
    setModal({ modo: "editar", data: p });
  };

  const guardar = async () => {
    if (!clean(form.nombre) || !clean(form.precio)) {
      mostrarToast("Nombre y precio son obligatorios");
      return;
    }
    setGuardando(true);
    let r;
    if (modal.modo === "crear") {
      r = await postAction({
        action: "create",
        sheet: "Productos",
        data: {
          nombre: clean(form.nombre),
          categoria: clean(form.categoria),
          precio: num(form.precio),
          activo: form.activo,
        },
      });
    } else {
      r = await postAction({
        action: "update",
        sheet: "Productos",
        idField: "id_producto",
        idValue: clean(modal.data.id_producto),
        data: {
          nombre: clean(form.nombre),
          categoria: clean(form.categoria),
          precio: num(form.precio),
          activo: form.activo,
        },
      });
    }
    setGuardando(false);
    if (r && r.status === "success") {
      mostrarToast(modal.modo === "crear" ? "Producto creado" : "Producto actualizado");
      setModal(null);
      cargar();
    } else {
      mostrarToast(r?.message || "Error al guardar");
    }
  };

  const borrar = async () => {
    const p = confirmDel;
    setConfirmDel(null);
    const r = await postAction({
      action: "delete",
      sheet: "Productos",
      idField: "id_producto",
      idValue: clean(p.id_producto),
    });
    if (r && r.status === "success") {
      mostrarToast("Producto borrado");
      cargar();
    } else {
      mostrarToast(r?.message || "No se pudo borrar");
    }
  };

  const filtrados = useMemo(() =>
    productos.filter((p) => !busqueda || clean(p.nombre).toLowerCase().includes(busqueda.toLowerCase())),
    [productos, busqueda]);

  if (loading) {
    return (
      <div className="bar-sec-loading">
        <span className="bar-spinner-amber"></span>
        <p>Cargando menú…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bar-menu-head">
        <input
          className="bar-search"
          placeholder="Buscar producto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {esAdmin && (
          <button className="bar-add-btn" onClick={abrirCrear}>＋ Nuevo</button>
        )}
      </div>

      <ul className="bar-prod-admin-list">
        {filtrados.map((p) => {
          const activo = esActivo(p.activo);
          return (
            <li key={clean(p.id_producto)} className={`bar-pa-item ${activo ? "" : "off"}`}>
              <div className="bar-pa-info">
                <span className="bar-pa-nombre">{clean(p.nombre)}</span>
                <span className="bar-pa-meta">
                  {clean(p.categoria) || "Sin categoría"} · {money(p.precio)}
                </span>
              </div>
              <div className="bar-pa-actions">
                <button
                  className={`bar-toggle ${activo ? "on" : ""}`}
                  onClick={() => toggleActivo(p)}
                  aria-label={activo ? "Desactivar" : "Activar"}
                >
                  <span className="bar-toggle-knob"></span>
                </button>
                {esAdmin && (
                  <>
                    <button className="bar-pa-edit" onClick={() => abrirEditar(p)} aria-label="Editar">✎</button>
                    <button className="bar-pa-del" onClick={() => setConfirmDel(p)} aria-label="Borrar">🗑</button>
                  </>
                )}
              </div>
            </li>
          );
        })}
        {filtrados.length === 0 && <p className="bar-empty-inline">No hay productos.</p>}
      </ul>

      {/* Modal crear/editar */}
      {modal && (
        <div className="bar-modal-overlay" onClick={() => setModal(null)}>
          <div className="bar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bar-modal-head">
              <h3>{modal.modo === "crear" ? "Nuevo producto" : "Editar producto"}</h3>
            </div>

            <div className="bar-form-field">
              <label>Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Cerveza Águila" />
            </div>
            <div className="bar-form-field">
              <label>Categoría</label>
              <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ej. Cervezas" />
            </div>
            <div className="bar-form-field">
              <label>Precio</label>
              <input type="number" inputMode="numeric" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} placeholder="Ej. 6000" />
            </div>
            <div className="bar-form-field">
              <label>Estado</label>
              <div className="bar-seg">
                <button className={form.activo === "SI" ? "on" : ""} onClick={() => setForm({ ...form, activo: "SI" })}>Activo</button>
                <button className={form.activo === "NO" ? "on" : ""} onClick={() => setForm({ ...form, activo: "NO" })}>Inactivo</button>
              </div>
            </div>

            <div className="bar-modal-actions">
              <button className="bar-modal-cancel" onClick={() => setModal(null)}>Cancelar</button>
              <button className="bar-modal-ok" onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de borrado con advertencia */}
      {confirmDel && (
        <div className="bar-modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="bar-modal bar-modal-warn" onClick={(e) => e.stopPropagation()}>
            <div className="bar-warn-icon">⚠️</div>
            <h3>¿Borrar "{clean(confirmDel.nombre)}"?</h3>
            <p className="bar-warn-text">
              Borrar el producto puede dañar tus reportes de ventas históricos, porque
              las cuentas viejas lo referencian. <b>Lo recomendable es desactivarlo</b> en
              vez de borrarlo: desaparece del menú pero conservas el historial.
            </p>
            <div className="bar-modal-actions">
              <button className="bar-modal-cancel" onClick={() => setConfirmDel(null)}>Mejor cancelar</button>
              <button className="bar-modal-danger" onClick={borrar}>Borrar de todos modos</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="bar-toast">{toast}</div>}
    </div>
  );
}