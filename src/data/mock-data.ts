import { addDays } from '../domain/date-utils';
import { DEFAULT_DAILY_LIMIT } from '../domain/review-scheduler';
import type { Card, CardBody, ISODate, Project, ReviewLogEntry, ReviewResult, Shelf, User, UserData } from '../domain/types';

/** The user shown in demo mode ("جرّب بدون حساب"), which loads the mock data below. */
export const DEMO_USER: User = Object.freeze({ id: 'user-demo', name: 'نور', email: '', dailyLimit: DEFAULT_DAILY_LIMIT, isStudent: null, plan: 'free', planExpiresAt: null, isAdmin: false });

/** A small diagram for the demo image card, inlined so it needs no file or network. */
const FORGETTING_CURVE_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 380" font-family="system-ui, sans-serif">
  <rect width="640" height="380" fill="#ffffff"/>
  <g stroke="#e0e0e0" stroke-width="1">
    <line x1="70" y1="40" x2="70" y2="310"/><line x1="70" y1="310" x2="600" y2="310"/>
    <line x1="70" y1="175" x2="600" y2="175" stroke-dasharray="4 6"/>
  </g>
  <path d="M70 55 C 120 200, 170 250, 250 268 S 430 292, 600 296" fill="none" stroke="#b56b56" stroke-width="3" stroke-dasharray="9 7"/>
  <path d="M70 55 C 95 120, 115 145, 140 152 L140 58 C 175 115, 205 128, 240 132 L240 58 C 295 95, 335 104, 380 107 L380 58 C 455 76, 525 84, 600 86" fill="none" stroke="#333333" stroke-width="3.5" stroke-linejoin="round"/>
  <g fill="#333333"><circle cx="140" cy="58" r="5"/><circle cx="240" cy="58" r="5"/><circle cx="380" cy="58" r="5"/></g>
  <g font-size="15" fill="#6b6b6b" text-anchor="middle">
    <text x="335" y="345">الوقت</text>
    <text x="30" y="180" transform="rotate(-90 30 180)">ما تتذكره</text>
  </g>
  <g font-size="14" fill="#333333">
    <line x1="440" y1="214" x2="470" y2="214" stroke="#333333" stroke-width="3.5"/><text x="480" y="219">مع المراجعة</text>
    <line x1="440" y1="244" x2="470" y2="244" stroke="#b56b56" stroke-width="3" stroke-dasharray="9 7"/><text x="480" y="249">بدون مراجعة</text>
  </g>
</svg>`)}`;

type SeedCard = CardBody & {
  id: string;
  projectId: string;
  stage: number;
  /** Days from today until the next review (negative = overdue). */
  dueIn: number;
  createdAgo: number;
  reviewedAgo?: number;
  result?: ReviewResult;
};

/*
 * Realistic seed data. All dates are relative to `today` so the demo always
 * shows a meaningful mix: cards due now (some overdue), cards already reviewed
 * today, cards scheduled tomorrow, in a week, in two weeks, and monthly, plus
 * a running streak.
 */
