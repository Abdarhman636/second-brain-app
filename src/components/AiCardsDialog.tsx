/*
 * Make cards with AI: paste text or pick a photo, get suggested cards,
 * review and edit them, then add the ones worth keeping. Nothing is added
 * without the student's review.
 */
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { AiCardsError, fetchAiUsage, generateCards, type AiUsage } from '../data/ai';
import {
  AI_CARD_COUNTS,
  AI_TEXT_MAX_CHARS,
  AI_TEXT_MIN_CHARS,
  isCompleteSuggestion,
  toCardBody,
  type SuggestedCard,
} from '../domain/ai-cards';
import { getCardType } from '../domain/card-types';
import { formatCount } from '../domain/format';
import { ImageFileError, prepareImageFile } from '../lib/image-file';
import { useToday } from '../hooks/use-today';
import { useAppStore } from '../store/app-store';
import { useUiStore } from '../store/ui-store';
import { Icon } from './Icon';
import { Modal } from './Modal';

type Mode = 'text' | 'image';
interface Picked {
  preview: string;
  mediaType: string;
  data: string;
}
interface Draft extends SuggestedCard {
  keep: boolean;
}

/** "data:image/jpeg;base64,AAAA" → its media type and base64 data. */
function splitDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  return match ? { mediaType: match[1] ?? '', data: match[2] ?? '' } : null;
}

const LOADING_LINES = ['نقرأ المحتوى…', 'نختار أهم الأفكار…', 'نكتب بطاقاتك…'];

function LoadingState() {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setLine((current) => (current + 1) % LOADING_LINES.length), 1800);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="ai-loading" role="status">
      <span className="ai-loading__mark" aria-hidden="true">
        <Icon name="sparkle" size={28} />
      </span>
      <p>{LOADING_LINES[line]}</p>
      <p className="ai-loading__hint">يستغرق هذا عادة بين 5 و20 ثانية.</p>
    </div>
  );
}

/** Not a راسخ subscriber (or demo mode): what the feature is, and where to get it. */
function Upsell({ onClose }: { onClose: () => void }) {
  const mode = useAppStore((state) => state.mode);
  return (
    <div className="ai-upsell">
      <span className="ai-upsell__mark" aria-hidden="true">
        <Icon name="sparkle" size={26} />
      </span>
      <p className="ai-upsell__title">البطاقات الذكية في خطة راسخ</p>
      <p>
        الصق نصًا أو صوّر صفحة، ونقترح عليك بطاقات جاهزة تراجعها قبل حفظها.{' '}
        {mode === 'demo' ? 'أنشئ حسابًا لتجربتها حين تُطلق.' : 'خطة راسخ تُطلق قريبًا.'}
      </p>
      <div className="form-footer">
        <Link className="btn btn--primary" to="/pricing" onClick={onClose}>
          الباقات والأسعار
        </Link>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          إغلاق
        </button>
      </div>
    </div>
  );
}

