import { Router } from "express";
import { getChatInfo, getUserChats, getUnseenMessagesCount, updateMessageStatus, createChat, updateChatGroup, addMessageToChat, getUnseenChatsCount} from "../controllers/messagesController";
const router = Router();


router.get("/chat/user", getUserChats)
router.get("/chat/:chatId", getChatInfo)
router.get("/chat/:chatId/unseenMessagesCount", getUnseenMessagesCount)
router.put("/chat/:chatId/messageStatus", updateMessageStatus)// a little modification needed
router.post("/chat/:userId/createchat", createChat)
router.put("/chat/:chatId/group", updateChatGroup)
router.post("/chat/:userId/message", addMessageToChat)
router.get("/chat/:userId/unseenChats", getUnseenChatsCount)





export default router;