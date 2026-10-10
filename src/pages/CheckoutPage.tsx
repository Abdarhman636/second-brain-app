/*
 * Manual checkout, in three steps a young student can follow:
 *   1. the period   2. a bank transfer of the exact amount   3. the receipt
 * The request then waits for an admin (see AdminPaymentsPage); approval
 * gives the plan for 6 or 12 months. Students on a university email, and
 * founders, see (and pay) their lower price; the server sets the amount.
 */
import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/ui';
import { PAYMENT } from '../config';
import {
  listMyPaymentRequests,
  PaymentError,
  refreshSubscription,
  submitPaymentRequest,
} from '../data/payments';
import { formatShortDate, toISODate } from '../domain/date-utils';
import { formatCount } from '../domain/format';
import { createPaymentReference, formatIban, getPaymentMethodLabel, isOpenPaymentStatus, type PaymentRequest } from '../domain/payments';
import {
  getDaysUntilExpiry,
  getPlanPrice,
  getUpgradeCreditDays,
  isBillingPeriod,
  isPaidPlan,
  PERIOD_LABELS,
  PLANS,
  priceDiscount,
  type PriceFor,
  type BillingPeriod,
  type PaidPlanId,
} from '../domain/plans';
import { isStudentDiscountEligible } from '../domain/students';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useFounderStatus } from '../hooks/use-founder-status';
import { useAppStore } from '../store/app-store';
import { useUiStore } from '../store/ui-store';

const formatDate = (timestamp: string) => formatShortDate(toISODate(new Date(timestamp)));

/** A value to type into another app, with a copy button. */
function CopyField({ label, value, display = value, ltr = true }: { label: string; value: string; display?: string; ltr?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      useUiStore.getState().showToast('تعذّر النسخ، انسخه يدويًا.', 'error');
    }
  };
  return (
    <div className="copy-field">
      <span className="copy-field__label">{label}</span>
      <span className="copy-field__value" dir={ltr ? 'ltr' : undefined}>
        {display}
      </span>
      <button type="button" className={`copy-field__button${copied ? ' is-copied' : ''}`} onClick={copy} aria-label={`نسخ ${label}`}>
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        {copied ? 'نُسخ' : 'نسخ'}
      </button>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="checkout-step" aria-labelledby={id}>
      <header className="checkout-step__head">
        <span className="checkout-step__number" aria-hidden="true">
          {number}
        </span>
        <h2 className="checkout-step__title" id={id}>
          {title}
        </h2>
      </header>
      <div className="checkout-step__body">{children}</div>
    </section>
  );
}

/** Step 2: exactly what to do in the bank app. */
function TransferInstructions({ iban, amount, reference }: { iban: string; amount: number; reference: string }) {
  return (
    <>
      <ol className="checkout-instructions">
        <li>افتح تطبيق البنك الذي تتعامل معه على جوالك (أي بنك سعودي).</li>
        <li>
          اختر <strong>«تحويل»</strong>، ثم <strong>«إضافة مستفيد»</strong> داخل السعودية، والصق الآيبان (اضغط «نسخ» بالأسفل). سيظهر لك
          أن البنك المستلم هو <strong>{PAYMENT.bank.name}</strong>.
        </li>
        <li>
          اكتب المبلغ كما هو بالضبط. إن كنت عميلًا في {PAYMENT.bank.name} فالتحويل يصل فورًا، ومن البنوك الأخرى يصل غالبًا خلال دقائق.
        </li>
        <li>
          إن وجدت خانة <strong>«ملاحظة»</strong> أو «الغرض»، اكتب فيها رمز طلبك. وإن لم تجدها فلا بأس.
        </li>
        <li>
          أكّد التحويل، ثم <strong>خذ لقطة شاشة</strong> لصفحة نجاح التحويل (الإيصال)، وارفعها هنا مع طلبك.
        </li>
      </ol>

      <div className="copy-fields">
        <div className="copy-field copy-field--static">
          <span className="copy-field__label">البنك المستلم</span>
          <span className="copy-field__value copy-field__bank">
            {PAYMENT.bank.name} <span dir="ltr">· {PAYMENT.bank.nameEnglish}</span>
          </span>
        </div>
        <CopyField label="رقم الآيبان (IBAN)" value={iban.replace(/\s+/g, '')} display={formatIban(iban)} />
        {PAYMENT.recipientName && <CopyField label="اسم المستفيد" value={PAYMENT.recipientName} ltr={false} />}
        <CopyField label="المبلغ بالضبط" value={String(amount)} display={`${amount} ر.س`} />
        <CopyField label="رمز طلبك (للملاحظة)" value={reference} />
      </div>

      {PAYMENT.recipientName && (
        <p className="checkout-hint">
          <Icon name="info" size={16} />
          قبل التأكيد، تأكد أن اسم المستلم الظاهر في التطبيق هو «{PAYMENT.recipientName}».
        </p>
      )}
    </>
  );
}

