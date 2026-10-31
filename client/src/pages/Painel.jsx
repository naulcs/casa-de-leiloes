import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Carrossel from "../Carrossel.jsx";
import { api } from "../api.js";
import { contarLances, formatarReais } from "../format.js";

const STATUS = {
  scheduled: "Agendado",
  live: "Ao vivo",
  ended: "Encerrado",
  canceled: "Cancelado",
};

const FORMULARIO_VAZIO = { inicial: "", incremento: "", inicio: "", fim: "" };

function reaisParaCentavos(texto) {
  return Math.round(Number(String(texto).replace(",", ".")) * 100);
}

export default function Painel() {
  const [lotes, setLotes] = useState(null);
  const [totalRecebido, setTotalRecebido] = useState(0);
  const [busca, setBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [temMais, setTemMais] = useState(false);
  const [escolhida, setEscolhida] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  function carregarLotes() {
    api("/lots/mine")
      .then((dados) => {
        setLotes(dados.lots);
        setTotalRecebido(dados.total_received_cents);
      })
      .catch((falha) => setErro(falha.message));
  }

  useEffect(() => {
    carregarLotes();
  }, []);

  function alterar(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  }

  async function pesquisar(pagina) {
    setErro("");
    setMensagem("");
    setBuscando(true);
    try {
      const dados = await api(
        `/catalog/search?q=${encodeURIComponent(busca.trim())}&page=${pagina}`,
      );
      setResultados((atuais) =>
        pagina === 1 ? dados.items : [...atuais, ...dados.items],
      );
      setPaginaAtual(pagina);
      setTemMais(dados.has_more);
      if (pagina === 1) setEscolhida(null);
      if (dados.stale) {
        setMensagem("A API de formigas está fora do ar: resultados guardados.");
      }
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setBuscando(false);
    }
  }

  function buscar(evento) {
    evento.preventDefault();
    pesquisar(1);
  }

  async function criarLote(evento) {
    evento.preventDefault();
    setErro("");
    if (!formulario.fim) {
      setErro("Informe o fim do leilão.");
      return;
    }
    try {
      await api("/lots", {
        method: "POST",
        body: {
          external_id: escolhida.external_id,
          starting_bid_cents: reaisParaCentavos(formulario.inicial),
          min_increment_cents: reaisParaCentavos(formulario.incremento),
          starts_at: formulario.inicio
            ? new Date(formulario.inicio).toISOString()
            : undefined,
          ends_at: new Date(formulario.fim).toISOString(),
        },
      });
      setMensagem("Lote criado.");
      setEscolhida(null);
      setFormulario(FORMULARIO_VAZIO);
      carregarLotes();
    } catch (falha) {
      setErro(falha.message);
    }
  }

  async function cancelar(lote) {
    if (!window.confirm(`Cancelar o lote "${lote.title}"?`)) return;
    setErro("");
    setMensagem("");
    try {
      await api(`/lots/${lote.id}/cancel`, { method: "POST" });
      setMensagem("Lote cancelado.");
      carregarLotes();
    } catch (falha) {
      setErro(falha.message);
    }
  }

  return (
    <section>
      <h1>Painel do leiloeiro</h1>
      <p>Total recebido em vendas: {formatarReais(totalRecebido)}</p>

      <h2>Criar lote</h2>
      <form onSubmit={buscar}>
        <label>
          Buscar formiga
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex.: formiga-vermelha"
          />
        </label>
        <button type="submit" disabled={buscando || busca.trim().length < 2}>
          Buscar
        </button>
      </form>
      {buscando && <p>Buscando...</p>}

      <Carrossel>
        {resultados.map((item) => (
          <li key={item.external_id} className="card">
            {item.image_url && <img src={item.image_url} alt={item.title} />}
            <h3>{item.title}</h3>
            <p>{item.attributes["Nome científico"]}</p>
            <button type="button" onClick={() => setEscolhida(item)}>
              Escolher
            </button>
          </li>
        ))}
      </Carrossel>
      {resultados.length > 0 && (
        <p>
          {resultados.length} formigas encontradas.{" "}
          {temMais && (
            <button
              type="button"
              onClick={() => pesquisar(paginaAtual + 1)}
              disabled={buscando}
            >
              Carregar mais
            </button>
          )}
        </p>
      )}

      {escolhida && (
        <form onSubmit={criarLote}>
          <h3>Novo lote: {escolhida.title}</h3>
          <label>
            Lance inicial (R$)
            <input
              value={formulario.inicial}
              onChange={(e) => alterar("inicial", e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label>
            Incremento mínimo (R$)
            <input
              value={formulario.incremento}
              onChange={(e) => alterar("incremento", e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label>
            Início (opcional, padrão: agora)
            <input
              type="datetime-local"
              value={formulario.inicio}
              onChange={(e) => alterar("inicio", e.target.value)}
            />
          </label>
          <label>
            Fim
            <input
              type="datetime-local"
              value={formulario.fim}
              onChange={(e) => alterar("fim", e.target.value)}
            />
          </label>
          <button type="submit">Criar lote</button>
        </form>
      )}

      {mensagem && <p role="status">{mensagem}</p>}
      {erro && <p role="alert">{erro}</p>}

      <h2>Meus lotes</h2>
      {lotes === null && <p>Carregando lotes...</p>}
      {lotes?.length === 0 && <p>Nenhum lote criado ainda.</p>}
      <ul>
        {lotes?.map((lote) => (
          <li key={lote.id}>
            {lote.title} — {STATUS[lote.status]} — lance atual:{" "}
            {formatarReais(
              lote.bid_count > 0
                ? lote.current_bid_cents
                : lote.starting_bid_cents,
            )}{" "}
            ({contarLances(lote.bid_count)})
            {lote.result &&
              (lote.result.sold
                ? ` — vendido por ${formatarReais(lote.result.amount_cents)}`
                : " — sem venda")}{" "}
            <Link to={`/lotes/${lote.id}`}>Ver</Link>
            {(lote.status === "scheduled" || lote.status === "live") && (
              <button type="button" onClick={() => cancelar(lote)}>
                Cancelar
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
