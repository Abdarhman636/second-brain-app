/*
 * Plans and prices. Open to everyone: visitors see it as a sales page, free
 * accounts land here (with ?reason=…) when they reach a limit. Subscribing
 * leads to /checkout (manual payment by bank transfer).
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Icon, type IconName } from '../components/Icon';
import { signOut } from '../data/session';
import { PAYMENT } from '../config';
import { formatShortDate, toISODate } from '../domain/date-utils';
import {
  comparePlans,
  describeLimits,
  FOUNDER_SEATS,
  getPlanPrice,
  getPriceList,
  monthlyEquivalent,
  priceDiscount,
  type PriceFor,
  PERIOD_LABELS,
  PLAN_ORDER,
  PLANS,
  RESOURCE_LABELS,
  studentDiscount,
  yearlySaving,
  type BillingPeriod,
  type LimitedResource,
  type Plan,
  type PlanId,
} from '../domain/plans';
import { ACADEMIC_EMAIL_EXAMPLE, isStudentDiscountEligible } from '../domain/students';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useFounderStatus } from '../hooks/use-founder-status';
import { useAppStore } from '../store/app-store';
import { countResources } from '../store/selectors';
import { useUiStore } from '../store/ui-store';

/** The plan we steer students toward. */
const RECOMMENDED: PlanId = 'plus';

const FEATURES: Record<PlanId, { icon: IconName; text: string }[]> = {
  free: [
    { icon: 'shelf', text: describeLimits('free')! },
    { icon: 'review', text: 'المراجعة المتباعدة كاملة' },
    { icon: 'flame', text: 'السلسلة اليومية ووضع الإجازة' },
    { icon: 'chart', text: 'إحصائيات تقدّمك' },
    { icon: 'cards', text: 'كل أنواع البطاقات، ومنها الصور' },
  ],
  plus: [
    { icon: 'check', text: 'كل ما في بذرة' },
    { icon: 'shelf', text: `حتى ${RESOURCE_LABELS.shelves.limitText(PLANS.plus.limits.shelves!)}` },
    { icon: 'projects', text: `حتى ${RESOURCE_LABELS.projects.limitText(PLANS.plus.limits.projects!)}` },
    { icon: 'cards', text: `حتى ${RESOURCE_LABELS.cards.limitText(PLANS.plus.limits.cards!)}` },
  ],
  pro: [
    { icon: 'check', text: 'كل ما في جذور' },
    { icon: 'shelf', text: 'رفوف ومشاريع وبطاقات بلا حدود' },
    { icon: 'text', text: 'بطاقات بالذكاء الاصطناعي من نص تلصقه' },
    { icon: 'image', text: 'أو من صورة لصفحة كتاب أو سبورة' },
    { icon: 'sparkle', text: `حتى ${PLANS.pro.aiCardsPerMonth} بطاقة ذكية في الشهر` },
  ],
};

const INCLUDED_EVERYWHERE = ['المراجعة المتباعدة', 'السلسلة ووضع الإجازة', 'الحد اليومي للمراجعة', 'الوضع الداكن', 'تصدير بياناتك'];

const FAQ: { question: string; answer: string }[] = [
  {
    question: 'هل خطة بذرة مجانية فعلًا؟',
    answer: 'نعم، بلا بطاقة دفع وبلا مدة. تكفيك لتجرّب رسوخ على مادة أو كتاب، وتبني عادة المراجعة اليومية.',
  },
  {
    question: 'ماذا يحدث لبطاقاتي إذا وصلت لحد خطتي؟',
    answer: 'لا يضيع شيء. تبقى كل بطاقاتك وتواصل مراجعتها كالمعتاد، لكن إضافة الجديد تحتاج خطة أعلى. خطة راسخ بلا حدود.',
  },
  {
    question: 'كيف تعمل البطاقات الذكية في خطة راسخ؟',
    answer:
      'الصق نصًا أو صوّر صفحة، ونقترح عليك بطاقات جاهزة. تراجعها وتعدّلها قبل حفظها، فلا يدخل مراجعتك إلا ما اخترته.',
  },
  {
    question: 'هل يوجد خصم للطلاب؟',
    answer: `نعم، نحو الثلث. أنشئ حسابك بإيميل جامعتك (مثل ${ACADEMIC_EMAIL_EXAMPLE}) واختر «نعم، طالب»، وسيظهر لك سعر الطالب تلقائيًا. إن كان حسابك بإيميل آخر، غيّره إلى إيميل الجامعة من «الإعدادات».`,
  },
  {
    question: 'ما هو سعر المؤسسين؟',
    answer: `أول ${FOUNDER_SEATS} مشترك في رسوخ يدفعون سعر الإطلاق المخفّض، ويبقى سعرهم ثابتًا في كل تجديد ما داموا يجدّدون. ويجتمع مع خصم الطلاب.`,
  },
  {
    question: 'كيف أدفع؟',
    answer: `بتحويل بنكي إلى حسابنا في ${PAYMENT.bank.name}، ثم ترسل الطلب من التطبيق مع صورة الإيصال. نراجع التحويل ونفعّل اشتراكك ${PAYMENT.approvalTime} غالبًا، ونرسل لك كل تحديث على بريدك.`,
  },
  {
    question: 'هل يتجدد الاشتراك تلقائيًا؟',
    answer: 'لا. تدفع مرة واحدة لمدة 6 أشهر أو 12 شهرًا، ولا يُسحب منك أي مبلغ بعدها. قبل انتهاء المدة نذكّرك، وتجدّد إن أردت.',
  },
  {
    question: 'ماذا يحدث عندما ينتهي اشتراكي؟',
    answer: 'تعود إلى خطة بذرة. لا يُحذف شيء: تبقى كل بطاقاتك وتواصل مراجعتها، لكن إضافة الجديد تحتاج تجديد الاشتراك.',
  },
];

