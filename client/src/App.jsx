import { Link, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Arremates from "./pages/Arremates.jsx";
import Auditoria from "./pages/Auditoria.jsx";
import Carteira from "./pages/Carteira.jsx";
import Comprovante from "./pages/Comprovante.jsx";
import Login from "./pages/Login.jsx";
import Painel from "./pages/Painel.jsx";
import Sala from "./pages/Sala.jsx";
import Vitrine from "./pages/Vitrine.jsx";

export default function App() {
  const { user, carregando, sair } = useAuth();

  if (carregando) return <p>Carregando...</p>;

  return (
    <>
      <header className="topo">
        <Link to="/">Casa de Leilões</Link>
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
            <button onClick={sair}>Sair</button>
          </>
        ) : (
          <Link to="/entrar">Entrar</Link>
        )}
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Vitrine />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/lotes/:id" element={<Sala />} />
          <Route path="/comprovantes/:code" element={<Comprovante />} />
          <Route path="/arremates" element={<Arremates />} />
          <Route path="/carteira" element={<Carteira />} />
          <Route path="/painel" element={<Painel />} />
          <Route path="/auditoria/:id" element={<Auditoria />} />
        </Routes>
      </main>
    </>
  );
}
