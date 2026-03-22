import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as dotenv from 'dotenv';
import { buildScheduleForUser } from '../src/lib/scheduleGenerator';

dotenv.config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: "dayo-294b9",
      clientEmail: "firebase-adminsdk-fbsvc@dayo-294b9.iam.gserviceaccount.com",
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function run() {
  try {
    const auth = getAuth();
    // Try to find test user phase b
    let uid = null;
    try {
      const userRecord = await auth.getUserByEmail('testuser_phaseb@gmail.com');
      uid = userRecord.uid;
      console.log('Found user:', uid);
    } catch (e) {
      console.log('User not found by email, picking first user in DB.');
      const snapshot = await db.collection('users').limit(1).get();
      if (!snapshot.empty) {
        uid = snapshot.docs[0].id;
        console.log('Found alternate user:', uid);
      }
    }

    if (!uid) {
      console.log('No user found to test with.');
      return;
    }

    // Set some dummy preferences and classes for this user for Phase C test
    await db.collection('users').doc(uid).set({
      wake_time: '06:00 AM',
      sleep_time: '11:00 PM',
      morning_commute_mins: 30,
      evening_commute_mins: 30,
      rush_hour_buffer: false,
      semester_weeks: 16
    }, { merge: true });

    // Clear existing classes
    const existingClasses = await db.collection('classes').where('user_id', '==', uid).get();
    const batch = db.batch();
    existingClasses.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Add mock classes
    const classesRef = db.collection('classes');
    await classesRef.add({
      user_id: uid,
      subject: 'Physics',
      type: 'Theory',
      days: ['Monday'],
      startTime: '09:00 AM',
      endTime: '10:30 AM',
    });
    await classesRef.add({
      user_id: uid,
      subject: 'Maths Lab',
      type: 'Practical',
      days: ['Monday'],
      startTime: '11:15 AM',
      endTime: '01:15 PM',
    });

    console.log("Mock data set. Running generator...");
    const result = await buildScheduleForUser(uid);
    console.log("Generator returned successfully. Blocks generated:");
    
    // Sort and display Monday blocks
    const mondayBlocks = result.filter((b: any) => b.day === 'MONDAY').sort((a: any, b: any) => a.startTimeMins - b.startTimeMins);
    mondayBlocks.forEach((b: any) => {
      const start = String(Math.floor(b.startTimeMins / 60)).padStart(2, '0') + ':' + String(b.startTimeMins % 60).padStart(2, '0');
      const end = String(Math.floor(b.endTimeMins / 60)).padStart(2, '0') + ':' + String(b.endTimeMins % 60).padStart(2, '0');
      console.log(`[${start} - ${end}] ${b.title} (${b.type}) - Priority: ${b.priority}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

run();
