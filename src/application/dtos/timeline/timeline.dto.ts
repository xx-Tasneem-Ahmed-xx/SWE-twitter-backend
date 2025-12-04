// src/application/dtos/timeline.dto.ts
import z from "zod";
import {
  CursorDTOSchema,
  TimelineItemSchema,
  ForYouResponseSchema,
  TimelineResponseSchema,
} from "./timeline.dto.schema";

export type CursorDTO = z.infer<typeof CursorDTOSchema>;
export type TimelineItemDTO = z.infer<typeof TimelineItemSchema>;
export type ForYouResponseDTO = z.infer<typeof ForYouResponseSchema>;
export type TimelineResponseDTO = z.infer<typeof TimelineResponseSchema>;



// {
//   "user": "string",
//   "recommendations": [
//     {
//       "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
//       "content": "string",
//       "createdAt": "2025-11-30",
//       "likesCount": 0,
//       "retweetCount": 0,
//       "repliesCount": 0,
//       "quotesCount": 0,
//       "replyControl": "EVERYONE",
//       "parentId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
//       "tweetType": "TWEET",
//       "user": {
//         "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
//         "name": "string",
//         "username": "string",
//         "profileMedia": {
//           "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
//         },
//         "verified": true,
//         "protectedAccount": true
//       },
//       "mediaIds": [
//         "3fa85f64-5717-4562-b3fc-2c963f66afa6"
//       ],
//       "isLiked": true,
//       "isRetweeted": true,
//       "isBookmarked": true,
//       "retweets": {
//         "data": [
//           {
//             "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
//             "name": "string",
//             "username": "string",
//             "profileMedia": {
//               "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
//             },
//             "verified": true,
//             "protectedAccount": true
//           }
//         ],
//         "nextCursor": "string"
//       }
//     }
//   ]
// }
// /api/home/for-you
// -----------------------------
// {
//   "data": [
//     {
//       "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
//       "content": "string",
//       "createdAt": "2025-11-30",
//       "likesCount": 0,
//       "retweetCount": 0,
//       "repliesCount": 0,
//       "quotesCount": 0,
//       "replyControl": "EVERYONE",
//       "parentId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
//       "tweetType": "TWEET",
//       "user": {
//         "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
//         "name": "string",
//         "username": "string",
//         "profileMedia": {
//           "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
//         },
//         "verified": true,
//         "protectedAccount": true
//       },
//       "mediaIds": [
//         "3fa85f64-5717-4562-b3fc-2c963f66afa6"
//       ],
//       "isLiked": true,
//       "isRetweeted": true,
//       "isBookmarked": true,
//       "retweets": {
//         "data": [
//           {
//             "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
//             "name": "string",
//             "username": "string",
//             "profileMedia": {
//               "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
//             },
//             "verified": true,
//             "protectedAccount": true
//           }
//         ],
//         "nextCursor": "string"
//       }
//     }
//   ],
//   "nextCursor": "string"
// }
// /api/home/timeline
// -------------------------