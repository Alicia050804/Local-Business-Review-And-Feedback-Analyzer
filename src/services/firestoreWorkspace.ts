import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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
  OwnerReply,
  PostCategoryKey,
  Review,
  StaffMember,
  StaffRole,
  UnhappyInsight,
} from '../types';

export const ADMIN_EMAIL = 'xolilemalele@gmail.com';

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `id-${Date.now()}`;
}

export function getStaffKey(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_').slice(0, 128);
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function isDirectoryAdmin(user: User | null): boolean {
  return Boolean(
    user?.email &&
      user.emailVerified &&
      user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

interface StoredBusinessDoc {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  description: string;
  imageUrl?: string;
}

interface StoredReviewDoc {
  id: string;
  businessId: string;
  authorUid: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  ownerReply?: {
    message: string;
    authorName: string;
    authorRole: StaffRole;
    authorUid?: string;
    date: string;
  };
}

interface StoredPostDoc {
  id: string;
  businessId: string;
  type: PostCategoryKey;
  title: string;
  details: string;
  date: string;
}

interface StoredAnalysisDoc {
  businessId: string;
  signature: string;
  summary: string;
  loves: LoveInsight[];
  unhappy: UnhappyInsight[];
  actions: ActionInsight[];
}

export async function ensureSharedDirectorySynced(
  user: User,
  localBusinesses: Business[],
  localAnalyses: Record<string, AnalysisState>
): Promise<void> {
  const businessesCol = collection(db, 'businesses');
  let existingSnap;
  try {
    existingSnap = await getDocs(query(businessesCol, where('isPublic', '==', true)));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'businesses');
  }

  const existingIds = new Set(existingSnap.docs.map((d) => d.id));
  const bizBatch = writeBatch(db);
  let bizOpsCount = 0;
  const subBatch = writeBatch(db);
  let subOpsCount = 0;

  // If the shared directory is empty, seed it with the current businesses (including any local creations)
  if (existingIds.size === 0) {
    for (const biz of localBusinesses) {
      const bizId = sanitizeId(biz.id);
      const bizRef = doc(db, 'businesses', bizId);
      const bizPayload: Record<string, unknown> = {
        id: bizId,
        ownerId: user.uid,
        name: clip(biz.name, 120) || 'Local Business',
        category: clip(biz.category, 80) || 'Local Spot',
        description: clip(biz.description, 800) || 'Neighborhood spot',
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (biz.imageUrl && biz.imageUrl.trim()) {
        bizPayload.imageUrl = clip(biz.imageUrl, 300);
      }
      bizBatch.set(bizRef, bizPayload);
      bizOpsCount++;

      for (const rev of biz.reviews || []) {
        const revId = sanitizeId(rev.id);
        const revRef = doc(db, 'businesses', bizId, 'reviews', revId);
        const revPayload: Record<string, unknown> = {
          id: revId,
          businessId: bizId,
          authorUid: user.uid,
          author: clip(rev.author, 60) || 'Neighbor',
          rating: Math.min(5, Math.max(1, Math.round(Number(rev.rating) || 5))),
          date: clip(rev.date || new Date().toISOString().slice(0, 10), 32),
          comment: clip(rev.comment, 1000) || 'Great spot!',
          isPublic: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        subBatch.set(revRef, revPayload);
        subOpsCount++;
      }

      const postGroups: { type: PostCategoryKey; list: CommunityPost[] }[] = [
        { type: 'specials', list: biz.specials || [] },
        { type: 'events', list: biz.events || [] },
        { type: 'jobs', list: biz.jobs || [] },
      ];

      for (const group of postGroups) {
        for (const post of group.list) {
          const postId = sanitizeId(post.id);
          const postRef = doc(db, 'businesses', bizId, 'posts', postId);
          subBatch.set(postRef, {
            id: postId,
            businessId: bizId,
            authorUid: user.uid,
            type: group.type,
            title: clip(post.title, 140) || 'Community Update',
            details: clip(post.details, 1000) || 'Details available.',
            date: clip(post.date || 'This Week', 64),
            isPublic: true,
            createdAt: serverTimestamp(),
          });
          subOpsCount++;
        }
      }

      const cachedAnalysis = localAnalyses[biz.id];
      if (cachedAnalysis?.data && cachedAnalysis.signature) {
        const analysisRef = doc(db, 'businesses', bizId, 'analyses', 'latest');
        subBatch.set(analysisRef, {
          businessId: bizId,
          authorUid: user.uid,
          signature: clip(cachedAnalysis.signature, 5000),
          summary: clip(cachedAnalysis.data.summary || '', 1000),
          loves: (cachedAnalysis.data.loves || []).slice(0, 6),
          unhappy: (cachedAnalysis.data.unhappy || []).slice(0, 6),
          actions: (cachedAnalysis.data.actions || []).slice(0, 6),
          isPublic: true,
          updatedAt: serverTimestamp(),
        });
        subOpsCount++;
      }
    }
  } else {
    // Directory already exists: sync any locally created businesses or unsynced community reviews
    for (const biz of localBusinesses) {
      const bizId = sanitizeId(biz.id);
      if (!existingIds.has(bizId)) {
        const bizRef = doc(db, 'businesses', bizId);
        const bizPayload: Record<string, unknown> = {
          id: bizId,
          ownerId: user.uid,
          name: clip(biz.name, 120) || 'Local Business',
          category: clip(biz.category, 80) || 'Local Spot',
          description: clip(biz.description, 800) || 'Neighborhood spot',
          isPublic: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (biz.imageUrl && biz.imageUrl.trim()) {
          bizPayload.imageUrl = clip(biz.imageUrl, 300);
        }
        bizBatch.set(bizRef, bizPayload);
        bizOpsCount++;
      }

      // Check for locally posted reviews (created while signed out)
      const localUnsyncedReviews = (biz.reviews || []).filter(
        (r) => r.id.startsWith('rev-') && !r.authorUid
      );
      if (localUnsyncedReviews.length > 0 && existingIds.has(bizId)) {
        let cloudRevIds = new Set<string>();
        try {
          const revSnap = await getDocs(
            query(collection(db, 'businesses', bizId, 'reviews'), where('isPublic', '==', true))
          );
          cloudRevIds = new Set(revSnap.docs.map((d) => d.id));
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, `businesses/${bizId}/reviews`);
        }

        for (const rev of localUnsyncedReviews) {
          const revId = sanitizeId(rev.id);
          if (!cloudRevIds.has(revId)) {
            const revRef = doc(db, 'businesses', bizId, 'reviews', revId);
            subBatch.set(revRef, {
              id: revId,
              businessId: bizId,
              authorUid: user.uid,
              author: clip(rev.author, 60) || 'Neighbor',
              rating: Math.min(5, Math.max(1, Math.round(Number(rev.rating) || 5))),
              date: clip(rev.date || new Date().toISOString().slice(0, 10), 32),
              comment: clip(rev.comment, 1000) || 'Great spot!',
              isPublic: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            subOpsCount++;
          }
        }
      }
    }
  }

  if (bizOpsCount > 0) {
    try {
      await bizBatch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'businesses');
    }
  }

  if (subOpsCount > 0) {
    try {
      await subBatch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'businesses');
    }
  }
}

export async function fetchSharedDirectoryOnce(): Promise<{
  businesses: Business[];
  analyses: Record<string, AnalysisState>;
}> {
  const bizSnap = await getDocs(
    query(collection(db, 'businesses'), where('isPublic', '==', true))
  );
  if (bizSnap.empty) {
    return { businesses: [], analyses: {} };
  }

  const businesses: Business[] = [];
  const analyses: Record<string, AnalysisState> = {};

  for (const bizDoc of bizSnap.docs) {
    const b = bizDoc.data() as StoredBusinessDoc;
    const [revSnap, postSnap, analysisSnap] = await Promise.all([
      getDocs(query(collection(db, 'businesses', b.id, 'reviews'), where('isPublic', '==', true))),
      getDocs(query(collection(db, 'businesses', b.id, 'posts'), where('isPublic', '==', true))),
      getDocs(query(collection(db, 'businesses', b.id, 'analyses'), where('isPublic', '==', true))),
    ]);

    const reviews: Review[] = revSnap.docs.map((d) => {
      const data = d.data() as StoredReviewDoc;
      return {
        id: data.id,
        author: data.author,
        authorUid: data.authorUid,
        rating: data.rating,
        date: data.date,
        comment: data.comment,
        ...(data.ownerReply
          ? {
              ownerReply: {
                message: data.ownerReply.message,
                authorName: data.ownerReply.authorName,
                authorRole: data.ownerReply.authorRole,
                authorUid: data.ownerReply.authorUid,
                date: data.ownerReply.date,
              },
            }
          : {}),
      };
    });

    const bizPosts = postSnap.docs.map((d) => d.data() as StoredPostDoc);
    businesses.push({
      id: b.id,
      ownerId: b.ownerId,
      name: b.name,
      category: b.category,
      description: b.description,
      ...(b.imageUrl ? { imageUrl: b.imageUrl } : {}),
      reviews,
      specials: bizPosts
        .filter((p) => p.type === 'specials')
        .map(({ id, title, details, date }) => ({ id, title, details, date })),
      events: bizPosts
        .filter((p) => p.type === 'events')
        .map(({ id, title, details, date }) => ({ id, title, details, date })),
      jobs: bizPosts
        .filter((p) => p.type === 'jobs')
        .map(({ id, title, details, date }) => ({ id, title, details, date })),
    });

    const latestAnalysis = analysisSnap.docs[0]?.data() as StoredAnalysisDoc | undefined;
    if (latestAnalysis) {
      analyses[b.id] = {
        signature: latestAnalysis.signature,
        loading: false,
        data: {
          summary: latestAnalysis.summary || '',
          loves: Array.isArray(latestAnalysis.loves) ? latestAnalysis.loves : [],
          unhappy: Array.isArray(latestAnalysis.unhappy) ? latestAnalysis.unhappy : [],
          actions: Array.isArray(latestAnalysis.actions) ? latestAnalysis.actions : [],
        },
      };
    }
  }

  return { businesses, analyses };
}

export function subscribeToSharedDirectory(
  onUpdate: (payload: {
    businesses: Business[];
    analyses: Record<string, AnalysisState>;
  }) => void,
  onError: (err: Error) => void
): () => void {
  let bizDocs: StoredBusinessDoc[] = [];
  const reviewsByBiz: Record<string, Review[]> = {};
  const postsByBiz: Record<string, StoredPostDoc[]> = {};
  const analysesByBiz: Record<string, AnalysisState> = {};
  const subUnsubs: Record<string, () => void> = {};

  const emit = () => {
    const businesses: Business[] = bizDocs.map((b) => {
      const bizPosts = postsByBiz[b.id] || [];
      return {
        id: b.id,
        ownerId: b.ownerId,
        name: b.name,
        category: b.category,
        description: b.description,
        ...(b.imageUrl ? { imageUrl: b.imageUrl } : {}),
        reviews: reviewsByBiz[b.id] || [],
        specials: bizPosts
          .filter((p) => p.type === 'specials')
          .map(({ id, title, details, date }) => ({ id, title, details, date })),
        events: bizPosts
          .filter((p) => p.type === 'events')
          .map(({ id, title, details, date }) => ({ id, title, details, date })),
        jobs: bizPosts
          .filter((p) => p.type === 'jobs')
          .map(({ id, title, details, date }) => ({ id, title, details, date })),
      };
    });

    onUpdate({
      businesses,
      analyses: { ...analysesByBiz },
    });
  };

  const attachBusinessSubListeners = (bizId: string) => {
    if (subUnsubs[bizId]) return;

    const revPath = `businesses/${bizId}/reviews`;
    const postPath = `businesses/${bizId}/posts`;
    const analysisPath = `businesses/${bizId}/analyses`;

    const unsubRev = onSnapshot(
      query(collection(db, 'businesses', bizId, 'reviews'), where('isPublic', '==', true)),
      (snap) => {
        reviewsByBiz[bizId] = snap.docs.map((d) => {
          const data = d.data() as StoredReviewDoc;
          return {
            id: data.id,
            author: data.author,
            authorUid: data.authorUid,
            rating: data.rating,
            date: data.date,
            comment: data.comment,
            ...(data.ownerReply
              ? {
                  ownerReply: {
                    message: data.ownerReply.message,
                    authorName: data.ownerReply.authorName,
                    authorRole: data.ownerReply.authorRole,
                    authorUid: data.ownerReply.authorUid,
                    date: data.ownerReply.date,
                  },
                }
              : {}),
          };
        });
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
      query(collection(db, 'businesses', bizId, 'posts'), where('isPublic', '==', true)),
      (snap) => {
        postsByBiz[bizId] = snap.docs.map((d) => d.data() as StoredPostDoc);
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
      query(collection(db, 'businesses', bizId, 'analyses'), where('isPublic', '==', true)),
      (snap) => {
        const latest = snap.docs[0]?.data() as StoredAnalysisDoc | undefined;
        if (latest) {
          analysesByBiz[bizId] = {
            signature: latest.signature,
            loading: false,
            data: {
              summary: latest.summary || '',
              loves: Array.isArray(latest.loves) ? latest.loves : [],
              unhappy: Array.isArray(latest.unhappy) ? latest.unhappy : [],
              actions: Array.isArray(latest.actions) ? latest.actions : [],
            },
          };
        }
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

    subUnsubs[bizId] = () => {
      unsubRev();
      unsubPost();
      unsubAnalysis();
    };
  };

  const unsubBusinesses = onSnapshot(
    query(collection(db, 'businesses'), where('isPublic', '==', true)),
    (snap) => {
      bizDocs = snap.docs.map((d) => d.data() as StoredBusinessDoc);
      const activeIds = new Set(bizDocs.map((b) => b.id));

      for (const existingId of Object.keys(subUnsubs)) {
        if (!activeIds.has(existingId)) {
          subUnsubs[existingId]();
          delete subUnsubs[existingId];
          delete reviewsByBiz[existingId];
          delete postsByBiz[existingId];
          delete analysesByBiz[existingId];
        }
      }

      for (const biz of bizDocs) {
        attachBusinessSubListeners(biz.id);
      }

      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'businesses');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );

  return () => {
    unsubBusinesses();
    for (const unsub of Object.values(subUnsubs)) {
      unsub();
    }
  };
}

export async function createBusinessInCloud(user: User, biz: Business): Promise<void> {
  const bizId = sanitizeId(biz.id);
  const path = `businesses/${bizId}`;
  const ref = doc(db, 'businesses', bizId);

  const payload: Record<string, unknown> = {
    id: bizId,
    ownerId: user.uid,
    name: clip(biz.name, 120) || 'Local Business',
    category: clip(biz.category, 80) || 'Local Spot',
    description: clip(biz.description, 800) || 'Neighborhood spot',
    isPublic: true,
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

export async function createReviewInCloud(
  user: User,
  businessId: string,
  review: Review
): Promise<void> {
  const bizId = sanitizeId(businessId);
  const revId = sanitizeId(review.id);
  const path = `businesses/${bizId}/reviews/${revId}`;
  const ref = doc(db, 'businesses', bizId, 'reviews', revId);

  try {
    await setDoc(ref, {
      id: revId,
      businessId: bizId,
      authorUid: user.uid,
      author: clip(review.author, 60) || 'Neighbor',
      rating: Math.min(5, Math.max(1, Math.round(Number(review.rating) || 5))),
      date: clip(review.date || new Date().toISOString().slice(0, 10), 32),
      comment: clip(review.comment, 1000) || 'Great spot!',
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function replyToReviewInCloud(
  user: User,
  businessId: string,
  reviewId: string,
  reply: OwnerReply
): Promise<void> {
  const bizId = sanitizeId(businessId);
  const revId = sanitizeId(reviewId);
  const path = `businesses/${bizId}/reviews/${revId}`;
  const ref = doc(db, 'businesses', bizId, 'reviews', revId);

  try {
    await updateDoc(ref, {
      ownerReply: {
        message: clip(reply.message, 1000),
        authorName: clip(reply.authorName, 60) || 'Owner',
        authorRole: reply.authorRole,
        authorUid: user.uid,
        date: clip(reply.date || new Date().toISOString().slice(0, 10), 32),
        repliedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createPostInCloud(
  user: User,
  businessId: string,
  type: PostCategoryKey,
  post: CommunityPost
): Promise<void> {
  const bizId = sanitizeId(businessId);
  const postId = sanitizeId(post.id);
  const path = `businesses/${bizId}/posts/${postId}`;
  const ref = doc(db, 'businesses', bizId, 'posts', postId);

  try {
    await setDoc(ref, {
      id: postId,
      businessId: bizId,
      authorUid: user.uid,
      type,
      title: clip(post.title, 140) || 'Update',
      details: clip(post.details, 1000) || 'Details available.',
      date: clip(post.date || 'This Week', 64),
      isPublic: true,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveAnalysisInCloud(
  user: User,
  businessId: string,
  signature: string,
  data: FeedbackAnalysis
): Promise<void> {
  const bizId = sanitizeId(businessId);
  const path = `businesses/${bizId}/analyses/latest`;
  const ref = doc(db, 'businesses', bizId, 'analyses', 'latest');

  try {
    await setDoc(ref, {
      businessId: bizId,
      authorUid: user.uid,
      signature: clip(signature, 5000) || 'default',
      summary: clip(data.summary || '', 1000),
      loves: (data.loves || []).slice(0, 6),
      unhappy: (data.unhappy || []).slice(0, 6),
      actions: (data.actions || []).slice(0, 6),
      isPublic: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadStaffAccessForUser(
  user: User,
  businesses: Business[]
): Promise<{
  managedBusinessIds: string[];
  staffByBusiness: Record<string, StaffMember[]>;
}> {
  const admin = isDirectoryAdmin(user);
  const userEmail = user.email?.trim().toLowerCase() || '';
  const staffKey = userEmail ? getStaffKey(userEmail) : '';
  const managedSet = new Set<string>();
  const staffByBusiness: Record<string, StaffMember[]> = {};

  for (const biz of businesses) {
    const bizId = sanitizeId(biz.id);
    const isOwnerOrAdmin = admin || biz.ownerId === user.uid;

    if (isOwnerOrAdmin) {
      managedSet.add(biz.id);
      try {
        const staffRef = collection(db, 'businesses', bizId, 'staffMembers');
        const snap = admin
          ? await getDocs(staffRef)
          : await getDocs(query(staffRef, where('ownerId', '==', user.uid)));
        staffByBusiness[biz.id] = snap.docs.map((d) => d.data() as StaffMember);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `businesses/${bizId}/staffMembers`);
      }
    } else if (staffKey) {
      try {
        const memberSnap = await getDoc(
          doc(db, 'businesses', bizId, 'staffMembers', staffKey)
        );
        if (memberSnap.exists()) {
          managedSet.add(biz.id);
          staffByBusiness[biz.id] = [memberSnap.data() as StaffMember];
        }
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.GET,
          `businesses/${bizId}/staffMembers/${staffKey}`
        );
      }
    }
  }

  return {
    managedBusinessIds: Array.from(managedSet),
    staffByBusiness,
  };
}

export async function addStaffMemberInCloud(
  user: User,
  business: Business,
  email: string,
  role: StaffRole
): Promise<StaffMember> {
  const cleanEmail = email.trim().toLowerCase().slice(0, 160);
  const memberId = getStaffKey(cleanEmail);
  const bizId = sanitizeId(business.id);
  const ownerId = business.ownerId || user.uid;
  const path = `businesses/${bizId}/staffMembers/${memberId}`;
  const ref = doc(db, 'businesses', bizId, 'staffMembers', memberId);

  const member: StaffMember = {
    id: memberId,
    businessId: bizId,
    ownerId,
    email: cleanEmail,
    role,
  };

  try {
    await setDoc(ref, {
      ...member,
      addedByUid: user.uid,
      createdAt: serverTimestamp(),
    });
    return member;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeStaffMemberInCloud(
  businessId: string,
  memberId: string
): Promise<void> {
  const bizId = sanitizeId(businessId);
  const cleanMemberId = sanitizeId(memberId);
  const path = `businesses/${bizId}/staffMembers/${cleanMemberId}`;
  try {
    await deleteDoc(doc(db, 'businesses', bizId, 'staffMembers', cleanMemberId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function resetSharedDirectoryInCloud(
  user: User,
  seedBusinesses: Business[]
): Promise<void> {
  const existingSnap = await getDocs(
    query(collection(db, 'businesses'), where('isPublic', '==', true))
  );

  const deleteBatch = writeBatch(db);
  for (const bizDoc of existingSnap.docs) {
    const bizId = bizDoc.id;
    const subCols = ['reviews', 'posts', 'analyses', 'staffMembers'] as const;
    for (const colName of subCols) {
      const subSnap = await getDocs(collection(db, 'businesses', bizId, colName));
      subSnap.docs.forEach((d) => deleteBatch.delete(d.ref));
    }
    deleteBatch.delete(bizDoc.ref);
  }

  try {
    await deleteBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'businesses');
  }

  await ensureSharedDirectorySynced(user, seedBusinesses, {});
}
