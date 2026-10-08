/*
 * Renders whichever dialog is open in the UI store. Each dialog wires a form
 * or a choice to the matching app-store action.
 */
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { DEFAULT_CARD_TYPE, toFieldValues } from '../domain/card-types';
import { getProjectTypeLabel, DEFAULT_PROJECT_TYPE } from '../domain/project-types';
import { suggestProjectColor } from '../domain/project-colors';
import { formatCount } from '../domain/format';
import { SHELF_NAME_MAX_LENGTH } from '../domain/shelves';
import type { Project, ProjectInput } from '../domain/types';
import { useToday } from '../hooks/use-today';
import { useAppStore } from '../store/app-store';
import { isPlanLimitReached } from '../store/selectors';
import { useUiStore, type Dialog } from '../store/ui-store';
import { AiCardsDialog } from './AiCardsDialog';
import { CardForm } from './CardForm';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { ProjectForm } from './ProjectForm';
import { accentProps } from './ui';

type DialogOf<K extends Dialog['kind']> = Extract<Dialog, { kind: K }>;

/** Projects a card can belong to: active ones, plus the card's own (even if archived). */
function useSelectableProjects(currentProjectId?: string): Project[] {
  const projects = useAppStore((state) => state.projects);
  return projects.filter((project) => !project.archived || project.id === currentProjectId);
}

function CreateCardDialog({ dialog }: { dialog: DialogOf<'create-card'> }) {
  const today = useToday();
  const addCard = useAppStore((state) => state.addCard);
  const lastUsedProjectId = useAppStore((state) => state.lastUsedProjectId);
  const projects = useSelectableProjects();
  const { closeDialog, openDialog, showToast } = useUiStore.getState();
  const hasProjects = projects.length > 0;

  // Cards live inside projects, so the very first card starts with a project.
  useEffect(() => {
    if (hasProjects) return;
    openDialog({
      kind: 'create-project',
      lead: 'تُحفظ البطاقات داخل مشاريع. أنشئ مشروعك الأول، ثم أضف إليه بطاقتك.',
      thenCreateCard: true,
    });
  }, [hasProjects, openDialog]);

  if (!hasProjects) return null;

  // Preselect the project in view, else the last one used; otherwise the user chooses.
  const preferred = [dialog.projectId, lastUsedProjectId].find((id) => id && projects.some((project) => project.id === id));

  return (
    <Modal title="بطاقة جديدة" onClose={closeDialog}>
      <button
        type="button"
        className="ai-entry"
        onClick={() => openDialog({ kind: 'ai-cards', ...(preferred ? { projectId: preferred } : {}) })}
      >
        <Icon name="sparkle" size={16} />
        <span>
          <strong>أنشئ بطاقات بالذكاء الاصطناعي</strong> من نص أو صورة
        </span>
        <Icon name="arrowLeft" size={16} />
      </button>
      <CardForm
        initial={{ projectId: preferred ?? '', type: DEFAULT_CARD_TYPE, values: {} }}
        projects={projects}
        submitLabel="إضافة البطاقة"
        onCancel={closeDialog}
        onSubmit={(input) => {
          addCard(input, today);
          closeDialog();
          showToast('أُضيفت البطاقة إلى مراجعة اليوم');
        }}
      />
    </Modal>
  );
}

function EditCardDialog({ dialog }: { dialog: DialogOf<'edit-card'> }) {
  const card = useAppStore((state) => state.cards.find((item) => item.id === dialog.cardId));
  const editCard = useAppStore((state) => state.editCard);
  const projects = useSelectableProjects(card?.projectId);
  const { closeDialog, showToast } = useUiStore.getState();
  if (!card) return null;

  return (
    <Modal title="تعديل البطاقة" onClose={closeDialog}>
      <CardForm
        initial={{ projectId: card.projectId, type: card.type, values: toFieldValues(card) }}
        projects={projects}
        submitLabel="حفظ التغييرات"
        onCancel={closeDialog}
        onSubmit={(input) => {
          editCard(card.id, input);
          closeDialog();
          showToast('حُفظت التعديلات');
        }}
      />
    </Modal>
  );
}

