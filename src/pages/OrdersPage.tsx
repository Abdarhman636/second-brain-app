/*
 * The customer's subscription requests (/orders): each one with its details
 * and where it stands: sent → being reviewed → approved or rejected.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/ui';
import { PAYMENT } from '../config';
import { listMyPaymentRequests, PaymentError, refreshSubscription } from '../data/payments';
import { formatDateTime, formatTimeAgo } from '../domain/date-utils';
import { getPaymentMethodLabel, isOpenPaymentStatus, PAYMENT_STATUS_LABELS, type PaymentRequest } from '../domain/payments';
import { PERIOD_LABELS, PLANS } from '../domain/plans';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useAppStore } from '../store/app-store';

interface Step {
  label: string;
  note?: string;
  state: 'done' | 'current' | 'failed' | 'todo';
}

function getSteps(request: PaymentRequest): Step[] {
  const { status } = request;
  const reviewed = status === 'approved' || status === 'rejected';
  return [
    { label: 'أرسلت الطلب', note: formatDateTime(request.createdAt), state: 'done' },
    {
      label: status === 'pending' ? 'بانتظار المراجعة' : 'نراجع التحويل',
      note: status === 'pending' ? `نراجع الطلبات ${PAYMENT.approvalTime} غالبًا` : status === 'reviewing' ? 'نراجعه الآن' : undefined,
      state: reviewed ? 'done' : 'current',
    },
    status === 'rejected'
      ? { label: 'رُفض الطلب', note: request.reviewedAt ? formatDateTime(request.reviewedAt) : undefined, state: 'failed' }
      : {
          label: 'فُعّل اشتراكك',
          note: status === 'approved' && request.reviewedAt ? formatDateTime(request.reviewedAt) : undefined,
          state: status === 'approved' ? 'done' : 'todo',
        },
  ];
}

function OrderCard({ request }: { request: PaymentRequest }) {
  const plan = PLANS[request.plan];
  return (
    <article className={`order-card is-${request.status}`} aria-labelledby={`order-${request.id}`}>
      <header className="order-card__head">
        <div>
          <h2 className="order-card__title" id={`order-${request.id}`}>
            {plan.name} · {PERIOD_LABELS[request.period]}
          </h2>
          <p className="order-card__meta">
            <span dir="ltr">{request.reference}</span> · {formatTimeAgo(request.createdAt)}
          </p>
        </div>
        <span className={`status-pill is-${request.status}`}>{PAYMENT_STATUS_LABELS[request.status]}</span>
      </header>

      <ol className="order-steps" aria-label="مراحل الطلب">
        {getSteps(request).map((step) => (
          <li key={step.label} className={`order-steps__step is-${step.state}`} aria-current={step.state === 'current' ? 'step' : undefined}>
            <span className="order-steps__label">{step.label}</span>
            {step.note && <span className="order-steps__note">{step.note}</span>}
          </li>
        ))}
      </ol>

      {request.status === 'rejected' && (
        <p className="order-card__notice is-error" role="note">
          <Icon name="info" size={16} />
          <span>
            {request.reviewNote ?? 'لم نتمكن من مطابقة التحويل.'} يمكنك إرسال طلب جديد، أو الرد على رسالتنا في بريدك.
          </span>
        </p>
      )}

      <dl className="order-card__details">
        <div>
          <dt>المبلغ</dt>
          <dd>
            {request.amount} ر.س
            {(request.studentPrice || request.founderPrice) && (
              <span className="order-card__price-note">
                {[request.founderPrice && 'سعر المؤسسين', request.studentPrice && 'سعر الطالب'].filter(Boolean).join(' + ')}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>طريقة الدفع</dt>
          <dd>{getPaymentMethodLabel(request.method)}</dd>
        </div>
        <div>
          <dt>آخر تحديث</dt>
          <dd>{formatDateTime(request.statusChangedAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function OrdersPage() {
  useDocumentTitle('الطلبات');
  const mode = useAppStore((state) => state.mode);
  const [requests, setRequests] = useState<PaymentRequest[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setRequests(await listMyPaymentRequests());
      // A request approved since the last visit shows in the plan right away.
      await refreshSubscription();
    } catch (loadError) {
      setError(loadError instanceof PaymentError ? loadError.message : 'تعذّر تحميل الطلبات.');
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    if (mode === 'account') void load();
  }, [mode, load]);

  if (mode !== 'account') {
    return (
      <div className="page">
        <EmptyState
          icon="receipt"
          title="الطلبات تحتاج حسابًا"
          message="أنت في الوضع التجريبي. أنشئ حسابًا مجانيًا لتشترك وتتابع طلباتك."
          actions={[{ label: 'الباقات والأسعار', to: '/pricing', variant: 'secondary' }]}
          headingLevel={1}
        />
      </div>
    );
  }

  const hasOpen = requests?.some((request) => isOpenPaymentStatus(request.status)) ?? false;

  return (
    <div className="page orders">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">حسابك</p>
          <h1 className="page-title">الطلبات</h1>
          <p className="page-subtitle">طلبات اشتراكك وحالة كل طلب. نرسل لك رسالة على بريدك كلما تغيّرت الحالة.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--secondary" onClick={() => void load()}>
            <Icon name="retry" size={16} />
            تحديث
          </button>
          {!hasOpen && (
            <Link className="btn btn--primary" to="/pricing">
              <Icon name="gem" size={16} />
              اشترك
            </Link>
          )}
        </div>
      </header>

      {error && (
        <p className="checkout-error" role="alert">
          {error}
        </p>
      )}

      {requests === null ? (
        <p className="page-loading">جارٍ التحميل…</p>
      ) : requests.length ? (
        <div className="orders__list">
          {requests.map((request) => (
            <OrderCard key={request.id} request={request} />
          ))}
        </div>
      ) : (
        !error && (
          <EmptyState
            icon="receipt"
            title="لا طلبات بعد"
            message="حين تشترك في خطة، يظهر طلبك هنا وتتابع حالته حتى يُفعَّل."
            actions={[{ label: 'الباقات والأسعار', to: '/pricing', variant: 'primary' }]}
          />
        )
      )}
    </div>
  );
}
