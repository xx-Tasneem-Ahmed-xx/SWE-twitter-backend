import { Router } from "express";
import { getChatInfo, getUserChats, getUnseenMessagesCount, createChat, updateChatGroup, deleteChat, getChatMessages, getUnseenMessagesCountOfUser} from "../controllers/messagesController";
const router = Router();


router.get("/chat/user", getUserChats)
router.post("/chat/create-chat", createChat)
router.get("/chat/all-unseen-messages-count", getUnseenMessagesCountOfUser)
router.get("/chat/:chatId/messages", getChatMessages)
router.patch("/chat/:chatId/group", updateChatGroup)
router.get("/chat/:chatId/unseen-messages-count", getUnseenMessagesCount)
router.get("/chat/:chatId", getChatInfo)
router.delete("/chat/:chatId", deleteChat)





export default router;