function MoveCardDialog({ dialog }: { dialog: DialogOf<'move-card'> }) {
  const card = useAppStore((state) => state.cards.find((item) => item.id === dialog.cardId));
  const cards = useAppStore((state) => state.cards);
  const moveCard = useAppStore((state) => state.moveCard);
  const projects = useSelectableProjects(card?.projectId);
  const { closeDialog, showToast } = useUiStore.getState();
  if (!card) return null;

  const hasOtherProjects = projects.some((project) => project.id !== card.projectId);

  return (
    <Modal title="نقل إلى مشروع" onClose={closeDialog}>
      <ul className="choice-list" role="list">
        {projects.map((project) => {
          const isCurrent = project.id === card.projectId;
          const count = cards.filter((item) => item.projectId === project.id).length;
          return (
            <li key={project.id}>
              <button
                type="button"
                className="choice"
                disabled={isCurrent}
                {...accentProps(project)}
                data-autofocus={!isCurrent && project === projects.find((item) => item.id !== card.projectId) ? '' : undefined}
                onClick={() => {
                  moveCard(card.id, project.id);
                  closeDialog();
                  showToast(`نُقلت البطاقة إلى «${project.name}»`);
                }}
              >
                <span className="type-dot" aria-hidden="true" />
                <span className="choice__body">
                  <span className="choice__name">{project.name}</span>
                  <span className="choice__meta">
                    {getProjectTypeLabel(project)} · {formatCount(count, 'cards')}
                  </span>
                </span>
                {isCurrent ? <span className="choice__current">المشروع الحالي</span> : <Icon name="arrowLeft" size={18} />}
              </button>
            </li>
          );
        })}
      </ul>
      {!hasOtherProjects && <p className="choice-list__empty">لا توجد مشاريع أخرى بعد. أنشئ مشروعًا جديدًا لتنقل إليه البطاقة.</p>}
      <div className="form-footer">
        <button type="button" className="btn btn--ghost" onClick={closeDialog}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

/** The project's shelf, creating the shelf first when the form named a new one. */
function withShelf(input: ProjectInput, newShelfName: string | null): ProjectInput {
  return newShelfName ? { ...input, shelfId: useAppStore.getState().addShelf(newShelfName).id } : input;
}

function CreateProjectDialog({ dialog }: { dialog: DialogOf<'create-project'> }) {
  const navigate = useNavigate();
  const projects = useAppStore((state) => state.projects);
  const shelves = useAppStore((state) => state.shelves);
  const canAddShelf = useAppStore((state) => !isPlanLimitReached(state, 'shelves'));
  const addProject = useAppStore((state) => state.addProject);
  const { closeDialog, openDialog, showToast } = useUiStore.getState();
  const shelfId = dialog.shelfId && shelves.some((shelf) => shelf.id === dialog.shelfId) ? dialog.shelfId : null;

  return (
    <Modal title="مشروع جديد" onClose={closeDialog}>
      <ProjectForm
        initial={{ name: '', type: DEFAULT_PROJECT_TYPE, customTypeLabel: null, color: suggestProjectColor(projects), shelfId }}
        shelves={shelves}
        canAddShelf={canAddShelf}
        submitLabel="إنشاء المشروع"
        {...(dialog.lead ? { lead: dialog.lead } : {})}
        onCancel={closeDialog}
        onSubmit={(input, newShelfName) => {
          const project = addProject(withShelf(input, newShelfName));
          if (dialog.thenCreateCard) {
            openDialog({ kind: 'create-card', projectId: project.id });
            return;
          }
          closeDialog();
          navigate(`/projects/${project.id}`);
          showToast(`أُنشئ مشروع «${project.name}»`);
        }}
      />
    </Modal>
  );
}

function EditProjectDialog({ dialog }: { dialog: DialogOf<'edit-project'> }) {
  const project = useAppStore((state) => state.projects.find((item) => item.id === dialog.projectId));
  const shelves = useAppStore((state) => state.shelves);
  const canAddShelf = useAppStore((state) => !isPlanLimitReached(state, 'shelves'));
  const updateProject = useAppStore((state) => state.updateProject);
  const { closeDialog, showToast } = useUiStore.getState();
  if (!project) return null;

  return (
    <Modal title="تعديل المشروع" onClose={closeDialog}>
      <ProjectForm
        initial={project}
        shelves={shelves}
        canAddShelf={canAddShelf}
        submitLabel="حفظ التغييرات"
        onCancel={closeDialog}
        onSubmit={(input, newShelfName) => {
          updateProject(project.id, withShelf(input, newShelfName));
          closeDialog();
          showToast('حُفظت تغييرات المشروع');
        }}
      />
    </Modal>
  );
}

/** Name a new shelf, or rename one. */
function ShelfDialog({ dialog }: { dialog: DialogOf<'create-shelf'> | DialogOf<'rename-shelf'> }) {
  const id = useId();
  const shelf = useAppStore((state) => (dialog.kind === 'rename-shelf' ? state.shelves.find((item) => item.id === dialog.shelfId) : undefined));
  const navigate = useNavigate();
  const { closeDialog, showToast } = useUiStore.getState();
  const [name, setName] = useState(shelf?.name ?? '');
  const [error, setError] = useState('');
  if (dialog.kind === 'rename-shelf' && !shelf) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('اكتب اسمًا للرف');
      document.getElementById(`${id}-name`)?.focus();
      return;
    }
    closeDialog();
    if (shelf) {
      useAppStore.getState().renameShelf(shelf.id, trimmed);
      showToast('حُفظ اسم الرف');
      return;
    }
    const created = useAppStore.getState().addShelf(trimmed);
    navigate(`/projects?shelf=${created.id}`);
    showToast(`أُنشئ رف «${created.name}»، أضف إليه مشاريعك`);
  };

  return (
    <Modal title={shelf ? 'إعادة تسمية الرف' : 'رف جديد'} variant="compact" onClose={closeDialog}>
      <form className="form" noValidate onSubmit={submit}>
        {!shelf && <p className="form__lead">الرف يجمع مشاريع متشابهة، مثل رف «كتب» فيه مشروع لكل كتاب، وكل مشروع ببطاقاته.</p>}
        <div className="field">
          <label className="field__label" htmlFor={`${id}-name`}>
            اسم الرف
          </label>
          <input
            className="input"
            id={`${id}-name`}
            type="text"
            autoComplete="off"
            maxLength={SHELF_NAME_MAX_LENGTH}
            placeholder="مثال: كتب"
            value={name}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-error`}
            data-autofocus=""
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
          />
          <p className="field__error" id={`${id}-error`} hidden={!error}>
            {error}
          </p>
        </div>
        <div className="form-footer">
          <button type="submit" className="btn btn--primary">
            {shelf ? 'حفظ' : 'إنشاء الرف'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={closeDialog}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmDialog({ dialog }: { dialog: DialogOf<'confirm'> }) {
  const finish = (confirmed: boolean) => {
    dialog.resolve(confirmed);
    useUiStore.setState({ dialog: null });
  };

  return (
    <Modal title={dialog.title} variant="compact" onClose={() => finish(false)}>
      <p className="modal__message">{dialog.message}</p>
      <div className="form-footer">
        <button type="button" className={`btn btn--${dialog.tone ?? 'danger'}`} onClick={() => finish(true)}>
          {dialog.confirmLabel}
        </button>
        {/* Destructive dialogs focus the safe choice. */}
        <button type="button" className="btn btn--secondary" data-autofocus={dialog.tone === 'primary' ? undefined : ''} onClick={() => finish(false)}>
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

export function DialogHost() {
  const dialog = useUiStore((state) => state.dialog);
  if (!dialog) return null;

  // Keying by kind remounts the <dialog> when switching between dialogs.
  switch (dialog.kind) {
    case 'create-card':
      return <CreateCardDialog key="create-card" dialog={dialog} />;
    case 'edit-card':
      return <EditCardDialog key="edit-card" dialog={dialog} />;
    case 'move-card':
      return <MoveCardDialog key="move-card" dialog={dialog} />;
    case 'create-project':
      return <CreateProjectDialog key="create-project" dialog={dialog} />;
    case 'edit-project':
      return <EditProjectDialog key="edit-project" dialog={dialog} />;
    case 'ai-cards':
      return <AiCardsDialog key="ai-cards" {...(dialog.projectId ? { projectId: dialog.projectId } : {})} />;
    case 'create-shelf':
    case 'rename-shelf':
      return <ShelfDialog key={dialog.kind} dialog={dialog} />;
    case 'confirm':
      return <ConfirmDialog key="confirm" dialog={dialog} />;
  }
}
