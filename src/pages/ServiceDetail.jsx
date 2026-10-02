import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { matchesProduct, normalizeSearch } from '../lib/product-search';

export default function ServiceDetail() {
  const { slug } = useParams();
  const service = getService(slug);
  // Hooks must run unconditionally, so the real page lives in its own component.
  return service ? <ServiceContent key={slug} service={service} /> : <NotFound />;
}

function ServiceContent({ service }) {
  const { t, pick, dir } = useI18n();
  const { status, categories, partial, reload } = useServiceContent(service.slug);
  const [activeId, setActiveId] = useState('all');
  const [openItem, setOpenItem] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);
  const searching = Boolean(normalizeSearch(searchQuery));
  const searchPending = searchInput !== searchQuery;
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 3000);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    searchRef.current?.focus();
  };
  const categoryNav = useRef(null);
  const selectCategory = (id) => {
    setActiveId(id);
    requestAnimationFrame(() => {
      categoryNav.current?.scrollIntoView({ block: 'start' });
      const selected = categoryNav.current?.querySelector('[aria-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      selected?.focus({ preventScroll: true });
    });
  };

  const base = `services.items.${service.key}`;
  const title = t(`${base}.title`);
  usePageTitle(title);

  useEffect(() => setActiveId('all'), [service.slug]);

  const visible = useMemo(
    () => {
      const selected = activeId === 'all' ? categories : categories.filter(c => String(c.id) === String(activeId));
      return searching ? selected.map(c => ({ ...c, items: c.items.filter(item => matchesProduct(item, searchQuery)) })) : selected;
    },
    [categories, activeId, searchQuery, searching]
  );
  const resultCount = visible.reduce((sum, category) => sum + category.items.length, 0);
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

          {(status === 'error' || partial) && (
            <StateBox
              icon={<LuTriangleAlert aria-hidden="true" />}
              title={t(partial ? 'service_page.partial_title' : 'service_page.error_title')}
              text={t(partial ? 'service_page.partial_text' : 'service_page.error_text')}
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
              <div className="product-search">
                <label htmlFor="product-search">{t('service_page.search_label')}</label>
                <div className="product-search__field">
                  <input ref={searchRef} id="product-search" type="search" value={searchInput}
                    placeholder={t('service_page.search_placeholder')}
                    aria-describedby="product-search-status"
                    onChange={event => setSearchInput(event.target.value)} />
                  {(searchInput || searchQuery) && <button type="button" className="category-block__more" onClick={clearSearch}>{t('service_page.clear_search')}</button>}
                </div>
                <p id="product-search-status" role="status" aria-live="polite">
                  {searchPending ? '' : searching ? `${t('service_page.search_results')}: ${resultCount}` : ''}
                </p>
              </div>
              <div ref={categoryNav} className="pills" role="tablist" aria-label={t('service_page.categories')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeId === 'all'}
                  className={`pill${activeId === 'all' ? ' is-active' : ''}`}
                  onClick={() => selectCategory('all')}
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
                    onClick={() => selectCategory(c.id)}
                  >
                    {pick(c, 'name')}
                  </button>
                ))}
              </div>

              {!hasAnyItem && !partial && (
                <StateBox
                  icon={<LuLayers aria-hidden="true" />}
                  title={t('service_page.empty_title')}
                  text={t('service_page.empty_text')}
                  action={<Button to="/contact">{t('nav.contact')}</Button>}
                />
              )}

              {searching && resultCount === 0 && <p className="search-empty">{t('service_page.search_empty')}</p>}
              {visible.map((category) => {
                  // In the "All" view, skip categories that have nothing to show yet.
                  if ((activeId === 'all' || searching) && category.items.length === 0 && !category.loadError) return null;
                  return (
                    <div className="category-block" key={category.id}>
                      <div className="category-block__header">
                        <h2 className="category-block__title">{pick(category, 'name')}</h2>
                        {activeId === 'all' && !searching && category.items.length > 4 && (
                          <button type="button" className="category-block__more"
                            aria-label={`${t('service_page.view_all')}: ${pick(category, 'name')}`}
                            onClick={() => selectCategory(category.id)}>
                            {t('service_page.view_all')} ({category.items.length})
                          </button>
                        )}
                        {activeId !== 'all' && (
                          <button type="button" className="category-block__more" onClick={() => selectCategory('all')}>
                            {t('service_page.back_to_categories')}
                          </button>
                        )}
                      </div>
                      {category.loadError ? (
                        <p role="alert">{t('service_page.error_text')}</p>
                      ) : category.items.length === 0 ? (
                        <p className="category-block__empty">{t('service_page.empty_category')}</p>
                      ) : (
                        <div className="items-grid">
                          {(activeId === 'all' && !searching ? category.items.slice(0, 4) : category.items).map((item) => (
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
