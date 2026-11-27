import {
  Cloud,
  CloudOff,
  Download,
  HardDrive,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { DemoStaffSession } from '../types';

interface WorkspaceSyncBarProps {
  user: User | null;
  demoSession: DemoStaffSession | null;
  authReady: boolean;
  syncing: boolean;
  exporting: boolean;
  portableMode: boolean;
  isStaffPortalOpen: boolean;
  pendingReplyCount: number;
  cloudError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onRetrySync: () => void;
  onExportHtml: () => void;
  onOpenStaffPortal: () => void;
}

export function WorkspaceSyncBar({
  user,
  demoSession,
  authReady,
  syncing,
  exporting,
  portableMode,
  isStaffPortalOpen,
  pendingReplyCount,
  cloudError,
  onSignIn,
  onSignOut,
  onRetrySync,
  onExportHtml,
  onOpenStaffPortal,
}: WorkspaceSyncBarProps) {
  const isStaffSignedIn = Boolean(user || demoSession);

  const staffButton = !isStaffPortalOpen ? (
    <button
      type="button"
      onClick={onOpenStaffPortal}
      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-charcoal text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
    >
      <ShieldCheck className="w-3.5 h-3.5 text-limefresh" aria-hidden="true" />
      <span className="tabular-nums">
        {isStaffSignedIn && pendingReplyCount > 0
          ? `Staff Portal (${pendingReplyCount} open)`
          : 'Owner & Staff Portal'}
      </span>
    </button>
  ) : null;

  const downloadButton = (
    <button
      type="button"
      onClick={onExportHtml}
      disabled={exporting}
      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-charcoal text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
    >
      <Download className="w-3.5 h-3.5 text-mango" aria-hidden="true" />
      <span>{exporting ? 'Packaging HTML...' : 'Download Single HTML'}</span>
    </button>
  );

  if (portableMode) {
    return (
      <div className="mb-6 bg-white rounded-xl border border-stone-200 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm text-stone-600">
          <HardDrive className="w-4 h-4 text-limefresh shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-charcoal">Portable single-file mode.</strong>{' '}
            Your exported businesses, reviews, owner replies, and insights are running locally.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {staffButton}
          {downloadButton}
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="mb-6 bg-white rounded-xl border border-stone-200 px-5 py-3.5 flex items-center justify-between gap-4 text-xs sm:text-sm text-stone-500">
        <span>Checking saved workspace...</span>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {staffButton}
          {downloadButton}
        </div>
      </div>
    );
  }

  if (demoSession && !user) {
    return (
      <div className="mb-6 bg-white rounded-xl border border-stone-200 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-stone-600">
          <ShieldCheck className="w-4 h-4 text-limefresh shrink-0" aria-hidden="true" />
          <span className="font-semibold text-limefresh">Decoy Staff Session Active</span>
          <span aria-hidden="true">·</span>
          <span className="font-medium text-charcoal">{demoSession.email}</span>
          <span aria-hidden="true">·</span>
          <span className="text-stone-500">Customer feedback &amp; replies synced live</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {staffButton}
          {downloadButton}
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mb-6 bg-white rounded-xl border border-stone-200 px-5 py-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm text-stone-600">
            <CloudOff className="w-4 h-4 text-stone-400 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-charcoal">Community Member Portal.</strong>{' '}
              Send feedback below, or open the Staff Portal to sign in with Google or decoy credentials.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {staffButton}
            {downloadButton}
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg bg-limefresh hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>Sign in with Google</span>
            </button>
          </div>
        </div>

        {cloudError && (
          <div className="pt-2.5 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-hibiscus">
            <span>{cloudError}</span>
            <button
              type="button"
              onClick={onOpenStaffPortal}
              className="font-semibold text-limefresh hover:underline self-start sm:self-auto whitespace-nowrap cursor-pointer"
            >
              Use Decoy Staff Login Instead
            </button>
          </div>
        )}
      </div>
    );
  }

  const label = user.displayName || user.email || 'Signed-in Neighbor';

  return (
    <div className="mb-6 bg-white rounded-xl border border-stone-200 px-5 py-3.5 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-stone-600">
          <Cloud className="w-4 h-4 text-limefresh shrink-0" aria-hidden="true" />
          <span className="font-semibold text-limefresh">
            {syncing ? 'Syncing live updates...' : 'Connected to live directory'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-medium text-charcoal">{label}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {staffButton}
          {downloadButton}
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {cloudError && (
        <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs text-hibiscus">
          <span>{cloudError}</span>
          <button
            type="button"
            onClick={onRetrySync}
            className="inline-flex items-center gap-1 font-semibold text-charcoal hover:underline cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            <span>Retry Sync</span>
          </button>
        </div>
      )}
    </div>
  );
}
