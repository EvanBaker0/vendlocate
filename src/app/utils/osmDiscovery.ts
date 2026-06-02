import { expandBusinessTypeToOsmTags } from './osmTags';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat1 - lat2) * Math.PI / 180;
  const dLng = (lng1 - lng2) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildOverpassQuery(tags, lat, lng, radiusMeters) {
  const radius = Math.min(Math.round(radiusMeters), 50000);
  const tagFilters = tags
    .map((tag) => {
      const [k, v] = tag.split('=');
      if (v === '*') return `["${k}"](around:${radius},${lat},${lng})`;
      return `["${k}"="${v}"](around:${radius},${lat},${lng})`;
    })
    .join('');
  return `[out:json][timeout:60];(node${tagFilters};way${tagFilters};);out body center tags qt 1000;`;
}

async function tryOverpassQuery(query) {
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 35000);
      const resp = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        lastError = new Error(`Overpass ${endpoint} HTTP ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('All Overpass endpoints failed');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildNameRegexQuery(keywords, lat, lng, radiusMeters) {
  const radius = Math.min(Math.round(radiusMeters), 50000);
  const pattern = keywords
    .map((k) => escapeRegex(String(k).toLowerCase()))
    .filter(Boolean)
    .join('|');
  if (!pattern) return null;
  return `[out:json][timeout:60];(node["name"~"${pattern}",i](around:${radius},${lat},${lng});way["name"~"${pattern}",i](around:${radius},${lat},${lng}););out body center tags qt 1000;`;
}

const BAD_KEYWORDS = [
  'city',
  'town',
  'village',
  'county',
  'school',
  'church',
  'police',
  'fire',
  'department',
  'government',
  'public',
  'park',
  'cemetery',
  'library',
  'museum',
  'army',
  'corps',
  'township',
  'community',
  'association',
  'district',
  'state',
  'bureau',
];

function isLikelyBusiness(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  if (lower.length < 3) return false;
  if (lower.length > 200) return false;
  return !BAD_KEYWORDS.some((kw) => {
    const re = new RegExp(`\\b${kw}\\b`);
    return re.test(lower);
  });
}

function elementToPlace(el, lat, lng, businessTypeName) {
  const tags = el.tags || {};
  const name = tags.name || tags.operator || tags.brand;
  if (!name) return null;

  const elLat = el.type === 'way' || el.type === 'relation' ? el.center?.lat : el.lat;
  const elLng = el.type === 'way' || el.type === 'relation' ? el.center?.lon : el.lon;
  if (typeof elLat !== 'number' || typeof elLng !== 'number') return null;

  const distance = parseFloat(haversineMiles(lat, lng, elLat, elLng).toFixed(2));

  const address = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'],
    tags['addr:state'],
    tags['addr:postcode'],
  ]
    .filter(Boolean)
    .join(', ');

  return {
    business_name: name,
    business_type: businessTypeName,
    address: address || '',
    city: tags['addr:city'] || '',
    state: tags['addr:state'] || '',
    website: tags.website || tags['contact:website'] || null,
    phone: tags.phone || tags['contact:phone'] || null,
    place_id: `${el.type}/${el.id}`,
    lat: elLat,
    lng: elLng,
    distance,
  };
}

export async function discoverBusinessesByType({
  businessType,
  lat,
  lng,
  radiusMeters,
  centerCity = '',
  centerState = '',
  perTypeLimit = 1500,
}) {
  const osmTags = expandBusinessTypeToOsmTags(businessType);
  const keywords = [
    ...(businessType.requiredKeywords || []),
    ...(businessType.optionalKeywords || []),
  ].map((k) => String(k || '').trim()).filter(Boolean);

  const places = new Map();

  if (osmTags.length > 0) {
    try {
      const query = buildOverpassQuery(osmTags, lat, lng, radiusMeters);
      const data = await tryOverpassQuery(query);
      for (const el of data.elements || []) {
        if (places.size >= perTypeLimit) break;
        const place = elementToPlace(el, lat, lng, businessType.name || 'General');
        if (!place) continue;
        if (!isLikelyBusiness(place.business_name)) continue;
        places.set(place.place_id, place);
      }
    } catch (err) {
      console.warn(`OSM tag query failed for ${businessType.name}:`, err?.message);
    }
  }

  if (places.size < perTypeLimit / 3 && keywords.length > 0) {
    try {
      const query = buildNameRegexQuery(keywords, lat, lng, radiusMeters);
      if (query) {
        const data = await tryOverpassQuery(query);
        for (const el of data.elements || []) {
          if (places.size >= perTypeLimit) break;
          const place = elementToPlace(el, lat, lng, businessType.name || 'General');
          if (!place) continue;
          if (!isLikelyBusiness(place.business_name)) continue;
          places.set(place.place_id, place);
        }
      }
    } catch (err) {
      console.warn(`OSM name-regex query failed for ${businessType.name}:`, err?.message);
    }
  }

  if (centerCity) {
    for (const place of places.values()) {
      if (!place.city && centerCity) place.city = centerCity;
      if (!place.state && centerState) place.state = centerState;
    }
  }

  return Array.from(places.values());
}
