import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, signInWithGoogle } from './firebase';
import {
  addStaffMemberInCloud,
  createBusinessInCloud,
  createPostInCloud,
  createReviewInCloud,
  ensureSharedDirectorySynced,
  isDirectoryAdmin,
  loadStaffAccessForUser,
  removeStaffMemberInCloud,
  replyToReviewInCloud,
  resetSharedDirectoryInCloud,
  saveAnalysisInCloud,
  subscribeToSharedDirectory,
} from './services/firestoreWorkspace';
import {
  AnalysisState,
  Business,
  DemoStaffSession,
  FeedbackAnalysis,
  HighlightFilter,
  HighlightItem,
  OwnerDraft,
  OwnerReply,
  PostCategoryKey,
  ProfileTab,
  Review,
  StaffMember,
  StaffRole,
} from './types';
import {
  SEED_BUSINESSES,
  getReviewSignature,
  hydrateSeedImages,
  isPortableFileMode,
  loadBusinesses,
  loadCachedAnalyses,
  loadMyFeedbackIds,
  saveBusinesses,
  saveCachedAnalyses,
  saveMyFeedbackIds,
} from './data/seedBusinesses';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { BusinessProfileView } from './components/BusinessProfileView';
import { DemoSandboxInfo, StaffPortalView } from './components/StaffPortalView';
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

function mergeServerDemoOverlay(base: Business[], demoOverlay: Business[] | null): Business[] {
  if (!demoOverlay || demoOverlay.length === 0) return base;
  const hydratedOverlay = hydrateSeedImages(demoOverlay);
  const byId = new Map<string, Business>();

  for (const biz of base) {
    byId.set(biz.id, biz);
  }

  for (const demoBiz of hydratedOverlay) {
    const existing = byId.get(demoBiz.id);
    if (!existing) {
      byId.set(demoBiz.id, demoBiz);
      continue;
    }

    const mergedReviews = new Map<string, Review>();
    for (const r of existing.reviews) {
      mergedReviews.set(r.id, r);
    }
    for (const dr of demoBiz.reviews) {
      const prev = mergedReviews.get(dr.id);
      if (!prev) {
        mergedReviews.set(dr.id, dr);
      } else if (dr.ownerReply && !prev.ownerReply) {
        mergedReviews.set(dr.id, { ...prev, ownerReply: dr.ownerReply });
      } else if (dr.ownerReply && prev.ownerReply && dr.ownerReply.message !== prev.ownerReply.message) {
        mergedReviews.set(dr.id, { ...prev, ownerReply: dr.ownerReply });
      }
    }

    const mergePosts = (a: Business['specials'], b: Business['specials']) => {
      const seen = new Set(a.map((p) => p.id));
      return [...b.filter((p) => !seen.has(p.id)), ...a];
    };

    byId.set(demoBiz.id, {
      ...existing,
      reviews: Array.from(mergedReviews.values()),
      specials: mergePosts(existing.specials, demoBiz.specials),
      events: mergePosts(existing.events, demoBiz.events),
      jobs: mergePosts(existing.jobs, demoBiz.jobs),
    });
  }

  return Array.from(byId.values());
}