const formatPrice = (value: number) => value.toLocaleString('en', { maximumFractionDigits: 2 });

function isLimitedResource(value: string | null): value is LimitedResource {
  return value === 'shelves' || value === 'projects' || value === 'cards';
}

/** Why the user was sent here, when they hit a limit. */
function LimitBanner({ reason }: { reason: LimitedResource }) {
  const planId = useAppStore((state) => (state.mode === 'account' ? (state.user?.plan ?? 'free') : 'free'));
  const plan = PLANS[planId];
  const limit = plan.limits[reason] ?? 0;
  const next = planId === 'free' ? 'اختر خطة أعلى' : PLANS.pro.available ? 'انتقل إلى خطة راسخ' : 'انتظر خطة راسخ (بلا حدود)، قريبًا';
  return (
    <div className="pricing-banner" role="status">
      <Icon name="info" size={20} />
      <p>
        <strong>
          وصلت لحد خطة {plan.name}: {RESOURCE_LABELS[reason].limitText(limit)}.
        </strong>{' '}
        كل ما أضفته محفوظ وتواصل مراجعته. لتضيف {RESOURCE_LABELS[reason].more}، {next}.
      </p>
    </div>
  );
}

/** The account's usage of each limit, on a plan that has limits. */
function Usage() {
  const user = useAppStore((state) => state.user);
  const mode = useAppStore((state) => state.mode);
  const shelves = useAppStore((state) => state.shelves);
  const projects = useAppStore((state) => state.projects);
  const cards = useAppStore((state) => state.cards);
  if (mode !== 'account' || !user || !describeLimits(user.plan)) return null;
  const plan = PLANS[user.plan];

  const counts = countResources({ user, mode, shelves, projects, cards });
  const rows: { resource: LimitedResource; label: string }[] = [
    { resource: 'shelves', label: 'الرفوف' },
    { resource: 'projects', label: 'المشاريع' },
    { resource: 'cards', label: 'البطاقات' },
  ];

  return (
    <dl className="pricing-usage" aria-label={`استخدامك لخطة ${plan.name}`}>
      {rows.map(({ resource, label }) => {
        const limit = plan.limits[resource] ?? 0;
        const used = counts[resource];
        return (
          <div key={resource} className={`pricing-usage__item${used >= limit ? ' is-full' : ''}`}>
            <dt>{label}</dt>
            <dd>
              <span className="pricing-usage__count">
                {used}/{limit}
              </span>
              <span className="pricing-usage__bar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function PlanPrice({ plan, period, buyer }: { plan: Plan; period: BillingPeriod; buyer: PriceFor }) {
  if (!plan.price) {
    return (
      <div className="plan-card__price">
        <span className="plan-card__amount">0</span>
        <span className="plan-card__unit">ر.س</span>
        <p className="plan-card__billing">مجانية دائمًا</p>
      </div>
    );
  }
  // The whole price, since it's paid once for the period; the monthly figure helps compare.
  const prices = getPriceList(plan, buyer) ?? plan.price;
  const label = [buyer.founder && 'سعر المؤسسين', buyer.student && 'سعر الطالب'].filter(Boolean).join(' + ');
  return (
    <div className="plan-card__price">
      {label && (
        <span className="plan-card__student">
          {label} · خصم {priceDiscount(plan, period, buyer)}% <s>{plan.price[period]} ر.س</s>
        </span>
      )}
      <span className="plan-card__amount">{getPlanPrice(plan, period, buyer)}</span>
      <span className="plan-card__unit">ر.س / {PERIOD_LABELS[period]}</span>
      <p className="plan-card__billing">
        تعادل {formatPrice(monthlyEquivalent(prices, period))} ر.س شهريًا · دفعة واحدة بلا تجديد تلقائي
      </p>
    </div>
  );
}

function PlanAction({ plan, period }: { plan: Plan; period: BillingPeriod }) {
  const user = useAppStore((state) => state.user);
  const mode = useAppStore((state) => state.mode);
  const navigate = useNavigate();
  const currentPlan = mode === 'account' ? (user?.plan ?? null) : null;
  const checkout = `/checkout?plan=${plan.id}&period=${period}`;

  if (plan.id === 'free') {
    if (currentPlan === 'free') {
      return (
        <button type="button" className="btn btn--secondary btn--lg btn--block" disabled>
          <Icon name="check" size={18} />
          خطتك الحالية
        </button>
      );
    }
    if (currentPlan) return null; // On a paid plan already.
    if (mode === 'demo') {
      return (
        <button
          type="button"
          className="btn btn--secondary btn--lg btn--block"
          onClick={async () => {
            await signOut();
            navigate('/signup');
          }}
        >
          أنشئ حسابًا مجانيًا
        </button>
      );
    }
    return (
      <Link className="btn btn--secondary btn--lg btn--block" to="/signup">
        ابدأ مجانًا
      </Link>
    );
  }

  if (!plan.available) {
    return (
      <button type="button" className="btn btn--secondary btn--lg btn--block" disabled>
        يُطلق قريبًا
      </button>
    );
  }

  if (mode === 'demo') {
    return (
      <button
        type="button"
        className={`btn btn--lg btn--block ${plan.id === RECOMMENDED ? 'btn--primary' : 'btn--dark'}`}
        onClick={() => useUiStore.getState().showToast('الاشتراك يحتاج حسابًا. أنشئ حسابًا مجانيًا من صفحة الدخول أولًا.')}
      >
        اشترك في {plan.name}
      </button>
    );
  }

  // Signed out: sign up first, then continue to checkout.
  if (!user || !currentPlan) {
    return (
      <Link className={`btn btn--lg btn--block ${plan.id === RECOMMENDED ? 'btn--primary' : 'btn--dark'}`} to="/signup" state={{ from: checkout }}>
        اشترك في {plan.name}
      </Link>
    );
  }

  const standing = comparePlans(plan.id, currentPlan);
  if (standing === 'current') {
    return (
      <div className="plan-card__current">
        <p>
          <Icon name="check" size={16} />
          أنت مشترك حاليًا في هذه الباقة
          {user.planExpiresAt && ` حتى ${formatShortDate(toISODate(new Date(user.planExpiresAt)))}`}.
        </p>
        <Link className="btn btn--secondary btn--lg btn--block" to={checkout}>
          جدّد اشتراكك
        </Link>
      </div>
    );
  }
  if (standing === 'downgrade') {
    return (
      <button type="button" className="btn btn--secondary btn--lg btn--block" disabled>
        باقتك الحالية أعلى
      </button>
    );
  }
  // Free accounts subscribe; paid ones upgrade.
  return (
    <Link className={`btn btn--lg btn--block ${currentPlan === 'free' && plan.id !== RECOMMENDED ? 'btn--dark' : 'btn--primary'}`} to={checkout}>
      {currentPlan === 'free' ? `اشترك في ${plan.name}` : `الترقية إلى ${plan.name}`}
    </Link>
  );
}

export function PricingPage() {
  useDocumentTitle('الباقات والأسعار');
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');
  const [period, setPeriod] = useState<BillingPeriod>('year');
  const user = useAppStore((state) => state.user);
  const mode = useAppStore((state) => state.mode);
  const student = mode === 'account' && isStudentDiscountEligible(user);
  const { status: founderStatus, founder, seatsLeft } = useFounderStatus();
  const buyer: PriceFor = { student, founder };
  const bestStudentDiscount = Math.max(
    ...PLAN_ORDER.flatMap((id) => (['half', 'year'] as const).map((option) => studentDiscount(PLANS[id], option))),
  );
  const bestSaving = Math.max(...PLAN_ORDER.map((id) => PLANS[id].price).flatMap((price) => (price ? [yearlySaving(price)] : [])));

  return (
    <div className="page pricing">
      <header className="pricing__header">
        <p className="page-eyebrow">الباقات والأسعار</p>
        <h1 className="page-title">خطة تناسب مذاكرتك</h1>
        <p className="pricing__lead">ابدأ مجانًا، وارتقِ حين تحتاج أكثر. أسعار بالريال السعودي، مصممة لميزانية الطلاب.</p>
      </header>

      {isLimitedResource(reason) && <LimitBanner reason={reason} />}
      {founder && (
        <div className="pricing-founders" role="status">
          <span className="pricing-founders__seats">
            {founderStatus?.isFounder ? '✓' : seatsLeft}
            <small>{founderStatus?.isFounder ? 'مؤسس' : `من ${FOUNDER_SEATS}`}</small>
          </span>
          <p>
            {founderStatus?.isFounder ? (
              <>
                <strong>أنت من مؤسسي رسوخ.</strong> سعرك المخفّض ثابت في كل تجديد.
              </>
            ) : (
              <>
                <strong>
                  سعر المؤسسين · المقاعد المتبقية {seatsLeft} من {FOUNDER_SEATS}.
                </strong>{' '}
                أول {FOUNDER_SEATS} مشترك يدفعون سعر الإطلاق، ويبقى ثابتًا لهم في كل تجديد.
              </>
            )}
          </p>
          <span className="pricing-founders__bar" aria-hidden="true">
            <span style={{ width: `${founderStatus ? Math.min(100, (founderStatus.taken / founderStatus.seats) * 100) : 0}%` }} />
          </span>
        </div>
      )}
      {student ? (
        <div className="pricing-student is-active" role="status">
          <Icon name="gem" size={18} />
          <p>
            <strong>أسعار الطلاب مفعّلة لحسابك</strong> لأنك مسجّل بإيميل جامعي. الأسعار أدناه بعد الخصم.
          </p>
        </div>
      ) : (
        <div className="pricing-student">
          <Icon name="gem" size={18} />
          <p>
            <strong>طالب؟ وفّر حتى {bestStudentDiscount}%.</strong>{' '}
            {mode === 'account'
              ? 'غيّر إيميل حسابك إلى إيميل جامعتك من «الإعدادات»، وسيظهر لك سعر الطالب.'
              : `أنشئ حسابك بإيميل جامعتك (مثل ${ACADEMIC_EMAIL_EXAMPLE}) واختر «نعم، طالب».`}
          </p>
        </div>
      )}
      <Usage />

      <div className="billing-toggle" role="radiogroup" aria-label="مدة الاشتراك">
        {(['half', 'year'] as const).map((option) => (
          <label key={option} className="billing-toggle__option">
            <input type="radio" name="billing" checked={period === option} onChange={() => setPeriod(option)} />
            <span>
              {PERIOD_LABELS[option]}
              {option === 'year' && <span className="billing-toggle__save">وفّر {bestSaving}%</span>}
            </span>
          </label>
        ))}
      </div>

      <ul className="plan-grid" role="list">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          // A subscriber's own plan takes the frame; everyone else sees the plan we recommend.
          const subscribed = mode === 'account' && user !== null && user.plan !== 'free';
          const current = subscribed && user.plan === id;
          const recommended = !subscribed && id === RECOMMENDED;
          return (
            <li key={id} className={`plan-card plan-card--${id}${current || recommended ? ' is-recommended' : ''}`}>
              <article aria-labelledby={`plan-${id}`}>
                <header className="plan-card__head">
                  <h2 className="plan-card__name" id={`plan-${id}`}>
                    {plan.name}
                  </h2>
                  {current && <span className="plan-card__tag">باقتك الحالية</span>}
                  {recommended && <span className="plan-card__tag">موصى بها للطلاب</span>}
                  {id === 'pro' && (
                    <span className="plan-card__tag plan-card__tag--ai">
                      <Icon name="sparkle" size={12} />
                      ذكاء اصطناعي
                    </span>
                  )}
                </header>
                <p className="plan-card__tagline">{plan.tagline}</p>
                <PlanPrice plan={plan} period={period} buyer={buyer} />
                <PlanAction plan={plan} period={period} />
                <ul className="plan-card__features" role="list">
                  {FEATURES[id].map((feature) => (
                    <li key={feature.text}>
                      <Icon name={feature.icon} size={16} />
                      {feature.text}
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          );
        })}
      </ul>


      <section className="pricing-included" aria-labelledby="pricing-included-title">
        <h2 className="pricing-included__title" id="pricing-included-title">
          في كل الخطط
        </h2>
        <ul role="list">
          {INCLUDED_EVERYWHERE.map((item) => (
            <li key={item}>
              <Icon name="check" size={14} />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="pricing-faq" aria-labelledby="pricing-faq-title">
        <h2 className="pricing-faq__title" id="pricing-faq-title">
          أسئلة شائعة
        </h2>
        {FAQ.map((item) => (
          <details key={item.question} className="pricing-faq__item">
            <summary>
              {item.question}
              <Icon name="plus" size={16} />
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
