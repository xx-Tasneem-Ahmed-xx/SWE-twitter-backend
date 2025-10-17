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


notificationRoutes.get("/", Auth, getNotificationList);
notificationRoutes.get("/unseen/count", Auth, getUnseenNotificationsCount);
notificationRoutes.get("/unseen", Auth, getUnseenNotifications);
notificationRoutes.patch("/mark-as-read/:NotificationId", Auth, markNotificationsAsRead);
notificationRoutes.post("/", Auth, addNotification);





export default notificationRoutes;