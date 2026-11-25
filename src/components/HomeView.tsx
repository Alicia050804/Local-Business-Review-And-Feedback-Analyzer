import { Search, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';
import {
  AnalysisState,
  Business,
  HighlightFilter,
  HighlightItem,
  OwnerDraft,
  ProfileTab,
} from '../types';
import { HERO_IMAGE_URL, getAverageRating } from '../data/seedBusinesses';
import { BusinessMedia } from './BusinessMedia';
import { StarRating } from './StarRating';
import { FeedbackInsightsPanel } from './FeedbackInsightsPanel';

interface HomeViewProps {
  businesses: Business[];
  highlights: HighlightItem[];
  highlightFilter: HighlightFilter;
  searchQuery: string;
  analysisCache: Record<string, AnalysisState>;
  featuredBusinessId: string;
  onSelectFeaturedBusiness: (id: string) => void;
  onRunAnalysis: (biz: Business, forceRefresh?: boolean) => void;
  onCreateOwnerPost: (bizId: string, draft: OwnerDraft) => void;
  onSearchChange: (value: string) => void;
  onHighlightFilterChange: (filter: HighlightFilter) => void;
  onOpenBusiness: (id: string, tab?: ProfileTab) => void;
}

const HIGHLIGHT_TABS: { key: HighlightFilter; label: string }[] = [
  { key: 'all', label: 'All Updates' },
  { key: 'specials', label: 'Specials' },
  { key: 'events', label: 'Events' },
  { key: 'jobs', label: 'Jobs' },
];

const HIGHLIGHT_TYPE_LABEL: Record<HighlightItem['type'], string> = {
  specials: 'Special',
  events: 'Event',
  jobs: 'Job Open',
};

const HIGHLIGHT_TYPE_TEXT_COLOR: Record<HighlightItem['type'], string> = {
  specials: 'text-orange-700',
  events: 'text-hibiscus',
  jobs: 'text-limefresh',
};

export function HomeView({
  businesses,
  highlights,
  highlightFilter,
  searchQuery,
  analysisCache,
  featuredBusinessId,
  onSelectFeaturedBusiness,
  onRunAnalysis,
  onCreateOwnerPost,
  onSearchChange,
  onHighlightFilterChange,
  onOpenBusiness,
}: HomeViewProps) {
  const [heroImgError, setHeroImgError] = useState(false);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredBusinesses = businesses.filter((biz) => {
    if (!normalizedQuery) return true;
    return (
      biz.name.toLowerCase().includes(normalizedQuery) ||
      biz.category.toLowerCase().includes(normalizedQuery) ||
      biz.description.toLowerCase().includes(normalizedQuery)
    );
  });

  const filteredHighlights = highlights.filter((item) => {
    if (highlightFilter !== 'all' && item.type !== highlightFilter) return false;
    if (!normalizedQuery) return true;
    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.details.toLowerCase().includes(normalizedQuery) ||
      item.bizName.toLowerCase().includes(normalizedQuery)
    );
  });

  const featuredBusiness =
    businesses.find((b) => b.id === featuredBusinessId) ?? businesses[0] ?? null;

  const scrollToInsights = () => {
    document.getElementById('insights-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-12">
      {/* Split Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-wide text-limefresh mb-3">
              Neighborhood Food Spots · Produce · Owner Feedback Insights
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-charcoal leading-[1.12] [text-wrap:balance]">
              Local Business Review &amp; Feedback Analyze
            </h1>
            <p className="text-stone-600 text-base sm:text-lg mt-4 max-w-2xl leading-relaxed">
              See what customers love about neighborhood services, spot what makes them unhappy, and give owners clear, practical steps to improve—alongside daily specials, events, and local jobs.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search spots, kotas, produce, specials..."
                aria-label="Search local businesses and highlights"
                className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-stone-300 bg-lemonade text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-mango focus:border-transparent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-charcoal p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={scrollToInsights}
              className="px-5 py-2.5 rounded-lg bg-charcoal hover:bg-stone-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              View Feedback Insights
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 min-h-[240px] lg:min-h-full bg-stone-100">
          {!heroImgError ? (
            <img
              src={HERO_IMAGE_URL}
              alt="Neighborhood market display with fresh mangoes, oranges, leafy greens, and sandwiches"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-100 via-amber-50 to-emerald-100 flex items-center justify-center p-8 text-center">
              <div>
                <p className="font-display font-bold text-xl text-charcoal">Fresh Market Board</p>
                <p className="text-sm text-stone-600 mt-1">Daily specials &amp; neighborhood produce</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Customer Service Feedback Insights Board */}
      {featuredBusiness && (
        <section id="insights-section" className="scroll-mt-24 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-charcoal">
                Service Feedback Analyzer
              </h2>
              <p className="text-sm text-stone-600 mt-1">
                Select a neighborhood spot to inspect what customers love, what causes frustration, and what the owner can do next.
              </p>
            </div>

            <div
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-lg self-start md:self-auto max-w-full"
              role="tablist"
              aria-label="Select business for feedback analysis"
            >
              {businesses.map((biz) => {
                const isSelected = biz.id === featuredBusiness.id;
                return (
                  <button
                    key={biz.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => onSelectFeaturedBusiness(biz.id)}
                    className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 max-w-[200px] truncate cursor-pointer ${
                      isSelected
                        ? 'bg-white text-charcoal shadow-xs'
                        : 'text-stone-600 hover:text-charcoal'
                    }`}
                  >
                    {biz.name}
                  </button>
                );
              })}
            </div>
          </div>

          <FeedbackInsightsPanel
            business={featuredBusiness}
            analysisState={analysisCache[featuredBusiness.id]}
            onRunAnalysis={(force) => onRunAnalysis(featuredBusiness, force)}
            onOpenProfile={() => onOpenBusiness(featuredBusiness.id, 'reviews')}
            onCreateOwnerPost={(draft) => onCreateOwnerPost(featuredBusiness.id, draft)}
          />
        </section>
      )}

      {/* Local Businesses Directory Grid */}
      <section id="directory-section" className="scroll-mt-24">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-charcoal">
              Local Food Spots &amp; Produce
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              Select a business to read customer reviews, view AI service insights, or post owner updates.
            </p>
          </div>
          <span className="text-sm font-semibold text-stone-600 tabular-nums whitespace-nowrap shrink-0">
            {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'Business' : 'Businesses'}
          </span>
        </div>

        {filteredBusinesses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
            <h3 className="font-display font-bold text-lg text-charcoal">
              No matching businesses found
            </h3>
            <p className="text-sm text-stone-500 mt-1">
              Try a different search term or add a new neighborhood business above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBusinesses.map((biz) => {
              const avg = getAverageRating(biz);
              const reviewCount = biz.reviews?.length || 0;
              const specialsCount = biz.specials?.length || 0;
              const jobsCount = biz.jobs?.length || 0;
              const insightData = analysisCache[biz.id]?.data;

              return (
                <article
                  key={biz.id}
                  onClick={() => onOpenBusiness(biz.id, 'reviews')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenBusiness(biz.id, 'reviews');
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className="bg-white rounded-2xl border border-stone-200 overflow-hidden hover:border-mango/60 hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mango"
                >
                  <div>
                    <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
                      <BusinessMedia
                        imageUrl={biz.imageUrl}
                        name={biz.name}
                        category={biz.category}
                        className="group-hover:scale-[1.02] transition-transform duration-200"
                      />
                    </div>

                    <div className="p-5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-stone-500 mb-2">
                        <span className="text-limefresh font-semibold">{biz.category}</span>
                        {specialsCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-orange-700 font-semibold tabular-nums">
                              {specialsCount} {specialsCount === 1 ? 'Special' : 'Specials'}
                            </span>
                          </>
                        )}
                        {jobsCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-charcoal font-semibold">Hiring</span>
                          </>
                        )}
                      </div>

                      <h3 className="font-display text-lg font-bold text-charcoal group-hover:text-mango transition-colors leading-snug">
                        {biz.name}
                      </h3>
                      <p className="text-sm text-stone-600 mt-2 line-clamp-2 leading-relaxed">
                        {biz.description}
                      </p>

                      {insightData && (
                        <div className="mt-4 pt-3.5 border-t border-stone-100 space-y-1.5 text-xs leading-relaxed">
                          {insightData.loves[0] && (
                            <p className="text-stone-700 line-clamp-1">
                              <span className="font-semibold text-limefresh">Loved: </span>
                              {insightData.loves[0].point}
                            </p>
                          )}
                          {insightData.unhappy[0] && (
                            <p className="text-stone-700 line-clamp-1">
                              <span className="font-semibold text-hibiscus">Unhappy: </span>
                              {insightData.unhappy[0].point}
                            </p>
                          )}
                          {insightData.actions[0] && (
                            <p className="text-stone-700 line-clamp-1">
                              <span className="font-semibold text-orange-700">Improve: </span>
                              {insightData.actions[0].action}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-5 py-3.5 border-t border-stone-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StarRating rating={avg} size="sm" />
                      <span className="text-sm font-bold text-charcoal tabular-nums">
                        {avg > 0 ? avg.toFixed(1) : 'New'}
                      </span>
                      <span className="text-xs text-stone-500 tabular-nums">
                        ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-mango">
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Community Highlights Board */}
      <section id="highlights-section" className="scroll-mt-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-charcoal">
              Community Highlights
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              Fresh daily deals, upcoming neighborhood events, and open local jobs.
            </p>
          </div>

          <div
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-lg self-start md:self-auto"
            role="tablist"
            aria-label="Filter community highlights"
          >
            {HIGHLIGHT_TABS.map((tab) => {
              const isActive = highlightFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onHighlightFilterChange(tab.key)}
                  className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-white text-charcoal shadow-xs'
                      : 'text-stone-600 hover:text-charcoal'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredHighlights.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-stone-600">
              No community highlights match your current filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredHighlights.slice(0, 6).map((item) => (
              <button
                key={`${item.bizId}-${item.id}`}
                type="button"
                onClick={() => onOpenBusiness(item.bizId, 'updates')}
                className="text-left bg-white rounded-xl border border-stone-200 p-5 hover:border-mango/60 hover:-translate-y-0.5 transition-all duration-150 flex flex-col justify-between gap-4 cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-stone-500 mb-2">
                    <span className={`font-semibold ${HIGHLIGHT_TYPE_TEXT_COLOR[item.type]}`}>
                      {HIGHLIGHT_TYPE_LABEL[item.type]}
                    </span>
                    {item.date && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{item.date}</span>
                      </>
                    )}
                  </div>
                  <h3 className="font-display font-bold text-base text-charcoal group-hover:text-mango transition-colors line-clamp-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-stone-600 mt-1.5 line-clamp-2 leading-relaxed">
                    {item.details}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-charcoal">
                  <span className="truncate">{item.bizName}</span>
                  <span className="inline-flex items-center gap-1 text-mango shrink-0 ml-2">
                    <span>View</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
