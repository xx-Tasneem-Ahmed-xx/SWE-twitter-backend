import { Request, Response, NextFunction } from "express";
import prisma from "../../database";
import {ChatInput, chatGroupUpdate, MessageData, newMessageInput} from '../../application/dtos/chat/messages.dto';
import { ChatInfo } from '../../application/dtos/chat/chatInfo.dto';
import { MediaType } from "@prisma/client";
import { UUID } from "crypto";
import { mediaSchema } from "../../application/dtos/media/media.schema.dto";


export const addMediaTotweet = async (req: Request, res: Response) => {
    try {
        
        const { tweetId } = req.body;
        const media = req.body.media as typeof mediaSchema[];
        for(const mediaRaw of media){
            // If mediaRaw is a Zod schema, parse it first
            let mediaObj: any;
            if (typeof mediaRaw.safeParse === 'function') {
                const result = mediaRaw.safeParse(mediaRaw);
                mediaObj = result.success ? result.data : {};
            } else {
                mediaObj = mediaRaw;
            }
    
            const createdMedia = await prisma.media.create({
                data: {
                    url: mediaObj.url || '',
                    type: mediaObj.type as MediaType || 'IMAGE' as MediaType,
                    name: mediaObj.name || '',
                    size: mediaObj.size || 0,
                    tweetMedia: {
                        create: { tweetId: tweetId as UUID }
                    }
                }
            });
        }
        res.status(200).json({ message: "Media added to tweet successfully" });
    } catch (error) {
        console.error("Error adding media to tweet:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}


export const getTweetMedia = async (req: Request, res: Response) => {
    try {
        const { tweetId } = req.params;
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