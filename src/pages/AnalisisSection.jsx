import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyHhnwmVFDDdrWN3_1q9o7URaqFkyp35XqqFRAiK9gA56n18EJnivkF2wDpptIDmRAZ/exec";

const clean = (v) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v) => { const n = Number(clean(v).replace(",", ".")); return isNaN(n) ? 0 : n; };
const money = (n) => "$" + (Number(n) || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });

const fetchJSON = async (url) => {
  const res = await fetch(url);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return null; }
};
const fetchSheet = async (sheet) => {
  const data = await fetchJSON(`${API_URL}?sheet=${encodeURIComponent(sheet)}`);
  return Array.isArray(data) ? data : [];
};

// Paleta ámbar/whisky para las gráficas
const COLORS = ["#e8a13a", "#f0c074", "#8c3b2e", "#7fb069", "#c98a3a", "#a0632e", "#d4a857"];

// Convierte una fecha (Date o texto) a YYYY-MM-DD
const diaDe = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return clean(v).split("T")[0];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const nombreDia = (yyyymmdd) => {
  const d = new Date(yyyymmdd + "T12:00:00");
  if (isNaN(d.getTime())) return yyyymmdd;
  return d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
};

/* ============================================================
   SECCIÓN ANÁLISIS — solo admin
   Qué se vende más, por categoría, por día, y totales clave.
   ============================================================ */
