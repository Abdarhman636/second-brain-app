/*
 * Share a project or a shelf by link. Opening the dialog makes the link (or
 * refreshes it with the latest cards), so it's ready to copy or send.
 */
import { useEffect, useState } from 'react';
import { fetchShare, getShareUrl, publishShare, ShareError, type OwnShare } from '../data/shares';
import { formatCount } from '../domain/format';
import {
  buildProjectSnapshot,
  buildShelfSnapshot,
  countSkippedImageCards,
  countSnapshot,
  MAX_SHARED_CARDS,
  type ShareKind,
} from '../domain/sharing';
import { useAppStore } from '../store/app-store';
import { useUiStore } from '../store/ui-store';
import { Icon } from './Icon';
import { Modal } from './Modal';

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      useUiStore.getState().showToast('تعذّر النسخ، انسخ الرابط يدويًا.', 'error');
    }
  };
  return (
    <button type="button" className="btn btn--primary" onClick={() => void copy()}>
      <Icon name={copied ? 'check' : 'copy'} size={16} />
      {copied ? 'نُسخ الرابط' : 'نسخ الرابط'}
    </button>
  );
}

export function ShareDialog({ kind, sourceId }: { kind: ShareKind; sourceId: string }) {
  const mode = useAppStore((state) => state.mode);
  const userName = useAppStore((state) => state.user?.name ?? '');
  const shelves = useAppStore((state) => state.shelves);
  const projects = useAppStore((state) => state.projects);
  const cards = useAppStore((state) => state.cards);
  const { closeDialog } = useUiStore.getState();

  const [own, setOwn] = useState<OwnShare | null>(null);
  const [copies, setCopies] = useState(0);
  const [error, setError] = useState('');

  const shelf = kind === 'shelf' ? shelves.find((item) => item.id === sourceId) : undefined;
  const project = kind === 'project' ? projects.find((item) => item.id === sourceId) : undefined;
  const name = shelf?.name ?? project?.name ?? '';
  const snapshot = shelf ? buildShelfSnapshot(shelf, projects, cards) : project ? buildProjectSnapshot(project, cards) : null;
  const counts = snapshot ? countSnapshot(snapshot) : { shelves: 0, projects: 0, cards: 0 };
  const includedIds = snapshot ? (shelf ? projects.filter((item) => item.shelfId === shelf.id && !item.archived).map((item) => item.id) : [sourceId]) : [];
  const skippedImages = countSkippedImageCards(includedIds, cards);

  const shareable = Boolean(snapshot && counts.cards > 0 && counts.cards <= MAX_SHARED_CARDS);

  // Make the link, or bring it up to date, as soon as the dialog opens.
  useEffect(() => {
    if (mode !== 'account' || !shareable || !snapshot) return;
    let active = true;
    void (async () => {
      try {
        const published = await publishShare(kind, sourceId, snapshot);
        if (!active) return;
        setOwn(published);
        const share = await fetchShare(published.id);
        if (active && share) setCopies(share.copies);
      } catch (publishError) {
        if (active) setError(publishError instanceof ShareError ? publishError.message : 'تعذّرت المشاركة.');
      }
    })();
    return () => {
      active = false;
    };
    // Once per opening (not on every edit): the snapshot is the cards as they are now.
  }, [mode, shareable, kind, sourceId]);

  const title = kind === 'shelf' ? `مشاركة رف «${name}»` : `مشاركة «${name}»`;
  const url = own ? getShareUrl(own.id) : '';
  const message = `${kind === 'shelf' ? 'رف' : 'مشروع'} «${name}» على رسوخ: ${formatCount(counts.cards, 'cards')} تراجعها بالمراجعة المتباعدة. انسخه لحسابك:`;

  if (mode !== 'account') {
    return (
      <Modal title={title} variant="compact" onClose={closeDialog}>
        <p className="modal__message">المشاركة تحتاج حسابًا، لأن الرابط يعرض ما في حسابك. أنشئ حسابًا مجانيًا وشارك مشاريعك مع أصدقائك.</p>
        <div className="form-footer">
          <button type="button" className="btn btn--secondary" onClick={closeDialog}>
            حسنًا
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={title} variant="compact" onClose={closeDialog}>
      <div className="share-dialog">
        {!snapshot || counts.cards === 0 ? (
          <p className="modal__message">
            {kind === 'shelf' ? 'لا بطاقات في مشاريع هذا الرف بعد.' : 'لا بطاقات في هذا المشروع بعد.'} أضف بطاقات أولًا، ثم شاركه.
            {skippedImages > 0 && ' (بطاقات الصور لا تُشارك.)'}
          </p>
        ) : counts.cards > MAX_SHARED_CARDS ? (
          <p className="modal__message">
            فيه {formatCount(counts.cards, 'cards')}، والرابط الواحد يتسع لـ {MAX_SHARED_CARDS} بطاقة. شارك المشاريع واحدًا واحدًا.
          </p>
        ) : (
          <>
            <p className="modal__message">أرسل الرابط لمن تريد: يرى البطاقات، وينسخها إلى حسابه ليراجعها بنفسه.</p>

            <ul className="share-dialog__facts" role="list">
              <li>
                <Icon name="cards" size={16} />
                {kind === 'shelf' && `${formatCount(counts.projects, 'projects')}، `}
                {formatCount(counts.cards, 'cards')}
              </li>
              <li>
                <Icon name="eye" size={16} />
                يظهر اسمك ({userName || 'بدون اسم'})، ولا يظهر تقدّمك في المراجعة
              </li>
              {skippedImages > 0 && (
                <li>
                  <Icon name="image" size={16} />
                  {formatCount(skippedImages, 'cards')} بصور لا تُشارك
                </li>
              )}
              {copies > 0 && (
                <li>
                  <Icon name="copy" size={16} />
                  نسخه {copies === 1 ? 'شخص واحد' : copies === 2 ? 'شخصان' : `${copies} أشخاص`}
                </li>
              )}
            </ul>

            {own ? (
              <>
                <div className="copy-field copy-field--static share-link">
                  <span className="copy-field__label">الرابط</span>
                  <span className="copy-field__value" dir="ltr">
                    {url.replace(/^https?:\/\//, '')}
                  </span>
                </div>
                <div className="share-dialog__actions">
                  <CopyButton url={url} />
                  <a
                    className="btn btn--secondary"
                    href={`https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    واتساب
                  </a>
                </div>
              </>
            ) : (
              !error && <p className="page-loading">جارٍ تجهيز الرابط…</p>
            )}
          </>
        )}

        {error && (
          <p className="checkout-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
