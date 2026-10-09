/*
 * A shared project or shelf (/s/:shareId), open to everyone with the link.
 * Visitors see the cards; signed-in users copy them into their account
 * (within their plan's limits); everyone else is invited to sign up first,
 * and brought back here afterwards.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/ui';
import { fetchShare, recordShareCopy, rememberPendingShare, ShareError } from '../data/shares';
import { getCardType } from '../domain/card-types';
import { formatShortDate, toISODate } from '../domain/date-utils';
import { formatCount } from '../domain/format';
import { PLANS, RESOURCE_LABELS } from '../domain/plans';
import { getProjectColor } from '../domain/project-colors';
import { getProjectTypeLabel } from '../domain/project-types';
import { countSnapshot, getCopyBlock, type Share, type SharedCard, type SharedProject } from '../domain/sharing';
import { useDocumentTitle } from '../hooks/use-document-title';
import { useToday } from '../hooks/use-today';
import { useAppStore } from '../store/app-store';
import { countResources } from '../store/selectors';
import { useUiStore } from '../store/ui-store';

const CARDS_SHOWN = 12;

/** The shown part and the hidden part of a card, side by side. */
function cardParts(card: SharedCard): [string, string] {
  switch (card.type) {
    case 'qa':
      return [card.content.question, card.content.answer];
    case 'definition':
      return [card.content.term, card.content.definition];
    case 'quote':
      return [card.content.text, card.content.continuation];
    case 'note':
      return [card.content.text, ''];
  }
}

