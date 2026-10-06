import { addDays } from '../utils/date-utils.js';

/**
 * The demo account. Signing in with it loads the mock data below; new
 * accounts start empty. The address uses the reserved example.com domain.
 */
export const DEMO_ACCOUNT = Object.freeze({
  id: 'user-demo',
  name: 'نور',
  email: 'demo@example.com',
  password: 'rusookh-demo',
});

/*
 * Realistic seed data. All dates are relative to `today` so the demo always
 * shows a meaningful mix: cards due now (some overdue), cards already reviewed
 * today, cards scheduled tomorrow, in a week, in two weeks, and monthly, plus
 * a running streak.
 */
export function createMockData(today) {
  const day = (offset) => addDays(today, offset);
  const timestamp = (offset) => `${day(offset)}T08:30:00.000Z`;

  const projects = [
    { id: 'project-atomic-habits', name: 'العادات الذرية', type: 'book', color: 'clay', createdAt: timestamp(-60) },
    { id: 'project-fenjan', name: 'بودكاست فنجان', type: 'podcast', color: 'plum', createdAt: timestamp(-48) },
    { id: 'project-ux-basics', name: 'أساسيات تجربة المستخدم', type: 'course', color: 'blue', createdAt: timestamp(-40) },
    { id: 'project-psychology', name: 'علم النفس', type: 'topic', color: 'terracotta', createdAt: timestamp(-35) },
    { id: 'project-negotiation', name: 'مهارات التفاوض', type: 'other', customTypeLabel: 'ورشة عمل', color: 'rose', createdAt: timestamp(-25) },
    { id: 'project-clear-writing', name: 'الكتابة الواضحة', type: 'skill', color: 'teal', createdAt: timestamp(-20) },
    { id: 'project-reflections', name: 'تأملات شخصية', type: 'personal', color: 'ochre', createdAt: timestamp(-15) },
  ].map((project) => ({ ...project, updatedAt: project.createdAt }));

  const card = ({ id, projectId, type, content, stage, dueIn, createdAgo, reviewedAgo = null, result = null }) => ({
    id,
    projectId,
    type,
    content,
    reviewStage: stage,
    nextReviewDate: day(dueIn),
    lastReviewedAt: reviewedAgo === null ? null : day(-reviewedAgo),
    lastReviewResult: result,
    createdAt: timestamp(-createdAgo),
    updatedAt: timestamp(-createdAgo),
  });

  const cards = [
    /* ---------- العادات الذرية ---------- */
    card({
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
    }),
    card({
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
    }),
    card({
      id: 'card-ah-systems',
      projectId: 'project-atomic-habits',
      type: 'quote',
      content: { text: 'أنت لا ترتقي إلى مستوى أهدافك، بل تهبط إلى مستوى أنظمتك.' },
      stage: 3,
      dueIn: -1,
      createdAgo: 12,
      reviewedAgo: 8,
      result: 'remembered',
    }),
    card({
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
    }),
    card({
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
    }),
    card({
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
    }),
    card({
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
    }),

    /* ---------- بودكاست فنجان ---------- */
    card({
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
    }),
    card({
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
    }),
    card({
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
    }),
    card({
      id: 'card-fj-questions',
      projectId: 'project-fenjan',
      type: 'quote',
      content: { text: 'السؤال الجيد يفتح أبوابًا أكثر مما تفتحه الإجابة السريعة.' },
      stage: 6,
      dueIn: 9,
      createdAgo: 46,
      reviewedAgo: 21,
      result: 'remembered',
    }),

    /* ---------- أساسيات تجربة المستخدم ---------- */
    card({
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
    }),
    card({
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
    }),
    card({
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
    }),
    card({
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
    }),
    card({
      id: 'card-ux-how-it-works',
      projectId: 'project-ux-basics',
      type: 'quote',
      content: { text: 'التصميم ليس فقط كيف يبدو الشيء أو كيف نشعر به؛ التصميم هو كيف يعمل.' },
      stage: 5,
      dueIn: 27,
      createdAgo: 34,
      reviewedAgo: 3,
      result: 'remembered',
    }),
    card({
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
    }),

    /* ---------- علم النفس ---------- */
    card({
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
    }),
    card({
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
    }),
    card({
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
    }),
    card({
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
    }),
    card({
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
    }),

    /* ---------- مهارات التفاوض (custom type) ---------- */
    card({
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
    }),
    card({
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
    }),

    /* ---------- الكتابة الواضحة ---------- */
    card({
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
    }),
    card({
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
    }),

    /* ---------- تأملات شخصية ---------- */
    card({
      id: 'card-pr-deep-work',
      projectId: 'project-reflections',
      type: 'note',
      content: { text: 'أفضل وقت للتركيز العميق عندي هو أول ساعتين بعد الاستيقاظ، قبل فتح الهاتف أو البريد.' },
      stage: 6,
      dueIn: 20,
      createdAgo: 15,
      reviewedAgo: 10,
      result: 'remembered',
    }),
  ];

  // Reviews already completed today, so the dashboard opens mid-progress.
  const todaysReviews = cards
    .filter((item) => item.lastReviewedAt === today)
    .map((item, index) => ({
      id: `review-seed-${index + 1}`,
      cardId: item.id,
      result: item.lastReviewResult,
      date: today,
      dueDate: today,
      reviewedAt: `${today}T07:${String(10 + index * 2).padStart(2, '0')}:00.000Z`,
    }));

  // A card that was due 8 days ago but only reviewed 6 days ago: days -8 and -7
  // had unfinished work, so they are missed days that ended the older streak.
  const lateReview = {
    id: 'review-seed-late',
    cardId: 'card-ah-two-minutes',
    result: 'remembered',
    date: day(-6),
    dueDate: day(-8),
    reviewedAt: timestamp(-6),
  };

  const reviewLog = [lateReview, ...todaysReviews];

  // Days on which every due card was reviewed: a 6-day streak ending
  // yesterday (finishing today makes it 7) and an older 12-day best run.
  const completedDays = [
    ...Array.from({ length: 6 }, (_, index) => day(-(index + 1))),
    ...Array.from({ length: 12 }, (_, index) => day(-(index + 9))),
  ];

  return { projects, cards, reviewLog, completedDays };
}
