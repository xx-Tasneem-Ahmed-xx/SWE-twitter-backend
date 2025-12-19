import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  },
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true },
  });

  if (users.length === 0) {
    throw new Error("No users found in the database. Please seed users first.");
  }

  console.log(`Found ${users.length} users in the database.`);

  const categoryTweets: Record<string, string[]> = {
    sports: [
      "Big win for the home team tonight!",
      "Training hard for the marathon next month.",
      "That penalty kick was unbelievable!",
      "Sports bring people together across cultures.",
      "Watching the Olympics always inspires me.",
      "Local league finals this weekend — can’t wait!",
    ],
    entertainment: [
      "The new comedy show had me laughing nonstop.",
      "Concert tickets booked for next month!",
      "Streaming platforms are changing how we watch TV.",
      "That movie twist was mind-blowing.",
      "Stand-up comedy night was unforgettable.",
      "Binge-watching my favorite series again.",
    ],
    "business & finance": [
      "Markets closed higher today after tech rally.",
      "Launching a new startup is both exciting and scary.",
      "Reading about Warren Buffett’s investment strategies.",
      "Quarterly reports show steady growth.",
      "Networking at the business summit was fruitful.",
      "Exploring sustainable finance options.",
    ],
    basketball: [
      "Three-pointer at the buzzer! Incredible game.",
      "Practicing free throws every morning.",
      "NBA playoffs are heating up.",
      "Basketball teaches teamwork and discipline.",
      "Streetball culture is so vibrant.",
      "Legends like Jordan inspire generations.",
    ],
    fashion: [
      "New season, new wardrobe ideas.",
      "Mixing vintage with modern styles today.",
      "Sneaker drops are getting wild lately.",
      "Fashion week highlights are stunning.",
      "Minimalist outfits are my current vibe.",
      "Accessories can make or break a look.",
    ],
    science: [
      "Space exploration expands our horizons.",
      "Reading about CRISPR breakthroughs.",
      "Physics explains the beauty of the universe.",
      "Climate science is more urgent than ever.",
      "Lab experiments are progressing well.",
      "Science podcasts keep me inspired.",
    ],
    cryptocurrency: [
      "Bitcoin hit a new milestone today.",
      "Exploring Ethereum smart contracts.",
      "Crypto volatility keeps traders on edge.",
      "Learning about decentralized finance (DeFi).",
      "NFTs are reshaping digital ownership.",
      "Regulation debates continue in crypto space.",
    ],
    food: [
      "Homemade pasta night was delicious.",
      "Trying out a new vegan recipe.",
      "Street food adventures are the best.",
      "Baking bread is therapeutic.",
      "Exploring world cuisines broadens the palate.",
      "Food festivals bring communities together.",
    ],
    "american football": [
      "Touchdown celebrations are unmatched.",
      "Super Bowl ads are always iconic.",
      "Practicing drills with the team.",
      "College football games are intense.",
      "Fantasy football league updates are fun.",
      "Game-day snacks are essential.",
    ],
    gaming: [
      "Levelled up in my favorite RPG.",
      "Esports tournaments are thrilling to watch.",
      "Retro games bring back nostalgia.",
      "VR gaming feels futuristic.",
      "Multiplayer nights with friends are the best.",
      "Exploring indie game gems.",
    ],
    "health & fitness": [
      "5K run this morning. Feeling great!",
      "Yoga helps me stay balanced.",
      "Meal prepping keeps me on track.",
      "Strength training builds confidence.",
      "Hydration is key to performance.",
      "Meditation improves mental health.",
    ],
    finance: [
      "Stock market analysis is fascinating.",
      "Budgeting apps make life easier.",
      "Compound interest is powerful.",
      "Diversification reduces risk.",
      "Reading financial news daily.",
      "Planning for retirement early pays off.",
    ],
    shopping: [
      "Black Friday deals were insane.",
      "Online shopping is so convenient.",
      "Supporting local shops feels good.",
      "Comparing prices saves money.",
      "Impulse buys can be dangerous.",
      "Wishlist items finally on sale.",
    ],
    memes: [
      "This meme perfectly sums up my mood.",
      "Internet humor evolves so fast.",
      "Sharing memes with friends is bonding.",
      "Dank memes keep me laughing.",
      "Meme culture is global now.",
      "That cat meme never gets old.",
    ],
    "movies & tv": [
      "Rewatching classic films is comforting.",
      "Oscar nominations are out!",
      "TV dramas keep me hooked.",
      "Documentaries open new perspectives.",
      "Animated movies are underrated.",
      "Movie nights are the best.",
    ],
    music: [
      "Jamming with the band tonight.",
      "New album release is fire.",
      "Live concerts are unforgettable.",
      "Music heals the soul.",
      "Discovering indie artists is rewarding.",
      "Playlist updates keep me motivated.",
    ],
    news: [
      "Global headlines are shifting rapidly.",
      "Local news keeps me connected.",
      "Breaking stories spread instantly online.",
      "Journalism shapes public opinion.",
      "Reading morning news is routine.",
      "Investigative reports reveal hidden truths.",
    ],
    politics: [
      "Debates highlight key issues.",
      "Policy changes affect everyday life.",
      "Voting is a civic duty.",
      "Political campaigns are everywhere.",
      "International relations are complex.",
      "Public opinion polls are interesting.",
    ],
    celebrity: [
      "Celebrity interviews reveal hidden sides.",
      "Red carpet fashion is dazzling.",
      "Fan culture is powerful.",
      "Celebrity philanthropy inspires change.",
      "Tabloid rumors spread quickly.",
      "Autographs are treasured keepsakes.",
    ],
    soccer: [
      "World Cup fever is unmatched.",
      "Goal celebrations are iconic.",
      "Soccer unites fans globally.",
      "Practicing drills improves skills.",
      "Club rivalries are intense.",
      "Legends inspire young players.",
    ],
    technology: [
      "Debugged a gnarly backend bug today.",
      "Exploring AI-powered tools for productivity.",
      "Quantum computing feels closer than ever.",
      "Building a side project with Next.js.",
      "Tech conferences are great for networking.",
      "Cloud costs can spiral if not managed.",
    ],
    travel: [
      "Planning my next trip to Iceland.",
      "Exploring hidden gems in Europe.",
      "Travel photography captures memories.",
      "Solo travel builds confidence.",
      "Cultural immersion enriches journeys.",
      "Backpacking adventures are unforgettable.",
    ],
    pets: [
      "My dog learned a new trick!",
      "Cats are masters of relaxation.",
      "Pet adoption changes lives.",
      "Walking the dog clears my mind.",
      "Birds bring joy with their songs.",
      "Pets are family.",
    ],
    baseball: [
      "Home run celebrations are epic.",
      "Pitching practice is intense.",
      "Baseball stats are fascinating.",
      "Minor league games are fun.",
      "Legends inspire young players.",
      "Ballpark snacks are unbeatable.",
    ],
    stocks: [
      "Tech stocks rallied today.",
      "Watching market trends closely.",
      "Dividend stocks provide steady income.",
      "Stock splits excite investors.",
      "Bear vs bull markets explained.",
      "Long-term investing builds wealth.",
    ],
  };

  // Prepare tweets data with round-robin user assignment
  const tweetsData = Object.entries(categoryTweets).flatMap(
    ([category, contents], i) =>
      contents.map((content, j) => ({
        userId: users[(i + j) % users.length].id,
        content,
        category,
      }))
  );

  console.log("Inserting tweets...");

  // Step 1: Insert all tweets quickly
  await prisma.tweet.createMany({
    data: tweetsData.map((tweet) => ({
      userId: tweet.userId,
      content: tweet.content,
      tweetType: "TWEET",
    })),
    skipDuplicates: true, // optional, avoids duplicate content errors
  });

  console.log("Tweets inserted. Creating tweet-category connections...");

  // Step 2: Insert tweetCategories connections
  for (const tweet of tweetsData) {
    const dbTweet = await prisma.tweet.findFirst({
      where: { content: tweet.content },
      select: { id: true },
    });

    const dbCategory = await prisma.category.findUnique({
      where: { name: tweet.category },
      select: { id: true },
    });

    if (dbTweet && dbCategory) {
      await prisma.tweetCategory.create({
        data: {
          tweetId: dbTweet.id,
          categoryId: dbCategory.id,
        },
      });
    }
  }

  console.log("All tweets and category connections inserted successfully!");

  // Summary statistics
  const totalTweets = await prisma.tweet.count();
  const tweetsPerUser = Math.floor(totalTweets / users.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
