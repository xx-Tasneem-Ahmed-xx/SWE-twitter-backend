import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { mediaSchema } from "../application/dtos/media/media.schema.dto";

export const registerMediaDocs = (registry: OpenAPIRegistry) => {
    registry.registerPath({
        method: "post",
        path: "api/media/{tweetId}/addMediaToTweet",
        summary: "Add media to a tweet",
        tags: ["Media"],
        request: {
            params: z.object({
                tweetId: z.string().uuid()
            }),
            body: {
                required: true,
                content: {
                    "application/json": {
                        schema: z.object({
                            media: z.array(mediaSchema)
                        })
                    }
                }
            },
        },
        responses: {
            200: {
                description: "Media added to tweet successfully",
                content: {
                    "application/json": {
                        schema: z.object({ message: z.string() })
                    }
                }
            },
            400: {
                description: "Bad request",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string()
                        })
                    }
                }
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string()
                        })
                    }
                }
            }
        }
    });

    registry.registerPath({
        method: "get",
        path: "api/media/{tweetId}/getTweetMedia",
        summary: "Get media for a tweet",
        tags: ["Media"],
        request: {
            params: z.object({
                tweetId: z.string().uuid()
            })
        },
        responses: {
            200: {
                description: "Media retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            media: z.array(mediaSchema)
                        })
                    }
                }
            },
            400: {
                description: "Bad request",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string()
                        })
                    }
                }
            },
            404: {
                description: "Tweet not found",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string()
                        })
                    }
                }
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string()
                        })
                    }
                }
            }
        }
    });
};