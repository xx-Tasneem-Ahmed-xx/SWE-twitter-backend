import router from "express";
import {
    getNotificationList,
    getUnseenNotificationsCount,
    getUnseenNotifications,
    markNotificationsAsRead,
    addNotification
} from "@/api/controllers/notificationController";
import Auth from "../middlewares/Auth";


const notificationRoutes = router();


notificationRoutes.get("/", getNotificationList);
notificationRoutes.get("/unseen/count", getUnseenNotificationsCount);
notificationRoutes.get("/unseen", getUnseenNotifications);
notificationRoutes.patch("/mark-as-read/:NotificationId", markNotificationsAsRead);
notificationRoutes.post("/", addNotification);





export default notificationRoutes;