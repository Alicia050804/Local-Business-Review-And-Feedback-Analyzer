import {
  AlertTriangle,
  ArrowRight,
  Heart,
  Lightbulb,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { AnalysisState, Business, OwnerDraft } from '../types';
import { getAverageRating } from '../data/seedBusinesses';
import { StarRating } from './StarRating';

interface FeedbackInsightsPanelProps {
  business: Business;
  analysisState?: AnalysisState;
  onRunAnalysis: (forceRefresh?: boolean) => void;
  onCreateOwnerPost?: (draft: OwnerDraft) => void;
  onOpenProfile?: () => void;
}

export function FeedbackInsightsPanel({
  business,
  analysisState,
  onRunAnalysis,
  onCreateOwnerPost,
  onOpenProfile,
}: FeedbackInsightsPanelProps) {
  const reviewCount = business.reviews.length;
  const avg = getAverageRating(business);
  const positiveCount = business.reviews.filter((r) => r.rating >= 4).length;
  const criticalCount = business.reviews.filter((r) => r.rating <= 3).length;
  const positivePct = reviewCount > 0 ? Math.round((positiveCount / reviewCount) * 100) : 0;

  return (
    <section
      aria-label={`Customer feedback insights for ${business.name}`}
      className="bg-white rounded-2xl border border-stone-200 overflow-hidden"
    >
      {/* Panel Header */}
      <div className="p-6 sm:px-7 sm:py-6 border-b border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-stone-500">
            <span className="font-semibold text-limefresh">Customer Service Feedback Insights</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-charcoal">{business.name}</span>
            {reviewCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <StarRating rating={avg} size="sm" />
                  <span className="font-semibold text-charcoal">{avg.toFixed(1)}</span>
                  <span>
                    ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                  </span>
                </span>
              </>
            )}
          </div>

          <h2 className="font-display text-xl sm:text-2xl font-bold text-charcoal [text-wrap:balance]">
            What Customers Love, Friction Points &amp; Owner Improvements
          </h2>

          {reviewCount > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-stone-600 tabular-nums">
              <span className="font-medium text-limefresh">
                {positiveCount} positive ({positivePct}% rated 4–5★)
              </span>
              <span aria-hidden="true" className="text-stone-300">
                /
              </span>
              <span className="font-medium text-hibiscus">
                {criticalCount} {criticalCount === 1 ? 'review' : 'reviews'} with improvement notes (1–3★)
              </span>
              <div
                className="w-28 h-1.5 rounded-full bg-rose-100 overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="h-full bg-limefresh transition-all duration-300"
                  style={{ width: `${positivePct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-charcoal text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Read All Reviews</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onRunAnalysis(true)}
            disabled={analysisState?.loading || reviewCount === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-charcoal hover:bg-stone-800 text-white text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-mango" aria-hidden="true" />
            <span>
              {analysisState?.loading
                ? 'Analyzing Feedback...'
                : analysisState?.data
                  ? 'Refresh AI Analysis'
                  : 'Analyze Customer Feedback'}
            </span>
          </button>
        </div>
      </div>

      {/* Body States */}
      {analysisState?.loading ? (
        <div className="p-6 sm:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-48 rounded-xl shimmer" />
            <div className="h-48 rounded-xl shimmer" />
            <div className="h-48 rounded-xl shimmer" />
          </div>
          <p className="text-center text-xs font-medium text-stone-500 mt-4 tabular-nums">
            Analyzing {reviewCount} customer {reviewCount === 1 ? 'review' : 'reviews'} for {business.name}...
          </p>
        </div>
      ) : analysisState?.error ? (
        <div className="p-6 sm:p-7">
          <div className="rounded-xl border border-hibiscus/30 bg-rose-50/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-bold text-sm text-hibiscus">
                Could Not Complete AI Feedback Analysis
              </h3>
              <p className="text-sm text-stone-700 mt-1">{analysisState.error}</p>
            </div>
            <button
              type="button"
              onClick={() => onRunAnalysis(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-hibiscus/40 bg-white text-hibiscus text-xs font-semibold hover:bg-rose-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Retry Analysis</span>
            </button>
          </div>
        </div>
      ) : reviewCount === 0 ? (
        <div className="p-8 text-center bg-lemonade">
          <p className="text-sm text-stone-600">
            No customer reviews yet for <strong className="text-charcoal">{business.name}</strong>. Once neighbors post reviews, AI insights on what customers love, pain points, and owner actions will appear here.
          </p>
        </div>
      ) : analysisState?.data ? (
        <div>
          {analysisState.data.summary && (
            <div className="px-6 sm:px-7 py-4 bg-lemonade border-b border-stone-200 text-sm text-stone-700 leading-relaxed">
              <span className="font-semibold text-charcoal">Overall Service Takeaway: </span>
              {analysisState.data.summary}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-stone-200">
            {/* Column 1: What Customers Love */}
            <div className="p-6 sm:p-7 bg-emerald-50/25">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="font-display font-bold text-base text-limefresh flex items-center gap-2">
                  <Heart className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>What Customers Love</span>
                </h3>
                <span className="text-xs font-semibold text-stone-500 tabular-nums">
                  {analysisState.data.loves.length} strengths
                </span>
              </div>

              <ul className="divide-y divide-stone-200/70">
                {analysisState.data.loves.map((item, idx) => (
                  <li key={idx} className="py-3 first:pt-0 last:pb-0">
                    <div className="font-semibold text-sm text-charcoal leading-snug">
                      {item.point}
                    </div>
                    {item.evidence && (
                      <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
                        {item.evidence}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 2: What Customers Are Unhappy About */}
            <div className="p-6 sm:p-7 bg-rose-50/25">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="font-display font-bold text-base text-hibiscus flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>What Customers Are Unhappy About</span>
                </h3>
                <span className="text-xs font-semibold text-stone-500 tabular-nums">
                  {analysisState.data.unhappy.length} {analysisState.data.unhappy.length === 1 ? 'issue' : 'issues'}
                </span>
              </div>

              <ul className="divide-y divide-stone-200/70">
                {analysisState.data.unhappy.map((item, idx) => (
                  <li key={idx} className="py-3 first:pt-0 last:pb-0">
                    <div className="font-semibold text-sm text-charcoal leading-snug">
                      {item.point}
                    </div>
                    {item.impact && (
                      <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
                        {item.impact}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: What Owners Can Do to Improve */}
            <div className="p-6 sm:p-7 bg-orange-50/25">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="font-display font-bold text-base text-orange-700 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>What Owners Can Do to Improve</span>
                </h3>
                <span className="text-xs font-semibold text-stone-500 tabular-nums">
                  {analysisState.data.actions.length} steps
                </span>
              </div>

              <ul className="divide-y divide-stone-200/70">
                {analysisState.data.actions.map((item, idx) => (
                  <li key={idx} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 mb-1">
                      <span className="tabular-nums">0{idx + 1}.</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.timeframe}</span>
                    </div>
                    <div className="font-semibold text-sm text-charcoal leading-snug">
                      {item.action}
                    </div>
                    {item.expectedOutcome && (
                      <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
                        <span className="font-medium text-stone-700">Impact: </span>
                        {item.expectedOutcome}
                      </p>
                    )}
                    {onCreateOwnerPost && item.suggestedPostType && item.suggestedPostTitle && item.suggestedPostDetails && (
                      <button
                        type="button"
                        onClick={() =>
                          onCreateOwnerPost({
                            type: item.suggestedPostType!,
                            title: item.suggestedPostTitle!,
                            details: item.suggestedPostDetails!,
                            date: 'Starting This Week',
                          })
                        }
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-limefresh hover:text-emerald-800 hover:underline underline-offset-2 transition-colors cursor-pointer"
                      >
                        <span>Post this as an owner update</span>
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-lemonade">
          <p className="text-sm text-stone-600">
            Click <strong className="text-charcoal">Analyze Customer Feedback</strong> to reveal what customers love, what makes them unhappy, and concrete owner improvements.
          </p>
        </div>
      )}
    </section>
  );
}
