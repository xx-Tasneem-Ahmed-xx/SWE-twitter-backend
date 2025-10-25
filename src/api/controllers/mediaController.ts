import { Request, Response, NextFunction } from "express";
import prisma from "../../database";
import { MediaType } from "@prisma/client";
import {storageService} from '../../app';



export const requestToUploadMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { fileName, contentType } = req.body;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        })
        if(user){
            const keyName = `${userId}/${Date.now()}-${fileName}`;
            const uploadUrl = await storageService.getPresignedUrl(keyName, contentType);
            return res.status(200).json({ url: uploadUrl, keyName });
        }else{
            return res.status(404).json({ error: "User not authorized" });
        }
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
}

export const requestToDownloadMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { mediaId } = req.params;   
        const userId = req.user?.id;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        }); 
        if(!user){
            return res.status(404).json({ error: "Unauthorized Access" });
        }
        const media =  await prisma.media.findUnique({
            where: { id: mediaId }
        });
        if(!media){
            return res.status(404).json({ error: "Media not found" });
        }
        const downloadUrl = await storageService.getDownloadUrl(media.keyName);
        return res.status(200).json({ url: downloadUrl });
    } catch (error) {
        console.error("Error downloading media:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export const confirmMediaUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { keyName } = req.params;
        const userId = req.user?.id;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (user) {
            const metadata = await storageService.getS3ObjectMetadata(keyName);
            if (metadata) {
                const name = keyName.split('-')[1] || 'unknown';
                const newMedia = await prisma.media.create({
                    data: {
                        name: name,
                        type: metadata.ContentType as MediaType,
                        size: metadata.ContentLength,
                        keyName: keyName
                    }
                })
                return res.status(200).json({ newMedia });
            } else {
                return res.status(404).json({ error: "Media not found" });
            }
        } else {
            return res.status(404).json({ error: "User not authorized" });
        }
    } catch (error: any) {
        console.error("Error confirming media upload:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export const addMediaTotweet = async (req: Request, res: Response) => {
    try {
        const { tweetId, mediaIds } = req.body as { tweetId?: string; mediaIds?: string[] };
        const userId = req.user?.id;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            return res.status(401).json({ error: "Unauthorized Access" });
        }

        if (!tweetId) {
            return res.status(400).json({ error: "tweetId is required" });
        }

        const ids: string[] = Array.isArray(mediaIds) ? mediaIds : [];
        if (ids.length === 0) {
            return res.status(400).json({ error: "mediaIds must be a non-empty array" });
        }

        for (const id of ids) {
            await prisma.tweetMedia.create({
                data: {
                    tweetId,
                    mediaId: id
                }
            });
        }
        return res.status(200).json({ message: "Media added to tweet successfully" });
    } catch (error) {
        console.error("Error adding media to tweet:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const addMediaToMessage = async (req: Request, res: Response) => {
    try {
        const { messageId, mediaIds } = req.body as { messageId?: string; mediaIds?: string };
        const userId = req.user?.id;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            return res.status(401).json({ error: "Unauthorized Access" });
        }

        if (!messageId) {
            return res.status(400).json({ error: "messageId is required" });
        }

        const ids: string[] = Array.isArray(mediaIds) ? mediaIds : [];
        if (ids.length === 0) {
            return res.status(400).json({ error: "mediaIds must be a non-empty array" });
        }

        for (const id of ids) {
            await prisma.messageMedia.create({
                data: {
                    messageId,
                    mediaId: id
                }
            });
        }
        return res.status(200).json({ message: "Media added to message successfully" });
    } catch (error) {
        console.error("Error adding media to message:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const getTweetMedia = async (req: Request, res: Response) => {
    try {
        const { tweetId } = req.params;
        const userId = req.user?.id;
        if(!userId){
            return res.status(401).json({ error: "Unauthorized Access" });
        }
        if(!tweetId){
            return res.status(400).json({ error: "tweetId is required" });
        }
        const media  = await prisma.media.findMany({
            where: { tweetMedia: { some: { tweetId } } }
        });
        if(!media){
            return res.status(404).json({ error: "No media found for this tweet" });
        }
        res.status(200).json(media); 
    } catch (error) {
        console.error("Error fetching media for tweet:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const getMessageMedia = async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;
        const userId = req.user?.id;
        if(!userId){
            return res.status(401).json({ error: "Unauthorized Access" });
        }
        if(!messageId){
            return res.status(400).json({ error: "messageId is required" });
        }
        const media  = await prisma.media.findMany({
            where: { messageMedia: { some: { messageId } } }
        });
        if(!media){
            return res.status(404).json({ error: "No media found for this message" });
        }
        res.status(200).json(media);
    } catch (error) {
        console.error("Error fetching media for message:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}
