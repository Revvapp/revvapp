const MAKE_MAP: Record<string, string> = {
  'vw':         'Volkswagen',
  'volkswagen': 'Volkswagen',
  'mercedes':   'Mercedes-Benz',
  'benz':       'Mercedes-Benz',
  'chevy':      'Chevrolet',
  'land rover': 'Land_Rover',
};

function wikiTitle(make: string, model: string): string {
  const normalizedMake = MAKE_MAP[make.toLowerCase().trim()] ?? make.trim();
  const combined = `${normalizedMake} ${model.trim()}`;
  return combined.replace(/\s+/g, '_');
}

export async function fetchCarImageUrl(make: string, model: string): Promise<string | null> {
  if (!make || !model) return null;
  try {
    const title = wikiTitle(make, model);
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      originalimage?: { source: string };
      thumbnail?:     { source: string };
    };
    return data.originalimage?.source ?? data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}
