import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useDismiss } from '../hooks/use-dismiss';
import { Icon, type IconName } from './Icon';

export interface ActionMenuItem {
  label: string;
  icon: IconName;
  onSelect: () => void;
  danger?: boolean;
}

/**
 * A compact "⋯" menu. Keeps long lists calm by hiding secondary actions
 * until asked for. Keyboard: arrows move, Escape closes and returns focus.
 */
export function ActionMenu({ label, items, className = '' }: { label: string; items: ActionMenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  // Open upward when there isn't room below, then focus the first item.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) {
      setPlacement('bottom');
      return;
    }
    if (menu.getBoundingClientRect().bottom > window.innerHeight - 8) setPlacement('top');
    menu.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const menuItems = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = menuItems.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (next: number) => menuItems[(next + menuItems.length) % menuItems.length]?.focus();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(menuItems.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const select = (item: ActionMenuItem) => {
    setOpen(false);
    // Focus the trigger first so a dialog opened by the item returns focus here.
    triggerRef.current?.focus();
    item.onSelect();
  };

  return (
    <div className={`action-menu ${className}`.trim()} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-btn action-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="more" size={20} />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className={`action-menu__list action-menu__list--${placement}`}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`action-menu__item${item.danger ? ' action-menu__item--danger' : ''}`}
              onClick={() => select(item)}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
