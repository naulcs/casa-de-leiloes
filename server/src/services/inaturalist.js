const BASE = process.env.INATURALIST_URL || "https://api.inaturalist.org/v1";
const HEADERS = {
  "User-Agent": "casa-de-leiloes/1.0",
  Accept: "application/json",
};
const TIMEOUT_MS = 8000;
const CACHE_MS = 5 * 60 * 1000;
const FORMICIDAE = 47336;
const IMAGE_HOSTS = [
  "static.inaturalist.org",
  "inaturalist-open-data.s3.amazonaws.com",
];
const LICENSES = {
  cc0: "CC0",
  "cc-by": "CC BY",
  "cc-by-nc": "CC BY-NC",
  "cc-by-sa": "CC BY-SA",
  "cc-by-nd": "CC BY-ND",
  "cc-by-nc-sa": "CC BY-NC-SA",
  "cc-by-nc-nd": "CC BY-NC-ND",
};

const PER_PAGE = 30;

const cache = new Map();

export function cleanName(text) {
  if (!text) return text;
  const cleaned = text
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export class ApiUnavailableError extends Error {}
export class ItemNotFoundError extends Error {}

async function getJson(path) {
  let res;
  try {
    res = await fetch(BASE + path, {
      headers: HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiUnavailableError("API externa fora do ar ou lenta demais.");
  }
  if (res.status === 404) return null;
  if (!res.ok)
    throw new ApiUnavailableError(`API externa respondeu ${res.status}.`);
  return res.json();
}

function normalize(taxon) {
  const photo = taxon.default_photo;
  const license = photo?.license_code;
  const commonName = cleanName(
    taxon.preferred_common_name || taxon.english_common_name || null,
  );
  const attributes = {
    "Nome científico": taxon.name,
    "Nome popular": commonName,
    "Observações no mundo": taxon.observations_count
      ? String(taxon.observations_count)
      : null,
    Foto: photo?.attribution,
    "Licença da foto": LICENSES[license],
  };
  for (const key of Object.keys(attributes)) {
    if (!attributes[key]) delete attributes[key];
  }
  return {
    external_id: String(taxon.id),
    title: commonName || taxon.name,
    image_url: license && LICENSES[license] ? photo.medium_url : null,
    attributes,
  };
}

export async function searchAnts(q, page = 1) {
  const key = `${q.toLowerCase()}|${page}`;
  const stored = cache.get(key);
  if (stored && Date.now() - stored.at < CACHE_MS) {
    return { items: stored.items, hasMore: stored.hasMore, stale: false };
  }
  try {
    const json = await getJson(
      `/taxa?q=${encodeURIComponent(q)}&taxon_id=${FORMICIDAE}&rank=species&is_active=true&per_page=${PER_PAGE}&page=${page}&locale=pt-BR`,
    );
    const items = (json?.results ?? [])
      .map(normalize)
      .filter((i) => i.image_url);
    const hasMore = (json?.total_results ?? 0) > page * PER_PAGE;
    cache.set(key, { at: Date.now(), items, hasMore });
    return { items, hasMore, stale: false };
  } catch (error) {
    if (error instanceof ApiUnavailableError && stored) {
      return { items: stored.items, hasMore: stored.hasMore, stale: true };
    }
    throw error;
  }
}

export async function getAnt(id) {
  if (!/^\d{1,9}$/.test(id))
    throw new ItemNotFoundError("Formiga não encontrada.");
  const json = await getJson(`/taxa/${id}?locale=pt-BR`);
  const taxon = json?.results?.[0];
  if (
    !taxon ||
    taxon.rank !== "species" ||
    !taxon.ancestor_ids?.includes(FORMICIDAE)
  ) {
    throw new ItemNotFoundError("Formiga não encontrada.");
  }
  return normalize(taxon);
}

export async function downloadImage(url) {
  try {
    if (!url || !IMAGE_HOSTS.includes(new URL(url).hostname)) return null;
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const data = Buffer.from(await res.arrayBuffer());
    return data.length <= 3_000_000 ? { contentType, data } : null;
  } catch {
    return null;
  }
}
