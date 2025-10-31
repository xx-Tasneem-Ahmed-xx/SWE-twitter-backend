import admin from 'firebase-admin';
import serviceAccount from '../../../psychic-fin-474008-h8-1be573080339.json';

const initializeFirebase = () => {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as any), 
        });
        console.log(' Firebase Admin SDK initialized successfully.');
    } catch (error) {
        if (!admin.apps.length) {
            console.error('Failed to initialize Firebase Admin SDK:', error);
        }
    }
  }
};

export { admin, initializeFirebase };
