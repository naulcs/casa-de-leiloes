import { useState } from "react";
import Carousel from "../Carousel.jsx";
import { api } from "../api.js";

export default function AntSearch({ onSelect }) {
  const [searchText, setSearchText] = useState("");
  const [searchedTerm, setSearchedTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function runSearch(term, page) {
    setError("");
    setNotice("");
    setIsSearching(true);
    try {
      const data = await api(
        `/catalog/search?q=${encodeURIComponent(term)}&page=${page}`,
      );
      setResults((current) =>
        page === 1 ? data.items : [...current, ...data.items],
      );
      setSearchedTerm(term);
      setCurrentPage(page);
      setHasMore(data.has_more);
      if (data.stale) {
        setNotice("A API de formigas está fora do ar: resultados guardados.");
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setIsSearching(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    onSelect(null);
    runSearch(searchText.trim(), 1);
  }

  return (
    <>
      <form onSubmit={submit}>
        <label>
          Buscar formiga
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Ex.: formiga-vermelha"
          />
        </label>
        <button
          type="submit"
          disabled={isSearching || searchText.trim().length < 2}
        >
          Buscar
        </button>
      </form>
      {isSearching && <p>Buscando...</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {!isSearching && !error && searchedTerm && results.length === 0 && (
        <p>
          Nenhuma formiga encontrada para “{searchedTerm}”. Tente outro nome.
        </p>
      )}

      <Carousel>
        {results.map((item) => (
          <li key={item.external_id} className="card">
            {item.image_url && <img src={item.image_url} alt={item.title} />}
            <h3>{item.title}</h3>
            <p>{item.attributes["Nome científico"]}</p>
            <button type="button" onClick={() => onSelect(item)}>
              Escolher
            </button>
          </li>
        ))}
      </Carousel>
      {results.length > 0 && (
        <p>
          {results.length} formigas encontradas.{" "}
          {hasMore && (
            <button
              type="button"
              onClick={() => runSearch(searchedTerm, currentPage + 1)}
              disabled={isSearching}
            >
              Carregar mais
            </button>
          )}
        </p>
      )}
    </>
  );
}
