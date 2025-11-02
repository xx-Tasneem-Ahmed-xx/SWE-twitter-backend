import { Router } from "express";
import { getChatInfo, getUserChats, getUnseenMessagesCount, updateMessageStatus, createChat, updateChatGroup, addMessageToChat, getUnseenChatsCount, deleteChat, getChatMessages, getUnseenMessagesCountOfUser} from "../controllers/messagesController";
const router = Router();


router.get("/chat/user", getUserChats)
router.post("/chat/create-chat", createChat)
router.get("/chat/unseen-chats", getUnseenChatsCount)
router.get("/chat/:chatId", getChatInfo)
router.get("/chat/:chatId/messages", getChatMessages)
router.patch("/chat/:chatId/group", updateChatGroup)
router.delete("/chat/:chatId", deleteChat)
router.post("/chat/new-message", addMessageToChat)
router.get("/chat/:chatId/unseen-messages-count", getUnseenMessagesCount)
router.get("/chat/all-unseen-messages-count", getUnseenMessagesCountOfUser)





export default router;