import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuArrowLeft, LuArrowRight, LuTriangleAlert, LuRefreshCw, LuLayers } from 'react-icons/lu';
import { getService } from '../config/site';
import { useI18n } from '../i18n/I18nProvider';
import { Link, useParams } from '../router';
import { useServiceContent } from '../hooks/useServiceContent';
import { usePageTitle } from '../hooks/usePageTitle';
import PageHero from '../components/PageHero';
import CtaSection from '../components/CtaSection';
import ItemCard from '../components/ItemCard';
import ItemModal from '../components/ItemModal';
import Button from '../components/Button';
import { LoadingGrid, StateBox } from '../components/ContentState';
import NotFound from './NotFound';
import '../styles/items.css';

export default function ServiceDetail() {
  const { slug } = useParams();
  const service = getService(slug);
  // Hooks must run unconditionally, so the real page lives in its own component.
  return service ? <ServiceContent key={slug} service={service} /> : <NotFound />;
}

function ServiceContent({ service }) {
  const { t, pick, dir } = useI18n();
  const { status, categories, reload } = useServiceContent(service.slug);
  const [activeId, setActiveId] = useState('all');
  const [openItem, setOpenItem] = useState(null);

  const base = `services.items.${service.key}`;
  const title = t(`${base}.title`);
  usePageTitle(title);

  useEffect(() => setActiveId('all'), [service.slug]);

  const visible = useMemo(
    () => (activeId === 'all' ? categories : categories.filter((c) => String(c.id) === String(activeId))),
    [categories, activeId]
  );
  const hasAnyItem = categories.some((c) => c.items.length > 0);
  const closeModal = useCallback(() => setOpenItem(null), []);
  const BackIcon = dir === 'rtl' ? LuArrowRight : LuArrowLeft; // "back" points against the reading direction

  return (
    <>
      <PageHero
        eyebrow={t('services.eyebrow')}
        title={title}
        description={t(`${base}.description`)}
        image={service.image}
        imagePosition={service.imagePosition ?? '50% 40%'}
      >
        {Array.isArray(t(`${base}.tags`)) && (
          <ul className="chips">
            {t(`${base}.tags`).map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
      </PageHero>

      <section className="service-content">
        <div className="container">
          <Link to="/services" className="back-link">
            <BackIcon aria-hidden="true" />
            <span>{t('common.back_to_services')}</span>
          </Link>

          {status === 'loading' && <LoadingGrid label={t('common.loading')} />}

          {status === 'error' && (
            <StateBox
              icon={<LuTriangleAlert aria-hidden="true" />}
              title={t('service_page.error_title')}
              text={t('service_page.error_text')}
              action={
                <Button variant="outline-dark" size="sm" onClick={reload} icon={<LuRefreshCw aria-hidden="true" />}>
                  {t('common.retry')}
                </Button>
              }
            />
          )}

          {status === 'ready' && !hasAnyItem && categories.length === 0 && (
            <StateBox
              icon={<LuLayers aria-hidden="true" />}
              title={t('service_page.empty_title')}
              text={t('service_page.empty_text')}
              action={<Button to="/contact">{t('nav.contact')}</Button>}
            />
          )}

          {status === 'ready' && categories.length > 0 && (
            <>
              <div className="pills" role="tablist" aria-label={t('service_page.categories')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeId === 'all'}
                  className={`pill${activeId === 'all' ? ' is-active' : ''}`}
                  onClick={() => setActiveId('all')}
                >
                  {t('service_page.all')}
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={String(activeId) === String(c.id)}
                    className={`pill${String(activeId) === String(c.id) ? ' is-active' : ''}`}
                    onClick={() => setActiveId(c.id)}
                  >
                    {pick(c, 'name')}
                  </button>
                ))}
              </div>

              {!hasAnyItem && (
                <StateBox
                  icon={<LuLayers aria-hidden="true" />}
                  title={t('service_page.empty_title')}
                  text={t('service_page.empty_text')}
                  action={<Button to="/contact">{t('nav.contact')}</Button>}
                />
              )}

              {hasAnyItem &&
                visible.map((category) => {
                  // In the "All" view, skip categories that have nothing to show yet.
                  if (activeId === 'all' && category.items.length === 0) return null;
                  return (
                    <div className="category-block" key={category.id}>
                      <h2 className="category-block__title">{pick(category, 'name')}</h2>
                      {category.items.length === 0 ? (
                        <p className="category-block__empty">{t('service_page.empty_category')}</p>
                      ) : (
                        <div className="items-grid">
                          {category.items.map((item) => (
                            <ItemCard key={item.id} item={{ ...item, _category: category }} onOpen={setOpenItem} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </>
          )}
        </div>
      </section>

      <CtaSection />

      {openItem && <ItemModal item={openItem} categoryName={pick(openItem._category, 'name')} onClose={closeModal} />}
    </>
  );
}