/** After sending: what happens next, and the request's status. */
function RequestStatus({ request, onRefresh }: { request: PaymentRequest; onRefresh: () => void }) {
  const plan = PLANS[request.plan];
  return (
    <section className="checkout-status" role="status">
      <span className="checkout-status__icon">
        <Icon name="check" size={26} />
      </span>
      <h2 className="checkout-status__title">استلمنا طلبك، شكرًا لك!</h2>
      <p>
        سنتأكد من وصول التحويل ونفعّل اشتراكك في <strong>{plan.name}</strong> لمدة {PERIOD_LABELS[request.period]}{' '}
        {PAYMENT.approvalTime} غالبًا، ونرسل لك رسالة على بريدك عند كل تحديث. لا تحتاج أن تفعل شيئًا آخر.
      </p>

      <dl className="checkout-status__details">
        <div>
          <dt>رمز الطلب</dt>
          <dd dir="ltr">{request.reference}</dd>
        </div>
        <div>
          <dt>المبلغ</dt>
          <dd>{request.amount} ر.س</dd>
        </div>
        <div>
          <dt>طريقة الدفع</dt>
          <dd>{getPaymentMethodLabel(request.method)}</dd>
        </div>
        <div>
          <dt>تاريخ الطلب</dt>
          <dd>{formatDate(request.createdAt)}</dd>
        </div>
      </dl>

      <ol className="checkout-next" aria-label="ماذا بعد؟">
        <li className="is-done">أرسلت الطلب والإيصال</li>
        <li className="is-current">{request.status === 'reviewing' ? 'نراجع التحويل الآن' : 'نراجع التحويل'}</li>
        <li>نفعّل اشتراكك، وتجده في «الإعدادات»</li>
      </ol>

      <div className="checkout-status__actions">
        <button type="button" className="btn btn--primary" onClick={onRefresh}>
          <Icon name="retry" size={16} />
          تحقّق من الحالة
        </button>
        <Link className="btn btn--secondary" to="/orders">
          <Icon name="receipt" size={16} />
          تابع طلباتك
        </Link>
      </div>
      {PAYMENT.whatsapp && (
        <p className="checkout-hint">
          عندك سؤال؟{' '}
          <a href={`https://wa.me/${PAYMENT.whatsapp}?text=${encodeURIComponent(`مرحبًا، بخصوص طلب الاشتراك ${request.reference}`)}`} target="_blank" rel="noopener noreferrer">
            راسلنا على واتساب
          </a>
        </p>
      )}
    </section>
  );
}

