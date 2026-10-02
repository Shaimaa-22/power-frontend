import { useEffect, useRef } from 'react';
import { LuX } from 'react-icons/lu';
import { useI18n } from '../i18n/I18nProvider';
import ItemImage from './ItemImage';
import '../styles/items.css';

export default function ItemModal({ item, categoryName, onClose }) {
  const { pick, t } = useI18n();
  const closeRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const focusableElements = () => Array.from(dialogRef.current?.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]'
    ) ?? []).filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
    const keepFocusInside = (e) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target)) {
        (focusableElements()[0] || dialogRef.current).focus();
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const elements = focusableElements();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          e.preventDefault();
          dialogRef.current?.focus();
        } else if (!elements.includes(document.activeElement) ||
          (e.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', keepFocusInside);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', keepFocusInside);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const title = pick(item, 'title');
  const description = pick(item, 'description');

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} tabIndex={-1} className="modal__dialog" role="dialog" aria-modal="true" aria-label={title}>
        <button ref={closeRef} type="button" className="modal__close" onClick={onClose} aria-label={t('common.close')}>
          <LuX aria-hidden="true" />
        </button>
        <div className="modal__media">
          <ItemImage filename={item.image_url} alt={title} loading="eager" />
        </div>
        <div className="modal__body">
          {categoryName && <p className="eyebrow eyebrow--plain">{categoryName}</p>}
          <h3>{title}</h3>
          {description && <p className="modal__desc">{description}</p>}
        </div>
      </div>
    </div>
  );
}