export default function App() {
  const portableMode = useMemo(() => isPortableFileMode(), []);
  const [businesses, setBusinesses] = useState<Business[]>(() => loadBusinesses());
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [featuredBusinessId, setFeaturedBusinessId] = useState<string>(
    () => loadBusinesses()[0]?.id ?? ''
  );
  const [isStaffPortalOpen, setIsStaffPortalOpen] = useState(false);
  const [staffBusinessId, setStaffBusinessId] = useState<string>(
    () => loadBusinesses()[0]?.id ?? ''
  );
  const [activeTab, setActiveTab] = useState<ProfileTab>('reviews');
  const [highlightFilter, setHighlightFilter] = useState<HighlightFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [analysisCache, setAnalysisCache] = useState<Record<string, AnalysisState>>(() =>
    loadCachedAnalyses()
  );
  const [myFeedbackIds, setMyFeedbackIds] = useState<string[]>(() => loadMyFeedbackIds());
  const [ownerDraft, setOwnerDraft] = useState<OwnerDraft | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [demoSession, setDemoSession] = useState<DemoStaffSession | null>(null);
  const [demoSandbox, setDemoSandbox] = useState<DemoSandboxInfo | null>(null);
  const [authReady, setAuthReady] = useState(() => portableMode);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const [syncEpoch, setSyncEpoch] = useState(0);

  const [managedBusinessIds, setManagedBusinessIds] = useState<string[]>([]);
  const [staffByBusiness, setStaffByBusiness] = useState<Record<string, StaffMember[]>>({});
  const [loadingStaffAccess, setLoadingStaffAccess] = useState(false);

  const businessesRef = useRef(businesses);
  businessesRef.current = businesses;

  const analysisCacheRef = useRef(analysisCache);
  analysisCacheRef.current = analysisCache;

  const userRef = useRef(user);
  userRef.current = user;

  const demoOverlayRef = useRef<Business[] | null>(null);
  const lastDemoUpdatedAtRef = useRef(0);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const isAdmin = useMemo(() => isDirectoryAdmin(user), [user]);

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
    saveMyFeedbackIds(myFeedbackIds);
  }, [myFeedbackIds]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const broadcastDirectoryUpdate = useCallback((nextBusinesses: Business[]) => {
    try {
      broadcastRef.current?.postMessage({ type: 'DIRECTORY_UPDATED', businesses: nextBusinesses });
    } catch {
      // BroadcastChannel unsupported or closed
    }
  }, []);

  // Cross-tab instant synchronization via BroadcastChannel & localStorage events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('local_refreshments_sync');
      broadcastRef.current = channel;
      channel.onmessage = (event) => {
        if (event.data?.type === 'DIRECTORY_UPDATED' && Array.isArray(event.data.businesses)) {
          setBusinesses(hydrateSeedImages(event.data.businesses as Business[]));
        }
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'local_refreshments_directory_v1' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBusinesses(hydrateSeedImages(parsed as Business[]));
          }
        } catch {
          // Ignore malformed storage payload
        }
      }
      if (e.key === 'local_refreshments_my_feedback_ids_v1' && e.newValue) {
        setMyFeedbackIds(loadMyFeedbackIds());
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
      broadcastRef.current = null;
    };
  }, []);

  // Load decoy staff sandbox credentials & initial server demo directory snapshot
  useEffect(() => {
    if (portableMode) {
      setDemoSandbox({
        enabled: true,
        email: 'staff-demo@localrefreshments.demo',
        accessCode: 'PORTABLE-DEMO',
        displayName: 'Demo Store Owner',
        role: 'Owner',
      });
      return;
    }

    fetch('/api/demo-staff/sandbox')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.enabled) setDemoSandbox(data as DemoSandboxInfo);
      })
      .catch(() => undefined);
  }, [portableMode]);

  // Poll server demo directory so customer feedback <-> decoy staff replies sync live across tabs/browsers
  useEffect(() => {
    if (portableMode) return;
    let active = true;

    const pullDemoDirectory = async () => {
      try {
        const res = await fetch('/api/demo-directory');
        if (!res.ok) return;
        const payload = (await res.json()) as { businesses?: Business[] | null; updatedAt?: number };
        if (!active || !payload.businesses) return;
        if (typeof payload.updatedAt === 'number' && payload.updatedAt > lastDemoUpdatedAtRef.current) {
          lastDemoUpdatedAtRef.current = payload.updatedAt;
          demoOverlayRef.current = payload.businesses;
          setBusinesses((prev) => mergeServerDemoOverlay(prev, payload.businesses ?? null));
        }
      } catch {
        // Ignore transient offline errors
      }
    };

    void pullDemoDirectory();
    const timer = window.setInterval(() => {
      void pullDemoDirectory();
    }, 3500);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [portableMode]);

  useEffect(() => {
    if (portableMode) {
      setAuthReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      setCloudError(null);
      if (firebaseUser) {
        setDemoSession(null);
      } else {
        setManagedBusinessIds([]);
        setStaffByBusiness({});
      }
    });
    return () => unsubscribe();
  }, [portableMode]);

  // Real-time Firestore shared directory sync for both signed-in and public community views
  useEffect(() => {
    if (portableMode || !authReady) return;

    let active = true;
    let unsubscribeSnapshot: (() => void) | null = null;

    const connectSharedDirectory = async () => {
      if (user) {
        setSyncing(true);
        setCloudError(null);
        try {
          await ensureSharedDirectorySynced(
            user,
            businessesRef.current,
            analysisCacheRef.current
          );
        } catch (err) {
          if (!active) return;
          setSyncing(false);
          const errorObj = err instanceof Error ? err : new Error(String(err));
          if (
            errorObj.message.includes('Missing or insufficient permissions') ||
            errorObj.message.includes('Quota exceeded')
          ) {
            setCloudError('Cloud directory permissions or quota blocked live sync. Using local & demo directory.');
            return;
          }
          setCloudError('Could not connect to live cloud directory right now. Local copy remains active.');
          return;
        }
      }

      if (!active) return;

      unsubscribeSnapshot = subscribeToSharedDirectory(
        ({ businesses: cloudBusinesses, analyses: cloudAnalyses }) => {
          if (!active) return;
          if (cloudBusinesses.length > 0) {
            setBusinesses(mergeServerDemoOverlay(hydrateSeedImages(cloudBusinesses), demoOverlayRef.current));
          }
          if (Object.keys(cloudAnalyses).length > 0) {
            setAnalysisCache((prev) => {
              const next = { ...prev };
              for (const [bizId, savedState] of Object.entries(cloudAnalyses)) {
                if (!next[bizId]?.loading) {
                  next[bizId] = savedState;
                }
              }
              return next;
            });
          }
          setSyncing(false);
        },
        (err) => {
          if (!active) return;
          setSyncing(false);
          if (err.message.includes('Quota exceeded')) {
            setFatalError(err);
          } else {
            console.warn('Firestore live directory listener notice:', err.message);
          }
        }
      );
    };

    void connectSharedDirectory();

    return () => {
      active = false;
      unsubscribeSnapshot?.();
    };
  }, [portableMode, authReady, user, syncEpoch]);

  // Refresh which businesses the signed-in Google user can manage in the Staff Portal
  useEffect(() => {
    if (portableMode || demoSession) {
      setManagedBusinessIds(businesses.map((b) => b.id));
      return;
    }
    if (!user) {
      setManagedBusinessIds([]);
      setStaffByBusiness({});
      return;
    }

    let active = true;
    setLoadingStaffAccess(true);
    loadStaffAccessForUser(user, businesses)
      .then(({ managedBusinessIds: ids, staffByBusiness: map }) => {
        if (!active) return;
        setManagedBusinessIds(ids);
        setStaffByBusiness(map);
      })
      .catch((err) => {
        if (!active) return;
        console.warn('Could not load staff permissions:', err);
      })
      .finally(() => {
        if (active) setLoadingStaffAccess(false);
      });

    return () => {
      active = false;
    };
  }, [portableMode, demoSession, user, businesses]);

  const selectedBusiness = useMemo(
    () => businesses.find((b) => b.id === selectedBusinessId) ?? null,
    [businesses, selectedBusinessId]
  );

  const featuredBusiness = useMemo(
    () => businesses.find((b) => b.id === featuredBusinessId) ?? businesses[0] ?? null,
    [businesses, featuredBusinessId]
  );

  const pendingReplyCount = useMemo(() => {
    if (!user && !demoSession) return 0;
    return businesses
      .filter((b) => Boolean(demoSession) || isAdmin || managedBusinessIds.includes(b.id))
      .reduce(
        (sum, b) => sum + b.reviews.filter((r) => !r.ownerReply).length,
        0
      );
  }, [user, demoSession, businesses, isAdmin, managedBusinessIds]);

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
          void saveAnalysisInCloud(currentUser, biz.id, signature, data).catch((err) => {
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
    if (isStaffPortalOpen) return;

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
  }, [
    isStaffPortalOpen,
    portableMode,
    selectedBusiness,
    featuredBusiness,
    activeTab,
    analysisCache,
    runFeedbackAnalysis,
  ]);

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
    setCloudError(null);
    const result = await signInWithGoogle();
    if (result.cancelled) return;
    if (result.errorMessage) {
      setCloudError(result.errorMessage);
      return;
    }
    if (result.user) {
      setDemoSession(null);
      setToastMessage(`Signed in as ${result.user.displayName || result.user.email}.`);
    }
  };

  const handleSignInDemo = async (
    email: string,
    accessCode: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (portableMode) {
      const session: DemoStaffSession = {
        token: 'portable-local',
        email: email || 'staff-demo@localrefreshments.demo',
        displayName: 'Demo Store Owner',
        role: 'Owner',
        businessIds: businessesRef.current.map((b) => b.id),
      };
      setDemoSession(session);
      setCloudError(null);
      setToastMessage('Signed into Staff Portal (Portable Decoy Mode).');
      return { ok: true };
    }

    try {
      const res = await fetch('/api/demo-staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accessCode }),
      });
      const data = (await res.json()) as { session?: DemoStaffSession; error?: string };
      if (!res.ok || !data.session) {
        return { ok: false, error: data.error || 'Invalid decoy staff credentials.' };
      }

      if (user) {
        await signOut(auth).catch(() => undefined);
      }

      setDemoSession(data.session);
      setCloudError(null);
      setToastMessage('Signed into Staff Portal with Decoy Staff Credentials.');
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach Staff Portal sign-in service.' };
    }
  };

  const handleSignOut = async () => {
    try {
      if (user) {
        await signOut(auth);
      }
      setDemoSession(null);
      setToastMessage('Signed out.');
    } catch {
      setDemoSession(null);
      setToastMessage('Could not sign out cleanly. Please try again.');
    }
  };

  const handleNavigateHome = (sectionId?: string, nextFilter?: HighlightFilter) => {
    setIsStaffPortalOpen(false);
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

  const handleOpenStaffPortal = (bizId?: string) => {
    if (bizId) {
      setStaffBusinessId(bizId);
    } else if (selectedBusinessId) {
      setStaffBusinessId(selectedBusinessId);
    }
    setIsStaffPortalOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenBusiness = (id: string, tab: ProfileTab = 'reviews') => {
    setIsStaffPortalOpen(false);
    setSelectedBusinessId(id);
    setFeaturedBusinessId(id);
    setStaffBusinessId(id);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateOwnerPostFromAction = (bizId: string, draft: OwnerDraft) => {
    setIsStaffPortalOpen(false);
    setOwnerDraft(draft);
    handleOpenBusiness(bizId, 'owner');
    setToastMessage('Pre-filled owner update from AI improvement suggestion.');
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (selectedBusinessId || isStaffPortalOpen) {
      setSelectedBusinessId(null);
      setIsStaffPortalOpen(false);
    }
  };

  const handleAddBusiness = (input: { name: string; category: string; description: string }) => {
    const newBiz: Business = {
      id: `biz-${Date.now()}`,
      ...(user ? { ownerId: user.uid } : {}),
      name: input.name,
      category: input.category,
      description: input.description,
      reviews: [],
      specials: [],
      events: [],
      jobs: [],
    };
    const nextBusinesses = [newBiz, ...businesses];
    setBusinesses(nextBusinesses);
    broadcastDirectoryUpdate(nextBusinesses);
    setIsAddModalOpen(false);
    setToastMessage(
      user
        ? `Added "${input.name}" and linked you as owner in the Staff Portal.`
        : `Added "${input.name}" to the neighborhood directory.`
    );
    handleOpenBusiness(newBiz.id, 'owner');

    if (user && !portableMode) {
      setSyncing(true);
      void createBusinessInCloud(user, newBiz)
        .then(() => setSyncing(false))
        .catch((err) => {
          setSyncing(false);
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        });
    } else if (!portableMode) {
      void fetch('/api/demo-directory/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business: newBiz,
          businessesSnapshot: businessesRef.current,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.businesses) {
            demoOverlayRef.current = data.businesses;
            lastDemoUpdatedAtRef.current = data.updatedAt || Date.now();
          }
        })
        .catch(() => undefined);
    }
  };

  const submitFeedbackForBusiness = (
    targetBusinessId: string,
    input: { author: string; rating: number; comment: string }
  ) => {
    const newReview: Review = {
      id: `rev-${Date.now()}`,
      author: input.author,
      ...(user ? { authorUid: user.uid } : {}),
      rating: input.rating,
      date: new Date().toISOString().slice(0, 10),
      comment: input.comment,
    };

    const updatedBusinesses = businesses.map((biz) =>
      biz.id === targetBusinessId
        ? { ...biz, reviews: [...biz.reviews, newReview] }
        : biz
    );
    setBusinesses(updatedBusinesses);
    broadcastDirectoryUpdate(updatedBusinesses);
    setMyFeedbackIds((prev) => [...prev.filter((id) => id !== newReview.id), newReview.id]);

    setToastMessage(
      portableMode
        ? 'Feedback saved on this device and visible in the Staff Portal.'
        : 'Feedback sent to the Staff Portal! Any owner reply will appear in your feedback section.'
    );

    if (user && !portableMode) {
      setSyncing(true);
      void createReviewInCloud(user, targetBusinessId, newReview)
        .then(() => setSyncing(false))
        .catch((err) => {
          setSyncing(false);
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        });
    }

    if (!portableMode) {
      void fetch('/api/demo-directory/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: targetBusinessId,
          review: newReview,
          businessesSnapshot: businessesRef.current,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.businesses) {
            demoOverlayRef.current = data.businesses;
            lastDemoUpdatedAtRef.current = data.updatedAt || Date.now();
          }
        })
        .catch(() => undefined);
    }

    const updatedBiz = updatedBusinesses.find((b) => b.id === targetBusinessId);
    if (updatedBiz && !portableMode) {
      void runFeedbackAnalysis(updatedBiz, true);
    }
  };

  const handleAddReview = (input: { author: string; rating: number; comment: string }) => {
    if (!selectedBusiness) return;
    submitFeedbackForBusiness(selectedBusiness.id, input);
  };

  const handleReplyToReview = async (
    businessId: string,
    reviewId: string,
    reply: OwnerReply
  ) => {
    const nextBusinesses = businesses.map((biz) =>
      biz.id === businessId
        ? {
            ...biz,
            reviews: biz.reviews.map((rev) =>
              rev.id === reviewId ? { ...rev, ownerReply: reply } : rev
            ),
          }
        : biz
    );
    setBusinesses(nextBusinesses);
    broadcastDirectoryUpdate(nextBusinesses);

    if (user && !demoSession && !portableMode) {
      setSyncing(true);
      try {
        await replyToReviewInCloud(user, businessId, reviewId, reply);
        setSyncing(false);
        setToastMessage('Reply published! The feedback writer can now see your response.');
      } catch (err) {
        setSyncing(false);
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }

    if (demoSession && !portableMode) {
      try {
        const res = await fetch('/api/demo-directory/replies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${demoSession.token}`,
          },
          body: JSON.stringify({
            businessId,
            reviewId,
            reply,
            businessesSnapshot: businessesRef.current,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          businesses?: Business[];
          updatedAt?: number;
          error?: string;
        };
        if (res.ok && data.businesses) {
          demoOverlayRef.current = data.businesses;
          lastDemoUpdatedAtRef.current = data.updatedAt || Date.now();
        } else if (res.status === 401) {
          setDemoSession(null);
          setToastMessage(data.error || 'Demo staff session expired. Please sign in again.');
          return;
        }
      } catch {
        // Local copy already updated
      }
    }

    setToastMessage('Reply published! Visible in the feedback writer portal and review card.');
  };

  const handleAddOwnerPostForBusiness = (
    businessId: string,
    input: { type: PostCategoryKey; date: string; title: string; details: string },
    switchToUpdatesTab = false
  ) => {
    const canManageTarget =
      portableMode ||
      Boolean(demoSession) ||
      isAdmin ||
      managedBusinessIds.includes(businessId);
    if (user && !demoSession && !portableMode && !canManageTarget) {
      setToastMessage('Only the business owner or authorized staff can publish official updates.');
      return;
    }

    const newPost = {
      id: `post-${Date.now()}`,
      title: input.title,
      details: input.details,
      date: input.date,
    };

    const nextBusinesses = businesses.map((biz) =>
      biz.id === businessId
        ? { ...biz, [input.type]: [newPost, ...biz[input.type]] }
        : biz
    );
    setBusinesses(nextBusinesses);
    broadcastDirectoryUpdate(nextBusinesses);

    setToastMessage(
      user || demoSession
        ? 'Update published to the community board.'
        : 'Update published locally.'
    );
    if (switchToUpdatesTab) {
      setActiveTab('updates');
    }

    if (user && !demoSession && !portableMode) {
      setSyncing(true);
      void createPostInCloud(user, businessId, input.type, newPost)
        .then(() => setSyncing(false))
        .catch((err) => {
          setSyncing(false);
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        });
    } else if (demoSession && !portableMode) {
      void fetch('/api/demo-directory/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${demoSession.token}`,
        },
        body: JSON.stringify({
          businessId,
          type: input.type,
          post: newPost,
          businessesSnapshot: businessesRef.current,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.businesses) {
            demoOverlayRef.current = data.businesses;
            lastDemoUpdatedAtRef.current = data.updatedAt || Date.now();
          }
        })
        .catch(() => undefined);
    }
  };

  const handleAddStaffMember = async (
    business: Business,
    email: string,
    role: StaffRole
  ) => {
    if (!user || demoSession || portableMode) return;
    setSyncing(true);
    try {
      const added = await addStaffMemberInCloud(user, business, email, role);
      setStaffByBusiness((prev) => {
        const current = prev[business.id] ?? [];
        const filtered = current.filter((m) => m.id !== added.id);
        return { ...prev, [business.id]: [...filtered, added] };
      });
      setToastMessage(`Authorized ${added.email} (${added.role}) for ${business.name}.`);
    } catch (err) {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSyncing(false);
    }
  };

  const handleRemoveStaffMember = async (businessId: string, memberId: string) => {
    if (!user || demoSession || portableMode) return;
    setSyncing(true);
    try {
      await removeStaffMemberInCloud(businessId, memberId);
      setStaffByBusiness((prev) => ({
        ...prev,
        [businessId]: (prev[businessId] ?? []).filter((m) => m.id !== memberId),
      }));
      setToastMessage('Removed staff access.');
    } catch (err) {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSyncing(false);
    }
  };

  const handleResetDemoData = () => {
    const fresh = structuredClone(SEED_BUSINESSES);
    setBusinesses(fresh);
    saveBusinesses(fresh);
    broadcastDirectoryUpdate(fresh);
    demoOverlayRef.current = null;
    lastDemoUpdatedAtRef.current = Date.now();
    setAnalysisCache({});
    saveCachedAnalyses({});
    setMyFeedbackIds([]);
    saveMyFeedbackIds([]);
    setSearchQuery('');
    setHighlightFilter('all');
    setSelectedBusinessId(null);
    setIsStaffPortalOpen(false);
    setFeaturedBusinessId(fresh[0]?.id ?? '');
    setStaffBusinessId(fresh[0]?.id ?? '');
    setToastMessage(user ? 'Restoring demo directory in cloud...' : 'Demo directory restored.');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (demoSession && !portableMode) {
      void fetch('/api/demo-directory/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${demoSession.token}` },
      }).catch(() => undefined);
    }

    if (user && !portableMode && isAdmin) {
      setSyncing(true);
      void resetSharedDirectoryInCloud(user, fresh)
        .then(() => {
          setSyncing(false);
          setToastMessage('Demo directory restored in shared cloud database.');
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
        isStaffPortalOpen={isStaffPortalOpen}
        onNavigateHome={handleNavigateHome}
        onOpenStaffPortal={() => handleOpenStaffPortal()}
        onOpenAddBusiness={() => setIsAddModalOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        <WorkspaceSyncBar
          user={user}
          demoSession={demoSession}
          authReady={authReady}
          syncing={syncing}
          exporting={exporting}
          portableMode={portableMode}
          isStaffPortalOpen={isStaffPortalOpen}
          pendingReplyCount={pendingReplyCount}
          cloudError={cloudError}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onRetrySync={() => setSyncEpoch((prev) => prev + 1)}
          onExportHtml={handleExportSingleHtml}
          onOpenStaffPortal={() => handleOpenStaffPortal()}
        />

        {isStaffPortalOpen ? (
          <StaffPortalView
            user={user}
            demoSession={demoSession}
            demoSandbox={demoSandbox}
            authError={cloudError}
            isAdmin={isAdmin}
            loadingStaffAccess={loadingStaffAccess}
            portableMode={portableMode}
            businesses={businesses}
            managedBusinessIds={managedBusinessIds}
            staffByBusiness={staffByBusiness}
            analysisCache={analysisCache}
            selectedBusinessId={staffBusinessId}
            onSelectBusiness={setStaffBusinessId}
            onBackToCommunity={() => handleNavigateHome()}
            onSignIn={handleSignIn}
            onSignInDemo={handleSignInDemo}
            onSignOut={handleSignOut}
            onOpenAddBusiness={() => setIsAddModalOpen(true)}
            onReplyToReview={handleReplyToReview}
            onRunAnalysis={runFeedbackAnalysis}
            onPublishPost={(bizId, input) => handleAddOwnerPostForBusiness(bizId, input, false)}
            onAddStaffMember={handleAddStaffMember}
            onRemoveStaffMember={handleRemoveStaffMember}
          />
        ) : selectedBusiness ? (
          <BusinessProfileView
            business={selectedBusiness}
            activeTab={activeTab}
            analysisState={analysisCache[selectedBusiness.id]}
            ownerDraft={ownerDraft}
            isSignedIn={Boolean(user || demoSession)}
            canManageBusiness={
              portableMode ||
              Boolean(demoSession) ||
              isAdmin ||
              managedBusinessIds.includes(selectedBusiness.id)
            }
            portableMode={portableMode}
            onClearOwnerDraft={() => setOwnerDraft(null)}
            onBack={() => handleNavigateHome()}
            onOpenStaffPortal={() => handleOpenStaffPortal(selectedBusiness.id)}
            onSignIn={handleSignIn}
            onTabChange={setActiveTab}
            onRunAnalysis={(force) => runFeedbackAnalysis(selectedBusiness, force)}
            onCreateOwnerPostFromAction={(draft) =>
              handleCreateOwnerPostFromAction(selectedBusiness.id, draft)
            }
            onSubmitReview={handleAddReview}
            onSubmitOwnerPost={(input) =>
              handleAddOwnerPostForBusiness(selectedBusiness.id, input, true)
            }
          />
        ) : (
          <HomeView
            businesses={businesses}
            highlights={allHighlights}
            highlightFilter={highlightFilter}
            searchQuery={searchQuery}
            analysisCache={analysisCache}
            featuredBusinessId={featuredBusinessId}
            myFeedbackIds={myFeedbackIds}
            currentUserUid={user?.uid}
            onSelectFeaturedBusiness={setFeaturedBusinessId}
            onRunAnalysis={runFeedbackAnalysis}
            onCreateOwnerPost={handleCreateOwnerPostFromAction}
            onSubmitQuickFeedback={submitFeedbackForBusiness}
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
