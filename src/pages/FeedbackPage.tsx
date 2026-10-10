/*
 * Suggestions and complaints (/feedback). The message reaches support by
 * email, and the reply comes back to the user's own address.
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/ui';
import { FEEDBACK_KINDS, FEEDBACK_MAX_LENGTH, FEEDBACK_MIN_LENGTH, FeedbackError, sendFeedback, type FeedbackKind } from '../data/feedback';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useAppStore } from '../store/app-store';

export function FeedbackPage() {
  useDocumentTitle('اقتراحات وشكاوى');
  const mode = useAppStore((state) => state.mode);
  const email = useAppStore((state) => state.user?.email ?? '');
  const [kind, setKind] = useState<FeedbackKind>('suggestion');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  if (mode !== 'account') {
    return (
      <div className="page">
        <EmptyState
          icon="message"
          title="الاقتراحات تحتاج حسابًا"
          message="أنت في الوضع التجريبي. أنشئ حسابًا مجانيًا لترسل لنا اقتراحك، ونرد عليك على بريدك."
          headingLevel={1}
        />
      </div>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < FEEDBACK_MIN_LENGTH) return setError('اكتب رسالتك أولًا.');
    setBusy(true);
    setError('');
    try {
      await sendFeedback(kind, trimmed);
      setSent(true);
      setMessage('');
    } catch (sendError) {
      setError(sendError instanceof FeedbackError ? sendError.message : 'تعذّر إرسال رسالتك. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page feedback">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">تواصل معنا</p>
          <h1 className="page-title">اقتراحات وشكاوى</h1>
          <p className="page-subtitle">فكرة تجعل رسوخ أفضل، أو شيء لم يعجبك، أو مشكلة واجهتك؟ نقرأ كل رسالة، ونرد عليك على بريدك.</p>
        </div>
      </header>

      {sent ? (
        <section className="checkout-status feedback__sent" role="status">
          <span className="checkout-status__icon">
            <Icon name="check" size={26} />
          </span>
          <h2 className="checkout-status__title">وصلتنا رسالتك، شكرًا لك!</h2>
          <p>
            إن احتاجت ردًّا، نرد عليك على <span dir="ltr">{email}</span>.
          </p>
          <div className="checkout-status__actions">
            <button type="button" className="btn btn--secondary" onClick={() => setSent(false)}>
              أرسل رسالة أخرى
            </button>
            <Link className="btn btn--ghost" to="/">
              العودة إلى اليوم
            </Link>
          </div>
        </section>
      ) : (
        <form className="form feedback__form" noValidate onSubmit={submit}>
          <fieldset className="field">
            <legend className="field__label">نوع الرسالة</legend>
            <div className="feedback__kinds">
              {FEEDBACK_KINDS.map((option) => (
                <label key={option.id} className="type-option">
                  <input className="type-option__input" type="radio" name="feedback-kind" checked={kind === option.id} onChange={() => setKind(option.id)} />
                  <span className="type-option__label">{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label className="field__label" htmlFor="feedback-message">
              رسالتك
            </label>
            <textarea
              className="textarea"
              id="feedback-message"
              rows={7}
              maxLength={FEEDBACK_MAX_LENGTH}
              placeholder={kind === 'problem' ? 'ماذا حدث؟ وفي أي صفحة؟ وماذا كنت تتوقع أن يحدث؟' : 'اكتب ما تريد أن تقوله لنا'}
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setError('');
              }}
            />
            <p className="field__hint">
              نرد على <span dir="ltr">{email}</span>. {message.length > FEEDBACK_MAX_LENGTH - 300 && `${message.length}/${FEEDBACK_MAX_LENGTH}`}
            </p>
          </div>

          {error && (
            <p className="checkout-error" role="alert">
              {error}
            </p>
          )}

          <div className="form-footer">
            <button type="submit" className="btn btn--primary btn--lg" disabled={busy} aria-busy={busy}>
              <Icon name="message" size={18} />
              {busy ? 'جارٍ الإرسال…' : 'أرسل رسالتك'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
