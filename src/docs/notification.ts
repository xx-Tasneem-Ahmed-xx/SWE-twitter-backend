import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { register } from "module";
import { NotificationInputSchema, NotificationSchema } from "@/application/dtos/notification/notification.dto.schema";
export const registerNotificationDocs = (registry: OpenAPIRegistry) => {
    registry.registerPath({
        method: "get",
        path: "/api/notifications",
        summary: "Get list of notifications for the authenticated user",
        tags: ["Notifications"],
        request: {
            headers: z.object({
                Authorization: z.string().describe("Bearer token for authentication"),
            }),
        },
        responses: {
            200: {
                description: "List of notifications retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.array(NotificationSchema),
                    },
                },
            },
            401: { 
                description: "Unauthorized" ,
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().describe("Unauthorized"),
                        }),
                    },
                },
            },
            500: { 
                description: "Internal Server Error" ,
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().describe("Internal Server Error"),
                        }),
                    },
                },
            },
        },
    });

    registry.registerPath({
        method: "get",
        path: "/api/notifications/unseen/count",
        summary: "Get count of unseen notifications for the authenticated user",
        tags: ["Notifications"],
        request: {
            headers: z.object({
                Authorization: z.string().describe("Bearer token for authentication"),
            }),
        },
        responses: {
            200: {
                description: "Unseen notifications count retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            unseenCount: z.number().describe("Count of unseen notifications"),
                        }),
                    },
                },
            },
            401: { 
                description: "Unauthorized" ,
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().describe("Unauthorized"),
                        }),
                    },
                },
            },
            500: { 
                description: "Internal Server Error" ,
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().describe("Internal Server Error"),
                        }),
                    },
                },
            },
        },

    });

    registry.registerPath({
        method: "get",
        path: "/api/notifications/unseen",
        summary: "Get unseen notifications for the authenticated user",
        tags: ["Notifications"],
        request: {
            headers: z.object({
                Authorization: z.string().describe("Bearer token for authentication"), 
            }),
        },
        responses: {
            200: { 
                description: "Unseen notifications retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            notifications: z.array(NotificationSchema),
                        }),
                    },
                },
            },
            401: {
                description: "Unauthorized",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().describe("Unauthorized"),
                        }),
                    },
                },
            },
            500: {
                description: "Internal Server Error",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().describe("Internal Server Error"),
                        }),
                    },
                },
            },
        },
    });

    registry.registerPath({
        method: "post",
        path: "/api/notifications",
        summary: "Create a new notification for a user",
        tags: ["Notifications"],
        request: {
            headers: z.object({
                Authorization: z.string().describe("Bearer token for authentication"),
            }),
            body: {
                required: true,
                content: {
                    "application/json": {
                        schema: NotificationInputSchema,
                    },
                },
            },
        },
        responses: {
            201: {
                description: "Notification created successfully",   
                content: {
                    "application/json": {
                        schema: NotificationSchema,
                    },
                },
            },
            400: {
                description: "Invalid notification data",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().describe("Invalid notification data"),
                        }),
                    },
                },
            },
            401: {
                description: "Unauthorized",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().describe("Unauthorized"),
                        }),
                    },
                },
            },
            500: {
                description: "Internal Server Error",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().describe("Internal Server Error"),
                        }),
                    },
                },
            }
        },
    });

    registry.registerPath({
        method: "patch",
        path: "/api/mark-as-read/{NotificationId}",
        summary: "Update a notification status to read",
        tags: ["Notifications"],
        request: {
            headers: z.object({
                Authorization: z.string().describe("Bearer token for authentication"),
            }),
            params: z.object({
                NotificationId: z.string().describe("ID of the notification to update"),
            }),
        },
        responses: {
            200: {
                description: "Notification updated successfully",
                content: {
                    "application/json": {
                        schema: NotificationSchema,
                    },
                },
            },
            401: {
                description: "Unauthorized",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().describe("Unauthorized"),
                        }),
                    },
                },
            },
            404: {
                description: "Notification not found",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().describe("Notification not found"),
                        }),
                    },
                },
            },
            500: {
                description: "Internal Server Error",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().describe("Internal Server Error"),
                        }),
                    },
                },
            }
        },
    });
};