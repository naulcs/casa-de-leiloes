const BASE = process.env.INATURALIST_URL || 'https://api.inaturalist.org/v1';
const HEADERS = { 'User-Agent': 'casa-de-leiloes/1.0', Accept: 'application/json' };
const TIMEOUT_MS = 8000;
const CACHE_MS = 5 * 60 * 1000;
const FORMICIDAE = 47336;
const HOSTS_IMAGEM = ['static.inaturalist.org', 'inaturalist-open-data.s3.amazonaws.com'];
const LICENCAS = {
  cc0: 'CC0',
  'cc-by': 'CC BY',
  'cc-by-nc': 'CC BY-NC',
  'cc-by-sa': 'CC BY-SA',
  'cc-by-nd': 'CC BY-ND',
  'cc-by-nc-sa': 'CC BY-NC-SA',
  'cc-by-nc-nd': 'CC BY-NC-ND',
};

const cache = new Map();

export class ApiUnavailableError extends Error {}
export class ItemNotFoundError extends Error {}

async function getJson(path) {
  let res;
  try {
    res = await fetch(BASE + path, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ApiUnavailableError('API externa fora do ar ou lenta demais.');
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiUnavailableError(`API externa respondeu ${res.status}.`);
  return res.json();
}

function normalize(taxon) {
  const foto = taxon.default_photo;
  const licenca = foto?.license_code;
  const nomePopular = taxon.preferred_common_name || taxon.english_common_name || null;
  const attributes = {
    'Nome científico': taxon.name,
    'Nome popular': nomePopular,
    'Observações no mundo': taxon.observations_count ? String(taxon.observations_count) : null,
    Foto: foto?.attribution,
    'Licença da foto': LICENCAS[licenca],
  };
  for (const chave of Object.keys(attributes)) {
    if (!attributes[chave]) delete attributes[chave];
  }
  return {
    external_id: String(taxon.id),
    title: nomePopular || taxon.name,
    image_url: licenca && LICENCAS[licenca] ? foto.medium_url : null,
    attributes,
  };
}

export async function searchAnts(q) {
  const chave = q.toLowerCase();
  const guardado = cache.get(chave);
  if (guardado && Date.now() - guardado.at < CACHE_MS) {
    return { items: guardado.items, stale: false };
  }
  try {
    const json = await getJson(
      `/taxa?q=${encodeURIComponent(q)}&taxon_id=${FORMICIDAE}&rank=species&is_active=true&per_page=30&locale=pt-BR`
    );
    const items = (json?.results ?? []).map(normalize).filter((i) => i.image_url).slice(0, 12);
    cache.set(chave, { at: Date.now(), items });
    return { items, stale: false };
  } catch (erro) {
    if (erro instanceof ApiUnavailableError && guardado) {
      return { items: guardado.items, stale: true };
    }
    throw erro;
  }
}

export async function getAnt(id) {
  if (!/^\d{1,9}$/.test(id)) throw new ItemNotFoundError('Formiga não encontrada.');
  const json = await getJson(`/taxa/${id}?locale=pt-BR`);
  const taxon = json?.results?.[0];
  if (!taxon || taxon.rank !== 'species' || !taxon.ancestor_ids?.includes(FORMICIDAE)) {
    throw new ItemNotFoundError('Formiga não encontrada.');
  }
  return normalize(taxon);
}

export async function downloadImage(url) {
  try {
    if (!url || !HOSTS_IMAGEM.includes(new URL(url).hostname)) return null;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return null;
    const data = Buffer.from(await res.arrayBuffer());
    return data.length <= 3_000_000 ? { contentType, data } : null;
  } catch {
    return null;
  }
}