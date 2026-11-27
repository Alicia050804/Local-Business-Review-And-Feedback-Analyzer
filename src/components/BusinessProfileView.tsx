import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CornerDownRight,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import {
  AnalysisState,
  Business,
  OwnerDraft,
  PostCategoryKey,
  ProfileTab,
} from '../types';
import { getAverageRating } from '../data/seedBusinesses';
import { BusinessMedia } from './BusinessMedia';
import { StarRating } from './StarRating';
import { FeedbackInsightsPanel } from './FeedbackInsightsPanel';

interface BusinessProfileViewProps {
  business: Business;
  activeTab: ProfileTab;
  analysisState?: AnalysisState;
  ownerDraft?: OwnerDraft | null;
  isSignedIn: boolean;
  canManageBusiness?: boolean;
  portableMode: boolean;
  onClearOwnerDraft?: () => void;
  onBack: () => void;
  onOpenStaffPortal: () => void;
  onSignIn: () => void;
  onTabChange: (tab: ProfileTab) => void;
  onRunAnalysis: (forceRefresh?: boolean) => void;
  onCreateOwnerPostFromAction: (draft: OwnerDraft) => void;
  onSubmitReview: (input: { author: string; rating: number; comment: string }) => void;
  onSubmitOwnerPost: (input: {
    type: PostCategoryKey;
    date: string;
    title: string;
    details: string;
  }) => void;
}

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: 'reviews', label: 'Reviews & AI Insights' },
  { id: 'updates', label: 'Specials, Events & Jobs' },
  { id: 'owner', label: 'Owner Update Portal' },
];

type ReviewSentimentFilter = 'all' | 'positive' | 'attention' | 'replied';

