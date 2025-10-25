import router from "express";
import {
    getNotificationList,
    getUnseenNotificationsCount,
    getUnseenNotifications,
    markNotificationsAsRead,
} from "@/api/controllers/notificationController";


const notificationRoutes = router();


notificationRoutes.get("/", getNotificationList);
notificationRoutes.get("/unseen/count", getUnseenNotificationsCount);
notificationRoutes.get("/unseen", getUnseenNotifications);
notificationRoutes.patch("/mark-as-read/:NotificationId", markNotificationsAsRead);





export default notificationRoutes;