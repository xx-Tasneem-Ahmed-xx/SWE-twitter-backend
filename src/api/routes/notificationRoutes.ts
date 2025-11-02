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





export default notificationRoutes;