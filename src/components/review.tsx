/*
 * Review session pieces: the card under review, the outcome buttons, and the
 * end-of-review screen.
 */
import type { ReactNode, Ref } from 'react';
import { Link } from 'react-router';
import { getCardLength, getCardType, hasHiddenPart } from '../domain/card-types';
import { formatRelativeDate } from '../domain/date-utils';
import { formatCount } from '../domain/format';
import { getProjectTypeLabel } from '../domain/project-types';
import { getDaysOverdue, getForgottenStage, getNextStage, getReturnLabel, INITIAL_STAGE } from '../domain/review-scheduler';
import type { StreakSummary } from '../domain/streak';
import type { Card, ISODate, Project, ReviewResult } from '../domain/types';
import type { ReviewSummary } from '../store/selectors';
import { StreakLine } from './dashboard';
import { Icon } from './Icon';
import { accentProps, StageIndicator } from './ui';

const LONG_CONTENT_THRESHOLD = 180;

function RevealedPart({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="review-card__answer">
      <p className="review-card__answer-label">{label}</p>
      {children}
    </div>
  );
}

function ReviewBody({ card, revealed }: { card: Card; revealed: boolean }) {
  switch (card.type) {
    case 'qa':
      return (
        <>
          <p className="review-card__question">{card.content.question}</p>
          {revealed && (
            <RevealedPart label="الإجابة">
              <p className="review-card__answer-text">{card.content.answer}</p>
            </RevealedPart>
          )}
        </>
      );
    case 'quote': {
      const { text, continuation } = card.content;
      return (
        <blockquote className="review-card__quote">
          <p>
            {text}
            {continuation &&
              (revealed ? (
                <span className="quote-continuation"> {continuation}</span>
              ) : (
                <span className="quote-gap" aria-label="أكمل الاقتباس من ذاكرتك"> …</span>
              ))}
          </p>
        </blockquote>
      );
    }
    case 'definition':
      return (
        <>
          <p className="review-card__term">{card.content.term}</p>
          {revealed && (
            <RevealedPart label="التعريف">
              <p className="review-card__definition">{card.content.definition}</p>
            </RevealedPart>
          )}
        </>
      );
    case 'image':
      return (
        <>
          <p className="review-card__term">{card.content.title}</p>
          {revealed && (
            <RevealedPart label="الصورة">
              <img className="review-card__image" src={card.content.imageUrl} alt={card.content.title} />
            </RevealedPart>
          )}
        </>
      );
    case 'note':
      return <p className="review-card__text">{card.content.text}</p>;
  }
}

/** Only surfaces review context when it is useful. */
function ReviewNote({ card, today }: { card: Card; today: ISODate }) {
  const overdueDays = getDaysOverdue(card, today);
  if (overdueDays === 1) return <p className="review-card__note review-card__note--warning">كانت مستحقة أمس</p>;
  if (overdueDays > 1) {
    return <p className="review-card__note review-card__note--warning">متأخرة منذ {formatCount(overdueDays, 'days')}</p>;
  }
  if (card.lastReviewResult === 'forgot') return <p className="review-card__note">لم تتذكرها في المرة السابقة</p>;
  if (card.reviewStage === INITIAL_STAGE) return <p className="review-card__note">أول مراجعة</p>;
  return null;
}

export function ReviewCard({
  card,
  project,
  revealed,
  leaving,
  today,
  onReveal,
}: {
  card: Card;
  project: Project | undefined;
  revealed: boolean;
  leaving: boolean;
  today: ISODate;
  onReveal: () => void;
}) {
  const cardType = getCardType(card.type);
  // A card with a hidden part reveals it when clicked anywhere.
  const revealable = hasHiddenPart(card) && !revealed;
  const hiddenPartLabel = cardType.hiddenPartLabel ?? '';
  const classes = [
    'review-card',
    leaving ? 'is-leaving' : 'is-entering',
    revealable && 'is-revealable',
    getCardLength(card) > LONG_CONTENT_THRESHOLD && 'is-long',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={classes} {...accentProps(project)} aria-labelledby="review-card-meta" onClick={revealable ? onReveal : undefined}>
      <header className="review-card__meta" id="review-card-meta">
        <span className="review-card__project">
          <span className="type-tag">
            <span className="type-dot" aria-hidden="true" />
            {project?.name}
          </span>
          {project && <span className="review-card__project-type">{getProjectTypeLabel(project)}</span>}
        </span>
        <span className="card-type">
          <Icon name={cardType.icon} size={16} />
          {cardType.label}
        </span>
      </header>

      <div className="review-card__body">
        <ReviewBody card={card} revealed={revealed} />
        {revealable && (
          <p className="review-card__reveal-hint" aria-hidden="true">
            اضغط على البطاقة لإظهار {hiddenPartLabel}
          </p>
        )}
      </div>

      <footer className="review-card__info">
        <StageIndicator stage={card.reviewStage} />
        <ReviewNote card={card} today={today} />
      </footer>
    </article>
  );
}

