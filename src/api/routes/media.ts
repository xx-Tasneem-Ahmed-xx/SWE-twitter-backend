import {Router} from "express";
import { addMediaTotweet, getTweetMedia, requestToUploadMedia, requestToDownloadMedia, addMediaToMessage, getMessageMedia, confirmMediaUpload } from "../controllers/mediaController";
const router = Router();


router.post("/upload-request", requestToUploadMedia)
router.get("/download-request/:mediaId", requestToDownloadMedia)
router.post("/confirm-upload/:keyName", confirmMediaUpload)
router.post("/add-media-to-message", addMediaToMessage)
router.get("/message-media/:messageId", getMessageMedia)
router.post("/add-media-to-tweet", addMediaTotweet)
router.get("/tweet-media/:tweetId", getTweetMedia)

export default router;