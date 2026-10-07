import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { getCardType, hasHiddenPart } from '../domain/card-types';
import { formatRelativeDate } from '../domain/date-utils';
import type { Card, ISODate, Project } from '../domain/types';
import { useCardActions } from '../hooks/use-card-actions';
import { ActionMenu } from './ActionMenu';
import { Icon } from './Icon';
import { accentProps, StageIndicator } from './ui';

interface KnowledgeCardProps {
  card: Card;
  project: Project | undefined;
  today: ISODate;
  /** Whether the card is waiting for review today (false for paused projects). */
  due: boolean;
  /** Label the card with its project, for lists that mix projects. */
  showProject?: boolean;
}

/** Answer or definition, hidden behind a button while the card is still due. */
function HiddenPart({ label, hidden, onReveal, children }: { label: string; hidden: boolean; onReveal: () => void; children: ReactNode }) {
  if (hidden) {
    return (
      <button type="button" className="k-card__reveal" onClick={onReveal}>
        <Icon name="eye" size={16} />
        {label}
      </button>
    );
  }
  return <>{children}</>;
}

function CardContent({ card, hideAnswer }: { card: Card; hideAnswer: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const hidden = hideAnswer && !revealed;
  const reveal = () => setRevealed(true);
  const revealLabel = `إظهار ${getCardType(card.type).hiddenPartLabel ?? ''}`;

  switch (card.type) {
    case 'qa':
      return (
        <>
          <p className="k-card__question">{card.content.question}</p>
          <HiddenPart label={revealLabel} hidden={hidden} onReveal={reveal}>
            <p className="k-card__answer">
              <span className="k-card__answer-label">الإجابة: </span>
              {card.content.answer}
            </p>
          </HiddenPart>
        </>
      );
    case 'definition':
      return (
        <>
          <p className="k-card__term">{card.content.term}</p>
          <HiddenPart label={revealLabel} hidden={hidden} onReveal={reveal}>
            <p className="k-card__text">{card.content.definition}</p>
          </HiddenPart>
        </>
      );
    case 'quote':
      return (
        <>
          <blockquote className="k-card__quote">
            <p>
              {card.content.text}
              {card.content.continuation &&
                (hidden ? (
                  <span className="quote-gap" aria-label="تكملة مخفية"> …</span>
                ) : (
                  <span className="quote-continuation"> {card.content.continuation}</span>
                ))}
            </p>
          </blockquote>
          {card.content.continuation && hidden && <HiddenPart label={revealLabel} hidden onReveal={reveal}>{null}</HiddenPart>}
        </>
      );
    case 'image':
      return (
        <>
          <p className="k-card__term">{card.content.title}</p>
          <HiddenPart label={revealLabel} hidden={hidden} onReveal={reveal}>
            <img className="k-card__image" src={card.content.imageUrl} alt={card.content.title} loading="lazy" />
          </HiddenPart>
        </>
      );
    case 'note':
      return <p className="k-card__text">{card.content.text}</p>;
  }
}

/**
 * The one card layout used everywhere cards are listed. While a card is due,
 * its answer stays hidden so seeing it in a list doesn't spoil the review.
 */
export function KnowledgeCard({ card, project, today, due, showProject = false }: KnowledgeCardProps) {
  const cardType = getCardType(card.type);
  const { edit, move, remove } = useCardActions(card.id);

  return (
    <article className="k-card" {...accentProps(project)}>
      <header className="k-card__header">
        <div className="k-card__labels">
          {showProject && project && (
            <Link className="k-card__project" to={`/projects/${project.id}`}>
              <span className="type-dot" aria-hidden="true" />
              {project.name}
            </Link>
          )}
          <span className="card-type">
            <Icon name={cardType.icon} size={16} />
            {cardType.label}
          </span>
        </div>
        <div className="k-card__header-end">
          {due && <span className="badge badge--due">مستحقة اليوم</span>}
          <ActionMenu
            label="خيارات البطاقة"
            items={[
              { label: 'تعديل', icon: 'edit', onSelect: edit },
              { label: 'نقل إلى مشروع آخر', icon: 'move', onSelect: move },
              { label: 'حذف', icon: 'trash', onSelect: remove, danger: true },
            ]}
          />
        </div>
      </header>

      <div className="k-card__content">
        <CardContent card={card} hideAnswer={due && hasHiddenPart(card)} />
      </div>

      <footer className="k-card__footer">
        <dl className="k-card__schedule">
          <div>
            <dt>المرحلة</dt>
            <dd>
              <StageIndicator stage={card.reviewStage} />
            </dd>
          </div>
          <div>
            <dt>المراجعة القادمة</dt>
            <dd>{due ? 'اليوم' : formatRelativeDate(card.nextReviewDate, today)}</dd>
          </div>
        </dl>
      </footer>
    </article>
  );
}
