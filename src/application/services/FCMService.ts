// fcm-service.js
import { admin } from './firebaseInitializer';


interface NotificationPayload {
    title: string;
    body: string;
}

interface DataPayload {
    [key: string]: string | number | boolean | undefined;
}

interface ApnsHeaders {
    [key: string]: string;
}

interface ApnsConfig {
    headers?: ApnsHeaders;
}

interface MulticastMessage {
    notification: NotificationPayload;
    data: DataPayload;
    tokens: string[];
    apns?: ApnsConfig;
}

interface BatchResponseItemMinimum {
    success: boolean;
    error?: { code: string };
}

interface BatchResponseMinimum {
    successCount: number;
    failureCount: number;
    responses: BatchResponseItemMinimum[];
}

export async function sendPushNotification(
    registrationTokens: string[],
    notificationPayload: NotificationPayload,
    dataPayload: DataPayload
): Promise<string[]> {
    if (!registrationTokens || registrationTokens.length === 0) {
        return [];
    }

    const message = {
        notification: notificationPayload,
        data: Object.fromEntries(
            Object.entries(dataPayload).map(([k, v]) => [k, v?.toString() ?? ""])
        ),                   
        tokens: registrationTokens,
        apns: { headers: { 'apns-priority': '10' } } 
    };

    const tokensToDelete: string[] = [];

    try {
        const response = await admin.messaging().sendEachForMulticast(message) as unknown as BatchResponseMinimum;
        console.log(`FCM: Sent ${response.successCount} messages, Failed ${response.failureCount}`);

        response.responses.forEach((resp, index) => {
            if (!resp.success && resp.error) {
                const error = resp.error;
                
                if (error.code === 'messaging/invalid-registration-token' || 
                    error.code === 'messaging/registration-token-not-registered') {
                    
                    tokensToDelete.push(registrationTokens[index]);
                    console.warn(`FCM: Invalid token detected: ${registrationTokens[index]}. Code: ${error.code}`);
                }
            }
        });

    } catch (error) {
        console.error('FCM Service Error during send:', error);
    }
    
    return tokensToDelete;
}

