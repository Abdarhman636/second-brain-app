/*
 * Card types. `fields` drives both the create/edit form and the shape of
 * `card.content`, so adding a type only requires a new entry here (plus its
 * review rendering).
 */
export const CARD_TYPES = Object.freeze({
  note: {
    id: 'note',
    label: 'ملاحظة',
    icon: 'note',
    fields: [
      {
        name: 'text',
        label: 'المعلومة',
        control: 'textarea',
        rows: 5,
        placeholder: 'اكتب المعلومة كما تريد أن تتذكرها',
      },
    ],
  },
  qa: {
    id: 'qa',
    label: 'سؤال وجواب',
    icon: 'question',
    fields: [
      {
        name: 'question',
        label: 'السؤال',
        control: 'textarea',
        rows: 2,
        placeholder: 'ما الذي تريد أن تسأل نفسك عنه؟',
      },
      {
        name: 'answer',
        label: 'الإجابة',
        control: 'textarea',
        rows: 4,
        placeholder: 'الإجابة التي ستظهر بعد أن تفكر',
      },
    ],
  },
  quote: {
    id: 'quote',
    label: 'اقتباس',
    icon: 'quote',
    fields: [
      {
        name: 'text',
        label: 'الاقتباس',
        control: 'textarea',
        rows: 4,
        placeholder: 'انسخ الاقتباس كما ورد',
      },
    ],
  },
  definition: {
    id: 'definition',
    label: 'تعريف',
    icon: 'definition',
    fields: [
      {
        name: 'term',
        label: 'المصطلح',
        control: 'input',
        placeholder: 'مثال: منحنى النسيان',
      },
      {
        name: 'definition',
        label: 'التعريف',
        control: 'textarea',
        rows: 4,
        placeholder: 'اشرح المصطلح بكلماتك',
      },
    ],
  },
});

export const CARD_TYPE_ORDER = Object.freeze(['note', 'qa', 'quote', 'definition']);
export const DEFAULT_CARD_TYPE = 'note';

export function getCardType(typeId) {
  return CARD_TYPES[typeId] ?? CARD_TYPES[DEFAULT_CARD_TYPE];
}

/** A one-line summary that never gives away a hidden answer or definition. */
export function getCardTeaser({ type, content }) {
  switch (type) {
    case 'qa':
      return content.question;
    case 'definition':
      return content.term;
    default:
      return content.text;
  }
}

/** Total readable length, used to calm the type size of long cards. */
export function getCardLength({ content }) {
  return Object.values(content).join(' ').length;
}
