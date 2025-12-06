import router from "express";
import {
    getNotificationList,
    getUnseenNotificationsCount,
    getUnseenNotifications,
    markNotificationsAsRead,
    getMentionNotifications,
} from "@/api/controllers/notificationController";
import { no } from "zod/v4/locales";


const notificationRoutes = router();


notificationRoutes.get("/", getNotificationList);
notificationRoutes.get("/mentions", getMentionNotifications);
notificationRoutes.get("/unseen/count", getUnseenNotificationsCount);
notificationRoutes.get("/unseen", getUnseenNotifications);





export default notificationRoutes;