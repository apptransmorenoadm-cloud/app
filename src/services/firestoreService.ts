/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  Timestamp,
  getDocs,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  Driver, 
  Truck, 
  Trailer, 
  Supplier, 
  Maintenance, 
  Trip, 
  Expense, 
  Product, 
  Invoice,
  UserProfile
} from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Generic CRUD helpers
export const subscribeToCollection = <T>(
  collectionName: string, 
  callback: (data: T[]) => void,
  queryConstraints: any[] = []
) => {
  const q = query(collection(db, collectionName), ...queryConstraints);
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    callback(data);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, collectionName);
  });
};

export const addDocument = async <T extends object>(collectionName: string, data: T) => {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionName);
  }
};

export const setDocument = async <T extends object>(collectionName: string, id: string, data: T) => {
  try {
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collectionName}/${id}`);
  }
};

export const updateDocument = async <T extends object>(collectionName: string, id: string, data: Partial<T>) => {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
  }
};

export const deleteDocument = async (collectionName: string, id: string) => {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
  }
};

// Specific User Profile helpers
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    return null;
  }
};

export const createUserProfile = async (profile: UserProfile) => {
  try {
    await setDoc(doc(db, 'users', profile.uid), profile);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${profile.uid}`);
  }
};
