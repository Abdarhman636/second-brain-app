/*
 * Card types. `fields` drives both the create/edit form and the shape of
 * `card.content`. Every type except a plain note has a hidden part that is
 * only revealed during review, so the user has to recall it first.
 */
import type { Card, CardBody, CardType } from './types';

export type CardFieldName = 'text' | 'question' | 'answer' | 'term' | 'definition' | 'continuation' | 'title' | 'imageUrl';
export type CardIconName = 'note' | 'question' | 'quote' | 'definition' | 'image';

export interface CardField {
  name: CardFieldName;
  label: string;
  control: 'input' | 'textarea' | 'image';
  rows?: number;
  placeholder: string;
  /** Explains when this part is visible during review. */
  hint?: string;
}

export interface CardTypeDefinition {
  id: CardType;
  label: string;
  icon: CardIconName;
  fields: readonly CardField[];
  /** What the hidden part is called, e.g. "الإجابة" (absent for notes). */
  hiddenPartLabel?: string;
}

const SHOWN_HINT = 'يظهر أثناء المراجعة.';
const HIDDEN_HINT = 'لا يظهر إلا بعد الضغط على البطاقة، لتتأكد أنك تتذكره.';

export const CARD_TYPES: Readonly<Record<CardType, CardTypeDefinition>> = {
  note: {
    id: 'note',
    label: 'ملاحظة',
    icon: 'note',
    fields: [{ name: 'text', label: 'المعلومة', control: 'textarea', rows: 5, placeholder: 'اكتب المعلومة كما تريد أن تتذكرها' }],
  },
  qa: {
    id: 'qa',
    label: 'سؤال وجواب',
    icon: 'question',
    hiddenPartLabel: 'الإجابة',
    fields: [
      { name: 'question', label: 'السؤال', control: 'textarea', rows: 2, placeholder: 'ما الذي تريد أن تسأل نفسك عنه؟', hint: SHOWN_HINT },
      { name: 'answer', label: 'الإجابة', control: 'textarea', rows: 4, placeholder: 'الإجابة التي ستظهر بعد أن تفكر', hint: HIDDEN_HINT },
    ],
  },
  quote: {
    id: 'quote',
    label: 'اقتباس',
    icon: 'quote',
    hiddenPartLabel: 'تكملة الاقتباس',
    fields: [
      { name: 'text', label: 'بداية الاقتباس', control: 'textarea', rows: 2, placeholder: 'مثال: أنت لا ترتقي إلى مستوى أهدافك،', hint: SHOWN_HINT },
      { name: 'continuation', label: 'تكملة الاقتباس', control: 'textarea', rows: 3, placeholder: 'مثال: بل تهبط إلى مستوى أنظمتك.', hint: HIDDEN_HINT },
    ],
  },
  definition: {
    id: 'definition',
    label: 'تعريف',
    icon: 'definition',
    hiddenPartLabel: 'التعريف',
    fields: [
      { name: 'term', label: 'المصطلح', control: 'input', placeholder: 'مثال: منحنى النسيان', hint: SHOWN_HINT },
      { name: 'definition', label: 'التعريف', control: 'textarea', rows: 4, placeholder: 'اشرح المصطلح بكلماتك', hint: HIDDEN_HINT },
    ],
  },
  image: {
    id: 'image',
    label: 'صورة',
    icon: 'image',
    hiddenPartLabel: 'الصورة',
    fields: [
      { name: 'title', label: 'عنوان الصورة', control: 'input', placeholder: 'مثال: مخطط منحنى النسيان', hint: SHOWN_HINT },
      { name: 'imageUrl', label: 'الصورة', control: 'image', placeholder: 'اختر صورة من جهازك', hint: 'تظهر بعد الضغط على البطاقة.' },
    ],
  },
};

export const CARD_TYPE_ORDER: readonly CardType[] = ['note', 'qa', 'quote', 'definition', 'image'];
export const DEFAULT_CARD_TYPE: CardType = 'note';

export function getCardType(type: CardType): CardTypeDefinition {
  return CARD_TYPES[type];
}

export type CardFieldValues = Partial<Record<CardFieldName, string>>;

/** The content fields of a card body, as flat form values. */
export function toFieldValues(body: CardBody): CardFieldValues {
  return { ...body.content };
}

/** Build a correctly-shaped card body from flat form values (already trimmed). */
export function toCardBody(type: CardType, values: CardFieldValues): CardBody {
  const value = (name: CardFieldName) => values[name] ?? '';
  switch (type) {
    case 'note':
      return { type, content: { text: value('text') } };
    case 'quote':
      return { type, content: { text: value('text'), continuation: value('continuation') } };
    case 'qa':
      return { type, content: { question: value('question'), answer: value('answer') } };
    case 'definition':
      return { type, content: { term: value('term'), definition: value('definition') } };
    case 'image':
      return { type, content: { title: value('title'), imageUrl: value('imageUrl') } };
  }
}

/** The part of a card that is shown before it is reviewed (never the hidden part). */
export function getCardPrompt(card: CardBody): string {
  switch (card.type) {
    case 'qa':
      return card.content.question;
    case 'definition':
      return card.content.term;
    case 'image':
      return card.content.title;
    case 'note':
    case 'quote':
      return card.content.text;
  }
}

/** Whether a card has a part to recall before it is revealed. */
export function hasHiddenPart(card: CardBody): boolean {
  if (card.type === 'note') return false;
  if (card.type === 'quote') return card.content.continuation.trim().length > 0;
  return true;
}

/** The card's readable text, for search and sizing (never the image data). */
export function getCardTextParts(card: CardBody): string[] {
  switch (card.type) {
    case 'note':
      return [card.content.text];
    case 'quote':
      return [card.content.text, card.content.continuation];
    case 'qa':
      return [card.content.question, card.content.answer];
    case 'definition':
      return [card.content.term, card.content.definition];
    case 'image':
      return [card.content.title];
  }
}

/** Total readable length, used to calm the type size of long cards. */
export function getCardLength(card: Card): number {
  return getCardTextParts(card).join(' ').length;
}
