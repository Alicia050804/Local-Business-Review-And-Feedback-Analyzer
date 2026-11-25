import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import {
  ensureWorkspaceAndSeed,
  resetWorkspaceInCloud,
  saveAnalysisToCloud,
  saveBusinessToCloud,
  savePostToCloud,
  saveReviewToCloud,
  subscribeToWorkspace,
} from './services/firestoreWorkspace';
import {
  AnalysisState,
  Business,
  FeedbackAnalysis,
  HighlightFilter,
  HighlightItem,
  OwnerDraft,
  PostCategoryKey,
  ProfileTab,
} from './types';
import {
  SEED_BUSINESSES,
  getReviewSignature,
  isPortableFileMode,
  loadBusinesses,
  loadCachedAnalyses,
  saveBusinesses,
  saveCachedAnalyses,
} from './data/seedBusinesses';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { BusinessProfileView } from './components/BusinessProfileView';
import { AddBusinessModal } from './components/AddBusinessModal';
import { WorkspaceSyncBar } from './components/WorkspaceSyncBar';

function buildCleanAnalysesSnapshot(
  cache: Record<string, AnalysisState>
): Record<string, AnalysisState> {
  const clean: Record<string, AnalysisState> = {};
  for (const [bizId, state] of Object.entries(cache)) {
    if (state?.data && !state.loading) {
      clean[bizId] = {
        signature: state.signature,
        loading: false,
        data: state.data,
      };
    }
  }
  return clean;
}

