import { Plus } from 'lucide-react';
import { HighlightFilter } from '../types';

interface HeaderProps {
  isStaffPortalOpen: boolean;
  onNavigateHome: (sectionId?: string, highlightFilter?: HighlightFilter) => void;
  onOpenStaffPortal: () => void;
  onOpenAddBusiness: () => void;
}

export function Header({
  isStaffPortalOpen,
  onNavigateHome,
  onOpenStaffPortal,
  onOpenAddBusiness,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigateHome()}
          className="font-display text-lg sm:text-xl font-bold tracking-tight text-charcoal hover:text-mango transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mango rounded cursor-pointer"
        >
          Local Refreshments
        </button>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
          <button
            type="button"
            onClick={() => onNavigateHome('insights-section')}
            className="hover:text-charcoal hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Feedback Insights
          </button>
          <button
            type="button"
            onClick={() => onNavigateHome('directory-section')}
            className="hover:text-charcoal hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Directory
          </button>
          <button
            type="button"
            onClick={() => onNavigateHome('highlights-section', 'all')}
            className="hover:text-charcoal hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Highlights
          </button>
          <button
            type="button"
            onClick={() => onNavigateHome('highlights-section', 'jobs')}
            className="hover:text-charcoal hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Community Jobs
          </button>
          <button
            type="button"
            onClick={onOpenStaffPortal}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isStaffPortalOpen
                ? 'text-mango font-semibold underline underline-offset-4'
                : 'hover:text-charcoal hover:underline underline-offset-4'
            }`}
          >
            Staff Portal
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenAddBusiness}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-mango hover:bg-orange-600 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mango"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add Business</span>
          </button>
        </div>
      </div>
    </header>
  );
}
