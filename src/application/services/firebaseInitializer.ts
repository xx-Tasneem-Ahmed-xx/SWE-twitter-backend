import fs from "fs";
import admin from "firebase-admin";
import { getSecrets } from "@/config/secrets";

const initializeFirebase = () => {
  try {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    const { FIREBASE_KEY_PATH: serviceAccountPath } = getSecrets();

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        `Firebase service account JSON not found at ${serviceAccountPath}`
      );
    }

    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf-8")
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as any),
    });
    console.log(" Firebase Admin SDK initialized successfully.");
  } catch (error) {
    if (!admin.apps.length) {
      console.error("Failed to initialize Firebase Admin SDK:", error);
    }
  }
};

export { admin, initializeFirebase };
