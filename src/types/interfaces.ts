export interface BaseInteractionRecord {
  userId: string;
  createdAt: Date;
}

export interface TweetLikeRecord extends BaseInteractionRecord {
  tweet: {
    user: { id: string };
    [key: string]: any;
  };
}

export interface RetweetRecord extends BaseInteractionRecord {
  user: { id: string };
  [key: string]: any;
}

export type InteractionRecord = TweetLikeRecord | RetweetRecord;
