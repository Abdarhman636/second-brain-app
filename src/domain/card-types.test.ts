import { describe, expect, it } from 'vitest';
import { getCardPrompt, getCardTextParts, hasHiddenPart, toCardBody } from './card-types';

describe('card types', () => {
  it('hides the second part of every type except notes', () => {
    expect(hasHiddenPart({ type: 'note', content: { text: 'x' } })).toBe(false);
    expect(hasHiddenPart({ type: 'qa', content: { question: 'q', answer: 'a' } })).toBe(true);
    expect(hasHiddenPart({ type: 'definition', content: { term: 't', definition: 'd' } })).toBe(true);
    expect(hasHiddenPart({ type: 'image', content: { title: 't', imageUrl: 'data:,' } })).toBe(true);
    expect(hasHiddenPart({ type: 'quote', content: { text: 'أول', continuation: 'ثانٍ' } })).toBe(true);
    // A quote saved without an ending has nothing to recall.
    expect(hasHiddenPart({ type: 'quote', content: { text: 'أول', continuation: ' ' } })).toBe(false);
  });

  it('prompts with the visible part only', () => {
    expect(getCardPrompt({ type: 'quote', content: { text: 'أول', continuation: 'ثانٍ' } })).toBe('أول');
    expect(getCardPrompt({ type: 'image', content: { title: 'عنوان', imageUrl: 'data:,x' } })).toBe('عنوان');
  });

  it('never treats image data as text', () => {
    expect(getCardTextParts({ type: 'image', content: { title: 'عنوان', imageUrl: 'data:image/png;base64,AAAA' } })).toEqual(['عنوان']);
  });

  it('builds the right content shape for each type', () => {
    expect(toCardBody('quote', { text: 'أ', continuation: 'ب', answer: 'ignored' })).toEqual({
      type: 'quote',
      content: { text: 'أ', continuation: 'ب' },
    });
    expect(toCardBody('image', { title: 'ع', imageUrl: 'data:,x' })).toEqual({
      type: 'image',
      content: { title: 'ع', imageUrl: 'data:,x' },
    });
  });
});