export function BusinessProfileView({
  business,
  activeTab,
  analysisState,
  ownerDraft,
  isSignedIn,
  canManageBusiness = true,
  portableMode,
  onClearOwnerDraft,
  onBack,
  onOpenStaffPortal,
  onSignIn,
  onTabChange,
  onRunAnalysis,
  onCreateOwnerPostFromAction,
  onSubmitReview,
  onSubmitOwnerPost,
}: BusinessProfileViewProps) {
  const [reviewAuthor, setReviewAuthor] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewFilter, setReviewFilter] = useState<ReviewSentimentFilter>('all');

  const [postType, setPostType] = useState<PostCategoryKey>('specials');
  const [postDate, setPostDate] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postDetails, setPostDetails] = useState('');

  useEffect(() => {
    if (!ownerDraft) return;
    setPostType(ownerDraft.type);
    setPostDate(ownerDraft.date);
    setPostTitle(ownerDraft.title);
    setPostDetails(ownerDraft.details);
    onClearOwnerDraft?.();
  }, [ownerDraft, onClearOwnerDraft]);

  const avg = getAverageRating(business);
  const reviewCount = business.reviews.length;
  const replyCount = business.reviews.filter((r) => Boolean(r.ownerReply)).length;

  const filteredReviews = business.reviews
    .slice()
    .reverse()
    .filter((rev) => {
      if (reviewFilter === 'positive') return rev.rating >= 4;
      if (reviewFilter === 'attention') return rev.rating <= 3;
      if (reviewFilter === 'replied') return Boolean(rev.ownerReply);
      return true;
    });

  const handleReviewFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    const author = reviewAuthor.trim();
    const comment = reviewComment.trim();
    if (!author || !comment) return;

    onSubmitReview({ author, rating: reviewRating, comment });
    setReviewAuthor('');
    setReviewRating(5);
    setReviewComment('');
  };

  const handleOwnerFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    const date = postDate.trim();
    const title = postTitle.trim();
    const details = postDetails.trim();
    if (!date || !title || !details) return;

    onSubmitOwnerPost({ type: postType, date, title, details });
    setPostDate('');
    setPostTitle('');
    setPostDetails('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-mango transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to All Local Businesses</span>
        </button>

        <button
          type="button"
          onClick={onOpenStaffPortal}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-limefresh hover:underline underline-offset-2 cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          <span>Owner &amp; Staff Login to Reply</span>
        </button>
      </div>

      {/* Business Profile Hero */}
      <section className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-4 aspect-[4/3] lg:aspect-auto lg:min-h-[240px] bg-stone-100">
            <BusinessMedia
              imageUrl={business.imageUrl}
              name={business.name}
              category={business.category}
            />
          </div>

          <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500 mb-2">
                  <span className="font-semibold text-limefresh">{business.category}</span>
                  {business.specials.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-orange-700 tabular-nums">
                        {business.specials.length} Active{' '}
                        {business.specials.length === 1 ? 'Special' : 'Specials'}
                      </span>
                    </>
                  )}
                  {business.jobs.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-charcoal tabular-nums">
                        {business.jobs.length} Job {business.jobs.length === 1 ? 'Opening' : 'Openings'}
                      </span>
                    </>
                  )}
                </div>

                <h1 className="font-display text-2xl sm:text-3xl font-bold text-charcoal [text-wrap:balance]">
                  {business.name}
                </h1>
                <p className="text-sm sm:text-base text-stone-600 mt-2 max-w-2xl leading-relaxed">
                  {business.description}
                </p>
              </div>

              <div className="bg-lemonade border border-stone-200 rounded-xl px-5 py-3.5 text-center shrink-0 self-start">
                <div className="font-display text-3xl font-bold text-charcoal tabular-nums">
                  {avg > 0 ? avg.toFixed(1) : '—'}
                </div>
                <div className="my-1 flex justify-center">
                  <StarRating rating={avg} size="md" />
                </div>
                <div className="text-xs font-medium text-stone-500 tabular-nums">
                  {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                </div>
              </div>
            </div>

            <div
              className="flex flex-wrap items-center gap-1.5 pt-4 border-t border-stone-100"
              role="tablist"
              aria-label="Business profile sections"
            >
              {PROFILE_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onTabChange(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-mango text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Tab 1: Reviews & AI Insights */}
      {activeTab === 'reviews' && (
        <div className="space-y-8">
          <FeedbackInsightsPanel
            business={business}
            analysisState={analysisState}
            onRunAnalysis={onRunAnalysis}
            onCreateOwnerPost={onCreateOwnerPostFromAction}
          />

          {/* Send Feedback + Community Feedback List */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <section className="lg:col-span-4 bg-white rounded-2xl border border-stone-200 p-6">
              <h3 className="font-display text-lg font-bold text-charcoal">
                Send Community Feedback
              </h3>
              <p className="text-xs text-stone-500 mt-1 mb-5 leading-relaxed">
                Your feedback goes directly to {business.name}&apos;s Staff Portal. When the owner replies, it appears right below your comment.
              </p>

              <form onSubmit={handleReviewFormSubmit} className="space-y-4">
                <div>
                  <label htmlFor="review-author" className="block text-xs font-semibold text-charcoal mb-1.5">
                    Your Name
                  </label>
                  <input
                    id="review-author"
                    required
                    type="text"
                    maxLength={60}
                    value={reviewAuthor}
                    onChange={(e) => setReviewAuthor(e.target.value)}
                    placeholder="e.g., Sipho M."
                    className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-mango focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="review-rating" className="block text-xs font-semibold text-charcoal mb-1.5">
                    Star Rating
                  </label>
                  <select
                    id="review-rating"
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-sm font-medium text-charcoal focus:outline-none focus:ring-2 focus:ring-mango focus:border-transparent"
                  >
                    <option value={5}>5 Stars — Amazing</option>
                    <option value={4}>4 Stars — Really Good</option>
                    <option value={3}>3 Stars — Okay</option>
                    <option value={2}>2 Stars — Needs Work</option>
                    <option value={1}>1 Star — Poor</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="review-comment" className="block text-xs font-semibold text-charcoal mb-1.5">
                    Your Feedback
                  </label>
                  <textarea
                    id="review-comment"
                    required
                    rows={3}
                    maxLength={1000}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="How was the food, freshness, wait time, or service?"
                    className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-mango focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-mango hover:bg-orange-600 text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  Send Feedback
                </button>

                {!isSignedIn && !portableMode && (
                  <p className="text-xs text-stone-500 leading-relaxed pt-1">
                    Posting as guest saves in this browser.{' '}
                    <button
                      type="button"
                      onClick={onSignIn}
                      className="text-limefresh font-semibold hover:underline cursor-pointer"
                    >
                      Sign in with Google
                    </button>{' '}
                    to publish directly to the live Staff Portal across devices.
                  </p>
                )}
              </form>
            </section>

            <section className="lg:col-span-8 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="font-display text-lg font-bold text-charcoal tabular-nums">
                    Community Feedback ({reviewCount})
                  </h3>
                  {replyCount > 0 && (
                    <>
                      <span aria-hidden="true" className="text-stone-300">
                        ·
                      </span>
                      <span className="text-xs font-semibold text-limefresh tabular-nums">
                        {replyCount} {replyCount === 1 ? 'owner reply' : 'owner replies'}
                      </span>
                    </>
                  )}
                </div>

                {reviewCount > 0 && (
                  <div
                    className="inline-flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-lg self-start sm:self-auto"
                    role="tablist"
                    aria-label="Filter customer reviews"
                  >
                    {(
                      [
                        { key: 'all', label: 'All' },
                        { key: 'positive', label: 'Positive (4–5★)' },
                        { key: 'attention', label: 'Needs Attention (1–3★)' },
                        { key: 'replied', label: 'Owner Replied' },
                      ] as const
                    ).map((item) => {
                      const active = reviewFilter === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setReviewFilter(item.key)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? 'bg-white text-charcoal shadow-xs'
                              : 'text-stone-600 hover:text-charcoal'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {reviewCount === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-sm text-stone-500">
                  No feedback yet. Be the first neighbor to share feedback with {business.name}.
                </div>
              ) : filteredReviews.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-500">
                  No feedback matches this filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReviews.map((rev) => (
                    <article
                      key={rev.id}
                      className="bg-white rounded-xl border border-stone-200 p-5"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-800 font-display font-bold text-sm flex items-center justify-center shrink-0">
                            {rev.author.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-charcoal">
                              {rev.author}
                            </div>
                            <div className="text-xs text-stone-400 tabular-nums">
                              {rev.date}
                            </div>
                          </div>
                        </div>
                        <StarRating rating={rev.rating} size="sm" />
                      </div>

                      <p className="text-sm text-stone-700 leading-relaxed">{rev.comment}</p>

                      {rev.ownerReply && (
                        <div className="mt-4 pt-3.5 border-t border-stone-100 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-limefresh">
                            <CornerDownRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>{rev.ownerReply.authorRole} Replied</span>
                            <span aria-hidden="true" className="text-stone-300">
                              ·
                            </span>
                            <span className="text-charcoal">{rev.ownerReply.authorName}</span>
                            <span aria-hidden="true" className="text-stone-300">
                              ·
                            </span>
                            <span className="text-stone-400 font-normal tabular-nums">
                              {rev.ownerReply.date}
                            </span>
                          </div>
                          <p className="text-sm text-charcoal leading-relaxed pl-5">
                            {rev.ownerReply.message}
                          </p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Tab 2: Specials, Events & Jobs */}
      {activeTab === 'updates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-charcoal flex items-center gap-2">
                <Tag className="w-4 h-4 text-mango" aria-hidden="true" />
                <span>Daily &amp; Weekly Specials</span>
              </h2>
              <span className="text-xs font-semibold text-stone-500 tabular-nums">
                {business.specials.length}
              </span>
            </div>

            {business.specials.length === 0 ? (
              <p className="text-sm text-stone-500 bg-lemonade rounded-xl p-4 border border-stone-100">
                No active specials posted yet.
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {business.specials.map((sp) => (
                  <div key={sp.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="text-xs font-semibold text-orange-700 mb-1">{sp.date}</div>
                    <h3 className="font-display font-bold text-base text-charcoal">{sp.title}</h3>
                    <p className="text-sm text-stone-700 mt-1 leading-relaxed">{sp.details}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-charcoal flex items-center gap-2">
                <Calendar className="w-4 h-4 text-hibiscus" aria-hidden="true" />
                <span>Upcoming Local Events</span>
              </h2>
              <span className="text-xs font-semibold text-stone-500 tabular-nums">
                {business.events.length}
              </span>
            </div>

            {business.events.length === 0 ? (
              <p className="text-sm text-stone-500 bg-lemonade rounded-xl p-4 border border-stone-100">
                No upcoming events posted yet.
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {business.events.map((ev) => (
                  <div key={ev.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="text-xs font-semibold text-hibiscus mb-1">{ev.date}</div>
                    <h3 className="font-display font-bold text-base text-charcoal">{ev.title}</h3>
                    <p className="text-sm text-stone-700 mt-1 leading-relaxed">{ev.details}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-charcoal flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-limefresh" aria-hidden="true" />
                <span>Job Opportunities</span>
              </h2>
              <span className="text-xs font-semibold text-stone-500 tabular-nums">
                {business.jobs.length}
              </span>
            </div>

            {business.jobs.length === 0 ? (
              <p className="text-sm text-stone-500 bg-lemonade rounded-xl p-4 border border-stone-100">
                No open job listings right now.
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {business.jobs.map((jb) => (
                  <div key={jb.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="text-xs font-semibold text-limefresh mb-1">{jb.date}</div>
                    <h3 className="font-display font-bold text-base text-charcoal">{jb.title}</h3>
                    <p className="text-sm text-stone-700 mt-1 leading-relaxed">{jb.details}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab 3: Owner Update Portal */}
      {activeTab === 'owner' && (
        <section className="max-w-2xl mx-auto bg-white rounded-2xl border border-stone-200 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <p className="text-xs font-semibold text-limefresh mb-1">
                Owner Noticeboard Portal
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-charcoal">
                Post an Update for {business.name}
              </h2>
              <p className="text-sm text-stone-600 mt-1">
                New specials, events, and jobs appear immediately on your profile and the home Community Highlights board.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenStaffPortal}
              className="px-3.5 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-charcoal whitespace-nowrap shrink-0 self-start cursor-pointer"
            >
              Open Feedback Inbox
            </button>
          </div>

          {!canManageBusiness && !portableMode ? (
            <div className="border-t border-stone-200 pt-5 space-y-4">
              <p className="text-sm text-stone-600 leading-relaxed">
                {isSignedIn
                  ? `Only ${business.name}'s owner, authorized staff, or directory admin can publish official updates here.`
                  : `Sign in with an owner or staff Google account for ${business.name} to publish official specials, events, or jobs.`}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={isSignedIn ? onOpenStaffPortal : onSignIn}
                  className="px-5 py-2.5 rounded-lg bg-limefresh hover:bg-emerald-700 text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  {isSignedIn ? 'Open Staff Portal' : 'Sign in with Google'}
                </button>
              </div>
            </div>
          ) : (
          <form onSubmit={handleOwnerFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="owner-post-type" className="block text-sm font-semibold text-charcoal mb-1.5">
                  Post Type
                </label>
                <select
                  id="owner-post-type"
                  value={postType}
                  onChange={(e) => setPostType(e.target.value as PostCategoryKey)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm font-medium text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
                >
                  <option value="specials">Daily / Weekly Special</option>
                  <option value="events">Upcoming Local Event</option>
                  <option value="jobs">Job Opportunity</option>
                </select>
              </div>

              <div>
                <label htmlFor="owner-post-date" className="block text-sm font-semibold text-charcoal mb-1.5">
                  Date / Schedule
                </label>
                <input
                  id="owner-post-date"
                  required
                  type="text"
                  value={postDate}
                  onChange={(e) => setPostDate(e.target.value)}
                  placeholder="e.g., Today 12:00–15:00"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="owner-post-title" className="block text-sm font-semibold text-charcoal mb-1.5">
                Title
              </label>
              <input
                id="owner-post-title"
                required
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="e.g., Lunchtime Kota & Cold Drink Combo"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="owner-post-details" className="block text-sm font-semibold text-charcoal mb-1.5">
                Details / Price / Pay &amp; How to Apply
              </label>
              <textarea
                id="owner-post-details"
                required
                rows={3}
                value={postDetails}
                onChange={(e) => setPostDetails(e.target.value)}
                placeholder="Include price, event highlights, or pay rate and how neighbors should apply..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-lg bg-limefresh hover:bg-emerald-700 text-white font-semibold text-sm transition-colors cursor-pointer"
              >
                Publish to Community Board
              </button>
            </div>
          </form>
          )}
        </section>
      )}
    </div>
  );
}
