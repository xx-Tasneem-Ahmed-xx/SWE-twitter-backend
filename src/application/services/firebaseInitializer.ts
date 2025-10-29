import admin from 'firebase-admin';
import serviceAccount from '../../../twitter-clone-project-ca1b1-firebase-adminsdk-fbsvc-a74d00fca4.json';


const initializeFirebase = () => {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as any), 
        });
        console.log('✅ Firebase Admin SDK initialized successfully.');
    } catch (error) {
        if (!admin.apps.length) {
            console.error('❌ Failed to initialize Firebase Admin SDK:', error);
        }
        
    }
};

export { admin, initializeFirebase };