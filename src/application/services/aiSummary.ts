import { Groq } from "groq-sdk";

const groq = new Groq();

export async function generateTweetSumamry(tweetContent: string) {
  const prompt = `You are an assistant that summarizes tweets briefly and clearly.
    The summary must:
        - Always be shorter than the original tweet.
        - Use simple, plain and natural English.
        - Summarize it clearly.
        - Do NOT include any extra quotes or escape characters.
        - keep it short.
        - Capture only the main point without repeating phrases or hashtags.`;

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: prompt,
      },
      {
        role: "user",
        content: `Tweet:${tweetContent}.`,
      },
    ],
    model: "llama-3.1-8b-instant",
    temperature: 0.3,
    top_p: 0.9,
  });

  return chatCompletion.choices[0].message?.content?.trim() || "";
}