export function AiCardsDialog({ projectId: preferredProjectId }: { projectId?: string }) {
  const id = useId();
  const today = useToday();
  const projects = useAppStore((state) => state.projects);
  const lastUsedProjectId = useAppStore((state) => state.lastUsedProjectId);
  const { closeDialog, showToast } = useUiStore.getState();
  const activeProjects = projects.filter((project) => !project.archived);

  const [usage, setUsage] = useState<AiUsage | null | 'loading'>('loading');
  const [projectId, setProjectId] = useState(
    [preferredProjectId, lastUsedProjectId].find((candidate) => activeProjects.some((project) => project.id === candidate)) ??
      activeProjects[0]?.id ??
      '',
  );
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [count, setCount] = useState<number>(1);
  const [step, setStep] = useState<'compose' | 'loading' | 'review'>('compose');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetchAiUsage().then((result) => active && setUsage(result));
    return () => {
      active = false;
    };
  }, []);

  const title = step === 'review' ? 'راجع البطاقات المقترحة' : 'بطاقات بالذكاء الاصطناعي';

  if (usage === 'loading') {
    return (
      <Modal title={title} onClose={closeDialog}>
        <p className="page-loading">جارٍ التحميل…</p>
      </Modal>
    );
  }
  if (!usage?.allowed) {
    return (
      <Modal title={title} variant="compact" onClose={closeDialog}>
        <Upsell onClose={closeDialog} />
      </Modal>
    );
  }

  const trimmedText = text.trim();
  const ready =
    Boolean(projectId) &&
    count <= usage.remaining &&
    (mode === 'text' ? trimmedText.length >= AI_TEXT_MIN_CHARS && trimmedText.length <= AI_TEXT_MAX_CHARS : Boolean(picked));

  const pickImage = async (file: File | undefined) => {
    setError('');
    if (!file) return;
    try {
      const dataUrl = await prepareImageFile(file);
      const parts = splitDataUrl(dataUrl);
      if (!parts) throw new ImageFileError('تعذّر فتح هذه الصورة. جرّب صورة أخرى.');
      setPicked({ preview: dataUrl, ...parts });
    } catch (pickError) {
      setError(pickError instanceof ImageFileError ? pickError.message : 'تعذّر فتح هذه الصورة. جرّب صورة أخرى.');
    }
  };

  const generate = async () => {
    if (!ready) return;
    setError('');
    setStep('loading');
    try {
      const result = await generateCards(
        mode === 'text'
          ? { mode: 'text', count, text: trimmedText }
          : { mode: 'image', count, image: { mediaType: picked!.mediaType, data: picked!.data } },
      );
      setDrafts(result.cards.map((card) => ({ ...card, keep: true })));
      setUsage({ ...usage, remaining: result.remaining, used: usage.limit - result.remaining });
      setStep('review');
    } catch (generateError) {
      setError(generateError instanceof AiCardsError ? generateError.message : 'تعذّر إنشاء البطاقات. حاول مرة أخرى.');
      setStep('compose');
    }
  };

  const updateDraft = (index: number, changes: Partial<Draft>) =>
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...changes } : draft)));

  const kept = drafts.filter((draft) => draft.keep && isCompleteSuggestion(draft));
  const project = projects.find((item) => item.id === projectId);

  const addKept = () => {
    const { addCard } = useAppStore.getState();
    kept.forEach((draft) => addCard({ projectId, ...toCardBody(draft) }, today));
    closeDialog();
    showToast(`أُضيف إلى «${project?.name ?? 'المشروع'}» ${formatCount(kept.length, 'cards')}، وتظهر في مراجعة اليوم`);
  };

  return (
    <Modal title={title} variant={step === 'review' ? 'wide' : undefined} onClose={closeDialog}>
      {step === 'loading' && <LoadingState />}

      {step === 'compose' && (
        <div className="form ai-compose">
          <p className="form__lead">الصق نصًا أو صوّر صفحة، ونقترح عليك بطاقات تراجعها وتعدّلها قبل أن تُضاف.</p>

          <div className="field">
            <label className="field__label" htmlFor={`${id}-project`}>
              المشروع
            </label>
            <select className="select" id={`${id}-project`} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {activeProjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="install__tabs" role="tablist" aria-label="مصدر البطاقات">
            {(
              [
                { id: 'text', label: 'من نص', icon: 'text' },
                { id: 'image', label: 'من صورة', icon: 'image' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                className="install__tab"
                onClick={() => {
                  setMode(tab.id);
                  setError('');
                }}
              >
                <Icon name={tab.icon} size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {mode === 'text' ? (
            <div className="field">
              <label className="field__label" htmlFor={`${id}-text`}>
                النص
              </label>
              <textarea
                className="textarea ai-compose__text"
                id={`${id}-text`}
                rows={8}
                maxLength={AI_TEXT_MAX_CHARS}
                placeholder="الصق هنا فقرة من كتاب، أو ملخص محاضرة، أو ملاحظاتك…"
                value={text}
                onChange={(event) => setText(event.target.value)}
                data-autofocus=""
              />
              <p className="field__hint ai-compose__count">
                {trimmedText.length.toLocaleString('en')} / {AI_TEXT_MAX_CHARS.toLocaleString('en')} حرف
                {trimmedText.length > 0 && trimmedText.length < AI_TEXT_MIN_CHARS && ' · أضف نصًا أطول قليلًا'}
              </p>
            </div>
          ) : (
            <div className="field">
              <span className="field__label">الصورة</span>
              <label className={`receipt-picker${picked ? ' has-file' : ''}`}>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void pickImage(event.target.files?.[0])} />
                {picked ? <img className="ai-compose__preview" src={picked.preview} alt="الصورة المختارة" /> : <Icon name="upload" size={20} />}
                <span>{picked ? 'اضغط لاختيار صورة أخرى' : 'صوّر صفحة كتاب أو سبورة، أو اختر صورة من جهازك'}</span>
              </label>
              <p className="field__hint">كلما كانت الصورة أوضح وأقرب، كانت البطاقات أدق.</p>
            </div>
          )}

          <fieldset className="field">
            <legend className="field__label">عدد البطاقات</legend>
            <div className="ai-compose__counts">
              {AI_CARD_COUNTS.map((option) => (
                <label key={option} className="type-option">
                  <input
                    className="type-option__input"
                    type="radio"
                    name={`${id}-count`}
                    checked={count === option}
                    disabled={option > usage.remaining}
                    onChange={() => setCount(option)}
                  />
                  <span className="type-option__label">{formatCount(option, 'cards')}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="ai-compose__quota">
            <Icon name="sparkle" size={14} />
            بقي لك {usage.remaining} من {usage.limit} بطاقة ذكية هذا الشهر. يُخصم فقط ما ننشئه فعلًا.
          </p>

          {error && (
            <p className="checkout-error" role="alert">
              {error}
            </p>
          )}

          <div className="form-footer">
            <button type="button" className="btn btn--primary btn--lg" disabled={!ready} onClick={() => void generate()}>
              <Icon name="sparkle" size={18} />
              أنشئ البطاقات
            </button>
            <button type="button" className="btn btn--ghost btn--lg" onClick={closeDialog}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="ai-review">
          <p className="form__lead">
            اقترحنا عليك {formatCount(drafts.length, 'cardsObject')}. عدّل ما تريد، وألغِ تحديد ما لا تحتاجه، ثم أضف الباقي إلى{' '}
            <strong>«{project?.name}»</strong>.
          </p>
          <ol className="ai-review__list">
            {drafts.map((draft, index) => {
              const type = getCardType(draft.type);
              const [frontLabel, backLabel] =
                draft.type === 'qa'
                  ? ['السؤال', 'الجواب']
                  : draft.type === 'definition'
                    ? ['المصطلح', 'التعريف']
                    : draft.type === 'quote'
                      ? ['بداية الاقتباس (تظهر)', 'بقيته (تتذكرها)']
                      : ['الملاحظة', ''];
              return (
                <li key={index} className={`ai-review__card${draft.keep ? '' : ' is-skipped'}`}>
                  <label className="ai-review__keep">
                    <input type="checkbox" checked={draft.keep} onChange={(event) => updateDraft(index, { keep: event.target.checked })} />
                    <span className="card-type">{type.label}</span>
                  </label>
                  <label className="ai-review__field">
                    <span>{frontLabel}</span>
                    <textarea className="textarea" rows={2} value={draft.front} onChange={(event) => updateDraft(index, { front: event.target.value })} />
                  </label>
                  {draft.type !== 'note' && (
                    <label className="ai-review__field">
                      <span>{backLabel}</span>
                      <textarea className="textarea" rows={2} value={draft.back} onChange={(event) => updateDraft(index, { back: event.target.value })} />
                    </label>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="form-footer">
            <button type="button" className="btn btn--primary btn--lg" disabled={!kept.length} onClick={addKept}>
              {kept.length ? `أضف ${formatCount(kept.length, 'cardsObject')}` : 'اختر بطاقة واحدة على الأقل'}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--lg"
              onClick={() => {
                setStep('compose');
                setDrafts([]);
              }}
            >
              ابدأ من جديد
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
