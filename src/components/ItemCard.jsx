import { useI18n } from '../i18n/I18nProvider';
import ItemImage from './ItemImage';
import '../styles/items.css';

export default function ItemCard({ item, onOpen }) {
  const { pick } = useI18n();
  const title = pick(item, 'title');
  const description = pick(item, 'description');

  return (
    <button type="button" className="item-card" onClick={() => onOpen(item)}>
      <div className="item-card__media">
        <ItemImage filename={item.image_url} alt="" />
      </div>
      <div className="item-card__body">
        <h4>{title}</h4>
        {description && <p>{description}</p>}
      </div>
    </button>
  );
}
