import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CornerDownRight,
  KeyRound,
  LogIn,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  AnalysisState,
  Business,
  DemoStaffSession,
  OwnerDraft,
  OwnerReply,
  PostCategoryKey,
  Review,
  StaffMember,
  StaffRole,
} from '../types';
import { getAverageRating } from '../data/seedBusinesses';
import { StarRating } from './StarRating';
import { FeedbackInsightsPanel } from './FeedbackInsightsPanel';

export interface DemoSandboxInfo {
  enabled: boolean;
  email: string;
  accessCode?: string;
  requiresConfiguredPasscode?: boolean;
  displayName?: string;
  role?: StaffRole;
}

interface StaffPortalViewProps {
  user: User | null;
  demoSession: DemoStaffSession | null;
  demoSandbox: DemoSandboxInfo | null;
  authError: string | null;
  isAdmin: boolean;
  loadingStaffAccess?: boolean;
  portableMode: boolean;
  businesses: Business[];
  managedBusinessIds: string[];
  staffByBusiness: Record<string, StaffMember[]>;
  analysisCache: Record<string, AnalysisState>;
  selectedBusinessId: string;
  onSelectBusiness: (id: string) => void;
  onBackToCommunity: () => void;
  onSignIn: () => void;
  onSignInDemo: (email: string, accessCode: string) => Promise<{ ok: boolean; error?: string }>;
  onSignOut: () => void;
  onOpenAddBusiness: () => void;
  onReplyToReview: (businessId: string, reviewId: string, reply: OwnerReply) => Promise<void>;
  onRunAnalysis: (biz: Business, forceRefresh?: boolean) => void;
  onPublishPost: (
    businessId: string,
    input: { type: PostCategoryKey; date: string; title: string; details: string }
  ) => void;
  onAddStaffMember: (business: Business, email: string, role: StaffRole) => Promise<void>;
  onRemoveStaffMember: (businessId: string, memberId: string) => Promise<void>;
}

type PortalTab = 'inbox' | 'insights' | 'updates' | 'staff';
type InboxFilter = 'unreplied' | 'all' | 'replied';

