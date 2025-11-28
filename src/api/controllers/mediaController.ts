import { Request, Response, NextFunction } from "express";
import prisma from "../../database";
import { MediaType } from "@prisma/client";
import { storageService } from "../../app";
import { AppError } from "@/errors/AppError";

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
      throw new AppError("Media not found", 404);
    }
    const downloadUrl = await storageService.getDownloadUrl(media.keyName);
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
        (metadata.ContentType?.split("/")[0].toUpperCase() as MediaType) ||
        "OTHER";
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
      throw new AppError("Media not found", 404);
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
          mediaId: id,
        },
      });
    }
    return res
      .status(200)
      .json({ message: "Media added to tweet successfully" });
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
          mediaId: id,
        },
      });
    }
    return res
      .status(200)
      .json({ message: "Media added to message successfully" });
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
      throw new AppError("tweetId is required", 400);
    }
    const media = await prisma.media.findMany({
      where: { tweetMedia: { some: { tweetId } } },
    });
    if (!media) {
      throw new AppError("No media found for this tweet", 404);
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
      throw new AppError("messageId is required", 400);
    }
    const media = await prisma.media.findMany({
      where: { messageMedia: { some: { messageId } } },
    });
    if (!media) {
      throw new AppError("No media found for this message", 404);
    }
    res.status(200).json(media);
  } catch (error) {
    console.error("Error fetching media for message:", error);
    next(error);
  }
};

//export const dropMedia = async (req: Request, res: Response, next: NextFunction) => {
 export const dropMedia = async (keyName: string) => {
  try {
    await storageService.dropS3Media(keyName);
  } catch (error) {
    console.error("Error deleting media from S3:", error);
    throw error;
  }
};
