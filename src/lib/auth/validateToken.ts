import { adminAuth } from '@/lib/firebase/firebaseAdmin';

export async function validateToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Unauthorized', uid: null, status: 401 };
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { error: null, uid: decoded.uid, status: 200 };
  } catch {
    return { error: 'Invalid token', uid: null, status: 401 };
  }
}
