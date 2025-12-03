import { Groq } from "groq-sdk";
import { prisma } from "@/prisma/client";
import { getSecrets } from "@/config/secrets";

export async function generateTweetSumamry(tweetContent: string) {
  const { GROQ_API_KEY: apiKey } = getSecrets();
  const groq = new Groq({ apiKey });

  const prompt = `You are an assistant that summarizes tweets briefly and clearly.
    The summary must:
        - Always be shorter than the original tweet.
        - Use simple, plain and natural English.
        - Summarize it clearly.
        - Do NOT include any extra quotes or escape characters.
        - keep it short.
        - Capture only the main point without repeating phrases or hashtags.`;

  const response = await groq.chat.completions.create({
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Tweet:${tweetContent}.` },
    ],
    model: "llama-3.1-8b-instant",
    temperature: 0.3,
    top_p: 0.9,
  });

  return response.choices[0].message?.content?.trim() || "";
}

export async function generateTweetCategory(tweetContent: string) {
  const { GROQ_API_KEY: apiKey } = getSecrets();
  const groq = new Groq({ apiKey });
  const categories = await prisma.category.findMany({ select: { name: true } });
  const categoryList = categories.map((c) => c.name).join(", ");

  const prompt = `
You are an assistant that classifies a tweet into the MOST relevant categories.

Rules:
- You MUST return a JSON object with this exact shape:
  {
    "categories": ["category1", "category2"]
  }
- You MUST return between 1 and 3 categories MAX.
- Choose ONLY from the provided list.
- NEVER invent new categories.
- Order categories from MOST relevant to least relevant.
- If only one category fits strongly, return one.
- Think strictly based on tweet meaning (semantic meaning).

Available categories:
${categoryList}
`;

  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0.1,
    top_p: 0.9,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Tweet: ${tweetContent}` },
    ],
  });

  const raw = response.choices[0].message?.content?.trim() || "";

  try {
    const json = JSON.parse(raw);
    return json.categories ?? [];
  } catch {
    console.log("failed to categorize");
    return [];
  }
}
