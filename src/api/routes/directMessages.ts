import { Router } from "express";
import { getChatInfo, getUserChats, getUnseenMessagesCount, updateMessageStatus, createChat, deleteChat, updateChatGroup, addMessageToChat, getAllUsers} from "../controllers/messagesController";
const router = Router();


router.get("/allUsers", getAllUsers)
router.get("/messages/:chatId", getChatInfo)
router.get("/userChats/:userId", getUserChats)
router.get("/unseenMessagesCount/:chatId", getUnseenMessagesCount)
router.put("/messageStatus/:chatId", updateMessageStatus)// a little bit modification needed
router.post("/createChat/:userId", createChat)
router.delete("/Chat/:chatId", deleteChat)
router.put("/chatGroup/:chatId", updateChatGroup)
router.post("/message/:userId", addMessageToChat)





export default router;