export function CheckoutPage() {
  useDocumentTitle('الاشتراك');
  const [searchParams] = useSearchParams();
  const user = useAppStore((state) => state.user);
  const mode = useAppStore((state) => state.mode);
  const { showToast } = useUiStore.getState();

  const requestedPlan = searchParams.get('plan');
  const requestedPeriod = searchParams.get('period');
  // A راسخ subscriber renews راسخ: buying the lower plan would cut their plan short.
  const [planId, setPlanId] = useState<PaidPlanId>(() =>
    user?.plan === 'pro' ? 'pro' : isPaidPlan(requestedPlan) && PLANS[requestedPlan].available ? requestedPlan : 'plus',
  );
  const [period, setPeriod] = useState<BillingPeriod>(isBillingPeriod(requestedPeriod) ? requestedPeriod : 'year');
  const [reference] = useState(() => createPaymentReference());
  const [receipt, setReceipt] = useState<File | null>(null);
  const [payerName, setPayerName] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<PaymentRequest[] | null>(null);
  const { founder } = useFounderStatus();

  const load = useCallback(async () => {
    try {
      setRequests(await listMyPaymentRequests());
    } catch {
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    if (mode === 'account') void load();
  }, [mode, load]);

  if (mode !== 'account' || !user) {
    return (
      <div className="page">
        <EmptyState
          icon="gem"
          title="الاشتراك يحتاج حسابًا"
          message="أنت في الوضع التجريبي. أنشئ حسابًا مجانيًا، ثم اشترك منه."
          actions={[{ label: 'الباقات والأسعار', to: '/pricing', variant: 'secondary' }]}
          headingLevel={1}
        />
      </div>
    );
  }

  const plan = PLANS[planId];
  const student = isStudentDiscountEligible(user);
  const buyer: PriceFor = { student, founder };
  const amount = getPlanPrice(plan, period, buyer) ?? 0;
  const priceLabel = [founder && 'سعر المؤسسين', student && 'سعر الطالب'].filter(Boolean).join(' + ');
  const iban = PAYMENT.bank.iban;
  const pending = requests?.find((request) => isOpenPaymentStatus(request.status));
  const lastReviewed = requests?.find((request) => !isOpenPaymentStatus(request.status));
  const hasActivePlan = user.plan !== 'free' && user.planExpiresAt;
  const upgrading = hasActivePlan && isPaidPlan(user.plan) && planId !== user.plan;
  const daysLeft = upgrading ? getDaysUntilExpiry(user.planExpiresAt!) : 0;
  const creditDays = upgrading && isPaidPlan(user.plan) ? getUpgradeCreditDays(daysLeft, user.plan, planId, period, buyer) : 0;

  const refresh = async () => {
    await load();
    const subscription = await refreshSubscription();
    if (subscription && subscription.plan !== 'free') showToast(`اشتراكك في ${PLANS[subscription.plan].name} مفعّل 🎉`);
    else showToast('طلبك ما زال قيد المراجعة');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!receipt) return setError('ارفع صورة الإيصال أولًا (لقطة شاشة لصفحة نجاح التحويل).');
    if (!confirmed) return setError(`أكّد أنك حوّلت ${amount} ر.س.`);
    setError('');
    setBusy(true);
    try {
      const request = await submitPaymentRequest({ plan: planId, period, method: 'bank', reference, payerName, note, receipt });
      setRequests((current) => [request, ...(current ?? [])]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submitError) {
      setError(submitError instanceof PaymentError ? submitError.message : 'تعذّر إرسال الطلب. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  if (requests === null) return <p className="page-loading">جارٍ التحميل…</p>;

  return (
    <div className="page checkout">
      <Link className="back-link" to="/pricing">
        <Icon name="arrowRight" size={18} />
        الباقات والأسعار
      </Link>
      <header className="page-header">
        <div>
          <p className="page-eyebrow">الاشتراك</p>
          <h1 className="page-title">
            {pending
              ? 'طلبك قيد المراجعة'
              : upgrading
                ? `الترقية إلى ${plan.name}`
                : hasActivePlan
                  ? `جدّد اشتراكك في ${plan.name}`
                  : `اشترك في ${plan.name}`}
          </h1>
        </div>
      </header>

      {pending ? (
        <RequestStatus request={pending} onRefresh={() => void refresh()} />
      ) : (
        <>
          {hasActivePlan && (
            <div className="checkout-banner" role="status">
              <Icon name="check" size={18} />
              <p>
                اشتراكك في <strong>{PLANS[user.plan].name}</strong> ساري حتى {formatDate(user.planExpiresAt!)}.{' '}
                {upgrading
                  ? `بعد قبول طلبك تنتقل إلى ${plan.name} فورًا لمدة ${PERIOD_LABELS[period]}${
                      creditDays > 0
                        ? `، ويُضاف إليها ${formatCount(creditDays, 'days')} مقابل ما بقي لك في ${PLANS[user.plan].name} (${formatCount(daysLeft, 'days')}).`
                        : '.'
                    }`
                  : 'إن جدّدت الآن، تُضاف المدة الجديدة إلى نهاية اشتراكك الحالي.'}
              </p>
            </div>
          )}
          {lastReviewed?.status === 'rejected' && (
            <div className="checkout-banner checkout-banner--error" role="alert">
              <Icon name="info" size={18} />
              <p>
                لم نتمكن من قبول طلبك السابق ({lastReviewed.reference}){lastReviewed.reviewNote ? `: ${lastReviewed.reviewNote}` : '.'} يمكنك
                إرسال طلب جديد.
              </p>
            </div>
          )}

          <div className="pricing-payment checkout-payment">
            <p className="pricing__note">
              الدفع حاليًا بتحويل بنكي، ونفعّل اشتراكك {PAYMENT.approvalTime} غالبًا.
            </p>
            <p className="pricing-payment__soon">
              <span className="pricing-payment__tag">قريبًا</span>
              الدفع الفوري بـ <span dir="ltr">Apple Pay</span> وبطاقات مدى والبطاقات الائتمانية، وتفعيل اشتراكك في الحال.
            </p>
          </div>

          {!iban ? (
            <section className="checkout-status" role="status">
              <span className="checkout-status__icon">
                <Icon name="gem" size={24} />
              </span>
              <h2 className="checkout-status__title">الاشتراك يفتح قريبًا جدًا</h2>
              <p>
                نجهّز حساب استقبال التحويلات. اشتراكك في <strong>{plan.name}</strong> سيكون بـ{' '}
                <strong>
                  {amount} ر.س لمدة {PERIOD_LABELS[period]}
                </strong>
                {priceLabel ? ` (${priceLabel})` : ''}. عُد إلى هنا قريبًا.
              </p>
              <Link className="btn btn--secondary" to="/pricing">
                الباقات والأسعار
              </Link>
            </section>
          ) : (
            <form className="checkout-steps" noValidate onSubmit={submit}>
              <Step number={1} title="اختر مدة اشتراكك">
                {priceLabel && (
                  <p className="checkout-student">
                    <Icon name="gem" size={16} />
                    <span>
                      أنت تحصل على <strong>{priceLabel}</strong>
                      {founder && '، ويبقى ثابتًا لك في كل تجديد'}
                      {student && ' (لأنك مسجّل بإيميل جامعي)'}.
                    </span>
                  </p>
                )}
                <div className="checkout-choices" role="radiogroup" aria-label="مدة الاشتراك">
                  {(['half', 'year'] as const).map((option) => (
                    <label key={option} className="checkout-choice">
                      <input type="radio" name="period" checked={period === option} onChange={() => setPeriod(option)} />
                      <span className="checkout-choice__body">
                        <span className="checkout-choice__title">{PERIOD_LABELS[option]}</span>
                        <span className="checkout-choice__price">
                          {getPlanPrice(plan, option, buyer)} ر.س
                          {priceLabel && <s className="checkout-choice__was">{plan.price?.[option]}</s>}
                        </span>
                        {option === 'year' && <span className="checkout-choice__note">الأوفر</span>}
                        {priceLabel && option === 'half' && (
                          <span className="checkout-choice__note">خصم {priceDiscount(plan, option, buyer)}%</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                {PLANS.pro.available && user.plan !== 'pro' && (
                  <p className="checkout-hint">
                    الخطة:{' '}
                    {(['plus', 'pro'] as const).map((id) => (
                      <button key={id} type="button" className={`link-button${planId === id ? ' is-current' : ''}`} onClick={() => setPlanId(id)}>
                        {PLANS[id].name}
                      </button>
                    ))}
                  </p>
                )}
              </Step>

              <Step number={2} title={`حوّل ${amount} ر.س إلى حسابنا في ${PAYMENT.bank.name}`}>
                <TransferInstructions iban={iban} amount={amount} reference={reference} />
              </Step>

              <Step number={3} title="ارفع الإيصال وأرسل الطلب">
                <div className="field">
                  <span className="field__label">صورة الإيصال</span>
                  <label className={`receipt-picker${receipt ? ' has-file' : ''}`}>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={(event) => {
                        setReceipt(event.target.files?.[0] ?? null);
                        setError('');
                      }}
                    />
                    <Icon name={receipt ? 'check' : 'upload'} size={20} />
                    <span>{receipt ? receipt.name : 'اضغط لاختيار لقطة الشاشة من جوالك أو جهازك'}</span>
                  </label>
                  <p className="field__hint">صورة أو PDF، حتى 5 ميجابايت.</p>
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="checkout-payer">
                    اسم صاحب الحساب الذي حوّلت منه <span className="field__optional">(اختياري)</span>
                  </label>
                  <input
                    className="input"
                    id="checkout-payer"
                    type="text"
                    maxLength={80}
                    autoComplete="name"
                    placeholder="يساعدنا في إيجاد تحويلك بسرعة"
                    value={payerName}
                    onChange={(event) => setPayerName(event.target.value)}
                  />
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="checkout-note">
                    ملاحظة <span className="field__optional">(اختياري)</span>
                  </label>
                  <textarea
                    className="textarea"
                    id="checkout-note"
                    rows={2}
                    maxLength={300}
                    placeholder="أي شيء تريد أن نعرفه عن تحويلك"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>

                <label className="checkout-confirm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => {
                      setConfirmed(event.target.checked);
                      setError('');
                    }}
                  />
                  <span>
                    أؤكد أنني حوّلت <strong>{amount} ر.س</strong> إلى الآيبان المذكور أعلاه.
                  </span>
                </label>

                {error && (
                  <p className="checkout-error" role="alert">
                    {error}
                  </p>
                )}

                <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy} aria-busy={busy}>
                  {busy ? 'جارٍ الإرسال…' : 'أرسل الطلب'}
                </button>
                <p className="checkout-hint">
                  نرسل لك تفاصيل طلبك على بريدك، ثم نفعّل اشتراكك {PAYMENT.approvalTime} غالبًا بعد التأكد من وصول التحويل. الاشتراك لا يتجدد
                  تلقائيًا.
                </p>
              </Step>
            </form>
          )}
        </>
      )}
    </div>
  );
}
