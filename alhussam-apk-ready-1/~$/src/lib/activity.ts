import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface ActivityDetails {
  [key: string]: any;
}

export const logActivity = async (
  action: string,
  recordId?: string,
  collectionName?: string,
  details?: ActivityDetails
) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, 'user_activity'), {
      userId: user.uid,
      userName: user.displayName || user.email || 'مستخدم غير معروف',
      action,
      recordId: recordId || null,
      collection: collectionName || null,
      timestamp: new Date().toISOString(),
      details: details || {}
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
