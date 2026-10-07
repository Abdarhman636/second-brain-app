import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Icon } from '../components/Icon';
import { ProjectReviewCompletion, ReviewActions, ReviewCard, ReviewCompletion } from '../components/review';
import { accentProps, EmptyState, Progress } from '../components/ui';
import { hasHiddenPart } from '../domain/card-types';
import { isCardDue } from '../domain/review-scheduler';
import type { ReviewResult } from '../domain/types';
import { useActiveCards, useProjectMap, useReviewSummary, useStreak, useTodaysReviews } from '../hooks/use-app-data';
import { useDocumentTitle } from '../hooks/use-document-title';
import { isTypingTarget } from '../hooks/use-global-shortcuts';
import { useToday } from '../hooks/use-today';
import { useAppStore } from '../store/app-store';
import { getCurrentReviewItem, getUpcomingSchedule, isReviewSessionActive } from '../store/selectors';
import { useUiStore } from '../store/ui-store';

const EXIT_DURATION_MS = 140; // keep in sync with .review-card.is-leaving in review.css
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The focused review: one card at a time. Grading plays a short exit
 * animation, then the store reschedules the card and moves to the next one.
 *
 * At /review it's the daily review; at /projects/:projectId/review it covers
 * every card of that one project.
 */
export function ReviewPage() {
  const { projectId = null } = useParams();
  const project = useAppStore((state) => (projectId ? state.projects.find((item) => item.id === projectId) : undefined));
  useDocumentTitle(project ? `مراجعة ${project.name}` : 'المراجعة');
  const today = useToday();
  const session = useAppStore((state) => state.reviewSession);
  const cards = useAppStore((state) => state.cards);
  const { startReviewSession, startProjectReview, revealAnswer, gradeCurrentCard } = useAppStore.getState();
  const openDialog = useUiStore((state) => state.openDialog);

  const activeCards = useActiveCards();
  const todays = useTodaysReviews(today);
  const projectMap = useProjectMap();
  const summary = useReviewSummary(today);
  const streak = useStreak(today);

  const [leaving, setLeaving] = useState(false);
  const submittingRef = useRef(false);
  const rememberedButtonRef = useRef<HTMLButtonElement>(null);

  // Entering the page keeps a matching session in progress, or starts one:
  // today's due cards, or the project's cards.
  useLayoutEffect(() => {
    const current = useAppStore.getState().reviewSession;
    if (isReviewSessionActive(current, today) && current.projectId === projectId) return;
    if (projectId) startProjectReview(projectId, today);
    else startReviewSession(today);
  }, [today, projectId, startReviewSession, startProjectReview]);

  const exitTo = projectId ? `/projects/${projectId}` : '/';

  const item = getCurrentReviewItem(session, cards, today);
  const awaitingReveal = Boolean(item && hasHiddenPart(item.card) && !session.answerRevealed);

  const grade = useCallback(
    (result: ReviewResult) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      const finish = () => {
        gradeCurrentCard(result, today);
        setLeaving(false);
        submittingRef.current = false;
      };
      if (prefersReducedMotion()) return finish();
      setLeaving(true);
      window.setTimeout(finish, EXIT_DURATION_MS);
    },
    [gradeCurrentCard, today],
  );

  // Keyboard: Space reveals; → تذكرتها, ← لم أتذكرها (by key position, so Arabic layouts work too).
  useEffect(() => {
    if (!item) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || useUiStore.getState().dialog) return;

      if (awaitingReveal) {
        if (event.code === 'Space') {
          event.preventDefault();
          revealAnswer();
        }
        return;
      }
      if (event.code === 'ArrowRight') {
        event.preventDefault();
        grade('remembered');
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        grade('forgot');
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [item, awaitingReveal, grade, revealAnswer]);

  // While a card is on screen, phones hide the header for a distraction-free review.
  const reviewing = Boolean(item);
  useEffect(() => {
    if (!reviewing) return;
    document.body.dataset.focus = 'review';
    return () => {
      delete document.body.dataset.focus;
    };
  }, [reviewing]);

  // Revealing swaps the focused button for the outcome buttons; keep focus in the flow.
  useEffect(() => {
    if (session.answerRevealed && document.activeElement === document.body) {
      rememberedButtonRef.current?.focus({ preventScroll: true });
    }
  }, [session.answerRevealed]);

  if (!item && projectId) {
    return (
      <div className="page page--narrow">
        {project && session.projectId === projectId && session.queue.length > 0 ? (
          <ProjectReviewCompletion
            project={project}
            results={session.results}
            dailyCount={todays.cards.length}
            onRestart={() => startProjectReview(projectId, today)}
          />
        ) : (
          <EmptyState
            icon="cardPlus"
            title={project ? 'لا توجد بطاقات للمراجعة هنا' : 'لم نجد هذا المشروع'}
            message={project?.archived ? 'هذا المشروع مؤرشف، ومراجعاته متوقفة.' : 'أضف بطاقات إلى المشروع أولًا.'}
            actions={[{ label: project ? 'العودة إلى المشروع' : 'استعراض المشاريع', to: project ? exitTo : '/projects', variant: 'secondary' }]}
            headingLevel={1}
          />
        )}
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page page--narrow">
        {summary.reviewed ? (
          <ReviewCompletion
            summary={summary}
            upcoming={getUpcomingSchedule(activeCards, today, 1)[0]}
            streak={streak}
            today={today}
            pendingCount={todays.cards.length}
            deferredCount={todays.deferred}
            dailyLimit={todays.limit}
            onRestart={() => startReviewSession(today)}
            onReviewMore={() => startReviewSession(today, { extra: true })}
            onAddCard={() => openDialog({ kind: 'create-card' })}
          />
        ) : (
          <EmptyState
            icon="sun"
            title="لا توجد مراجعات اليوم"
            message="أنت مخلص كل شيء حاليًا."
            actions={[{ label: 'العودة إلى اليوم', to: '/', variant: 'secondary' }]}
            headingLevel={1}
          />
        )}
      </div>
    );
  }

  const { card, position, total } = item;

  return (
    <section className="review" aria-labelledby="review-title" {...(project ? accentProps(project) : {})}>
      <h1 className="visually-hidden" id="review-title">
        مراجعة اليوم
      </h1>

      <header className="review-bar">
        <Link className="review-bar__exit" to={exitTo}>
          <Icon name="close" size={18} />
          إنهاء
        </Link>
        {project && <span className="review-bar__scope">{project.name}</span>}
        <div className="review-bar__progress">
          <Progress value={position - 1} max={total} label="تقدّم الجلسة" />
          <span className="review-bar__count">
            {position} من {total}
          </span>
        </div>
      </header>

      <div className="review-main">
        <ReviewCard
          key={card.id}
          card={card}
          project={projectMap.get(card.projectId)}
          revealed={session.answerRevealed}
          leaving={leaving}
          today={today}
          onReveal={revealAnswer}
        />
        <ReviewActions
          card={card}
          revealed={session.answerRevealed}
          onReveal={revealAnswer}
          onGrade={grade}
          primaryRef={rememberedButtonRef}
          practice={session.projectId !== null && !isCardDue(card, today)}
        />
      </div>
    </section>
  );
}