export function StaffPortalView({
  user,
  demoSession,
  demoSandbox,
  authError,
  isAdmin,
  loadingStaffAccess = false,
  portableMode,
  businesses,
  managedBusinessIds,
  staffByBusiness,
  analysisCache,
  selectedBusinessId,
  onSelectBusiness,
  onBackToCommunity,
  onSignIn,
  onSignInDemo,
  onSignOut,
  onOpenAddBusiness,
  onReplyToReview,
  onRunAnalysis,
  onPublishPost,
  onAddStaffMember,
  onRemoveStaffMember,
}: StaffPortalViewProps) {
  const [portalTab, setPortalTab] = useState<PortalTab>('inbox');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');
  const [inboxSearch, setInboxSearch] = useState('');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyAuthorName, setReplyAuthorName] = useState(
    () => user?.displayName || demoSession?.displayName || 'Business Owner'
  );
  const [replyRole, setReplyRole] = useState<StaffRole>(
    () => demoSession?.role || 'Owner'
  );
  const [submittingReviewId, setSubmittingReviewId] = useState<string | null>(null);

  const [demoEmail, setDemoEmail] = useState(() => demoSandbox?.email || '');
  const [demoCode, setDemoCode] = useState(() => demoSandbox?.accessCode || '');
  const [demoLoginError, setDemoLoginError] = useState<string | null>(null);
  const [demoLoggingIn, setDemoLoggingIn] = useState(false);

  const [postType, setPostType] = useState<PostCategoryKey>('specials');
  const [postDate, setPostDate] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postDetails, setPostDetails] = useState('');

  const [staffEmailInput, setStaffEmailInput] = useState('');
  const [staffRoleInput, setStaffRoleInput] = useState<StaffRole>('Staff');
  const [addingStaff, setAddingStaff] = useState(false);

  useEffect(() => {
    if (user?.displayName) {
      setReplyAuthorName(user.displayName);
    } else if (demoSession?.displayName) {
      setReplyAuthorName(demoSession.displayName);
      setReplyRole(demoSession.role);
    }
  }, [user?.displayName, demoSession]);

  useEffect(() => {
    if (demoSandbox?.email && !demoEmail) {
      setDemoEmail(demoSandbox.email);
    }
    if (demoSandbox?.accessCode && !demoCode) {
      setDemoCode(demoSandbox.accessCode);
    }
  }, [demoSandbox, demoEmail, demoCode]);

  const isAuthenticated = Boolean(user || demoSession || portableMode);

  const managedBusinesses = useMemo(
    () =>
      businesses.filter(
        (b) =>
          portableMode ||
          Boolean(demoSession) ||
          isAdmin ||
          managedBusinessIds.includes(b.id)
      ),
    [businesses, portableMode, demoSession, isAdmin, managedBusinessIds]
  );

  const activeBusiness =
    managedBusinesses.find((b) => b.id === selectedBusinessId) ?? managedBusinesses[0] ?? null;

  const canManageTeam = Boolean(
    activeBusiness &&
      user &&
      !demoSession &&
      (isAdmin || activeBusiness.ownerId === user.uid)
  );

  useEffect(() => {
    if (activeBusiness && activeBusiness.id !== selectedBusinessId) {
      onSelectBusiness(activeBusiness.id);
    }
  }, [activeBusiness, selectedBusinessId, onSelectBusiness]);

  const reviews = activeBusiness?.reviews ?? [];
  const unrepliedCount = reviews.filter((r) => !r.ownerReply).length;
  const repliedCount = reviews.filter((r) => Boolean(r.ownerReply)).length;
  const avgRating = activeBusiness ? getAverageRating(activeBusiness) : 0;

  const filteredReviews = useMemo(() => {
    const queryText = inboxSearch.trim().toLowerCase();
    return reviews
      .slice()
      .reverse()
      .filter((rev) => {
        if (inboxFilter === 'unreplied' && rev.ownerReply) return false;
        if (inboxFilter === 'replied' && !rev.ownerReply) return false;
        if (!queryText) return true;
        return (
          rev.author.toLowerCase().includes(queryText) ||
          rev.comment.toLowerCase().includes(queryText) ||
          (rev.ownerReply?.message.toLowerCase().includes(queryText) ?? false)
        );
      });
  }, [reviews, inboxFilter, inboxSearch]);

  const handleFillDecoyCredentials = () => {
    if (demoSandbox?.email) setDemoEmail(demoSandbox.email);
    if (demoSandbox?.accessCode) setDemoCode(demoSandbox.accessCode);
    setDemoLoginError(null);
  };

  const handleDemoLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setDemoLoginError(null);
    setDemoLoggingIn(true);
    try {
      const result = await onSignInDemo(demoEmail.trim(), demoCode.trim());
      if (!result.ok) {
        setDemoLoginError(result.error || 'Unable to sign in with those credentials.');
      }
    } finally {
      setDemoLoggingIn(false);
    }
  };

  const handleQuickSwitchToDecoy = async () => {
    const email = demoSandbox?.email || 'staff-demo@localrefreshments.demo';
    const code = demoSandbox?.accessCode || '';
    if (!code) return;
    setDemoLoggingIn(true);
    try {
      await onSignInDemo(email, code);
    } finally {
      setDemoLoggingIn(false);
    }
  };

  const handleOpenEditReply = (rev: Review) => {
    setEditingReviewId(rev.id);
    setReplyDrafts((prev) => ({
      ...prev,
      [rev.id]: rev.ownerReply?.message ?? prev[rev.id] ?? '',
    }));
    if (rev.ownerReply) {
      setReplyAuthorName(rev.ownerReply.authorName);
      setReplyRole(rev.ownerReply.authorRole);
    }
  };

  const handleSendReply = async (e: FormEvent, rev: Review) => {
    e.preventDefault();
    if (!activeBusiness) return;
    const message = (replyDrafts[rev.id] ?? '').trim();
    const authorName =
      replyAuthorName.trim() ||
      user?.displayName ||
      demoSession?.displayName ||
      'Owner';
    if (!message) return;

    setSubmittingReviewId(rev.id);
    try {
      await onReplyToReview(activeBusiness.id, rev.id, {
        message,
        authorName,
        authorRole: replyRole,
        ...(user?.uid ? { authorUid: user.uid } : {}),
        date: new Date().toISOString().slice(0, 10),
      });
      setEditingReviewId(null);
      setReplyDrafts((prev) => ({ ...prev, [rev.id]: '' }));
    } finally {
      setSubmittingReviewId(null);
    }
  };

  const handleOwnerUpdateSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    const date = postDate.trim();
    const title = postTitle.trim();
    const details = postDetails.trim();
    if (!date || !title || !details) return;

    onPublishPost(activeBusiness.id, { type: postType, date, title, details });
    setPostDate('');
    setPostTitle('');
    setPostDetails('');
  };

  const handleCreatePostFromAction = (draft: OwnerDraft) => {
    setPostType(draft.type);
    setPostDate(draft.date);
    setPostTitle(draft.title);
    setPostDetails(draft.details);
    setPortalTab('updates');
  };

  const handleStaffInviteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    const email = staffEmailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) return;

    setAddingStaff(true);
    try {
      await onAddStaffMember(activeBusiness, email, staffRoleInput);
      setStaffEmailInput('');
    } finally {
      setAddingStaff(false);
    }
  };

  // Unauthenticated Staff Login Screen (Google Sign-In + Decoy Staff Credentials)
  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={onBackToCommunity}
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-mango transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Community &amp; Feedback Writer Portal</span>
          </button>
        </div>

        <section className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-10 space-y-8">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold text-limefresh flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span>Business Owners &amp; Staff Portal</span>
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-charcoal [text-wrap:balance]">
              Log in to Check Customer Feedback &amp; Reply
            </h1>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              Sign in with Google or use the Decoy Staff Credentials below to open the Staff Inbox, view feedback sent by community members, and send replies back to their portal.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t border-stone-200 items-start">
            {/* Option A: Google Sign-In */}
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold text-charcoal">
                  Option 1: Sign in with Google
                </h2>
                <p className="text-sm text-stone-600 mt-1 leading-relaxed">
                  Use your verified Google account to sync businesses, reviews, and staff replies across devices in the cloud database.
                </p>
              </div>

              <div className="space-y-2.5 text-sm text-stone-600">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-mango shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Every customer comment appears in your live Staff Inbox.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-limefresh shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Replies appear right under the feedback in the customer&apos;s portal.</span>
                </div>
              </div>

              {authError && (
                <div className="rounded-lg border border-hibiscus/30 bg-rose-50/70 px-4 py-3 text-xs sm:text-sm text-hibiscus leading-relaxed">
                  {authError}
                </div>
              )}

              <div className="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onSignIn}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-mango hover:bg-orange-600 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  <span>Sign in with Google</span>
                </button>
              </div>
            </div>

            {/* Option B: Decoy Staff Credentials */}
            <div className="lg:border-l lg:border-stone-200 lg:pl-8 space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold text-charcoal flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-limefresh" aria-hidden="true" />
                  <span>Option 2: Decoy Staff Credentials</span>
                </h2>
                <p className="text-sm text-stone-600 mt-1 leading-relaxed">
                  Test the full interactive Staff Portal right away without needing a Google popup—customer feedback and owner replies sync live with the Community Portal.
                </p>
              </div>

              {demoSandbox && (
                <div className="rounded-xl border border-stone-200 bg-lemonade px-4 py-3 text-xs sm:text-sm space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-charcoal">Sandbox Staff Credentials</span>
                    {demoSandbox.accessCode && (
                      <button
                        type="button"
                        onClick={handleFillDecoyCredentials}
                        className="text-xs font-semibold text-limefresh hover:underline cursor-pointer"
                      >
                        Fill Credentials
                      </button>
                    )}
                  </div>
                  <div className="text-stone-700 font-mono text-xs">
                    Email: <strong className="text-charcoal">{demoSandbox.email}</strong>
                  </div>
                  {demoSandbox.accessCode ? (
                    <div className="text-stone-700 font-mono text-xs">
                      Access Code: <strong className="text-charcoal">{demoSandbox.accessCode}</strong>
                    </div>
                  ) : (
                    <div className="text-stone-600 text-xs">
                      Enter the configured <code className="font-mono">DEMO_STAFF_PASSCODE</code>.
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleDemoLoginSubmit} className="space-y-3">
                <div>
                  <label htmlFor="decoy-staff-email" className="block text-xs font-semibold text-charcoal mb-1">
                    Staff Email
                  </label>
                  <input
                    id="decoy-staff-email"
                    type="email"
                    required
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                    placeholder="staff-demo@localrefreshments.demo"
                    className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="decoy-staff-code" className="block text-xs font-semibold text-charcoal mb-1">
                    Access Code
                  </label>
                  <input
                    id="decoy-staff-code"
                    type="text"
                    required
                    value={demoCode}
                    onChange={(e) => setDemoCode(e.target.value)}
                    placeholder="Enter sandbox access code"
                    className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm font-mono text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
                  />
                </div>

                {demoLoginError && (
                  <p className="text-xs text-hibiscus font-medium">{demoLoginError}</p>
                )}

                <button
                  type="submit"
                  disabled={demoLoggingIn}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-limefresh hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {demoLoggingIn ? 'Signing in...' : 'Sign in with Decoy Credentials'}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Signed in with Google, checking staff access permissions
  if (user && !demoSession && !portableMode && !isAdmin && loadingStaffAccess && !activeBusiness) {
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={onBackToCommunity}
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-mango transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Community Directory</span>
          </button>
        </div>

        <section className="max-w-2xl mx-auto bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-2">
          <p className="text-xs font-semibold text-limefresh">Business Owners &amp; Staff Portal</p>
          <h1 className="font-display text-xl font-bold text-charcoal">
            Checking your staff access...
          </h1>
          <p className="text-sm text-stone-500">
            Loading the businesses and customer feedback linked to {user.email}.
          </p>
        </section>
      </div>
    );
  }

  // Signed in with Google, but user doesn't manage any business yet
  if (!activeBusiness) {
    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={onBackToCommunity}
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-mango transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Community Directory</span>
          </button>
        </div>

        <section className="max-w-2xl mx-auto bg-white rounded-2xl border border-stone-200 p-8 space-y-5">
          <div>
            <p className="text-xs font-semibold text-limefresh mb-1">
              Staff Account Signed In · {user?.email}
            </p>
            <h1 className="font-display text-2xl font-bold text-charcoal">
              No Businesses Linked to Your Google Account Yet
            </h1>
            <p className="text-sm text-stone-600 mt-2 leading-relaxed">
              Register your own business below, ask an owner to add <strong className="text-charcoal">{user?.email}</strong> under Staff Access, or open the Decoy Staff Account to test replying to neighborhood feedback right now.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenAddBusiness}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-mango hover:bg-orange-600 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Register Your Business</span>
            </button>
            {demoSandbox?.accessCode && (
              <button
                type="button"
                onClick={handleQuickSwitchToDecoy}
                disabled={demoLoggingIn}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-limefresh hover:bg-emerald-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" aria-hidden="true" />
                <span>Open with Decoy Staff Account</span>
              </button>
            )}
            <button
              type="button"
              onClick={onBackToCommunity}
              className="px-4 py-2.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-sm font-semibold text-stone-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Return to Directory
            </button>
          </div>
        </section>
      </div>
    );
  }

  const staffList = staffByBusiness[activeBusiness.id] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToCommunity}
          className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-mango transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Switch to Customer Feedback Portal</span>
        </button>

        <div className="text-xs sm:text-sm text-stone-600 flex flex-wrap items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-limefresh shrink-0" aria-hidden="true" />
          <span className="font-semibold text-charcoal">
            {demoSession
              ? `${demoSession.displayName} (${demoSession.email})`
              : user?.displayName || user?.email || 'Local Staff Preview'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-limefresh font-medium">
            {demoSession
              ? 'Decoy Staff Session'
              : isAdmin
                ? 'Directory Admin'
                : activeBusiness.ownerId === user?.uid
                  ? 'Business Owner'
                  : 'Authorized Staff'}
          </span>
          {!portableMode && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-hibiscus cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Staff Portal Header + Business Selector */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-limefresh mb-1">
              Business Owners &amp; Staff Portal
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-charcoal [text-wrap:balance]">
              {activeBusiness.name}
            </h1>
            <p className="text-sm text-stone-600 mt-1">
              Check feedback submitted by community members and send replies back to their portal.
            </p>
          </div>

          {managedBusinesses.length > 1 && (
            <div
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-lg self-start lg:self-auto max-w-full"
              role="tablist"
              aria-label="Select managed business"
            >
              {managedBusinesses.map((biz) => {
                const isSelected = biz.id === activeBusiness.id;
                const openCount = biz.reviews.filter((r) => !r.ownerReply).length;
                return (
                  <button
                    key={biz.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => onSelectBusiness(biz.id)}
                    className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 max-w-[220px] truncate cursor-pointer ${
                      isSelected
                        ? 'bg-white text-charcoal shadow-xs'
                        : 'text-stone-600 hover:text-charcoal'
                    }`}
                  >
                    {biz.name}
                    {openCount > 0 ? ` (${openCount})` : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4-Column KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-5 border-t border-stone-200">
          <div>
            <div className="text-xs font-medium text-stone-500">Total Feedback</div>
            <div className="font-display text-2xl font-bold text-charcoal tabular-nums mt-0.5">
              {reviews.length}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-stone-500">Awaiting Reply</div>
            <div
              className={`font-display text-2xl font-bold tabular-nums mt-0.5 ${
                unrepliedCount > 0 ? 'text-hibiscus' : 'text-charcoal'
              }`}
            >
              {unrepliedCount}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-stone-500">Owner Replied</div>
            <div className="font-display text-2xl font-bold text-limefresh tabular-nums mt-0.5">
              {repliedCount}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-stone-500">Average Rating</div>
            <div className="font-display text-2xl font-bold text-charcoal tabular-nums mt-0.5">
              {avgRating > 0 ? `${avgRating.toFixed(1)} / 5` : '—'}
            </div>
          </div>
        </div>

        {/* Portal Sub-Tabs */}
        <div
          className="flex flex-wrap items-center gap-1.5 pt-4 border-t border-stone-100"
          role="tablist"
          aria-label="Staff portal sections"
        >
          {(
            [
              { id: 'inbox', label: `Feedback Inbox (${reviews.length})` },
              { id: 'insights', label: 'AI Action Plan' },
              { id: 'updates', label: 'Post Specials & Jobs' },
              ...(canManageTeam ? [{ id: 'staff' as const, label: 'Staff Access' }] : []),
            ] as const
          ).map((tab) => {
            const isActive = portalTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setPortalTab(tab.id)}
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
      </section>

      {/* Tab 1: Feedback Inbox */}
      {portalTab === 'inbox' && (
        <section className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="p-6 border-b border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="inline-flex items-center gap-1 p-1 bg-stone-100 rounded-lg"
                role="tablist"
                aria-label="Filter inbox by reply status"
              >
                {(
                  [
                    { key: 'all', label: `All (${reviews.length})` },
                    { key: 'unreplied', label: `Needs Reply (${unrepliedCount})` },
                    { key: 'replied', label: `Replied (${repliedCount})` },
                  ] as const
                ).map((item) => {
                  const active = inboxFilter === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setInboxFilter(item.key)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
            </div>

            <div className="relative w-full md:w-72">
              <Search
                className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
                placeholder="Search customer feedback..."
                aria-label="Search customer feedback"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 bg-lemonade text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-mango focus:border-transparent"
              />
            </div>
          </div>

          {filteredReviews.length === 0 ? (
            <div className="p-10 text-center text-sm text-stone-500">
              {reviews.length === 0
                ? 'No community feedback received for this business yet.'
                : 'No feedback items match your current filter.'}
            </div>
          ) : (
            <div className="divide-y divide-stone-200">
              {filteredReviews.map((rev) => {
                const isEditing = editingReviewId === rev.id || !rev.ownerReply;
                const draftText = replyDrafts[rev.id] ?? '';
                const isSaving = submittingReviewId === rev.id;

                return (
                  <article key={rev.id} className="p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="font-display font-bold text-base text-charcoal">
                          {rev.author}
                        </span>
                        <span aria-hidden="true" className="text-stone-300">
                          ·
                        </span>
                        <StarRating rating={rev.rating} size="sm" />
                        <span aria-hidden="true" className="text-stone-300">
                          ·
                        </span>
                        <span className="text-xs text-stone-500 tabular-nums">{rev.date}</span>
                      </div>

                      <div className="text-xs font-semibold">
                        {rev.ownerReply ? (
                          <span className="text-limefresh">Owner Replied · Visible to Customer</span>
                        ) : (
                          <span className="text-hibiscus">Awaiting Reply</span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm sm:text-base text-stone-700 leading-relaxed">
                      {rev.comment}
                    </p>

                    {rev.ownerReply && editingReviewId !== rev.id && (
                      <div className="pt-3.5 border-t border-stone-100 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-limefresh">
                            <CornerDownRight className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {rev.ownerReply.authorRole} Replied · {rev.ownerReply.authorName}
                            </span>
                            <span aria-hidden="true" className="text-stone-300">
                              ·
                            </span>
                            <span className="text-stone-400 tabular-nums font-normal">
                              {rev.ownerReply.date}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenEditReply(rev)}
                            className="text-xs font-semibold text-stone-600 hover:text-mango hover:underline underline-offset-2 cursor-pointer"
                          >
                            Edit Reply
                          </button>
                        </div>
                        <p className="text-sm text-charcoal leading-relaxed pl-5">
                          {rev.ownerReply.message}
                        </p>
                      </div>
                    )}

                    {isEditing && (
                      <form
                        onSubmit={(e) => handleSendReply(e, rev)}
                        className="pt-4 border-t border-stone-100 space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label
                              htmlFor={`reply-name-${rev.id}`}
                              className="block text-xs font-semibold text-charcoal mb-1"
                            >
                              Replying As
                            </label>
                            <input
                              id={`reply-name-${rev.id}`}
                              type="text"
                              required
                              maxLength={60}
                              value={replyAuthorName}
                              onChange={(e) => setReplyAuthorName(e.target.value)}
                              placeholder="e.g., Mam' Ackerz"
                              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`reply-role-${rev.id}`}
                              className="block text-xs font-semibold text-charcoal mb-1"
                            >
                              Role Shown to Community
                            </label>
                            <select
                              id={`reply-role-${rev.id}`}
                              value={replyRole}
                              onChange={(e) => setReplyRole(e.target.value as StaffRole)}
                              className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
                            >
                              <option value="Owner">Owner</option>
                              <option value="Manager">Manager</option>
                              <option value="Staff">Staff</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor={`reply-msg-${rev.id}`}
                            className="block text-xs font-semibold text-charcoal mb-1"
                          >
                            Your Reply (visible to the feedback writer &amp; community)
                          </label>
                          <textarea
                            id={`reply-msg-${rev.id}`}
                            required
                            rows={2}
                            maxLength={1000}
                            value={draftText}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({ ...prev, [rev.id]: e.target.value }))
                            }
                            placeholder="Thank the customer, explain what you fixed, or invite them back..."
                            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {rev.ownerReply && (
                            <button
                              type="button"
                              onClick={() => setEditingReviewId(null)}
                              className="px-4 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-limefresh hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {isSaving
                                ? 'Sending Reply...'
                                : rev.ownerReply
                                  ? 'Update Reply'
                                  : 'Send Reply to Community'}
                            </span>
                          </button>
                        </div>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Tab 2: AI Action Plan */}
      {portalTab === 'insights' && (
        <FeedbackInsightsPanel
          business={activeBusiness}
          analysisState={analysisCache[activeBusiness.id]}
          onRunAnalysis={(force) => onRunAnalysis(activeBusiness, force)}
          onCreateOwnerPost={handleCreatePostFromAction}
        />
      )}

      {/* Tab 3: Post Specials, Events & Jobs */}
      {portalTab === 'updates' && (
        <section className="max-w-2xl bg-white rounded-2xl border border-stone-200 p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold text-limefresh mb-1">
              Community Noticeboard
            </p>
            <h2 className="font-display text-xl font-bold text-charcoal">
              Publish Update for {activeBusiness.name}
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              Share specials, events, or job openings directly with neighborhood customers.
            </p>
          </div>

          <form onSubmit={handleOwnerUpdateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="staff-post-type" className="block text-sm font-semibold text-charcoal mb-1.5">
                  Post Type
                </label>
                <select
                  id="staff-post-type"
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
                <label htmlFor="staff-post-date" className="block text-sm font-semibold text-charcoal mb-1.5">
                  Date / Schedule
                </label>
                <input
                  id="staff-post-date"
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
              <label htmlFor="staff-post-title" className="block text-sm font-semibold text-charcoal mb-1.5">
                Title
              </label>
              <input
                id="staff-post-title"
                required
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="e.g., Lunchtime Kota & Cold Drink Combo"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="staff-post-details" className="block text-sm font-semibold text-charcoal mb-1.5">
                Details
              </label>
              <textarea
                id="staff-post-details"
                required
                rows={3}
                value={postDetails}
                onChange={(e) => setPostDetails(e.target.value)}
                placeholder="Include price, event details, or pay rate and how to apply..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-lg bg-limefresh hover:bg-emerald-700 text-white font-semibold text-sm transition-colors cursor-pointer"
              >
                Publish Update
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Tab 4: Staff Access (Google Owner/Admin) */}
      {portalTab === 'staff' && canManageTeam && (
        <section className="max-w-2xl bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-xs font-semibold text-limefresh mb-1">
              Team &amp; Staff Permissions
            </p>
            <h2 className="font-display text-xl font-bold text-charcoal">
              Authorize Staff for {activeBusiness.name}
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              Add a staff member&apos;s Google email so they can log into this Staff Portal and reply to customer feedback.
            </p>
          </div>

          <form onSubmit={handleStaffInviteSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6">
              <label htmlFor="staff-email" className="block text-xs font-semibold text-charcoal mb-1.5">
                Staff Google Email
              </label>
              <input
                id="staff-email"
                type="email"
                required
                value={staffEmailInput}
                onChange={(e) => setStaffEmailInput(e.target.value)}
                placeholder="staff.member@gmail.com"
                className="w-full px-3.5 py-2 rounded-lg border border-stone-300 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
              />
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="staff-role" className="block text-xs font-semibold text-charcoal mb-1.5">
                Role
              </label>
              <select
                id="staff-role"
                value={staffRoleInput}
                onChange={(e) => setStaffRoleInput(e.target.value as StaffRole)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-limefresh focus:border-transparent"
              >
                <option value="Staff">Staff</option>
                <option value="Manager">Manager</option>
                <option value="Owner">Owner</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={addingStaff}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-charcoal hover:bg-stone-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>{addingStaff ? 'Adding...' : 'Add Staff'}</span>
              </button>
            </div>
          </form>

          <div className="border-t border-stone-200 pt-5">
            <h3 className="text-sm font-semibold text-charcoal mb-3">
              Authorized Staff ({staffList.length})
            </h3>
            {staffList.length === 0 ? (
              <p className="text-sm text-stone-500">
                No additional staff members added yet. Only the business owner and directory admin can reply right now.
              </p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {staffList.map((member) => (
                  <li key={member.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <span className="font-semibold text-charcoal">{member.email}</span>
                      <span aria-hidden="true" className="mx-2 text-stone-300">
                        ·
                      </span>
                      <span className="text-xs font-medium text-limefresh">{member.role}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveStaffMember(activeBusiness.id, member.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-hibiscus hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
