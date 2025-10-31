import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { ChatInfoSchema, CreateChatInput, messageData, newMessageInput } from "../application/dtos/chat/chatInfo.dto.schema";
import { register } from "module";
import { create } from "domain";
import { createChat } from "../api/controllers/messagesController";
import { MessageSchema } from "../application/dtos/chat/chatInfo.dto.schema";

export const registerChatDocs = (registry: OpenAPIRegistry) => {

    registry.registerPath({
    method: "get",
    path: "/api/dm/chat/{chatId}",
    summary: "Get chat information",
    description: "Retrieve detailed information about a specific chat including messages, participants, and group details",
    tags: ["Chats"],
    request: {
      params: z.object({
            chatId: z.string().uuid().openapi({ description: "Chat ID" })
        })
    },
    responses: { 
      200: {
        description: "Chat information retrieved successfully",
        content: {
          "application/json": {
            schema: ChatInfoSchema
          }
        }
      },
      400: {
        description: "Bad request - Chat ID is required",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string().openapi({ description: "Chat ID is required" })
            }).openapi("ChatErrorResponse")
          }
        }
      },
      404: {
        description: "Chat not found",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string().openapi({ description: "Chat not found" })
            }).openapi("ChatErrorResponse")
          }
        }
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string().openapi({ description: "Internal server error" })
            }).openapi("ChatErrorResponse")
          }
        }
      }
    }
  });

  registry.registerPath({
    method: "get",
    path: "/api/dm/chat/{chatId}/messages",
    summary: "Get chat messages",
    description: "Retrieve messages from a specific chat",
    tags: ["Chats"],
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              chatId: z.string().uuid().openapi({ description: "Chat ID" }),
              lastMessageTimestamp: z.string().datetime().optional().openapi({ description: "Timestamp of the last message received (for pagination)" })
            })
          }
        }
      }
    },
    responses: { 
      200: {
        description: "Chat information retrieved successfully",
        content: {
          "application/json": {
            schema: z.array(MessageSchema)
          }
        }
      },
      400: {
        description: "Bad request - Chat ID is required",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string().openapi({ description: "Chat ID and lastMessage timestamp are required" })
            }).openapi("ChatErrorResponse")
          }
        }
      },
      404: {
        description: "Chat not found",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string().openapi({ description: "Chat not found" })
            }).openapi("ChatErrorResponse")
          }
        }
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string().openapi({ description: "Internal server error" })
            }).openapi("ChatErrorResponse")
          }
        }
      }
    }
  });

  registry.registerPath({
    method: "get",
    path: "/api/dm/chat/{userId}",
    summary: "Retrieve all chats that a specific user is participating in",
    description: "Fetch a list of all chats that a user is involved in, including both direct messages and group chats",
    tags: ["Chats"],
    request: {
        params: z.object({
            userId: z.string().uuid().openapi({ description: "User ID" })
        })
    },
    responses: {
      200: {
        description: "List of chats retrieved successfully",
        content: {
          "application/json": {
            schema: z.array(ChatInfoSchema)
          }
        }
      },
      400: {
        description: "Bad request - User ID is required",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string().openapi({ description: "User ID is required" })
            }).openapi("ChatErrorResponse")
          }
        }
      },
      404: {
        description: "No chats found for user",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string().openapi({ description: "No chats found for user" })
            }).openapi("ChatErrorResponse")
          }
        }
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string().openapi({ description: "Internal server error" })
            }).openapi("ChatErrorResponse")
          }
        }
      }
    }
  });

  registry.registerPath({
    method: "get",
    path: "/api/dm/chat/{chatId}/unseenMessagesCount",
    summary: "get unseen messages count",
    tags: ["Chats"],
    request: {
        params: z.object({
            chatId: z.string().uuid().openapi({ description: "Chat ID" })
        })
    },
    responses: {
        200: {
            description: "Unseen messages count retrieved successfully",
            content: {
                "application/json": {
                    schema: z.object({
                        unseenMessagesCount: z.number().openapi({ description: "Count of unseen messages" })
                    })
                }
            }
        },
        400: {
            description: "Bad request - Chat ID is required",
            content: {
                "application/json": {
                    schema: z.object({
                        error: z.string().openapi({ description: "Chat ID is required" })
                    })
                }
            }
        },
        404: {
            description: "No unseen messages found",
            content: {
                "application/json": {
                    schema: z.object({
                        error: z.string().openapi({ description: "No unseen messages found" })
                    })
                }
            }
        },
        500: {
            description: "Internal server error",
            content: {
                "application/json": {
                    schema: z.object({
                        error: z.string().openapi({ description: "Internal server error" })
                    })
                }
            }
        }
    }
 });

 registry.registerPath({
    method: "post",
    path: "api/dm/chat/{userId}/createchat",
    summary: "Create a new chat",
    tags: ["Chats"],
    request: {
        params: z.object({
            userId: z.string().uuid().openapi({ description: "User ID to create chat with" })
        }),
        body: {
            required: true,
            content: {
                "application/json": {
                    schema: CreateChatInput
                }
            }
        }
    },
    responses: {
        201: {
            description: "Chat created successfully",
            content: {
                "application/json": {
                    schema: ChatInfoSchema
                }
            }
        },
        400: {
            description: "Bad request - Invalid input data",
            content: {
                "application/json": {
                    schema: z.object({
                        error: z.string().openapi({ description: "At least two participants are required to create a chat" })
                    })
                }
            }
        },
        404: {
            description: "User not found",
            content: {
                "application/json": {
                    schema: z.object({
                        error: z.string().openapi({ description: "User not found" })
                    })
                }
            }
        },
        500: {
            description: "Internal server error",
            content: {
                "application/json": {
                    schema: z.object({
                        error: z.string().openapi({ description: "Internal server error" })
                    })
                }
            }
        }
    }
 });

    registry.registerPath({
        method: "delete",
        path: "api/dm/chat/{chatId}",
        summary: "Delete a chat by its ID",
        tags: ["Chats"],
        request: {
            params: z.object({
                chatId: z.string().uuid().openapi({ description: "The ID of the chat to delete" }),
            })
        },
        responses: {
            200: {
                description: "Chat deleted successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            message: z.string().openapi({ description: "Chat deleted successfully" })
                        })
                    }
                }
            },
            400: {
                description: "Bad Request - Chat ID is required",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().openapi({ description: "Chat ID is required" })
                        })
                    }
                }
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().openapi({ description: "Internal server error" })
                        })
                    }
                }
            }
        }
    });


    registry.registerPath({
        method: "put",
        path: "api/dm/chat/{chatId}/group",
        summary: "Update group chat details",
        tags: ["Chats"],
        request: {
            params: z.object({
                chatId: z.string().uuid().openapi({ description: "The ID of the group chat to update" }),
            }),
            body: {
                required: true,
                content: {
                    "application/json": {
                        schema: z.object({
                            name: z.string().optional().openapi({ description: "New name for the group chat" }),
                            description: z.string().optional().openapi({ description: "New description for the group chat" }),
                            photo: z.string().url().optional().openapi({ description: "New photo URL for the group chat" }),
                        }).openapi("UpdateChatGroupInput")
                    }
                }
            }
        },
        responses: {
            200: {
                description: "Group chat updated successfully",
                content: {
                    "application/json": {
                        schema: ChatInfoSchema
                    }
                }
            },
            400: {
                description: "Bad Request - Chat ID is required",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().openapi({ description: "Chat ID is required" })
                        })
                    }
                }
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().openapi({ description: "Internal server error" })
                        })
                    }
                }
            }
        }
    });

    registry.registerPath({
        method: "post",
        path: "api/dm/chat/{userId}/message",
        summary: "Add a message to a chat",
        tags: ["Chats"],
        request: {
            params: z.object({
                userId: z.string().uuid().openapi({ description: "The ID of the user to send the message to" }),
            }),
            body: {
                required: true,
                content: {
                    "application/json": {
                        schema: newMessageInput
                    }
                }
            }
        },
        responses: {
            201: {
                description: "Message added successfully",
                content: {
                    "application/json": {
                        schema: MessageSchema
                    }
                }
            },
            400: {
                description: "Bad Request - Invalid input data",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().openapi({ description: "Message content is required or missing chatId or recipientId" })
                        })
                    }
                }
            },
            404: {
                description: "Chat not found",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().openapi({ description: "Chat not found" })
                        })
                    }
                }
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().openapi({ description: "Internal server error" })
                        })
                    }
                }
            }

        }
    });

    registry.registerPath({
        method: "put",
        path: "api/dm/chat/{chatId}/messageStatus",
        summary: "Update message status in a chat",
        tags: ["Chats"],
        request: {
            params: z.object({
                chatId: z.string().uuid().openapi({ description: "The ID of the chat containing the message" }),
            }),
        },
        responses: {
            200: {
                description: "Message status updated successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            status: z.string().openapi({ description: "Message status updated successfully" })
                        })
                    }
                }
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().openapi({ description: "Internal server error" })
                        })
                    }
                }
            }
        }
    });

    registry.registerPath({
        method: "get",
        path: "api/dm/chat/{userId}/unseenChats",
        summary: "Get unseen chats count for a user",
        tags: ["Chats"],
        request: {
            params: z.object({
                userId: z.string().uuid().openapi({ description: "The ID of the user" }),
            })
        },
        responses: {
            200: {
                description: "Unseen chats count retrieved successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            unseenChatsCount: z.number().openapi({ description: "The count of unseen chats for the user" })
                        })
                    }
                }
            },
            400: {
                description: "Bad Request - User ID is required",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().openapi({ description: "User ID is required" })
                        })
                    }
                }
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string().openapi({ description: "Internal server error" })
                        })
                    }
                }
            }
        }
    });
};