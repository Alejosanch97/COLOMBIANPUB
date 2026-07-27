import React, { useState, useEffect, useCallback, useMemo } from "react";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyHhnwmVFDDdrWN3_1q9o7URaqFkyp35XqqFRAiK9gA56n18EJnivkF2wDpptIDmRAZ/exec";

const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());
const esActivo = (v) => ["SI", "TRUE", "VERDADERO", "1"].indexOf(clean(v).toUpperCase()) !== -1;

const fetchJSON = async (url, opts) => {
  const res = await fetch(url, opts);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return null; }
};
const postAction = async (payload) =>
  fetchJSON(API_URL, { method: "POST", body: JSON.stringify(payload) });

const ROLES = [
  { id: "mesero", label: "Mesero" },
  { id: "cajero", label: "Cajero" },
  { id: "admin", label: "Admin" },
];

/* ============================================================
   SECCIÓN USUARIOS — solo admin
   Crear, editar y activar/desactivar meseros, cajeros y admins.
   ============================================================ */
export function UsuariosSection() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState(null); // {modo:'crear'|'editar', data}
  const [form, setForm] = useState({ nombre: "", usuario: "", password: "", rol: "mesero", activo: "SI" });
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    const data = await fetchJSON(`${API_URL}?sheet=Meseros`);
    setUsuarios(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const mostrarToast = (m, dur = 2200) => { setToast(m); setTimeout(() => setToast(""), dur); };

  const toggleActivo = async (u) => {
    const nuevo = esActivo(u.activo) ? "NO" : "SI";
    setUsuarios((prev) => prev.map((x) =>
      clean(x.id_mesero) === clean(u.id_mesero) ? { ...x, activo: nuevo } : x));
    const r = await postAction({
      action: "update",
      sheet: "Meseros",
      idField: "id_mesero",
      idValue: clean(u.id_mesero),
      data: { activo: nuevo },
    });
    if (!r || r.status !== "success") {
      mostrarToast("No se pudo actualizar");
      cargar();
    } else {
      mostrarToast(nuevo === "SI" ? "Usuario activado" : "Usuario desactivado");
    }
  };

  const abrirCrear = () => {
    setForm({ nombre: "", usuario: "", password: "", rol: "mesero", activo: "SI" });
    setModal({ modo: "crear" });
  };
  const abrirEditar = (u) => {
    setForm({
      nombre: clean(u.nombre),
      usuario: clean(u.usuario),
      password: "", // vacío = no cambiar
      rol: clean(u.rol).toLowerCase() || "mesero",
      activo: esActivo(u.activo) ? "SI" : "NO",
    });
    setModal({ modo: "editar", data: u });
  };

  const guardar = async () => {
    if (!clean(form.nombre) || !clean(form.usuario)) {
      mostrarToast("Nombre y usuario son obligatorios");
      return;
    }
    if (modal.modo === "crear" && !clean(form.password)) {
      mostrarToast("Ponle una contraseña al nuevo usuario");
      return;
    }
    setGuardando(true);
    let r;
    if (modal.modo === "crear") {
      r = await postAction({
        action: "create",
        sheet: "Meseros",
        data: {
          nombre: clean(form.nombre),
          usuario: clean(form.usuario).toLowerCase(),
          password: clean(form.password),
          rol: form.rol,
          activo: form.activo,
        },
      });
    } else {
      // En editar: solo mandamos password si el admin escribió una nueva
      const data = {
        nombre: clean(form.nombre),
        usuario: clean(form.usuario).toLowerCase(),
        rol: form.rol,
        activo: form.activo,
      };
      if (clean(form.password)) data.password = clean(form.password);
      r = await postAction({
        action: "update",
        sheet: "Meseros",
        idField: "id_mesero",
        idValue: clean(modal.data.id_mesero),
        data,
      });
    }
    setGuardando(false);
    if (r && r.status === "success") {
      mostrarToast(modal.modo === "crear" ? "Usuario creado" : "Usuario actualizado");
      setModal(null);
      cargar();
    } else {
      mostrarToast(r?.message || "Error al guardar");
    }
  };

  const filtrados = useMemo(() =>
    usuarios.filter((u) => {
      const t = busqueda.toLowerCase();
      return !busqueda ||
        clean(u.nombre).toLowerCase().includes(t) ||
        clean(u.usuario).toLowerCase().includes(t);
    }),
    [usuarios, busqueda]);

  if (loading) {
    return (
      <div className="bar-sec-loading">
        <span className="bar-spinner-amber"></span>
        <p>Cargando usuarios…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bar-menu-head">
        <input
          className="bar-search"
          placeholder="Buscar usuario…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <button className="bar-add-btn" onClick={abrirCrear}>＋ Nuevo</button>
      </div>

      <ul className="bar-prod-admin-list">
        {filtrados.map((u) => {
          const activo = esActivo(u.activo);
          const rolTxt = clean(u.rol) || "mesero";
          return (
            <li key={clean(u.id_mesero)} className={`bar-pa-item ${activo ? "" : "off"}`}>
              <div className="bar-pa-info">
                <span className="bar-pa-nombre">
                  {clean(u.nombre)}
                  <span className={`bar-rol-badge rol-${rolTxt.toLowerCase()}`}>{rolTxt}</span>
                </span>
                <span className="bar-pa-meta">@{clean(u.usuario)}</span>
              </div>
              <div className="bar-pa-actions">
                <button
                  className={`bar-toggle ${activo ? "on" : ""}`}
                  onClick={() => toggleActivo(u)}
                  aria-label={activo ? "Desactivar" : "Activar"}
                >
                  <span className="bar-toggle-knob"></span>
                </button>
                <button className="bar-pa-edit" onClick={() => abrirEditar(u)} aria-label="Editar">✎</button>
              </div>
            </li>
          );
        })}
        {filtrados.length === 0 && <p className="bar-empty-inline">No hay usuarios.</p>}
      </ul>

      {/* Modal crear/editar usuario */}
      {modal && (
        <div className="bar-modal-overlay" onClick={() => setModal(null)}>
          <div className="bar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bar-modal-head">
              <h3>{modal.modo === "crear" ? "Nuevo usuario" : "Editar usuario"}</h3>
            </div>

            <div className="bar-form-field">
              <label>Nombre completo</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Camila Ríos" />
            </div>
            <div className="bar-form-field">
              <label>Usuario (para entrar)</label>
              <input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} placeholder="Ej. camila" autoCapitalize="none" />
            </div>
            <div className="bar-form-field">
              <label>
                Contraseña {modal.modo === "editar" && <i style={{ color: "var(--dim)", fontStyle: "normal" }}>· deja vacío para no cambiar</i>}
              </label>
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={modal.modo === "crear" ? "Ej. 1234" : "••••"} />
            </div>
            <div className="bar-form-field">
              <label>Rol</label>
              <div className="bar-seg">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    className={form.rol === r.id ? "on" : ""}
                    onClick={() => setForm({ ...form, rol: r.id })}
                  >{r.label}</button>
                ))}
              </div>
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

      {toast && <div className="bar-toast">{toast}</div>}
    </div>
  );
}