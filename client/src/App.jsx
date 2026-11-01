import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Ant3D from "./Ant3D.jsx";
import MyBids from "./pages/MyBids.jsx";
import Audit from "./pages/Audit.jsx";
import Wallet from "./pages/Wallet.jsx";
import Receipt from "./pages/Receipt.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import LotRoom from "./pages/LotRoom.jsx";
import Showcase from "./pages/Showcase.jsx";
import { SECTIONS } from "./sections.js";
import { useAuth } from "./useAuth.js";

function initialTheme() {
  try {
    const saved = localStorage.getItem("formilance-theme");
    if (saved === "sand" || saved === "earth") return saved;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "sand"
    : "earth";
}

function RequireLogin({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return (
      <Navigate to="/entrar" replace state={{ from: location.pathname }} />
    );
  }
  if (user.role !== role) {
    return (
      <p role="alert">
        Esta página é só para {role === "bidder" ? "licitantes" : "leiloeiros"}.{" "}
        <Link to="/">Voltar à vitrine</Link>
      </p>
    );
  }
  return children;
}

export default function App() {
  const { user, loading, logout } = useAuth();
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("formilance-theme", theme);
    } catch {}
  }, [theme]);

  if (loading) return <p>Carregando...</p>;

  return (
    <>
      <header className="top-bar">
        <Link to="/">
          <Ant3D />
          <span className="brand-title">FormiLance</span>
        </Link>
        <nav className="lot-menu">
          {SECTIONS.map((section) => (
            <NavLink key={section.value} to={section.path}>
              {section.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme(theme === "sand" ? "earth" : "sand")}
          aria-label={
            theme === "sand"
              ? "Mudar para o tema terroso"
              : "Mudar para o tema areia"
          }
        >
          {theme === "sand" ? "☾ Terroso" : "☀ Areia"}
        </button>
        {user ? (
          <>
            <span>{user.name}</span>
            {user.role === "bidder" && (
              <>
                <Link to="/arremates">Meus arremates</Link>
                <Link to="/carteira">Carteira</Link>
              </>
            )}
            {user.role === "auctioneer" && <Link to="/painel">Painel</Link>}
            <button onClick={logout}>Sair</button>
          </>
        ) : (
          <Link to="/entrar">Entrar</Link>
        )}
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Showcase />} />
          {SECTIONS.map((section) => (
            <Route
              key={section.value}
              path={section.path}
              element={<Showcase status={section.value} />}
            />
          ))}
          <Route path="/entrar" element={<Login />} />
          <Route path="/lotes/:id" element={<LotRoom />} />
          <Route path="/comprovantes/:code" element={<Receipt />} />
          <Route
            path="/arremates"
            element={
              <RequireLogin role="bidder">
                <MyBids />
              </RequireLogin>
            }
          />
          <Route
            path="/carteira"
            element={
              <RequireLogin role="bidder">
                <Wallet />
              </RequireLogin>
            }
          />
          <Route
            path="/painel"
            element={
              <RequireLogin role="auctioneer">
                <Dashboard />
              </RequireLogin>
            }
          />
          <Route path="/auditoria/:id" element={<Audit />} />
        </Routes>
      </main>
    </>
  );
}
