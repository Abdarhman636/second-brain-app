/*
 * Admin dashboard: every subscription request. Who sent it, when and how
 * long it has waited, the receipt and the customer's note, and changing its
 * status (with an email to the customer). The database checks the caller is an admin.
 */
import { useEffect, useMemo, useState } from 'react';
import type { AdminUser } from '../data/admin';
import { getReceiptUrl, notifyPayment, PaymentError, setPaymentRequestStatus } from '../data/payments';
import { formatDateTime, formatTimeAgo } from '../domain/date-utils';
import {
  getNextPaymentStatuses,
  isOpenPaymentStatus,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_ORDER,
  type PaymentRequest,
  type PaymentStatus,
} from '../domain/payments';
import { PERIOD_LABELS, PLANS } from '../domain/plans';
import { useUiStore } from '../store/ui-store';
import { Icon } from './Icon';
import { Modal } from './Modal';

type Filter = 'open' | PaymentStatus | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: 'المفتوحة' },
  ...PAYMENT_STATUS_ORDER.map((status) => ({ id: status, label: PAYMENT_STATUS_LABELS[status] })),
  { id: 'all', label: 'الكل' },
];

const DEFAULT_REJECT_NOTE = 'لم نجد التحويل. تأكد من المبلغ ورقم الطلب في ملاحظة التحويل، ثم أرسل طلبًا جديدًا.';
// An open request waiting longer than this is flagged.
const LATE_AFTER_MS = 24 * 60 * 60 * 1000;

/* ---------- Receipt ---------- */

function ReceiptDialog({ request, onClose }: { request: PaymentRequest; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!request.receiptPath) return;
    let active = true;
    void getReceiptUrl(request.receiptPath).then((signed) => active && setUrl(signed));
    return () => {
      active = false;
    };
  }, [request.receiptPath]);

  return (
    <Modal title={`إيصال ${request.reference}`} onClose={onClose}>
      {!url ? (
        <p className="page-loading">جارٍ تحميل الإيصال…</p>
      ) : request.receiptPath?.endsWith('.pdf') ? (
        <a className="btn btn--secondary" href={url} target="_blank" rel="noopener noreferrer">
          <Icon name="download" size={16} />
          فتح الإيصال (PDF)
        </a>
      ) : (
        <a className="admin-order-receipt" href={url} target="_blank" rel="noopener noreferrer" aria-label="فتح الإيصال بالحجم الكامل">
          <img src={url} alt={`إيصال التحويل ${request.reference}`} />
        </a>
      )}
    </Modal>
  );
}

/* ---------- Changing the status ---------- */

