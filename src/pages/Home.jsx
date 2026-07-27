import React, { useState, useEffect, useCallback } from "react";
import "../Styles/home.css";
import { useNavigate } from "react-router-dom";

const API_URL =
  "https://script.google.com/macros/s/AKfycbyHhnwmVFDDdrWN3_1q9o7URaqFkyp35XqqFRAiK9gA56n18EJnivkF2wDpptIDmRAZ/exec";

// Cambia esto por el nombre real de tu bar
const NOMBRE_BAR = "EL ÁMBAR";

// Formatea números como precio en pesos colombianos
const money = (n) =>
  "$" + (Number(n) || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });

export const Home = ({ onLoginSuccess }) => {
  const navigate = useNavigate();

  // Lee el token del QR desde la URL: ?t=a8f3k9x2  (también acepta ?token=)
  const params = new URLSearchParams(window.location.search);
  const token = (params.get("t") || params.get("token") || "").trim();
  const esCliente = token.length > 0;

  return esCliente ? (
    <VistaCliente token={token} />
  ) : (
    <VistaStaff navigate={navigate} onLoginSuccess={onLoginSuccess} />
  );
};

/* ============================================================
   CARA CLIENTE — muestra la cuenta de la mesa (solo lectura)
   ============================================================ */
function VistaCliente({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargarCuenta = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}?cuenta_mesa=1&token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (json.status === "error") {
        setError(json.message || "No pudimos cargar tu cuenta.");
      } else {
        setData(json);
        setError("");
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo conectar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargarCuenta();
    // Refresca solo cada 20s para que el cliente vea lo que el mesero va agregando
    const id = setInterval(cargarCuenta, 20000);
    return () => clearInterval(id);
  }, [cargarCuenta]);

  const refrescar = () => {
    setLoading(true);
    cargarCuenta();
  };

  return (
    <div className="bar-login bar-cliente">
      <div className="bar-glow" aria-hidden="true"></div>
      <div className="bar-noise" aria-hidden="true"></div>

      <header className="bar-cli-head">
        <span className="bar-brand-mark">✦</span>
        <h1 className="bar-cli-bar">{NOMBRE_BAR}</h1>
        {data?.mesa?.nombre_mesa && (
          <span className="bar-cli-mesa">Mesa · {data.mesa.nombre_mesa}</span>
        )}
      </header>

      <main className="bar-cli-main">
        {loading && !data ? (
          <div className="bar-cli-loading">
            <span className="bar-spinner bar-spinner-amber"></span>
            <p>Cargando tu cuenta…</p>
          </div>
        ) : error ? (
          <div className="bar-cli-empty">
            <span className="bar-cli-emoji">😕</span>
            <p>{error}</p>
            <button className="bar-btn-ghost" onClick={refrescar}>Reintentar</button>
          </div>
        ) : !data?.items?.length ? (
          <div className="bar-cli-empty">
            <span className="bar-cli-emoji">🍹</span>
            <h2>Aún no has pedido nada</h2>
            <p>Cuando el mesero agregue tus productos, aparecerán aquí.</p>
            <button className="bar-btn-ghost" onClick={refrescar}>Actualizar</button>
          </div>
        ) : (
          <div className="bar-cli-card">
            <div className="bar-cli-card-top">
              <span>Tu consumo</span>
              <button className="bar-refresh" onClick={refrescar} aria-label="Actualizar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6"></path>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
              </button>
            </div>

            <ul className="bar-cli-list">
              {data.items.map((it) => (
                <li key={it.id_detalle} className="bar-cli-item">
                  <span className="bar-cli-qty">{it.cantidad}×</span>
                  <span className="bar-cli-name">{it.nombre_producto}</span>
                  <span className="bar-cli-price">{money(it.subtotal)}</span>
                </li>
              ))}
            </ul>

            <div className="bar-cli-total">
              <span>Total</span>
              <b>{money(data.total)}</b>
            </div>

            <p className="bar-cli-note">
              Esta es tu cuenta en tiempo real. Para pagar, acércate a caja o pide la cuenta a tu mesero.
            </p>
          </div>
        )}
      </main>

      <footer className="bar-cli-foot">
        <span>{NOMBRE_BAR} · Gracias por tu visita</span>
      </footer>
    </div>
  );
}

/* ============================================================
   CARA STAFF — portada del bar + login de mesero desplegable
   ============================================================ */
function VistaStaff({ navigate, onLoginSuccess }) {
  const [showLogin, setShowLogin] = useState(false);
  const [credentials, setCredentials] = useState({ usuario: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleInputChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "login",
          usuario: credentials.usuario.trim(),
          password: credentials.password.trim(),
        }),
      });
      const result = await response.json();
      if (result.status === "success") {
        localStorage.setItem("userSession", JSON.stringify(result));
        if (onLoginSuccess) onLoginSuccess(result);
        navigate("/dashboard");
      } else {
        setError(result.message || "Credenciales inválidas.");
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bar-login">
      <div className="bar-glow" aria-hidden="true"></div>
      <div className="bar-noise" aria-hidden="true"></div>

      <header className="bar-head">
        <div className="bar-head-row">
          <span className="bar-status">
            <span className="bar-status-dot"></span>
            ABIERTO
          </span>
          <span className="bar-clock">{clock}</span>
        </div>

        <div className="bar-brand">
          <span className="bar-brand-mark">✦</span>
          <h1 className="bar-logo">{NOMBRE_BAR}</h1>
          <p className="bar-tagline">Escanea el QR de tu mesa para ver tu cuenta</p>
        </div>
      </header>

      <main className="bar-main">
        {!showLogin ? (
          <div className="bar-welcome">
            <div className="bar-welcome-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                <line x1="14" y1="14" x2="14" y2="14.01"></line>
                <line x1="21" y1="14" x2="21" y2="14.01"></line>
                <line x1="14" y1="21" x2="14" y2="21.01"></line>
                <line x1="21" y1="21" x2="21" y2="21.01"></line>
                <line x1="17.5" y1="17.5" x2="17.5" y2="17.51"></line>
              </svg>
            </div>
            <h2 className="bar-welcome-title">Bienvenido a {NOMBRE_BAR}</h2>
            <p className="bar-welcome-sub">
              Si estás en una mesa, escanea el código QR para ver en vivo lo que has pedido y tu total.
            </p>
            <button className="bar-btn-staff" onClick={() => setShowLogin(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Soy del personal
            </button>
          </div>
        ) : (
          <div className="bar-card">
            <div className="bar-card-head">
              <h2 className="bar-card-title">Acceso staff</h2>
              <p className="bar-card-sub">Ingresa para tomar comandas y gestionar tus mesas.</p>
            </div>

            <form onSubmit={handleSubmit} className="bar-form">
              <div className="bar-field">
                <label htmlFor="usuario">Usuario</label>
                <div className="bar-input-wrap">
                  <svg className="bar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <input
                    id="usuario"
                    type="text"
                    name="usuario"
                    autoComplete="username"
                    placeholder="Ej. camila"
                    value={credentials.usuario}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="bar-field">
                <label htmlFor="password">Contraseña</label>
                <div className="bar-input-wrap">
                  <svg className="bar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <input
                    id="password"
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={credentials.password}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bar-error" role="alert">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="bar-btn" disabled={loading}>
                {loading ? (
                  <span className="bar-loading">
                    <span className="bar-spinner"></span>
                    Entrando…
                  </span>
                ) : (
                  "Entrar"
                )}
              </button>

              <button
                type="button"
                className="bar-btn-back"
                onClick={() => { setShowLogin(false); setError(""); }}
              >
                ← Volver
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}