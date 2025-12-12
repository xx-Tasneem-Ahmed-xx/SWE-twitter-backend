import { Request, Response, NextFunction } from "express";
import prisma from "../../database";
import { MediaType } from "@prisma/client";
import { storageService } from "../../app";
import * as responseUtils from "@/application/utils/response.utils";

export const requestToUploadMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    const { fileName, contentType } = req.body;
    const keyName = `${userId}-${Date.now()}-${fileName}`;
    const uploadUrl = await storageService.getPresignedUrl(
      keyName,
      contentType
    );
    return res.status(200).json({ url: uploadUrl, keyName });
  } catch (error) {
    next(error);
  }
};

export const requestToDownloadMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { mediaId } = req.params;
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    });
    if (!media) {
      responseUtils.throwError("MEDIA_NOT_FOUND");
    }
    const downloadUrl = await storageService.getDownloadUrl(media!.keyName);
    return res.status(200).json({ url: downloadUrl });
  } catch (error) {
    console.error("Error downloading media:", error);
    next(error);
  }
};

export const confirmMediaUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { keyName } = req.params;
    const metadata = await storageService.getS3ObjectMetadata(keyName);
    console.log("S3 Object Metadata:", metadata);
    if (metadata) {
      const name = keyName.split("-")[2] || "unknown";
      const type =
        (metadata.ContentType?.split("/")[0].toUpperCase() as MediaType) ;
      const newMedia = await prisma.media.create({
        data: {
          name: name,
          type: type,
          size: metadata.ContentLength,
          keyName: keyName,
        },
      });
      return res.status(200).json({ newMedia });
    } else {
      responseUtils.throwError("MEDIA_NOT_FOUND");
    }
  } catch (error: any) {
    console.error("Error confirming media upload:", error);
    next(error);
  }
};

export const addMediaTotweet = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { tweetId, mediaIds } = req.body as {
      tweetId?: string;
      mediaIds?: string[];
    };
    if (!tweetId) {
      responseUtils.throwError("TWEET_ID_REQUIRED");
    }

    const ids: string[] = Array.isArray(mediaIds) ? mediaIds : [];
    if (ids.length === 0) {
      responseUtils.throwError("MEDIA_IDS_MUST_BE_NON_EMPTY_ARRAY");
    }

    for (const id of ids) {
      await prisma.tweetMedia.create({
        data: {
          tweetId: tweetId!,
          mediaId: id,
        },
      });
    }
    return responseUtils.sendResponse(res, "MEDIA_ADDED_TO_TWEET");
  } catch (error) {
    console.error("Error adding media to tweet:", error);
    next(error);
  }
};

export const addMediaToMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { messageId, mediaIds } = req.body as {
      messageId?: string;
      mediaIds?: string[];
    };

    if (!messageId) {
      responseUtils.throwError("MESSAGE_ID_REQUIRED");
    }

    const ids: string[] = Array.isArray(mediaIds) ? mediaIds : [];
    if (ids.length === 0) {
      responseUtils.throwError("MEDIA_IDS_MUST_BE_NON_EMPTY_ARRAY");
    }

    for (const id of ids) {
      await prisma.messageMedia.create({
        data: {
          messageId: messageId!,
          mediaId: id,
        },
      });
    }
    return responseUtils.sendResponse(res, "MEDIA_ADDED_TO_MESSAGE");
  } catch (error) {
    console.error("Error adding media to message:", error);
    next(error);
  }
};

export const getTweetMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { tweetId } = req.params;
    if (!tweetId) {
      responseUtils.throwError("TWEET_ID_REQUIRED");
    }
    const media = await prisma.media.findMany({
      where: { tweetMedia: { some: { tweetId } } },
    });
    if (!media) {
      responseUtils.throwError("NO_MEDIA_FOUND_FOR_TWEET");
    }
    res.status(200).json(media);
  } catch (error) {
    console.error("Error fetching media for tweet:", error);
    next(error);
  }
};

export const getMessageMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { messageId } = req.params;
    if (!messageId) {
      responseUtils.throwError("MESSAGE_ID_REQUIRED");
    }
    const media = await prisma.media.findMany({
      where: { messageMedia: { some: { messageId } } },
    });
    if (!media) {
      responseUtils.throwError("NO_MEDIA_FOUND_FOR_MESSAGE");
    }
    res.status(200).json(media);
  } catch (error) {
    console.error("Error fetching media for message:", error);
    next(error);
  }
};

 export const dropMedia = async (keyName: string) => {
  try {
    await storageService.dropS3Media(keyName);
  } catch (error) {
    console.error("Error deleting media from S3:", error);
    throw error;
  }
};