export function createMockData(today: ISODate): UserData {
  const day = (offset: number) => addDays(today, offset);
  const timestamp = (offset: number) => `${day(offset)}T08:30:00.000Z`;

  const shelves: Shelf[] = [
    { id: 'shelf-books', name: 'كتب', createdAt: timestamp(-60), updatedAt: timestamp(-60) },
    { id: 'shelf-skills', name: 'مهارات وكورسات', createdAt: timestamp(-40), updatedAt: timestamp(-40) },
  ];
  const shelfOf: Record<string, string> = {
    'project-atomic-habits': 'shelf-books',
    'project-ux-basics': 'shelf-skills',
    'project-negotiation': 'shelf-skills',
    'project-clear-writing': 'shelf-skills',
  };

  const projectSeeds: Omit<Project, 'updatedAt' | 'archived' | 'customTypeLabel' | 'shelfId'>[] = [
    { id: 'project-atomic-habits', name: 'العادات الذرية', type: 'book', color: 'clay', createdAt: timestamp(-60) },
    { id: 'project-fenjan', name: 'بودكاست فنجان', type: 'podcast', color: 'plum', createdAt: timestamp(-48) },
    { id: 'project-ux-basics', name: 'أساسيات تجربة المستخدم', type: 'course', color: 'blue', createdAt: timestamp(-40) },
    { id: 'project-psychology', name: 'علم النفس', type: 'topic', color: 'terracotta', createdAt: timestamp(-35) },
    { id: 'project-negotiation', name: 'مهارات التفاوض', type: 'other', color: 'rose', createdAt: timestamp(-25) },
    { id: 'project-clear-writing', name: 'الكتابة الواضحة', type: 'skill', color: 'teal', createdAt: timestamp(-20) },
    { id: 'project-reflections', name: 'تأملات شخصية', type: 'personal', color: 'ochre', createdAt: timestamp(-15) },
  ];

  const projects: Project[] = projectSeeds.map((project) => ({
    ...project,
    customTypeLabel: project.id === 'project-negotiation' ? 'ورشة عمل' : null,
    shelfId: shelfOf[project.id] ?? null,
    archived: false,
    updatedAt: project.createdAt,
  }));

  const toCard = ({ stage, dueIn, createdAgo, reviewedAgo, result, ...body }: SeedCard): Card => ({
    ...body,
    reviewStage: stage,
    nextReviewDate: day(dueIn),
    lastReviewedAt: reviewedAgo === undefined ? null : day(-reviewedAgo),
    lastReviewResult: result ?? null,
    createdAt: timestamp(-createdAgo),
    updatedAt: timestamp(-createdAgo),
  });

  const seeds: SeedCard[] = [
    /* ---------- العادات الذرية ---------- */
    {
      id: 'card-ah-compound',
      projectId: 'project-atomic-habits',
      type: 'note',
      content: {
        text: 'التحسّن بنسبة 1% كل يوم يتراكم ليجعلك أفضل بنحو 37 ضعفًا بعد عام. التغييرات الصغيرة لا تبدو مهمة في لحظتها، لكن أثرها يظهر مع الوقت.',
      },
      stage: 1,
      dueIn: 1,
      createdAgo: 1,
      reviewedAgo: 0,
      result: 'remembered',
    },
    {
      id: 'card-ah-four-laws',
      projectId: 'project-atomic-habits',
      type: 'qa',
      content: {
        question: 'ما القوانين الأربعة لتغيير السلوك؟',
        answer:
          'اجعلها واضحة، اجعلها جذابة، اجعلها سهلة، اجعلها مُرضية.\nولكسر عادة سيئة نعكسها: اجعلها خفية، منفّرة، صعبة، غير مُرضية.',
      },
      stage: 2,
      dueIn: 0,
      createdAgo: 4,
      reviewedAgo: 2,
      result: 'remembered',
    },
    {
      id: 'card-ah-systems',
      projectId: 'project-atomic-habits',
      type: 'quote',
      content: { text: 'أنت لا ترتقي إلى مستوى أهدافك،', continuation: 'بل تهبط إلى مستوى أنظمتك.' },
      stage: 3,
      dueIn: -1,
      createdAgo: 12,
      reviewedAgo: 8,
      result: 'remembered',
    },
    {
      id: 'card-ah-stacking',
      projectId: 'project-atomic-habits',
      type: 'definition',
      content: {
        term: 'تكديس العادات',
        definition: 'ربط عادة جديدة بعادة تمارسها بالفعل، بصيغة: «بعد [العادة الحالية]، سأقوم بـ[العادة الجديدة]».',
      },
      stage: 4,
      dueIn: 14,
      createdAgo: 20,
      reviewedAgo: 0,
      result: 'remembered',
    },
    {
      id: 'card-ah-two-minutes',
      projectId: 'project-atomic-habits',
      type: 'definition',
      content: {
        term: 'قاعدة الدقيقتين',
        definition:
          'عند البدء بعادة جديدة، اختصرها إلى نسخة لا تستغرق أكثر من دقيقتين. الهدف أن تُتقن الحضور قبل أن تُتقن الأداء.',
      },
      stage: 6,
      dueIn: 18,
      createdAgo: 58,
      reviewedAgo: 12,
      result: 'remembered',
    },
    {
      id: 'card-ah-identity',
      projectId: 'project-atomic-habits',
      type: 'qa',
      content: {
        question: 'ما الفرق بين العادات المبنية على النتائج والعادات المبنية على الهوية؟',
        answer:
          'الأولى تبدأ بما تريد تحقيقه، والثانية تبدأ بمن تريد أن تكون. كل مرة تمارس فيها عادة هي تصويت لصالح الهوية التي تبنيها.',
      },
      stage: 3,
      dueIn: 5,
      createdAgo: 10,
      reviewedAgo: 2,
      result: 'remembered',
    },
    {
      id: 'card-ah-environment',
      projectId: 'project-atomic-habits',
      type: 'note',
      content: {
        text: 'البيئة أقوى من الإرادة: اجعل إشارات العادات الجيدة ظاهرة أمامك، وأخفِ إشارات العادات التي تريد التخلص منها.',
      },
      stage: 5,
      dueIn: 24,
      createdAgo: 30,
      reviewedAgo: 6,
      result: 'remembered',
    },

    /* ---------- بودكاست فنجان ---------- */
    {
      id: 'card-fj-burnout',
      projectId: 'project-fenjan',
      type: 'definition',
      content: {
        term: 'الاحتراق الوظيفي',
        definition:
          'حالة من الإنهاك الجسدي والذهني تنتج عن ضغط عمل مزمن لم تتم إدارته، وتظهر في الإرهاق، والنفور من العمل، وتراجع الشعور بالإنجاز.',
      },
      stage: 0,
      dueIn: 0,
      createdAgo: 0,
    },
    {
      id: 'card-fj-nap',
      projectId: 'project-fenjan',
      type: 'note',
      content: {
        text: 'القيلولة القصيرة بين 10 و20 دقيقة تنعش التركيز دون الدخول في النوم العميق، فتتجنب الخمول الذي يلي القيلولة الطويلة.',
      },
      stage: 3,
      dueIn: 7,
      createdAgo: 9,
      reviewedAgo: 0,
      result: 'remembered',
    },
    {
      id: 'card-fj-opinions',
      projectId: 'project-fenjan',
      type: 'qa',
      content: {
        question: 'لماذا يصعب علينا تغيير آرائنا حتى أمام الأدلة الواضحة؟',
        answer:
          'لأننا نربط آراءنا بهويتنا وبالجماعة التي ننتمي إليها، فيبدو التراجع عنها كأنه خسارة لجزء منا، لا مجرد تصحيح لمعلومة.',
      },
      stage: 2,
      dueIn: 1,
      createdAgo: 5,
      reviewedAgo: 1,
      result: 'remembered',
    },
    {
      id: 'card-fj-questions',
      projectId: 'project-fenjan',
      type: 'quote',
      content: { text: 'السؤال الجيد يفتح أبوابًا', continuation: 'أكثر مما تفتحه الإجابة السريعة.' },
      stage: 6,
      dueIn: 9,
      createdAgo: 46,
      reviewedAgo: 21,
      result: 'remembered',
    },

    /* ---------- أساسيات تجربة المستخدم ---------- */
    {
      id: 'card-ux-hick',
      projectId: 'project-ux-basics',
      type: 'definition',
      content: {
        term: 'قانون هيك',
        definition:
          'يزداد الوقت اللازم لاتخاذ القرار كلما زاد عدد الخيارات المتاحة وتعقيدها؛ لذلك نقلّل الخيارات في اللحظات الحاسمة.',
      },
      stage: 1,
      dueIn: 0,
      createdAgo: 2,
      reviewedAgo: 1,
      result: 'remembered',
    },
    {
      id: 'card-ux-fitts',
      projectId: 'project-ux-basics',
      type: 'definition',
      content: {
        term: 'قانون فيتس',
        definition:
          'الوقت اللازم للوصول إلى هدف ما يعتمد على المسافة إليه وحجمه؛ فالأزرار الأكبر والأقرب أسرع في الاستخدام.',
      },
      stage: 2,
      dueIn: 1,
      createdAgo: 6,
      reviewedAgo: 0,
      result: 'forgot',
    },
    {
      id: 'card-ux-design-thinking',
      projectId: 'project-ux-basics',
      type: 'qa',
      content: {
        question: 'ما المراحل الخمس للتفكير التصميمي؟',
        answer: 'التعاطف، ثم تحديد المشكلة، ثم توليد الأفكار، ثم بناء نموذج أولي، ثم الاختبار.',
      },
      stage: 4,
      dueIn: -2,
      createdAgo: 30,
      reviewedAgo: 16,
      result: 'remembered',
    },
    {
      id: 'card-ux-five-users',
      projectId: 'project-ux-basics',
      type: 'note',
      content: {
        text: 'اختبار قابلية الاستخدام مع خمسة مستخدمين يكشف معظم المشكلات الجوهرية. الأفضل إجراء اختبارات صغيرة ومتكررة بدل اختبار واحد كبير.',
      },
      stage: 3,
      dueIn: 4,
      createdAgo: 14,
      reviewedAgo: 3,
      result: 'remembered',
    },
    {
      id: 'card-ux-how-it-works',
      projectId: 'project-ux-basics',
      type: 'quote',
      content: { text: 'التصميم ليس فقط كيف يبدو الشيء أو كيف نشعر به؛', continuation: 'التصميم هو كيف يعمل.' },
      stage: 5,
      dueIn: 27,
      createdAgo: 34,
      reviewedAgo: 3,
      result: 'remembered',
    },
    {
      id: 'card-ux-vs-ui',
      projectId: 'project-ux-basics',
      type: 'qa',
      content: {
        question: 'ما الفرق بين تجربة المستخدم (UX) وواجهة المستخدم (UI)؟',
        answer:
          'تجربة المستخدم تهتم برحلة المستخدم كاملة ومدى سهولة وصوله إلى هدفه، أما واجهة المستخدم فتهتم بالعناصر المرئية التي يتفاعل معها.',
      },
      stage: 6,
      dueIn: 12,
      createdAgo: 39,
      reviewedAgo: 18,
      result: 'remembered',
    },

    /* ---------- علم النفس ---------- */
    {
      id: 'card-ps-forgetting-curve',
      projectId: 'project-psychology',
      type: 'definition',
      content: {
        term: 'منحنى النسيان',
        definition:
          'نموذج وضعه عالم النفس هيرمان إبنغهاوس، يوضح أن الذاكرة تفقد المعلومات بسرعة بعد التعلّم ما لم تُراجَع على فترات متباعدة.',
      },
      stage: 0,
      dueIn: 0,
      createdAgo: 0,
    },
    {
      id: 'card-ps-forgetting-chart',
      projectId: 'project-psychology',
      type: 'image',
      content: { title: 'منحنى النسيان: مع المراجعة المتباعدة وبدونها', imageUrl: FORGETTING_CURVE_IMAGE },
      stage: 0,
      dueIn: 0,
      createdAgo: 0,
    },
    {
      id: 'card-ps-confirmation-bias',
      projectId: 'project-psychology',
      type: 'definition',
      content: {
        term: 'الانحياز التأكيدي',
        definition: 'الميل إلى البحث عن المعلومات التي تؤكد معتقداتنا المسبقة، وتفسيرها وتذكّرها بطريقة تدعمها.',
      },
      stage: 1,
      dueIn: 1,
      createdAgo: 1,
      reviewedAgo: 0,
      result: 'remembered',
    },
    {
      id: 'card-ps-spaced-review',
      projectId: 'project-psychology',
      type: 'qa',
      content: {
        question: 'لماذا تُعد المراجعة المتباعدة أفضل من المراجعة المكثفة؟',
        answer:
          'لأن استرجاع المعلومة بعد أن نبدأ بنسيانها يقوّي أثرها في الذاكرة طويلة المدى، بينما تمنح المراجعة المكثفة في جلسة واحدة إحساسًا مؤقتًا بالإتقان.',
      },
      stage: 2,
      dueIn: 0,
      createdAgo: 6,
      reviewedAgo: 1,
      result: 'forgot',
    },
    {
      id: 'card-ps-retrieval',
      projectId: 'project-psychology',
      type: 'note',
      content: {
        text: 'استرجاع المعلومة من الذاكرة — أي أن تختبر نفسك — أكثر فاعلية للحفظ من إعادة قراءتها مرات متعددة.',
      },
      stage: 4,
      dueIn: 10,
      createdAgo: 24,
      reviewedAgo: 4,
      result: 'remembered',
    },
    {
      id: 'card-ps-dunning-kruger',
      projectId: 'project-psychology',
      type: 'definition',
      content: {
        term: 'تأثير دانينغ-كروجر',
        definition:
          'ميل أصحاب الخبرة المحدودة في مجال ما إلى المبالغة في تقدير كفاءتهم فيه، لأنهم لا يملكون بعد المعرفة الكافية لرؤية أخطائهم.',
      },
      stage: 2,
      dueIn: 1,
      createdAgo: 4,
      reviewedAgo: 1,
      result: 'remembered',
    },

    /* ---------- مهارات التفاوض (custom type) ---------- */
    {
      id: 'card-ng-batna',
      projectId: 'project-negotiation',
      type: 'definition',
      content: {
        term: 'أفضل بديل للاتفاق (BATNA)',
        definition: 'أفضل خيار متاح لك إذا فشلت المفاوضات. كلما كان بديلك أقوى، زادت قدرتك على قول «لا».',
      },
      stage: 3,
      dueIn: 3,
      createdAgo: 18,
      reviewedAgo: 4,
      result: 'remembered',
    },
    {
      id: 'card-ng-anchoring',
      projectId: 'project-negotiation',
      type: 'qa',
      content: {
        question: 'لماذا يُفضَّل أحيانًا أن تكون أول من يطرح رقمًا في التفاوض؟',
        answer: 'بسبب تأثير الإرساء: الرقم الأول يصبح نقطة مرجعية تؤثر في كل العروض التي تليه.',
      },
      stage: 2,
      dueIn: 1,
      createdAgo: 7,
      reviewedAgo: 1,
      result: 'remembered',
    },

    /* ---------- الكتابة الواضحة ---------- */
    {
      id: 'card-wr-topic-sentence',
      projectId: 'project-clear-writing',
      type: 'qa',
      content: {
        question: 'أين تضع الفكرة الرئيسية في الفقرة؟',
        answer: 'في الجملة الأولى، ثم تأتي الجمل التالية لتشرحها وتدعمها بالأمثلة.',
      },
      stage: 1,
      dueIn: 0,
      createdAgo: 2,
      reviewedAgo: 1,
      result: 'remembered',
    },
    {
      id: 'card-wr-draft-fast',
      projectId: 'project-clear-writing',
      type: 'note',
      content: {
        text: 'اكتب المسودة الأولى بسرعة ودون توقف، وأجّل التحرير إلى جلسة منفصلة. الكتابة والتحرير مهارتان مختلفتان.',
      },
      stage: 3,
      dueIn: 6,
      createdAgo: 9,
      reviewedAgo: 1,
      result: 'remembered',
    },

    /* ---------- تأملات شخصية ---------- */
    {
      id: 'card-pr-deep-work',
      projectId: 'project-reflections',
      type: 'note',
      content: { text: 'أفضل وقت للتركيز العميق عندي هو أول ساعتين بعد الاستيقاظ، قبل فتح الهاتف أو البريد.' },
      stage: 6,
      dueIn: 20,
      createdAgo: 15,
      reviewedAgo: 10,
      result: 'remembered',
    },
  ];
  const cards = seeds.map(toCard);

  // Each card's most recent review (today's included, so the dashboard opens
  // mid-progress), all on time: the review date is also the due date.
  const lastReviews: ReviewLogEntry[] = cards.flatMap((item, index) =>
    item.lastReviewedAt
      ? [
          {
            id: `review-seed-${index + 1}`,
            cardId: item.id,
            result: item.lastReviewResult ?? 'remembered',
            date: item.lastReviewedAt,
            dueDate: item.lastReviewedAt,
            reviewedAt: `${item.lastReviewedAt}T07:${String(10 + index).padStart(2, '0')}:00.000Z`,
          },
        ]
      : [],
  );

  // Earlier reviews, for a month of history: the UX course trips the user up
  // most often, so it shows as the hardest project.
  const history: [cardId: string, daysAgo: number, result: ReviewResult][] = [
    ['card-ux-hick', 4, 'forgot'],
    ['card-ux-design-thinking', 17, 'forgot'],
    ['card-ux-fitts', 4, 'remembered'],
    ['card-ah-four-laws', 4, 'remembered'],
    ['card-ah-identity', 9, 'remembered'],
    ['card-ah-systems', 15, 'remembered'],
    ['card-ps-spaced-review', 3, 'remembered'],
  ];
  const earlierReviews: ReviewLogEntry[] = history.map(([cardId, daysAgo, result], index) => ({
    id: `review-history-${index + 1}`,
    cardId,
    result,
    date: day(-daysAgo),
    dueDate: day(-daysAgo),
    reviewedAt: timestamp(-daysAgo),
  }));

  // A card that was due 8 days ago but only reviewed 6 days ago: days -8 and -7
  // had unfinished work, so they are missed days that ended the older streak.
  const lateReview: ReviewLogEntry = {
    id: 'review-seed-late',
    cardId: 'card-ah-two-minutes',
    result: 'remembered',
    date: day(-6),
    dueDate: day(-8),
    reviewedAt: timestamp(-6),
  };

  const reviewLog = [...earlierReviews, lateReview, ...lastReviews];

  // Days on which every due card was reviewed: a 6-day streak ending
  // yesterday (finishing today makes it 7) and an older 12-day best run.
  const completedDays = [
    ...Array.from({ length: 6 }, (_, index) => day(-(index + 1))),
    ...Array.from({ length: 12 }, (_, index) => day(-(index + 9))),
  ];

  return { shelves, projects, cards, reviewLog, completedDays, vacations: [] };
}
