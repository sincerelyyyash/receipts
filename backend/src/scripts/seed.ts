import "dotenv/config";
import { prisma } from "../lib/prisma.ts";

// Initial finance YouTubers to seed
const INITIAL_YOUTUBERS = [
  {
    name: "Akshat Shrivastava",
    channelId: "UCqW8jxh4tH1Z1sWPbkGWL4g",
    channelUrl: "https://www.youtube.com/channel/UCqW8jxh4tH1Z1sWPbkGWL4g",
    description: "Finance and investment education",
  },
  {
    name: "Ankur Warikoo",
    channelId: "UCRzYN32xtBf3Yxax6S3sZ8Q",
    channelUrl: "https://www.youtube.com/channel/UCRzYN32xtBf3Yxax6S3sZ8Q",
    description: "Entrepreneur, content creator, personal finance",
  },
  {
    name: "CA Rachana Ranade",
    channelId: "UCmXpPz-GHGMM4rJXPNMuIEw",
    channelUrl: "https://www.youtube.com/channel/UCmXpPz-GHGMM4rJXPNMuIEw",
    description: "Stock market education and analysis",
  },
  {
    name: "Pranjal Kamra",
    channelId: "UCLfM3QZS_7OOIkfxvMR9RmQ",
    channelUrl: "https://www.youtube.com/channel/UCLfM3QZS_7OOIkfxvMR9RmQ",
    description: "Stock market analysis and investment strategies",
  },
  {
    name: "Labour Law Advisor",
    channelId: "UCq4vJc0E1KoA8M7U5q0Q1bQ",
    channelUrl: "https://www.youtube.com/channel/UCq4vJc0E1KoA8M7U5q0Q1bQ",
    description: "Finance and legal advice for employees",
  },
];

const seed = async () => {
  console.log("🌱 Starting database seed...\n");

  try {
    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log("🗑️  Clearing existing data...");
    await prisma.prediction.deleteMany();
    await prisma.video.deleteMany();
    await prisma.youTuber.deleteMany();
    console.log("✅ Existing data cleared\n");

    // Seed YouTubers
    console.log("📺 Seeding YouTubers...");
    for (const youtuber of INITIAL_YOUTUBERS) {
      const created = await prisma.youTuber.upsert({
        where: { channelId: youtuber.channelId },
        update: {},
        create: youtuber,
      });
      console.log(`   ✅ ${created.name}`);
    }

    console.log("\n✅ Seed completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Start the server: bun run dev");
    console.log("   2. Sync videos for a channel:");
    console.log('      POST /api/channels/:id/sync?from=2022-01-01&to=2025-01-01');
    console.log("   3. Fetch transcript for a video:");
    console.log("      POST /api/videos/:id/transcript");
    console.log("   4. Analyze a video:");
    console.log("      POST /api/videos/:id/analyze");
    console.log("   5. Check the leaderboard:");
    console.log("      GET /api/leaderboard");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seed();

