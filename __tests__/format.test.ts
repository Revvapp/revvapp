import { toTitleCase } from '@/lib/format';

describe('toTitleCase', () => {
  it('capitalizes the first letter of each word', () => {
    expect(toTitleCase('hello world')).toBe('Hello World');
  });

  it('lowercases the rest of ALL-CAPS input', () => {
    expect(toTitleCase('FULL INTERIOR')).toBe('Full Interior');
  });

  it('handles a single word', () => {
    expect(toTitleCase('ceramic')).toBe('Ceramic');
  });

  it('returns empty string unchanged', () => {
    expect(toTitleCase('')).toBe('');
  });
});