/**
 * Cards with a hidden part first offer "إظهار …"; notes (and revealed cards)
 * show the two outcomes. تذكرتها sits on the right to match →, and each
 * outcome hints when the card comes back.
 */
export function ReviewActions({
  card,
  revealed,
  onReveal,
  onGrade,
  primaryRef,
  practice = false,
}: {
  card: Card;
  revealed: boolean;
  /** A card reviewed before it's due, in a project review (see applyPracticeResult). */
  practice?: boolean;
  onReveal: () => void;
  onGrade: (result: 'remembered' | 'forgot') => void;
  primaryRef: Ref<HTMLButtonElement>;
}) {
  const awaitingReveal = hasHiddenPart(card) && !revealed;
  const stagesBack = card.reviewStage - getForgottenStage(card.reviewStage);
  const hiddenPartLabel = getCardType(card.type).hiddenPartLabel ?? '';

  return (
    <footer className="review-footer">
      {awaitingReveal ? (
        <div className="review-actions">
          <button type="button" className="review-action review-action--reveal" onClick={onReveal}>
            <span className="review-action__label">
              <Icon name="eye" />
              إظهار {hiddenPartLabel}
            </span>
          </button>
        </div>
      ) : (
        <div className="review-actions" role="group" aria-label="هل تذكرت هذه البطاقة؟">
          <button
            ref={primaryRef}
            type="button"
            className="review-action review-action--remembered"
            aria-keyshortcuts="ArrowRight"
            onClick={() => onGrade('remembered')}
          >
            <span className="review-action__label">
              <Icon name="check" size={18} />
              تذكرتها
            </span>
            <span className="review-action__hint">
              {practice ? 'يبقى موعدها كما هو' : `تعود ${getReturnLabel(getNextStage(card.reviewStage))}`}
            </span>
          </button>
          <button
            type="button"
            className="review-action review-action--forgot"
            aria-keyshortcuts="ArrowLeft"
            onClick={() => onGrade('forgot')}
          >
            <span className="review-action__label">
              <Icon name="retry" size={18} />
              لم أتذكرها
            </span>
            <span className="review-action__hint">
              {practice ? 'تعود لمراجعة اليوم' : 'تعود غدًا'}
              {stagesBack > 0 && ` وترجع ${formatCount(stagesBack, 'stagesBack')}`}
            </span>
          </button>
        </div>
      )}

      <p className="review-shortcuts" aria-hidden="true">
        {awaitingReveal ? (
          <span>
            <kbd>مسافة</kbd> أو اضغط على البطاقة لإظهار {hiddenPartLabel}
          </span>
        ) : (
          <>
            <span>
              <kbd>→</kbd> تذكرتها
            </span>
            <span>
              <kbd>←</kbd> لم أتذكرها
            </span>
          </>
        )}
      </p>
    </footer>
  );
}

