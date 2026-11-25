import { Cloud, CloudOff, Download, HardDrive, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { User } from 'firebase/auth';

interface WorkspaceSyncBarProps {
  user: User | null;
  authReady: boolean;
  syncing: boolean;
  exporting: boolean;
  portableMode: boolean;
  cloudError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onRetrySync: () => void;
  onExportHtml: () => void;
}

export function WorkspaceSyncBar({
  user,
  authReady,
  syncing,
  exporting,
  portableMode,
  cloudError,
  onSignIn,
  onSignOut,
  onRetrySync,
  onExportHtml,
}: WorkspaceSyncBarProps) {
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
            Your exported businesses, reviews, and saved AI insights are running locally on this device.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">{downloadButton}</div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="mb-6 bg-white rounded-xl border border-stone-200 px-5 py-3.5 flex items-center justify-between gap-4 text-xs sm:text-sm text-stone-500">
        <span>Checking saved cloud workspace...</span>
        {downloadButton}
      </div>
    );
  }

  if (cloudError) {
    return (
      <div className="mb-6 bg-rose-50/70 rounded-xl border border-hibiscus/30 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-sm text-charcoal">
          <CloudOff className="w-4 h-4 text-hibiscus shrink-0" aria-hidden="true" />
          <span>{cloudError}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRetrySync}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-hibiscus/40 bg-white text-hibiscus text-xs font-semibold hover:bg-rose-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry Sync</span>
          </button>
          {downloadButton}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mb-6 bg-white rounded-xl border border-stone-200 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm text-stone-600">
          <CloudOff className="w-4 h-4 text-stone-400 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-charcoal">Browser-only session.</strong>{' '}
            Sign in with Google to save to the cloud, or download a single HTML file to send to another device.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
    );
  }

  const label = user.displayName || user.email || 'Signed-in Neighbor';

  return (
    <div className="mb-6 bg-white rounded-xl border border-stone-200 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-stone-600">
        <Cloud className="w-4 h-4 text-limefresh shrink-0" aria-hidden="true" />
        <span className="font-semibold text-limefresh">
          {syncing ? 'Saving to cloud...' : 'Saved to cloud workspace'}
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-medium text-charcoal">{label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
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
