import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { mediaSchema } from "../application/dtos/media/media.schema.dto";
import { MediaType } from "@prisma/client";

export const registerMediaDocs = (registry: OpenAPIRegistry) => {
    // Add media to tweet
    registry.registerPath({
        method: "post",
        path: "api/media/add-media-to-tweet",
        summary: "Add media to a tweet",
        tags: ["Media"],
        request: {
            body: {
                required: true,
                content: {
                    "application/json": {
                        schema: z.object({
                            mediaId: z.array(z.string().uuid()),
                            tweetId: z.string().uuid()
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
    // Add media to message
    registry.registerPath({
        method: "post",
        path: "api/media/add-media-to-message",
        summary: "Add media to a message",
        tags: ["Media"],
        request: {
            body: {
                required: true,
                content: {
                    "application/json": {
                        schema: z.object({
                            messageId: z.string().uuid(),
                            mediaId: z.string().uuid()
                        })
                    }
                }
            },
        },
        responses: {
            200: {
                description: "Media added to message successfully",
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
    // Get media for a tweet
    registry.registerPath({
        method: "get",
        path: "api/media/tweet-media/{tweetId}",
        summary: "Get media for a tweet",
        tags: ["Media"],
        request: {
            params: z.object({
                tweetId: z.string().uuid()
            }),
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

    //get message media
    registry.registerPath({
        method: "get",
        path: "api/media/message-media/{messageId}",
        summary: "Get media for a message",
        tags: ["Media"],
        request: {
            params: z.object({
                messageId: z.string().uuid()
            }),
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

    // Request to upload media
    registry.registerPath({
        method: "post",
        path: "api/media/upload-request",
        summary: "Request to upload media",
        tags: ["Media"],
        request: {
            body: {
                required: true,
                content: {
                    "application/json": {
                        schema: z.object({
                            fileName: z.string(),
                            fileType: z.nativeEnum(MediaType)
                        })
                    }
                }
            }
        },
        responses: {
            200: {
                description: "Upload request successful",
                content: {
                    "application/json": {
                        schema: z.object({
                            url: z.string().url(),
                            keyName: z.string()
                        })
                    }
                
                }
            },
            401: {
                description: "Unauthorized",
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
    }),
    // Request to download media
    registry.registerPath({
        method: "get",
        path: "api/media/download-request/{mediaId}",
        summary: "Request to download media",
        tags: ["Media"],
        request: {
            params: z.object({
                mediaId: z.string().uuid()
            }),
        },
        responses: {
            200: {
                description: "Download request successful",
                content: {
                    "application/json": {
                        schema: z.object({
                            url: z.string().url(),
                            keyName: z.string()
                        })
                    }
                }
            },
            401: {
                description: "Unauthorized",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string()
                        })
                    }
                }
            },
            404: {
                description: "Media not found",
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
    }),
    // Confirm media upload
    registry.registerPath({
        method: "post",
        path: "api/media/confirm-upload/{keyName}",
        summary: "Confirm media upload",
        tags: ["Media"],
        request: {
            params: z.object({
                keyName: z.string()
            }),
        },
        responses: {
            200: {
                description: "Media upload confirmed successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            newMedia: mediaSchema
                        })
                    }
                }
            },
            404: {
                description: "Media not found",
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
    })
}
