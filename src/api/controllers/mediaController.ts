import { Request, Response, NextFunction } from "express";
import prisma from "../../database";
import { MediaType } from "@prisma/client";
import {storageService} from '../../app';
import { AppError } from "@/errors/AppError";



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
            throw new AppError("User not authorized", 404);
        }
    } catch (error) {
        next(error);
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
           throw new AppError("Unauthorized Access", 404);
        }
        const media =  await prisma.media.findUnique({
            where: { id: mediaId }
        });
        if(!media){
           throw new AppError("Media not found", 404);
        }
        const downloadUrl = await storageService.getDownloadUrl(media.keyName);
        return res.status(200).json({ url: downloadUrl });
    } catch (error) {
        console.error("Error downloading media:", error);
        next(error);
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
                throw new AppError("Media not found", 404);
            }
        } else {
            throw new AppError("User not authorized", 404);
        }
    } catch (error: any) {
        console.error("Error confirming media upload:", error);
        next(error);
    }
}

export const addMediaTotweet = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tweetId, mediaIds } = req.body as { tweetId?: string; mediaIds?: string[] };
        const userId = req.user?.id;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            throw new AppError("Unauthorized Access", 401);
        }

        if (!tweetId) {
            throw new AppError("tweetId is required", 400);
        }

        const ids: string[] = Array.isArray(mediaIds) ? mediaIds : [];
        if (ids.length === 0) {
            throw new AppError("mediaIds must be a non-empty array", 400);
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
        next(error);
    }
}

export const addMediaToMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { messageId, mediaIds } = req.body as { messageId?: string; mediaIds?: string };
        const userId = req.user?.id;
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            throw new AppError("Unauthorized Access", 401);
        }

        if (!messageId) {
            throw new AppError("messageId is required", 400);
        }

        const ids: string[] = Array.isArray(mediaIds) ? mediaIds : [];
        if (ids.length === 0) {
            throw new AppError("mediaIds must be a non-empty array", 400);
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
        next(error);
    }
}

export const getTweetMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { tweetId } = req.params;
        const userId = req.user?.id;
        if(!userId){
            throw new AppError("Unauthorized Access", 401);
        
        }
        if(!tweetId){
            throw new AppError("tweetId is required", 400);
        }
        const media  = await prisma.media.findMany({
            where: { tweetMedia: { some: { tweetId } } }
        });
        if(!media){
            throw new AppError("No media found for this tweet", 404);
        }
        res.status(200).json(media); 
    } catch (error) {
        console.error("Error fetching media for tweet:", error);
        next(error);
    }
}

export const getMessageMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { messageId } = req.params;
        const userId = req.user?.id;
        if(!userId){
            throw new AppError("Unauthorized Access", 401);
        
        }
        if(!messageId){
            throw new AppError("messageId is required", 400);
        }
        const media  = await prisma.media.findMany({
            where: { messageMedia: { some: { messageId } } }
        });
        if(!media){
            throw new AppError("No media found for this message", 404);
        }
        res.status(200).json(media);
    } catch (error) {
        console.error("Error fetching media for message:", error);
        next(error);
    }
}
