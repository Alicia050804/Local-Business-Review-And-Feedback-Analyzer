import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const persistenceReady = setPersistence(auth, browserLocalPersistence).catch(() =>
  setPersistence(auth, inMemoryPersistence).catch(() => undefined)
);

export interface GoogleSignInResult {
  user: User | null;
  cancelled?: boolean;
  errorMessage?: string;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    await persistenceReady;
    const cred = await signInWithPopup(auth, googleProvider);
    return { user: cred.user };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { user: null, cancelled: true };
    }
    if (code === 'auth/popup-blocked') {
      return {
        user: null,
        errorMessage:
          'Google Sign-In popup was blocked by your browser or iframe. Allow popups for this site or use the Decoy Staff Credentials below.',
      };
    }
    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      return {
        user: null,
        errorMessage: `Google Sign-In is not yet authorized for "${host}" in Firebase Authentication > Settings > Authorized domains. You can sign in immediately with the Decoy Staff Credentials below.`,
      };
    }
    if (code === 'auth/operation-not-allowed') {
      return {
        user: null,
        errorMessage:
          'Google Sign-In provider is disabled in Firebase Auth. Use the Decoy Staff Credentials below or enable Google Sign-In in Firebase Console.',
      };
    }
    if (code === 'auth/network-request-failed') {
      return {
        user: null,
        errorMessage:
          'Network error while contacting Google Sign-In. Check your connection or use the Decoy Staff Credentials below.',
      };
    }
    return {
      user: null,
      errorMessage:
        'Google Sign-In could not be completed in this browser context. You can use the Decoy Staff Credentials below to enter the Staff Portal immediately.',
    };
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
