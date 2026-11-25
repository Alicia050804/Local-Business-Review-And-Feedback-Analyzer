import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  ActionInsight,
  AnalysisState,
  Business,
  CommunityPost,
  FeedbackAnalysis,
  LoveInsight,
  PostCategoryKey,
  Review,
  UnhappyInsight,
} from '../types';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `id-${Date.now()}`;
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

interface StoredReviewDoc {
  id: string;
  businessId: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
}

interface StoredPostDoc {
  id: string;
  businessId: string;
  type: PostCategoryKey;
  title: string;
  details: string;
  date: string;
}

interface StoredBusinessDoc {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl?: string;
}

interface StoredAnalysisDoc {
  businessId: string;
  signature: string;
  summary: string;
  loves: LoveInsight[];
  unhappy: UnhappyInsight[];
  actions: ActionInsight[];
}

export async function ensureWorkspaceAndSeed(
  user: User,
  localBusinesses: Business[],
  localAnalyses: Record<string, AnalysisState>
): Promise<void> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (snap.exists() && snap.data()?.seeded === true) {
    return;
  }

  const batch = writeBatch(db);
  const displayName = clip(user.displayName || user.email?.split('@')[0] || 'Neighbor', 100);

  batch.set(userRef, {
    uid: user.uid,
    displayName,
    seeded: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const biz of localBusinesses) {
    const bizId = sanitizeId(biz.id);
    const bizRef = doc(db, 'users', user.uid, 'businesses', bizId);
    const bizPayload: Record<string, unknown> = {
      id: bizId,
      ownerId: user.uid,
      name: clip(biz.name, 120) || 'Local Business',
      category: clip(biz.category, 80) || 'Local Spot',
      description: clip(biz.description, 800) || 'Neighborhood spot',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (biz.imageUrl && biz.imageUrl.trim()) {
      bizPayload.imageUrl = clip(biz.imageUrl, 300);
    }
    batch.set(bizRef, bizPayload);

    for (const rev of biz.reviews || []) {
      const revId = sanitizeId(rev.id);
      const revRef = doc(db, 'users', user.uid, 'reviews', revId);
      batch.set(revRef, {
        id: revId,
        ownerId: user.uid,
        businessId: bizId,
        author: clip(rev.author, 60) || 'Neighbor',
        rating: Math.min(5, Math.max(1, Math.round(Number(rev.rating) || 5))),
        date: clip(rev.date || new Date().toISOString().slice(0, 10), 32),
        comment: clip(rev.comment, 1000) || 'Great spot!',
        createdAt: serverTimestamp(),
      });
    }

    const postGroups: { type: PostCategoryKey; list: CommunityPost[] }[] = [
      { type: 'specials', list: biz.specials || [] },
      { type: 'events', list: biz.events || [] },
      { type: 'jobs', list: biz.jobs || [] },
    ];

    for (const group of postGroups) {
      for (const post of group.list) {
        const postId = sanitizeId(post.id);
        const postRef = doc(db, 'users', user.uid, 'posts', postId);
        batch.set(postRef, {
          id: postId,
          ownerId: user.uid,
          businessId: bizId,
          type: group.type,
          title: clip(post.title, 140) || 'Community Update',
          details: clip(post.details, 1000) || 'Details available in store.',
          date: clip(post.date || 'This Week', 64),
          createdAt: serverTimestamp(),
        });
      }
    }

    const cachedAnalysis = localAnalyses[biz.id];
    if (cachedAnalysis?.data && cachedAnalysis.signature) {
      const analysisRef = doc(db, 'users', user.uid, 'analyses', bizId);
      batch.set(analysisRef, {
        businessId: bizId,
        ownerId: user.uid,
        signature: clip(cachedAnalysis.signature, 5000),
        summary: clip(cachedAnalysis.data.summary || '', 1000),
        loves: (cachedAnalysis.data.loves || []).slice(0, 6),
        unhappy: (cachedAnalysis.data.unhappy || []).slice(0, 6),
        actions: (cachedAnalysis.data.actions || []).slice(0, 6),
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export function subscribeToWorkspace(
  uid: string,
  onUpdate: (payload: {
    businesses: Business[];
    analyses: Record<string, AnalysisState>;
  }) => void,
  onError: (err: Error) => void
): () => void {
  let bizDocs: StoredBusinessDoc[] = [];
  let reviewDocs: StoredReviewDoc[] = [];
  let postDocs: StoredPostDoc[] = [];
  let analysisDocs: StoredAnalysisDoc[] = [];

  let readyCount = { biz: false, rev: false, post: false, analysis: false };

  const emit = () => {
    if (!readyCount.biz || !readyCount.rev || !readyCount.post || !readyCount.analysis) {
      return;
    }

    const businesses: Business[] = bizDocs.map((b) => {
      const reviews: Review[] = reviewDocs
        .filter((r) => r.businessId === b.id)
        .map((r) => ({
          id: r.id,
          author: r.author,
          rating: r.rating,
          date: r.date,
          comment: r.comment,
        }));

      const bizPosts = postDocs.filter((p) => p.businessId === b.id);
      const specials: CommunityPost[] = bizPosts
        .filter((p) => p.type === 'specials')
        .map(({ id, title, details, date }) => ({ id, title, details, date }));
      const events: CommunityPost[] = bizPosts
        .filter((p) => p.type === 'events')
        .map(({ id, title, details, date }) => ({ id, title, details, date }));
      const jobs: CommunityPost[] = bizPosts
        .filter((p) => p.type === 'jobs')
        .map(({ id, title, details, date }) => ({ id, title, details, date }));

      return {
        id: b.id,
        name: b.name,
        category: b.category,
        description: b.description,
        ...(b.imageUrl ? { imageUrl: b.imageUrl } : {}),
        reviews,
        specials,
        events,
        jobs,
      };
    });

    const analyses: Record<string, AnalysisState> = {};
    for (const docItem of analysisDocs) {
      analyses[docItem.businessId] = {
        signature: docItem.signature,
        loading: false,
        data: {
          summary: docItem.summary || '',
          loves: Array.isArray(docItem.loves) ? docItem.loves : [],
          unhappy: Array.isArray(docItem.unhappy) ? docItem.unhappy : [],
          actions: Array.isArray(docItem.actions) ? docItem.actions : [],
        },
      };
    }

    onUpdate({ businesses, analyses });
  };

  const bizPath = `users/${uid}/businesses`;
  const revPath = `users/${uid}/reviews`;
  const postPath = `users/${uid}/posts`;
  const analysisPath = `users/${uid}/analyses`;

  const unsubBiz = onSnapshot(
    query(collection(db, 'users', uid, 'businesses'), where('ownerId', '==', uid)),
    (snap) => {
      bizDocs = snap.docs.map((d) => d.data() as StoredBusinessDoc);
      readyCount.biz = true;
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, bizPath);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );

  const unsubRev = onSnapshot(
    query(collection(db, 'users', uid, 'reviews'), where('ownerId', '==', uid)),
    (snap) => {
      reviewDocs = snap.docs.map((d) => d.data() as StoredReviewDoc);
      readyCount.rev = true;
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, revPath);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );

  const unsubPost = onSnapshot(
    query(collection(db, 'users', uid, 'posts'), where('ownerId', '==', uid)),
    (snap) => {
      postDocs = snap.docs.map((d) => d.data() as StoredPostDoc);
      readyCount.post = true;
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, postPath);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );

  const unsubAnalysis = onSnapshot(
    query(collection(db, 'users', uid, 'analyses'), where('ownerId', '==', uid)),
    (snap) => {
      analysisDocs = snap.docs.map((d) => d.data() as StoredAnalysisDoc);
      readyCount.analysis = true;
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, analysisPath);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );

  return () => {
    unsubBiz();
    unsubRev();
    unsubPost();
    unsubAnalysis();
  };
}

export async function saveBusinessToCloud(uid: string, biz: Business): Promise<void> {
  const bizId = sanitizeId(biz.id);
  const path = `users/${uid}/businesses/${bizId}`;
  const ref = doc(db, 'users', uid, 'businesses', bizId);

  const payload: Record<string, unknown> = {
    id: bizId,
    ownerId: uid,
    name: clip(biz.name, 120) || 'Local Business',
    category: clip(biz.category, 80) || 'Local Spot',
    description: clip(biz.description, 800) || 'Neighborhood spot',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (biz.imageUrl && biz.imageUrl.trim()) {
    payload.imageUrl = clip(biz.imageUrl, 300);
  }

  try {
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveReviewToCloud(
  uid: string,
  businessId: string,
  review: Review
): Promise<void> {
  const bizId = sanitizeId(businessId);
  const revId = sanitizeId(review.id);
  const path = `users/${uid}/reviews/${revId}`;
  const ref = doc(db, 'users', uid, 'reviews', revId);

  try {
    await setDoc(ref, {
      id: revId,
      ownerId: uid,
      businessId: bizId,
      author: clip(review.author, 60) || 'Neighbor',
      rating: Math.min(5, Math.max(1, Math.round(Number(review.rating) || 5))),
      date: clip(review.date || new Date().toISOString().slice(0, 10), 32),
      comment: clip(review.comment, 1000) || 'Great experience.',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function savePostToCloud(
  uid: string,
  businessId: string,
  type: PostCategoryKey,
  post: CommunityPost
): Promise<void> {
  const bizId = sanitizeId(businessId);
  const postId = sanitizeId(post.id);
  const path = `users/${uid}/posts/${postId}`;
  const ref = doc(db, 'users', uid, 'posts', postId);

  try {
    await setDoc(ref, {
      id: postId,
      ownerId: uid,
      businessId: bizId,
      type,
      title: clip(post.title, 140) || 'Update',
      details: clip(post.details, 1000) || 'Details available.',
      date: clip(post.date || 'This Week', 64),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveAnalysisToCloud(
  uid: string,
  businessId: string,
  signature: string,
  data: FeedbackAnalysis
): Promise<void> {
  const bizId = sanitizeId(businessId);
  const path = `users/${uid}/analyses/${bizId}`;
  const ref = doc(db, 'users', uid, 'analyses', bizId);

  try {
    await setDoc(ref, {
      businessId: bizId,
      ownerId: uid,
      signature: clip(signature, 5000) || 'default',
      summary: clip(data.summary || '', 1000),
      loves: (data.loves || []).slice(0, 6),
      unhappy: (data.unhappy || []).slice(0, 6),
      actions: (data.actions || []).slice(0, 6),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function resetWorkspaceInCloud(
  user: User,
  seedBusinesses: Business[]
): Promise<void> {
  const uid = user.uid;
  const colNames = ['analyses', 'posts', 'reviews', 'businesses'] as const;

  const deleteBatch = writeBatch(db);
  for (const colName of colNames) {
    const colPath = `users/${uid}/${colName}`;
    try {
      const snap = await getDocs(
        query(collection(db, 'users', uid, colName), where('ownerId', '==', uid))
      );
      snap.docs.forEach((d) => deleteBatch.delete(d.ref));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, colPath);
    }
  }

  deleteBatch.delete(doc(db, 'users', uid));

  try {
    await deleteBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }

  await ensureWorkspaceAndSeed(user, seedBusinesses, {});
}
