/*
 * Small presentational building blocks shared across screens.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { getProjectColor } from '../domain/project-colors';
import { getReviewStageLabel, MONTHLY_STAGE } from '../domain/review-scheduler';
import { getInitial } from '../domain/format';
import type { Project } from '../domain/types';
import { Icon, type IconName } from './Icon';

/* ---------- Project accent ---------- */

/**
 * Props that scope a project's color to an element. CSS derives soft and
 * strong tints from `--accent` (see variables.css → [data-accent]).
 */
export function accentProps(project: Pick<Project, 'color'> | undefined) {
  return { 'data-accent': '', style: { '--accent': getProjectColor(project) } as CSSProperties };
}

export function ProjectBadge({ project, size = 'md' }: { project: Project; size?: 'md' | 'lg' }) {
  return (
    <span className={`project-badge project-badge--${size}`} aria-hidden="true">
      {getInitial(project.name)}
    </span>
  );
}

/* ---------- Progress & stage ---------- */

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  const complete = max > 0 && value >= max;
  return (
    <div
      className={`progress${complete ? ' progress--complete' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span className="progress__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** A row of small steps showing how far a card is on its way to long-term memory. */
export function StageIndicator({ stage }: { stage: number }) {
  const label = getReviewStageLabel(stage);
  return (
    <span className="stage" role="img" aria-label={`مرحلة المراجعة: ${label}`}>
      <span className="stage__track" aria-hidden="true">
        {Array.from({ length: MONTHLY_STAGE }, (_, index) => (
          <span key={index} className={`stage__step${index < stage ? ' is-filled' : ''}`} />
        ))}
      </span>
      <span className="stage__label" aria-hidden="true">
        {label}
      </span>
    </span>
  );
}

/* ---------- Empty state ---------- */

type EmptyAction = { label: string; variant?: 'primary' | 'secondary' } & ({ to: string } | { onClick: () => void });

export function EmptyState({
  icon,
  title,
  message,
  note,
  actions = [],
  headingLevel = 2,
}: {
  icon: IconName;
  title: string;
  message: string;
  note?: string;
  actions?: EmptyAction[];
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section className="empty-state">
      <div className="empty-state__icon">
        <Icon name={icon} size={24} />
      </div>
      <Heading className="empty-state__title">{title}</Heading>
      <p className="empty-state__message">{message}</p>
      {note && <p className="empty-state__note">{note}</p>}
      {actions.length > 0 && (
        <div className="empty-state__actions">
          {actions.map((action) => {
            const className = `btn btn--${action.variant ?? 'primary'}`;
            return 'to' in action ? (
              <Link key={action.label} className={className} to={action.to}>
                {action.label}
              </Link>
            ) : (
              <button key={action.label} type="button" className={className} onClick={action.onClick}>
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function PageLoading({ children }: { children: ReactNode }) {
  return <p className="page-loading">{children}</p>;
}