function SharedProjectSection({ project }: { project: SharedProject }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? project.cards : project.cards.slice(0, CARDS_SHOWN);
  return (
    <section className="share-project" style={{ '--accent': getProjectColor(project) } as CSSProperties} data-accent="">
      <header className="share-project__head">
        <span className="share-project__badge" aria-hidden="true" />
        <div>
          <h2 className="share-project__name">{project.name}</h2>
          <p className="share-project__meta">
            {getProjectTypeLabel(project)} · {formatCount(project.cards.length, 'cards')}
          </p>
        </div>
      </header>
      {project.cards.length > 0 && (
        <ul className="share-cards" role="list">
          {shown.map((card, index) => {
            const [front, back] = cardParts(card);
            return (
              <li key={index} className="share-card">
                <span className="share-card__type">{getCardType(card.type).label}</span>
                <p className="share-card__front">{front}</p>
                {back && <p className="share-card__back">{back}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {project.cards.length > CARDS_SHOWN && (
        <button type="button" className="link-button share-project__more" onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'عرض أقل' : `عرض كل البطاقات (${project.cards.length})`}
        </button>
      )}
    </section>
  );
}

/** Copy into the account, or the way there for visitors. */
function CopyPanel({ share }: { share: Share }) {
  const today = useToday();
  const navigate = useNavigate();
  const mode = useAppStore((state) => state.mode);
  const user = useAppStore((state) => state.user);
  const shelves = useAppStore((state) => state.shelves);
  const projects = useAppStore((state) => state.projects);
  const cards = useAppStore((state) => state.cards);
  const importSnapshot = useAppStore((state) => state.importSnapshot);
  const { confirm, showToast } = useUiStore.getState();
  const incoming = countSnapshot(share.snapshot);
  const from = `/s/${share.id}`;

  if (!user) {
    return (
      <div className="share-cta">
        <p className="share-cta__text">
          <strong>انسخه إلى حسابك،</strong> ونذكّرك بكل بطاقة في وقتها حتى تترسّخ في ذاكرتك. مجانًا.
        </p>
        <div className="share-cta__actions">
          <Link className="btn btn--primary btn--lg" to="/signup" state={{ from }} onClick={() => rememberPendingShare(share.id)}>
            أنشئ حسابًا وانسخه
          </Link>
          <Link className="btn btn--secondary btn--lg" to="/login" state={{ from }} onClick={() => rememberPendingShare(share.id)}>
            لدي حساب
          </Link>
        </div>
      </div>
    );
  }

  if (mode !== 'account') {
    return (
      <div className="share-cta">
        <p className="share-cta__text">أنت في الوضع التجريبي. أنشئ حسابًا مجانيًا لتنسخ هذا إليه وتراجعه.</p>
      </div>
    );
  }

  const block = getCopyBlock(user.plan, countResources({ user, mode, shelves, projects, cards }), incoming);

  const copy = async () => {
    const what = share.kind === 'shelf' ? `رف «${share.snapshot.shelfName}» بمشاريعه` : `«${share.snapshot.projects[0]!.name}»`;
    const ok = await confirm({
      title: share.copiedByMe ? 'تنسخه مرة أخرى؟' : 'نسخه إلى حسابك؟',
      message: `${share.copiedByMe ? 'نسخته من قبل، وستحصل على نسخة ثانية منفصلة. ' : ''}سيُضاف ${what} (${formatCount(incoming.cards, 'cards')}) إلى حسابك، وتبدأ مراجعة بطاقاته من اليوم. يمكنك تعديلها كما تشاء.`,
      confirmLabel: 'انسخه',
      tone: 'primary',
    });
    if (!ok) return;
    const { shelf, projects: copied } = importSnapshot(share.snapshot, today);
    void recordShareCopy(share.id);
    showToast(`نُسخ إلى حسابك: ${formatCount(incoming.cards, 'cards')}`);
    navigate(shelf ? `/projects?shelf=${shelf.id}` : `/projects/${copied[0]!.id}`);
  };

  if (share.isOwner) {
    return (
      <div className="share-cta">
        <p className="share-cta__text">هذا رابطك. أي شخص يفتحه يرى هذه البطاقات وينسخها إلى حسابه.</p>
      </div>
    );
  }

  return (
    <div className="share-cta">
      {block ? (
        <>
          <p className="share-cta__text">
            <strong>
              النسخ يتجاوز حد خطة {PLANS[user.plan].name}: {RESOURCE_LABELS[block.resource].limitText(block.limit)}.
            </strong>{' '}
            بعد النسخ يصبح عندك {RESOURCE_LABELS[block.resource].limitText(block.wouldHave)}. ارتقِ بخطتك لتنسخه، أو احذف ما لا تحتاجه.
          </p>
          <div className="share-cta__actions">
            <Link className="btn btn--primary btn--lg" to={`/pricing?reason=${block.resource}`}>
              <Icon name="gem" size={18} />
              الباقات والأسعار
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="share-cta__text">
            {share.copiedByMe ? 'نسخته إلى حسابك من قبل.' : 'انسخه إلى حسابك وراجع بطاقاته بالمراجعة المتباعدة، ثم عدّلها كما تشاء.'}
          </p>
          <div className="share-cta__actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={() => void copy()}>
              <Icon name="copy" size={18} />
              انسخه لحسابي
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function SharePage() {
  const { shareId = '' } = useParams();
  const userId = useAppStore((state) => state.user?.id ?? null);
  const [share, setShare] = useState<Share | null | undefined>(undefined);
  const [error, setError] = useState('');

  const title = share ? (share.kind === 'shelf' ? share.snapshot.shelfName! : share.snapshot.projects[0]!.name) : 'مشاركة';
  useDocumentTitle(title);

  const load = useCallback(async () => {
    setError('');
    try {
      setShare(await fetchShare(shareId));
    } catch (loadError) {
      setError(loadError instanceof ShareError ? loadError.message : 'تعذّر فتح الرابط.');
      setShare(null);
    }
  }, [shareId]);

  // Again once signed in: whether it's yours, or copied already, depends on who's asking.
  useEffect(() => {
    void load();
  }, [load, userId]);

  if (share === undefined) return <p className="page-loading">جارٍ التحميل…</p>;

  if (!share) {
    return (
      <div className="page">
        <EmptyState
          icon="share"
          title={error ? 'تعذّر فتح الرابط' : 'هذا الرابط لا يعمل'}
          message={error || 'ربما أوقف صاحبه المشاركة، أو نُسخ الرابط ناقصًا.'}
          actions={[{ label: 'ما هو رسوخ؟', to: '/guide', variant: 'secondary' }]}
          headingLevel={1}
        />
      </div>
    );
  }

  const counts = countSnapshot(share.snapshot);

  return (
    <div className="page share-page">
      <header className="page-header share-page__header">
        <div>
          <p className="page-eyebrow">
            {share.kind === 'shelf' ? 'رف مشترك' : 'مشروع مشترك'}
            {share.ownerName && ` · من ${share.ownerName}`}
          </p>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">
            {share.kind === 'shelf' && `${formatCount(counts.projects, 'projects')} · `}
            {formatCount(counts.cards, 'cards')} · حُدّث {formatShortDate(toISODate(new Date(share.updatedAt)))}
            {share.copies > 0 && ` · نسخه ${share.copies === 1 ? 'شخص واحد' : share.copies === 2 ? 'شخصان' : `${share.copies} أشخاص`}`}
          </p>
        </div>
      </header>

      <CopyPanel share={share} />

      <div className="share-projects">
        {share.snapshot.projects.map((project, index) => (
          <SharedProjectSection key={index} project={project} />
        ))}
      </div>

      <aside className="share-about">
        <p>
          <strong>رسوخ</strong> يعيد إليك ما تتعلمه في الوقت المناسب، قبل أن تنساه بقليل، حتى يثبت في ذاكرتك.
        </p>
        <Link to="/guide">كيف يعمل رسوخ؟</Link>
      </aside>
    </div>
  );
}
