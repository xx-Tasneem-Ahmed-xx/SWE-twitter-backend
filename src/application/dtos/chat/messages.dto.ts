import {z} from "zod";
import type { mediaSchema } from "../media/media.schema.dto";


export class CreateChatInput {
  DMChat?: boolean;
  userId!: string;
}

// export class MessageAttachment {
//   name?: string;
//   url?: string;
//   size?: number;
//   type?: string;
// }

export class MessageData {
  messageMedia?: typeof mediaSchema[];
  content?: string;
}

export class ChatInput {
  DMChat!: boolean;
  participant_ids!: string[];
}

export class chatGroupUpdate {
  name?: string;
  description?: string;
  photo?: string;
}

export class newMessageInput {
  data!: MessageData;
  recipientId?: string[];
  chatId?: string;
}
