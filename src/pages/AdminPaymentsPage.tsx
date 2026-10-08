/*
 * Admin: payment requests. Check each transfer in the bank app,
 * then approve (gives the plan for its period) or reject (with a reason the
 * student sees). The database checks the caller is an admin; this page only
 * hides itself from everyone else.
 */
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/ui';
import { PAYMENT } from '../config';
import {
  approvePaymentRequest,
  getReceiptUrl,
  listPaymentRequests,
  PaymentError,
  refreshSubscription,
  rejectPaymentRequest,
} from '../data/payments';
import { getPaymentMethodLabel, type PaymentRequest, type PaymentStatus } from '../domain/payments';
import { PERIOD_LABELS, PLANS } from '../domain/plans';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useAppStore } from '../store/app-store';
import { useUiStore } from '../store/ui-store';

const FILTERS: { id: PaymentStatus | 'all'; label: string }[] = [
  { id: 'pending', label: 'بانتظار المراجعة' },
  { id: 'approved', label: 'مقبولة' },
  { id: 'rejected', label: 'مرفوضة' },
  { id: 'all', label: 'الكل' },
];

const STATUS_LABELS: Record<PaymentStatus, string> = { pending: 'بانتظار المراجعة', approved: 'مقبول', rejected: 'مرفوض' };

const formatDateTime = (timestamp: string) =>
  new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short', numberingSystem: 'latn' }).format(new Date(timestamp));

function Receipt({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getReceiptUrl(path).then((signed) => active && setUrl(signed));
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) return <div className="admin-receipt admin-receipt--loading">جارٍ تحميل الإيصال…</div>;
  if (path.endsWith('.pdf')) {
    return (
      <a className="admin-receipt admin-receipt--file" href={url} target="_blank" rel="noopener noreferrer">
        <Icon name="download" size={18} />
        فتح الإيصال (PDF)
      </a>
    );
  }
  return (
    <a className="admin-receipt" href={url} target="_blank" rel="noopener noreferrer" aria-label="فتح الإيصال بالحجم الكامل">
      <img src={url} alt="إيصال التحويل" loading="lazy" />
    </a>
  );
}

function RequestCard({ request, onReviewed }: { request: PaymentRequest; onReviewed: () => void }) {
  const [busy, setBusy] = useState(false);
  const { confirm, showToast } = useUiStore.getState();
  const plan = PLANS[request.plan];

  const approve = async () => {
    const ok = await confirm({
      title: 'تفعيل الاشتراك؟',
      message: `تأكدت أن ${request.amount} ر.س وصلت عبر ${getPaymentMethodLabel(request.method)}؟ سيُفعَّل ${plan.name} لمدة ${PERIOD_LABELS[request.period]} لـ ${request.userEmail}.`,
      confirmLabel: 'نعم، فعّل',
      tone: 'primary',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await approvePaymentRequest(request.id);
      showToast(`فُعّل ${plan.name} لـ ${request.userEmail}`);
      // An admin approving their own request sees it right away.
      if (request.userId === useAppStore.getState().user?.id) await refreshSubscription();
      onReviewed();
    } catch (error) {
      showToast(error instanceof PaymentError ? error.message : 'تعذّر التفعيل', 'error');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    const note = window.prompt('سبب الرفض (يظهر للطالب):', 'لم نجد التحويل. تأكد من المبلغ والرقم، ثم أرسل طلبًا جديدًا.');
    if (note === null) return;
    setBusy(true);
    try {
      await rejectPaymentRequest(request.id, note.trim());
      showToast('رُفض الطلب');
      onReviewed();
    } catch (error) {
      showToast(error instanceof PaymentError ? error.message : 'تعذّر الرفض', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`admin-request is-${request.status}`}>
      <Receipt path={request.receiptPath} />
      <div className="admin-request__body">
        <header className="admin-request__head">
          <span className="admin-request__reference" dir="ltr">
            {request.reference}
          </span>
          <span className={`admin-request__status is-${request.status}`}>{STATUS_LABELS[request.status]}</span>
        </header>
        <p className="admin-request__amount">
          {request.amount} ر.س <span>· {getPaymentMethodLabel(request.method)}</span>
          {request.studentPrice && <span className="admin-request__student">سعر طالب</span>}
          {request.founderPrice && <span className="admin-request__student">سعر مؤسس</span>}
        </p>
        <dl className="admin-request__details">
          <div>
            <dt>الحساب</dt>
            <dd dir="ltr">{request.userEmail}</dd>
          </div>
          <div>
            <dt>الخطة</dt>
            <dd>
              {plan.name} · {PERIOD_LABELS[request.period]}
            </dd>
          </div>
          <div>
            <dt>اسم المحوِّل</dt>
            <dd>{request.payerName ?? '—'}</dd>
          </div>
          <div>
            <dt>أُرسل</dt>
            <dd>{formatDateTime(request.createdAt)}</dd>
          </div>
          {request.reviewedAt && (
            <div>
              <dt>رُوجع</dt>
              <dd>{formatDateTime(request.reviewedAt)}</dd>
            </div>
          )}
          {request.reviewNote && (
            <div>
              <dt>سبب الرفض</dt>
              <dd>{request.reviewNote}</dd>
            </div>
          )}
        </dl>
        {request.status === 'pending' && (
          <div className="admin-request__actions">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void approve()}>
              <Icon name="check" size={16} />
              تفعيل الاشتراك
            </button>
            <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => void reject()}>
              رفض
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export function AdminPaymentsPage() {
  useDocumentTitle('طلبات الاشتراك');
  const isAdmin = useAppStore((state) => state.user?.isAdmin ?? false);
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('pending');
  const [requests, setRequests] = useState<PaymentRequest[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setRequests(await listPaymentRequests(filter));
    } catch (loadError) {
      setError(loadError instanceof PaymentError ? loadError.message : 'تعذّر تحميل الطلبات.');
      setRequests([]);
    }
  }, [filter]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <div className="page">
        <EmptyState icon="info" title="هذه الصفحة للإدارة فقط" message="ليست لديك صلاحية لعرضها." headingLevel={1} />
      </div>
    );
  }

  return (
    <div className="page admin-payments">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">الإدارة</p>
          <h1 className="page-title">طلبات الاشتراك</h1>
          <p className="page-subtitle">تأكد من وصول المبلغ إلى حسابك في {PAYMENT.bank.name} قبل التفعيل.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--secondary" onClick={() => void load()}>
            <Icon name="retry" size={16} />
            تحديث
          </button>
        </div>
      </header>

      <nav className="shelf-bar" aria-label="حالة الطلبات">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="shelf-chip"
            aria-current={filter === option.id ? 'page' : undefined}
            onClick={() => {
              setRequests(null);
              setFilter(option.id);
            }}
          >
            {option.label}
          </button>
        ))}
      </nav>

      {error && (
        <p className="checkout-error" role="alert">
          {error}
        </p>
      )}

      {requests === null ? (
        <p className="page-loading">جارٍ التحميل…</p>
      ) : requests.length ? (
        <div className="admin-requests">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} onReviewed={() => void load()} />
          ))}
        </div>
      ) : (
        <EmptyState icon="check" title="لا توجد طلبات هنا" message={filter === 'pending' ? 'كل الطلبات رُوجعت.' : 'لا شيء لعرضه.'} />
      )}
    </div>
  );
}
