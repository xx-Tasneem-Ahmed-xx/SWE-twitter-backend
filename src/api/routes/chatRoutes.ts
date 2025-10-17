import { Router } from "express";
import { getChatInfo, getUserChats, getUnseenMessagesCount, updateMessageStatus, createChat, updateChatGroup, addMessageToChat, getUnseenChatsCount, deleteChat} from "../controllers/messagesController";
const router = Router();


router.get("/chat/user", getUserChats)
router.post("/chat/createchat", createChat)
router.get("/chat/unseenChats", getUnseenChatsCount)
router.get("/chat/:chatId", getChatInfo)
router.patch("/chat/:chatId/group", updateChatGroup)
router.delete("/chat/:chatId", deleteChat)
router.post("/chat/message", addMessageToChat)
router.get("/chat/:chatId/unseenMessagesCount", getUnseenMessagesCount)
router.patch("/chat/:chatId/messageStatus", updateMessageStatus)





export default router;