export function AnalisisSection() {
  const [detalle, setDetalle] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rango, setRango] = useState("todo"); // hoy | semana | todo

  const cargar = useCallback(async () => {
    setLoading(true);
    const [det, cts, prods] = await Promise.all([
      fetchSheet("Detalle_Cuenta"),
      fetchSheet("Cuentas"),
      fetchSheet("Productos"),
    ]);
    setDetalle(det);
    setCuentas(cts);
    setProductos(prods);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Filtro por rango de fechas
  const dentroDelRango = useCallback((fecha) => {
    if (rango === "todo") return true;
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return true;
    const hoy = new Date();
    if (rango === "hoy") {
      return diaDe(d) === diaDe(hoy);
    }
    if (rango === "semana") {
      const hace7 = new Date();
      hace7.setDate(hace7.getDate() - 7);
      return d >= hace7;
    }
    return true;
  }, [rango]);

  // Solo líneas activas (no anuladas) dentro del rango
  const lineasValidas = useMemo(() => {
    return detalle.filter((d) => {
      const activo = clean(d.estado).toLowerCase() !== "anulado";
      return activo && dentroDelRango(d.fecha_hora);
    });
  }, [detalle, dentroDelRango]);

  // Cuentas pagadas dentro del rango
  const cuentasPagadas = useMemo(() => {
    return cuentas.filter((c) =>
      clean(c.estado).toLowerCase() === "pagada" && dentroDelRango(c.fecha_cierre || c.fecha_apertura));
  }, [cuentas, dentroDelRango]);

  /* ---- Métricas clave ---- */
  const ventaTotal = useMemo(
    () => cuentasPagadas.reduce((s, c) => s + num(c.total), 0),
    [cuentasPagadas]);

  const numCuentas = cuentasPagadas.length;
  const ticketPromedio = numCuentas > 0 ? Math.round(ventaTotal / numCuentas) : 0;
  const unidadesVendidas = useMemo(
    () => lineasValidas.reduce((s, l) => s + num(l.cantidad), 0),
    [lineasValidas]);

  /* ---- Top productos por unidades vendidas ---- */
  const topProductos = useMemo(() => {
    const acc = {};
    lineasValidas.forEach((l) => {
      const nombre = clean(l.nombre_producto) || "—";
      if (!acc[nombre]) acc[nombre] = { nombre, unidades: 0, ingreso: 0 };
      acc[nombre].unidades += num(l.cantidad);
      acc[nombre].ingreso += num(l.subtotal);
    });
    return Object.values(acc).sort((a, b) => b.unidades - a.unidades);
  }, [lineasValidas]);

  const top8 = useMemo(() => topProductos.slice(0, 8), [topProductos]);

  /* ---- Ventas por categoría ---- */
  const porCategoria = useMemo(() => {
    // mapa producto -> categoría
    const catDe = {};
    productos.forEach((p) => { catDe[clean(p.nombre)] = clean(p.categoria) || "Sin categoría"; });
    const acc = {};
    lineasValidas.forEach((l) => {
      const cat = catDe[clean(l.nombre_producto)] || "Sin categoría";
      acc[cat] = (acc[cat] || 0) + num(l.subtotal);
    });
    return Object.entries(acc)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [lineasValidas, productos]);

  /* ---- Ventas por día ---- */
  const porDia = useMemo(() => {
    const acc = {};
    cuentasPagadas.forEach((c) => {
      const dia = diaDe(c.fecha_cierre || c.fecha_apertura);
      if (!dia) return;
      acc[dia] = (acc[dia] || 0) + num(c.total);
    });
    return Object.entries(acc)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14) // últimos 14 días con ventas
      .map(([dia, total]) => ({ dia: nombreDia(dia), total }));
  }, [cuentasPagadas]);

  if (loading) {
    return (
      <div className="bar-sec-loading">
        <span className="bar-spinner-amber"></span>
        <p>Cargando análisis…</p>
      </div>
    );
  }

  const sinDatos = lineasValidas.length === 0 && cuentasPagadas.length === 0;

  return (
    <div className="bar-sec">
      <div className="bar-sec-head">
        <div className="bar-sec-head-row">
          <div>
            <h2 className="bar-sec-title">Análisis</h2>
            <p className="bar-sec-sub">Qué se vende más y cuándo</p>
          </div>
          <button className="bar-refresh-btn" onClick={cargar} aria-label="Actualizar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6"></path>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Selector de rango */}
      <div className="bar-cats" style={{ marginBottom: 18 }}>
        {[
          { id: "hoy", label: "Hoy" },
          { id: "semana", label: "Últimos 7 días" },
          { id: "todo", label: "Todo" },
        ].map((r) => (
          <button
            key={r.id}
            className={`bar-cat ${rango === r.id ? "on" : ""}`}
            onClick={() => setRango(r.id)}
          >{r.label}</button>
        ))}
      </div>

      {sinDatos ? (
        <div className="bar-cli-empty" style={{ margin: "40px auto" }}>
          <span className="bar-cli-emoji">📊</span>
          <h2>Aún no hay ventas</h2>
          <p>Cuando cobres algunas cuentas, aquí verás tus estadísticas.</p>
        </div>
      ) : (
        <>
          {/* Tarjetas de métricas */}
          <div className="bar-metrics">
            <div className="bar-metric">
              <span className="bar-metric-label">Venta total</span>
              <b className="bar-metric-val">{money(ventaTotal)}</b>
            </div>
            <div className="bar-metric">
              <span className="bar-metric-label">Cuentas</span>
              <b className="bar-metric-val">{numCuentas}</b>
            </div>
            <div className="bar-metric">
              <span className="bar-metric-label">Ticket prom.</span>
              <b className="bar-metric-val">{money(ticketPromedio)}</b>
            </div>
            <div className="bar-metric">
              <span className="bar-metric-label">Unidades</span>
              <b className="bar-metric-val">{unidadesVendidas}</b>
            </div>
          </div>

          {/* Top productos - barras horizontales */}
          <div className="bar-chart-card">
            <h3 className="bar-chart-title">Lo más vendido (unidades)</h3>
            <ResponsiveContainer width="100%" height={Math.max(220, top8.length * 42)}>
              <BarChart data={top8} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                <XAxis type="number" tick={{ fill: "#a08d75", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  tick={{ fill: "#f4ece0", fontSize: 11 }}
                  width={110}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: "#221a12", border: "1px solid #3a2d1e", borderRadius: 10, color: "#f4ece0" }}
                  formatter={(v, name) => [name === "unidades" ? `${v} und` : money(v), name === "unidades" ? "Vendidas" : "Ingreso"]}
                  cursor={{ fill: "rgba(232,161,58,0.08)" }}
                />
                <Bar dataKey="unidades" radius={[0, 6, 6, 0]}>
                  {top8.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ventas por categoría - dona */}
          {porCategoria.length > 0 && (
            <div className="bar-chart-card">
              <h3 className="bar-chart-title">Ingreso por categoría</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={porCategoria}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {porCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#221a12", border: "1px solid #3a2d1e", borderRadius: 10, color: "#f4ece0" }}
                    formatter={(v) => money(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="bar-legend">
                {porCategoria.map((c, i) => (
                  <div key={c.name} className="bar-legend-item">
                    <span className="bar-legend-dot" style={{ background: COLORS[i % COLORS.length] }}></span>
                    <span className="bar-legend-name">{c.name}</span>
                    <span className="bar-legend-val">{money(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ventas por día - línea */}
          {porDia.length > 1 && (
            <div className="bar-chart-card">
              <h3 className="bar-chart-title">Ventas por día</h3>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={porDia} margin={{ left: -10, right: 15, top: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a2d1e" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fill: "#a08d75", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#a08d75", fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                  <Tooltip
                    contentStyle={{ background: "#221a12", border: "1px solid #3a2d1e", borderRadius: 10, color: "#f4ece0" }}
                    formatter={(v) => money(v)}
                  />
                  <Line type="monotone" dataKey="total" stroke="#e8a13a" strokeWidth={2.5}
                    dot={{ fill: "#e8a13a", r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabla detallada top productos */}
          <div className="bar-chart-card">
            <h3 className="bar-chart-title">Detalle por producto</h3>
            <table className="bar-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Und</th>
                  <th>Ingreso</th>
                </tr>
              </thead>
              <tbody>
                {topProductos.map((p) => (
                  <tr key={p.nombre}>
                    <td>{p.nombre}</td>
                    <td>{p.unidades}</td>
                    <td>{money(p.ingreso)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}