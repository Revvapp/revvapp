import { fetchCarImageUrl } from '@/lib/carImage';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

/** The Wikipedia article title the lookup asked for, decoded. */
function requestedTitle(): string {
  const url = String(mockFetch.mock.calls[0][0]);
  return decodeURIComponent(url.split('/page/summary/')[1]);
}

const ok = (body: unknown) => ({ ok: true, json: async () => body });

describe('fetchCarImageUrl', () => {
  beforeEach(() => mockFetch.mockReset());

  it('prefers the original image over the thumbnail', () => {
    mockFetch.mockResolvedValue(
      ok({ originalimage: { source: 'big.jpg' }, thumbnail: { source: 'small.jpg' } })
    );
    return expect(fetchCarImageUrl('Toyota', 'Camry')).resolves.toBe('big.jpg');
  });

  it('falls back to the thumbnail when there is no original', () => {
    mockFetch.mockResolvedValue(ok({ thumbnail: { source: 'small.jpg' } }));
    return expect(fetchCarImageUrl('Toyota', 'Camry')).resolves.toBe('small.jpg');
  });

  it('returns null when the article has no image', () => {
    mockFetch.mockResolvedValue(ok({}));
    return expect(fetchCarImageUrl('Toyota', 'Camry')).resolves.toBeNull();
  });

  it('builds an underscored article title', async () => {
    mockFetch.mockResolvedValue(ok({}));
    await fetchCarImageUrl('Toyota', 'Camry');
    expect(requestedTitle()).toBe('Toyota_Camry');
  });

  it('expands the make aliases people actually type', async () => {
    const cases: [string, string, string][] = [
      ['vw', 'Golf', 'Volkswagen_Golf'],
      ['Volkswagen', 'Golf', 'Volkswagen_Golf'],
      ['chevy', 'Malibu', 'Chevrolet_Malibu'],
      ['mercedes', 'C-Class', 'Mercedes-Benz_C-Class'],
      ['benz', 'C-Class', 'Mercedes-Benz_C-Class'],
      ['land rover', 'Defender', 'Land_Rover_Defender'],
    ];
    for (const [make, model, expected] of cases) {
      mockFetch.mockReset();
      mockFetch.mockResolvedValue(ok({}));
      await fetchCarImageUrl(make, model);
      expect(requestedTitle()).toBe(expected);
    }
  });

  it('matches aliases case-insensitively and ignores stray whitespace', async () => {
    mockFetch.mockResolvedValue(ok({}));
    await fetchCarImageUrl('  ChEvY  ', '  Malibu  ');
    expect(requestedTitle()).toBe('Chevrolet_Malibu');
  });

  it('collapses internal whitespace in a multi-word model', async () => {
    mockFetch.mockResolvedValue(ok({}));
    await fetchCarImageUrl('Ford', 'Grand   Torino');
    expect(requestedTitle()).toBe('Ford_Grand_Torino');
  });

  it('returns null without calling the network on missing input', async () => {
    for (const [make, model] of [['', 'Camry'], ['Toyota', ''], ['', '']]) {
      await expect(fetchCarImageUrl(make, model)).resolves.toBeNull();
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null on a non-OK response', () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    return expect(fetchCarImageUrl('Toyota', 'Nonexistent')).resolves.toBeNull();
  });

  it('swallows a network failure rather than throwing into the UI', () => {
    // A garage screen must still render if Wikipedia is unreachable.
    mockFetch.mockRejectedValue(new Error('offline'));
    return expect(fetchCarImageUrl('Toyota', 'Camry')).resolves.toBeNull();
  });

  it('swallows a malformed JSON body', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('not json');
      },
    });
    return expect(fetchCarImageUrl('Toyota', 'Camry')).resolves.toBeNull();
  });
});
