import router from "express";
import {
    getNotificationList,
    getUnseenNotificationsCount,
    getUnseenNotifications,
    getMentionNotifications,
} from "@/api/controllers/notificationController";


const notificationRoutes = router();


notificationRoutes.get("/", getNotificationList);
notificationRoutes.get("/mentions", getMentionNotifications);
notificationRoutes.get("/unseen/count", getUnseenNotificationsCount);
notificationRoutes.get("/unseen", getUnseenNotifications);





export default notificationRoutes;