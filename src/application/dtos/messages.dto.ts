export class CreateChatInput {
  DMChat?: boolean;
  userId!: string;
}

export class MessageAttachment {
  media!: File;
  name?: string;
  url?: string;
  size?: number;
  type?: string;
}

export class MessageData {
  messageMedia?: MessageAttachment[];
  content?: string;
}

export class ChatInput {
  DMChat!: boolean;
  MessageData?: MessageData;
  participant_ids!: string[];
}

export class chatGroupUpdate {
  name?: string;
  description?: string;
  photo?: string;
}

export class newMessageInput {
  data!: MessageData;
  recipientId!: string[];
  chatId!: string;
}
