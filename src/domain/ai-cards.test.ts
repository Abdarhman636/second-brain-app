import { describe, expect, it } from 'vitest';
import { isCompleteSuggestion, toCardBody } from './ai-cards';

describe('AI card suggestions', () => {
  it('turns each suggestion into the matching card type', () => {
    expect(toCardBody({ type: 'qa', front: ' ما الذاكرة؟ ', back: 'القدرة على الاحتفاظ.' })).toEqual({
      type: 'qa',
      content: { question: 'ما الذاكرة؟', answer: 'القدرة على الاحتفاظ.' },
    });
    expect(toCardBody({ type: 'definition', front: 'التكرار المتباعد', back: 'مراجعة على فترات تزداد.' }).type).toBe('definition');
    expect(toCardBody({ type: 'note', front: 'ملاحظة', back: '' })).toEqual({ type: 'note', content: { text: 'ملاحظة' } });
    expect(toCardBody({ type: 'quote', front: 'ثمة خُلقٌ نبيل', back: 'اسمه الترفّع' })).toEqual({
      type: 'quote',
      content: { text: 'ثمة خُلقٌ نبيل', continuation: 'اسمه الترفّع' },
    });
  });

  it('keeps only suggestions with their parts filled in', () => {
    expect(isCompleteSuggestion({ type: 'qa', front: 'سؤال؟', back: '' })).toBe(false);
    expect(isCompleteSuggestion({ type: 'note', front: 'ملاحظة', back: '' })).toBe(true);
  });
});