function triggerHtmlDownload(htmlContent: string, filename: string) {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const portableMode = useMemo(() => isPortableFileMode(), []);
  const [businesses, setBusinesses] = useState<Business[]>(() => loadBusinesses());
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [featuredBusinessId, setFeaturedBusinessId] = useState<string>(
    () => loadBusinesses()[0]?.id ?? ''
  );
  const [activeTab, setActiveTab] = useState<ProfileTab>('reviews');
  const [highlightFilter, setHighlightFilter] = useState<HighlightFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [analysisCache, setAnalysisCache] = useState<Record<string, AnalysisState>>(() =>
    loadCachedAnalyses()
  );
  const [ownerDraft, setOwnerDraft] = useState<OwnerDraft | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(() => portableMode);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const [syncEpoch, setSyncEpoch] = useState(0);

  const businessesRef = useRef(businesses);
  businessesRef.current = businesses;

  const analysisCacheRef = useRef(analysisCache);
  analysisCacheRef.current = analysisCache;

  const userRef = useRef(user);
  userRef.current = user;

  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    saveBusinesses(businesses);
  }, [businesses]);

  useEffect(() => {
    saveCachedAnalyses(analysisCache);
  }, [analysisCache]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (portableMode) {
      setAuthReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      setCloudError(null);
    });
    return () => unsubscribe();
  }, [portableMode]);

  useEffect(() => {
    if (portableMode || !user) return;

    let active = true;
    let unsubscribeSnapshot: (() => void) | null = null;

    const connectCloudWorkspace = async () => {
      setSyncing(true);
      setCloudError(null);
      try {
        await ensureWorkspaceAndSeed(
          user,
          businessesRef.current,
          analysisCacheRef.current
        );
        if (!active) return;

        unsubscribeSnapshot = subscribeToWorkspace(
          user.uid,
          ({ businesses: cloudBusinesses, analyses: cloudAnalyses }) => {
            if (!active) return;
            if (cloudBusinesses.length > 0) {
              setBusinesses(cloudBusinesses);
            }
            setAnalysisCache((prev) => {
              const next = { ...prev };
              for (const [bizId, savedState] of Object.entries(cloudAnalyses)) {
                if (!next[bizId]?.loading) {
                  next[bizId] = savedState;
                }
              }
              return next;
            });
            setSyncing(false);
          },
          (err) => {
            if (!active) return;
            setSyncing(false);
            if (
              err.message.includes('Missing or insufficient permissions') ||
              err.message.includes('Quota exceeded')
            ) {
              setFatalError(err);
            } else {
              setCloudError('Unable to sync with cloud workspace. Using local copy.');
            }
          }
        );
      } catch (err) {
        if (!active) return;
        setSyncing(false);
        const errorObj = err instanceof Error ? err : new Error(String(err));
        if (
          errorObj.message.includes('Missing or insufficient permissions') ||
          errorObj.message.includes('Quota exceeded')
        ) {
          setFatalError(errorObj);
        } else {
          setCloudError('Could not connect to cloud storage right now. Your changes are still saved locally.');
        }
      }
    };

    void connectCloudWorkspace();

    return () => {
      active = false;
      unsubscribeSnapshot?.();
    };
  }, [portableMode, user, syncEpoch]);

  const selectedBusiness = useMemo(
    () => businesses.find((b) => b.id === selectedBusinessId) ?? null,
    [businesses, selectedBusinessId]
  );

  const featuredBusiness = useMemo(
    () => businesses.find((b) => b.id === featuredBusinessId) ?? businesses[0] ?? null,
    [businesses, featuredBusinessId]
  );

  const allHighlights = useMemo<HighlightItem[]>(() => {
    const items: HighlightItem[] = [];
    businesses.forEach((biz) => {
      biz.specials.forEach((sp) =>
        items.push({ ...sp, type: 'specials', bizId: biz.id, bizName: biz.name })
      );
      biz.events.forEach((ev) =>
        items.push({ ...ev, type: 'events', bizId: biz.id, bizName: biz.name })
      );
      biz.jobs.forEach((jb) =>
        items.push({ ...jb, type: 'jobs', bizId: biz.id, bizName: biz.name })
      );
    });
    return items;
  }, [businesses]);

  const runFeedbackAnalysis = useCallback(
    async (biz: Business, forceRefresh = false) => {
      const signature = getReviewSignature(biz);
      const cached = analysisCacheRef.current[biz.id];

      if (!forceRefresh && cached?.signature === signature && (cached.data || cached.loading)) {
        return;
      }

      if (biz.reviews.length === 0) {
        setAnalysisCache((prev) => ({
          ...prev,
          [biz.id]: { signature, loading: false, data: null },
        }));
        return;
      }

      if (portableMode) {
        setAnalysisCache((prev) => ({
          ...prev,
          [biz.id]: {
            signature,
            loading: false,
            error:
              'Live AI analysis requires the hosted web app connection. Saved insights from your export remain available.',
            data: prev[biz.id]?.data ?? null,
          },
        }));
        return;
      }

      setAnalysisCache((prev) => ({
        ...prev,
        [biz.id]: { signature, loading: true, data: null },
      }));

      try {
        const res = await fetch('/api/analyze-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessName: biz.name,
            category: biz.category,
            reviews: biz.reviews.map((r) => ({
              author: r.author,
              rating: r.rating,
              comment: r.comment,
            })),
          }),
        });

        const payload = (await res.json()) as Partial<FeedbackAnalysis> & { error?: string };

        if (!res.ok) {
          throw new Error(payload.error || `Request failed (${res.status})`);
        }

        const data: FeedbackAnalysis = {
          summary: typeof payload.summary === 'string' ? payload.summary : '',
          loves: Array.isArray(payload.loves) ? payload.loves : [],
          unhappy: Array.isArray(payload.unhappy) ? payload.unhappy : [],
          actions: Array.isArray(payload.actions) ? payload.actions : [],
        };

        setAnalysisCache((prev) => ({
          ...prev,
          [biz.id]: { signature, loading: false, data },
        }));

        const currentUser = userRef.current;
        if (currentUser) {
          void saveAnalysisToCloud(currentUser.uid, biz.id, signature, data).catch((err) => {
            console.error('Failed to save AI analysis to cloud:', err);
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to reach feedback analysis service.';
        setAnalysisCache((prev) => ({
          ...prev,
          [biz.id]: { signature, loading: false, error: message, data: null },
        }));
      }
    },
    [portableMode]
  );

  // Auto-analyze the active business on the profile view or home insights board
  useEffect(() => {
    const targetBiz = selectedBusiness
      ? activeTab === 'reviews'
        ? selectedBusiness
        : null
      : featuredBusiness;

    if (!targetBiz || targetBiz.reviews.length === 0) return;

    const sig = getReviewSignature(targetBiz);
    const cached = analysisCache[targetBiz.id];
    if (!cached || cached.signature !== sig) {
      if (portableMode) return;
      void runFeedbackAnalysis(targetBiz);
    }
  }, [portableMode, selectedBusiness, featuredBusiness, activeTab, analysisCache, runFeedbackAnalysis]);

  const handleExportSingleHtml = async () => {
    setExporting(true);
    try {
      const snapshotPayload = {
        businesses: businessesRef.current,
        analyses: buildCleanAnalysesSnapshot(analysisCacheRef.current),
      };

      if (portableMode) {
        const clonedDoc = document.documentElement.cloneNode(true) as HTMLElement;
        const rootEl = clonedDoc.querySelector('#root');
        if (rootEl) rootEl.innerHTML = '';

        let dataScript = clonedDoc.querySelector('#embedded-workspace-data');
        if (!dataScript) {
          dataScript = document.createElement('script');
          dataScript.id = 'embedded-workspace-data';
          dataScript.setAttribute('type', 'application/json');
          clonedDoc.querySelector('head')?.appendChild(dataScript);
        }
        dataScript.textContent = JSON.stringify(snapshotPayload).replace(/<\/script/gi, '<\\/script');

        triggerHtmlDownload(`<!doctype html>\n${clonedDoc.outerHTML}`, 'local-refreshments-portable.html');
        setToastMessage('Downloaded updated portable HTML file.');
        return;
      }

      const res = await fetch('/api/export-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshotPayload),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `Export failed (${res.status})`);
      }

      const htmlText = await res.text();
      triggerHtmlDownload(htmlText, 'local-refreshments-portable.html');
      setToastMessage('Downloaded single portable HTML file ready to send to any device.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to export portable HTML file.';
      setToastMessage(msg);
    } finally {
      setExporting(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setCloudError(null);
      await signInWithPopup(auth, googleProvider);
      setToastMessage('Signed in. Saving and syncing your workspace...');
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      setCloudError('Google sign-in could not be completed. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setToastMessage('Signed out. Local browser copy remains available.');
    } catch {
      setToastMessage('Could not sign out cleanly. Please try again.');
    }
  };

  const handleNavigateHome = (sectionId?: string, nextFilter?: HighlightFilter) => {
    setSelectedBusinessId(null);
    if (nextFilter) {
      setHighlightFilter(nextFilter);
    }
    window.setTimeout(() => {
      if (sectionId) {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 30);
  };

  const handleOpenBusiness = (id: string, tab: ProfileTab = 'reviews') => {
    setSelectedBusinessId(id);
    setFeaturedBusinessId(id);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateOwnerPostFromAction = (bizId: string, draft: OwnerDraft) => {
    setOwnerDraft(draft);
    handleOpenBusiness(bizId, 'owner');
    setToastMessage('Pre-filled owner update from AI improvement suggestion.');
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (selectedBusinessId) {
      setSelectedBusinessId(null);
    }
  };

  const handleAddBusiness = (input: { name: string; category: string; description: string }) => {
    const newBiz: Business = {
      id: `biz-${Date.now()}`,
      name: input.name,
      category: input.category,
      description: input.description,
      reviews: [],
      specials: [],
      events: [],
      jobs: [],
    };
    setBusinesses((prev) => [newBiz, ...prev]);
    setIsAddModalOpen(false);
    setToastMessage(
      user
        ? `Added "${input.name}" and saved to your cloud workspace.`
        : `Added "${input.name}" to the neighborhood directory.`
    );
    handleOpenBusiness(newBiz.id, 'owner');

    if (user && !portableMode) {
      setSyncing(true);
      void saveBusinessToCloud(user.uid, newBiz)
        .then(() => setSyncing(false))
        .catch((err) => {
          setSyncing(false);
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        });
    }
  };

  const handleAddReview = (input: { author: string; rating: number; comment: string }) => {
    if (!selectedBusiness) return;
    const newReview = {
      id: `rev-${Date.now()}`,
      author: input.author,
      rating: input.rating,
      date: new Date().toISOString().slice(0, 10),
      comment: input.comment,
    };

    const updatedBusinesses = businesses.map((biz) =>
      biz.id === selectedBusiness.id
        ? { ...biz, reviews: [...biz.reviews, newReview] }
        : biz
    );
    setBusinesses(updatedBusinesses);
    setToastMessage(
      user
        ? 'Review saved to cloud. Refreshing AI feedback insights...'
        : portableMode
          ? 'Review saved to this device.'
          : 'Review posted. Refreshing AI feedback insights...'
    );

    if (user && !portableMode) {
      setSyncing(true);
      void saveReviewToCloud(user.uid, selectedBusiness.id, newReview)
        .then(() => setSyncing(false))
        .catch((err) => {
          setSyncing(false);
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        });
    }

    const updatedBiz = updatedBusinesses.find((b) => b.id === selectedBusiness.id);
    if (updatedBiz && !portableMode) {
      void runFeedbackAnalysis(updatedBiz, true);
    }
  };

  const handleAddOwnerPost = (input: {
    type: PostCategoryKey;
    date: string;
    title: string;
    details: string;
  }) => {
    if (!selectedBusiness) return;
    const newPost = {
      id: `post-${Date.now()}`,
      title: input.title,
      details: input.details,
      date: input.date,
    };

    setBusinesses((prev) =>
      prev.map((biz) =>
        biz.id === selectedBusiness.id
          ? { ...biz, [input.type]: [newPost, ...biz[input.type]] }
          : biz
      )
    );
    setToastMessage(
      user
        ? 'Update saved to cloud and published to Community Highlights.'
        : 'Update published to profile and Community Highlights.'
    );
    setActiveTab('updates');

    if (user && !portableMode) {
      setSyncing(true);
      void savePostToCloud(user.uid, selectedBusiness.id, input.type, newPost)
        .then(() => setSyncing(false))
        .catch((err) => {
          setSyncing(false);
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        });
    }
  };

  const handleResetDemoData = () => {
    const fresh = structuredClone(SEED_BUSINESSES);
    setBusinesses(fresh);
    saveBusinesses(fresh);
    setAnalysisCache({});
    saveCachedAnalyses({});
    setSearchQuery('');
    setHighlightFilter('all');
    setSelectedBusinessId(null);
    setFeaturedBusinessId(fresh[0]?.id ?? '');
    setToastMessage(user ? 'Restoring demo directory in cloud...' : 'Demo directory restored.');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (user && !portableMode) {
      setSyncing(true);
      void resetWorkspaceInCloud(user, fresh)
        .then(() => {
          setSyncing(false);
          setToastMessage('Demo directory restored in your cloud workspace.');
        })
        .catch((err) => {
          setSyncing(false);
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-lemonade text-charcoal">
      <Header
        onNavigateHome={handleNavigateHome}
        onOpenAddBusiness={() => setIsAddModalOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        <WorkspaceSyncBar
          user={user}
          authReady={authReady}
          syncing={syncing}
          exporting={exporting}
          portableMode={portableMode}
          cloudError={cloudError}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onRetrySync={() => setSyncEpoch((prev) => prev + 1)}
          onExportHtml={handleExportSingleHtml}
        />

        {selectedBusiness ? (
          <BusinessProfileView
            business={selectedBusiness}
            activeTab={activeTab}
            analysisState={analysisCache[selectedBusiness.id]}
            ownerDraft={ownerDraft}
            onClearOwnerDraft={() => setOwnerDraft(null)}
            onBack={() => handleNavigateHome()}
            onTabChange={setActiveTab}
            onRunAnalysis={(force) => runFeedbackAnalysis(selectedBusiness, force)}
            onCreateOwnerPostFromAction={(draft) =>
              handleCreateOwnerPostFromAction(selectedBusiness.id, draft)
            }
            onSubmitReview={handleAddReview}
            onSubmitOwnerPost={handleAddOwnerPost}
          />
        ) : (
          <HomeView
            businesses={businesses}
            highlights={allHighlights}
            highlightFilter={highlightFilter}
            searchQuery={searchQuery}
            analysisCache={analysisCache}
            featuredBusinessId={featuredBusinessId}
            onSelectFeaturedBusiness={setFeaturedBusinessId}
            onRunAnalysis={runFeedbackAnalysis}
            onCreateOwnerPost={handleCreateOwnerPostFromAction}
            onSearchChange={handleSearchChange}
            onHighlightFilterChange={setHighlightFilter}
            onOpenBusiness={handleOpenBusiness}
          />
        )}
      </main>

      <footer className="border-t border-stone-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <p>Local Refreshments Neighborhood Directory</p>
          <button
            type="button"
            onClick={handleResetDemoData}
            className="text-hibiscus hover:underline font-semibold cursor-pointer"
          >
            Reset Demo Data
          </button>
        </div>
      </footer>

      <AddBusinessModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddBusiness={handleAddBusiness}
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-charcoal text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
