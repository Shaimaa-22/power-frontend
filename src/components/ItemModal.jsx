import { useEffect, useRef } from 'react';
import { LuX } from 'react-icons/lu';
import { useI18n } from '../i18n/I18nProvider';
import ItemImage from './ItemImage';
import '../styles/items.css';

export default function ItemModal({ item, categoryName, onClose }) {
  const { pick, t } = useI18n();
  const closeRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const title = pick(item, 'title');
  const description = pick(item, 'description');

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__dialog" role="dialog" aria-modal="true" aria-label={title}>
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