function StatusDialog({
  request,
  customer,
  onClose,
  onSaved,
}: {
  request: PaymentRequest;
  customer: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const showToast = useUiStore((state) => state.showToast);
  const choices = getNextPaymentStatuses(request.status);
  const [status, setStatus] = useState<PaymentStatus>(choices[0] ?? request.status);
  const [note, setNote] = useState(request.reviewNote ?? DEFAULT_REJECT_NOTE);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const plan = PLANS[request.plan];

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await setPaymentRequestStatus(request, status, status === 'rejected' ? note.trim() : '');
      const emailed = notify && (await notifyPayment(request.id, 'status'));
      const label = PAYMENT_STATUS_LABELS[status];
      if (!notify) showToast(`صارت الحالة «${label}»`);
      else if (emailed) showToast(`صارت الحالة «${label}» وأُرسل إيميل للعميل`);
      else showToast(`صارت الحالة «${label}»، لكن تعذّر إرسال الإيميل`, 'error');
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof PaymentError ? saveError.message : 'تعذّر تغيير الحالة.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="تغيير حالة الطلب" variant="compact" onClose={onClose}>
      <div className="form">
        <p className="form__lead">
          <span dir="ltr">{request.reference}</span> · {customer} · {request.amount} ر.س
        </p>
        <fieldset className="field">
          <legend className="field__label">الحالة الجديدة</legend>
          <div className="admin-status-choices">
            {choices.map((id) => (
              <label key={id} className="type-option">
                <input className="type-option__input" type="radio" name="order-status" checked={status === id} onChange={() => setStatus(id)} />
                <span className="type-option__label">{PAYMENT_STATUS_LABELS[id]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {status === 'approved' && (
          <p className="admin-order-warning" role="note">
            <Icon name="info" size={16} />
            تأكد أن {request.amount} ر.س وصلت إلى حسابك. سيُفعَّل {plan.name} لمدة {PERIOD_LABELS[request.period]}، ولا تتغير الحالة بعد القبول.
          </p>
        )}

        {status === 'rejected' && (
          <div className="field">
            <label className="field__label" htmlFor="order-note">
              سبب الرفض (يراه العميل)
            </label>
            <textarea className="textarea" id="order-note" rows={3} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        )}

        <label className="checkout-confirm">
          <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
          <span>
            أرسل إيميلًا للعميل بالحالة الجديدة (<span dir="ltr">{request.userEmail}</span>)
          </span>
        </label>

        {error && (
          <p className="checkout-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button type="button" className="btn btn--primary" disabled={busy || !choices.length} onClick={() => void save()}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ الحالة'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- The list ---------- */

export function AdminOrders({ requests, users, onChanged }: { requests: PaymentRequest[]; users: AdminUser[]; onChanged: () => void }) {
  const [filter, setFilter] = useState<Filter>('open');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<PaymentRequest | null>(null);
  const [viewing, setViewing] = useState<PaymentRequest | null>(null);

  const names = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);
  const customerName = (request: PaymentRequest) => names.get(request.userId) ?? 'بدون اسم';

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { open: 0, pending: 0, reviewing: 0, approved: 0, rejected: 0, all: requests.length };
    for (const request of requests) {
      result[request.status] += 1;
      if (isOpenPaymentStatus(request.status)) result.open += 1;
    }
    return result;
  }, [requests]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = requests.filter(
      (request) =>
        (filter === 'all' || (filter === 'open' ? isOpenPaymentStatus(request.status) : request.status === filter)) &&
        (!q ||
          request.reference.toLowerCase().includes(q) ||
          request.userEmail.toLowerCase().includes(q) ||
          (names.get(request.userId) ?? '').toLowerCase().includes(q)),
    );
    // Open requests: the one waiting longest first.
    return filter === 'open' ? [...matches].reverse() : matches;
  }, [requests, filter, query, names]);

  const now = Date.now();

  return (
    <section className="admin-users admin-orders" id="orders" aria-labelledby="admin-orders-title">
      <header className="admin-panel__head">
        <h2 id="admin-orders-title">الطلبات</h2>
        <span className="admin-panel__meta">{counts.open ? `${counts.open} تنتظر المراجعة` : 'لا طلبات تنتظر'}</span>
      </header>

      <div className="cards-toolbar admin-users__toolbar">
        <input
          className="input cards-toolbar__search"
          type="search"
          placeholder="ابحث برقم الطلب أو الاسم أو الإيميل…"
          aria-label="ابحث في الطلبات"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <nav className="shelf-bar admin-orders__filters" aria-label="حالة الطلبات">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="shelf-chip"
            aria-current={filter === option.id ? 'page' : undefined}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
            <span className="shelf-chip__count">{counts[option.id]}</span>
          </button>
        ))}
      </nav>

      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>الطلب</th>
              <th>العميل</th>
              <th>المبلغ</th>
              <th>أُرسل</th>
              <th>الحالة</th>
              <th>
                <span className="visually-hidden">إجراءات</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((request) => {
              const open = isOpenPaymentStatus(request.status);
              const late = open && now - new Date(request.createdAt).getTime() > LATE_AFTER_MS;
              return (
                <tr key={request.id}>
                  <td>
                    <span className="admin-user__name" dir="ltr">
                      {request.reference}
                    </span>
                    <span className="admin-user__meta">
                      {PLANS[request.plan].name} · {PERIOD_LABELS[request.period]}
                    </span>
                  </td>
                  <td>
                    <span className="admin-user__name">{customerName(request)}</span>
                    <span className="admin-user__email" dir="ltr">
                      {request.userEmail}
                    </span>
                    {request.payerName && <span className="admin-user__meta">المحوِّل: {request.payerName}</span>}
                    {request.note && <span className="admin-user__meta admin-order-note">ملاحظة: {request.note}</span>}
                  </td>
                  <td className="admin-num">
                    {request.amount} ر.س
                    {(request.studentPrice || request.founderPrice) && (
                      <span className="admin-user__meta">
                        {[request.founderPrice && 'مؤسس', request.studentPrice && 'طالب'].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`admin-order-age${late ? ' is-late' : ''}`}>{formatTimeAgo(request.createdAt)}</span>
                    <span className="admin-user__meta">{formatDateTime(request.createdAt)}</span>
                  </td>
                  <td>
                    <span className={`status-pill is-${request.status}`}>{PAYMENT_STATUS_LABELS[request.status]}</span>
                    {!open && <span className="admin-user__meta">{formatDateTime(request.statusChangedAt)}</span>}
                    {request.status === 'rejected' && request.reviewNote && (
                      <span className="admin-user__meta admin-order-note">{request.reviewNote}</span>
                    )}
                  </td>
                  <td>
                    <div className="admin-order-actions">
                      {request.receiptPath && (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setViewing(request)}>
                          <Icon name="receipt" size={14} />
                          الإيصال
                        </button>
                      )}
                      {request.status !== 'approved' && (
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(request)}>
                          تغيير الحالة
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!shown.length && <p className="page-loading">{filter === 'open' && !query ? 'كل الطلبات رُوجعت.' : 'لا طلبات مطابقة.'}</p>}

      {viewing && <ReceiptDialog request={viewing} onClose={() => setViewing(null)} />}
      {editing && <StatusDialog request={editing} customer={customerName(editing)} onClose={() => setEditing(null)} onSaved={onChanged} />}
    </section>
  );
}
