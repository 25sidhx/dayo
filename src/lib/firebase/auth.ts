import { adminAuth } from './firebaseAdmin';
import { NextRequest } from 'next/server';

export async function verifyAuthToken(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { uid: null, error: 'Missing or malformed Authorization header' };
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    if (!adminAuth) throw new Error("Firebase Admin not initialized.");
    const decodedToken = await adminAuth.verifyIdToken(token);
    return { uid: decodedToken.uid, error: null };
  } catch (error: any) {
    console.error('Error verifying auth token:', error.message);
    return { uid: null, error: 'Unauthorized: Invalid token' };
  }
}
