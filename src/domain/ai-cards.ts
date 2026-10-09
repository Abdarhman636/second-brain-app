/*
 * Cards suggested by AI (the generate-cards function), and how they become
 * real cards once the student keeps them.
 */
import type { CardBody } from './types';

export type SuggestedCardType = 'qa' | 'definition' | 'quote' | 'note';

export interface SuggestedCard {
  type: SuggestedCardType;
  /** qa: the question. definition: the term. quote: its opening words. note: the whole note. */
  front: string;
  /** qa: the answer. definition: the definition. quote: the rest of it. note: empty. */
  back: string;
}

export const AI_CARD_COUNTS = [1, 5, 10, 15] as const;
export const AI_TEXT_MIN_CHARS = 40;
export const AI_TEXT_MAX_CHARS = 12_000;

/** The card body for a kept suggestion (after the student's edits). */
export function toCardBody(card: SuggestedCard): CardBody {
  switch (card.type) {
    case 'qa':
      return { type: 'qa', content: { question: card.front.trim(), answer: card.back.trim() } };
    case 'definition':
      return { type: 'definition', content: { term: card.front.trim(), definition: card.back.trim() } };
    case 'quote':
      return { type: 'quote', content: { text: card.front.trim(), continuation: card.back.trim() } };
    case 'note':
      return { type: 'note', content: { text: [card.front, card.back].map((part) => part.trim()).filter(Boolean).join('\n') } };
  }
}

/** A suggestion is worth keeping only with its parts filled in. */
export function isCompleteSuggestion(card: SuggestedCard): boolean {
  return Boolean(card.front.trim() && (card.type === 'note' || card.back.trim()));
}