export function ReviewCompletion({
  summary,
  upcoming,
  streak,
  today,
  pendingCount,
  deferredCount,
  dailyLimit,
  onRestart,
  onReviewMore,
  onAddCard,
}: {
  summary: ReviewSummary;
  upcoming: { date: ISODate; count: number } | undefined;
  streak: StreakSummary;
  today: ISODate;
  pendingCount: number;
  /** Due cards past the daily limit. */
  deferredCount: number;
  dailyLimit: number | null;
  onRestart: () => void;
  onReviewMore: () => void;
  onAddCard: () => void;
}) {
  const atLimit = pendingCount === 0 && deferredCount > 0;
  return (
    <section className="completion">
      <div className="completion__mark" aria-hidden="true">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="32" r="24" transform="rotate(-90 32 32)" />
          <path d="M22 32.5l7 7 13-14" />
        </svg>
      </div>

      <h1 className="completion__title">خلصت مراجعتك لليوم.</h1>
      <p className="completion__count">راجعت {formatCount(summary.reviewed, 'cardsObject')}</p>
      <StreakLine streak={streak} />

      <dl className="completion__stats">
        <div>
          <dt>تذكّرتها</dt>
          <dd>{summary.remembered}</dd>
        </div>
        <div>
          <dt>تعود غدًا</dt>
          <dd>{summary.forgot}</dd>
        </div>
      </dl>

      {atLimit && (
        <p className="completion__upcoming">
          وصلت لحدّك اليومي ({dailyLimit} بطاقة). {formatCount(deferredCount, 'cards')} تنتظر الغد، وتأتي أولًا.
        </p>
      )}

      {!atLimit && upcoming && (
        <p className="completion__upcoming">
          موعدك القادم {formatRelativeDate(upcoming.date, today)} · {formatCount(upcoming.count, 'cards')}
        </p>
      )}

      <div className="completion__actions">
        {pendingCount > 0 ? (
          <>
            {/* Cards added after the session finished. */}
            <button type="button" className="btn btn--primary btn--lg" onClick={onRestart}>
              ابدأ المراجعة · {formatCount(pendingCount, 'cards')}
            </button>
            <Link className="btn btn--secondary btn--lg" to="/projects">
              استعراض المشاريع
            </Link>
          </>
        ) : atLimit ? (
          <>
            <Link className="btn btn--primary btn--lg" to="/">
              العودة إلى اليوم
            </Link>
            <button type="button" className="btn btn--secondary btn--lg" onClick={onReviewMore}>
              راجع دفعة إضافية
            </button>
          </>
        ) : (
          <>
            <Link className="btn btn--primary btn--lg" to="/projects">
              استعراض المشاريع
            </Link>
            <button type="button" className="btn btn--secondary btn--lg" onClick={onAddCard}>
              إضافة بطاقة جديدة
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/** The end of a project review: what was remembered, and what went back to the daily review. */
export function ProjectReviewCompletion({
  project,
  results,
  dailyCount,
  onRestart,
}: {
  project: Project;
  results: Readonly<Record<ReviewResult, number>>;
  /** Cards waiting in today's daily review (including the ones just sent there). */
  dailyCount: number;
  onRestart: () => void;
}) {
  return (
    <section className="completion" {...accentProps(project)}>
      <div className="completion__mark" aria-hidden="true">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="32" r="24" transform="rotate(-90 32 32)" />
          <path d="M22 32.5l7 7 13-14" />
        </svg>
      </div>

      <h1 className="completion__title">خلصت مراجعة «{project.name}».</h1>
      <p className="completion__count">راجعت {formatCount(results.remembered + results.forgot, 'cardsObject')}</p>

      <dl className="completion__stats">
        <div>
          <dt>تذكّرتها</dt>
          <dd>{results.remembered}</dd>
        </div>
        <div>
          <dt>عادت لمراجعة اليوم</dt>
          <dd>{results.forgot}</dd>
        </div>
      </dl>

      {results.forgot > 0 && <p className="completion__upcoming">البطاقات التي لم تتذكرها تنتظرك في مراجعة اليوم على الصفحة الرئيسية.</p>}

      <div className="completion__actions">
        {dailyCount > 0 ? (
          <Link className="btn btn--primary btn--lg" to="/review">
            ابدأ مراجعة اليوم · {formatCount(dailyCount, 'cards')}
          </Link>
        ) : (
          <Link className="btn btn--primary btn--lg" to={`/projects/${project.id}`}>
            العودة إلى المشروع
          </Link>
        )}
        <button type="button" className="btn btn--secondary btn--lg" onClick={onRestart}>
          راجع المشروع مرة أخرى
        </button>
      </div>
    </section>
  );
}
