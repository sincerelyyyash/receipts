/**
 * Test script to validate transcript fetching improvements
 * 
 * This script tests the enhanced transcript fetching with:
 * - Multi-language fallbacks
 * - Retry mechanisms
 * - Error handling
 * 
 * Usage: bun run src/scripts/test-transcript-improvements.ts
 */

import { prisma } from "../lib/prisma.ts";
import { fetchTranscript } from "../services/transcript.service.ts";

const testTranscriptImprovements = async () => {
  console.log("🧪 Testing Transcript Fetching Improvements\n");
  console.log("=" .repeat(60));

  try {
    // Get videos that were marked as TRANSCRIPT_UNAVAILABLE
    const failedVideos = await prisma.video.findMany({
      where: {
        transcript: {
          contains: "TRANSCRIPT_UNAVAILABLE",
        },
      },
      include: {
        youtuber: {
          select: { name: true },
        },
      },
      take: 5,
      orderBy: { publishedAt: "desc" },
    });

    if (failedVideos.length === 0) {
      console.log("✅ No previously failed videos found to test!");
      console.log("   This means all videos either have transcripts or haven't been attempted yet.");
      return;
    }

    console.log(`\nFound ${failedVideos.length} previously failed videos to retry:\n`);

    const results = {
      success: 0,
      failed: 0,
      details: [] as Array<{
        title: string;
        channel: string;
        videoId: string;
        status: "success" | "failed";
        error?: string;
      }>,
    };

    for (const video of failedVideos) {
      console.log(`\n📹 Testing: ${video.title}`);
      console.log(`   Channel: ${video.youtuber.name}`);
      console.log(`   Video ID: ${video.videoId}`);
      console.log(`   Published: ${video.publishedAt.toISOString().split("T")[0]}`);

      try {
        // Clear the old failed transcript first
        await prisma.video.update({
          where: { id: video.id },
          data: { transcript: null },
        });

        // Try fetching with new improved logic
        const transcript = await fetchTranscript(video.videoId);

        if (transcript && transcript.length > 0) {
          // Save the successfully fetched transcript
          await prisma.video.update({
            where: { id: video.id },
            data: {
              transcript: JSON.stringify(transcript),
              transcriptFetchedAt: new Date(),
            },
          });

          console.log(`   ✅ SUCCESS - Fetched ${transcript.length} segments`);
          results.success++;
          results.details.push({
            title: video.title,
            channel: video.youtuber.name,
            videoId: video.videoId,
            status: "success",
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.log(`   ❌ FAILED - ${errorMessage}`);
        
        // Restore the TRANSCRIPT_UNAVAILABLE marker
        await prisma.video.update({
          where: { id: video.id },
          data: {
            transcript: JSON.stringify([
              {
                text: "TRANSCRIPT_UNAVAILABLE",
                offsetSec: 0,
                timestamp: "0:00",
                duration: 0,
                error: errorMessage,
              },
            ]),
            transcriptFetchedAt: new Date(),
          },
        });

        results.failed++;
        results.details.push({
          title: video.title,
          channel: video.youtuber.name,
          videoId: video.videoId,
          status: "failed",
          error: errorMessage,
        });
      }

      // Small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("\n📊 TEST RESULTS SUMMARY\n");
    console.log(`Total videos tested: ${failedVideos.length}`);
    console.log(`✅ Successfully fetched: ${results.success} (${Math.round((results.success / failedVideos.length) * 100)}%)`);
    console.log(`❌ Still failed: ${results.failed} (${Math.round((results.failed / failedVideos.length) * 100)}%)`);

    if (results.success > 0) {
      console.log("\n🎉 Improvements working! Previously failed videos now have transcripts:");
      results.details
        .filter((d) => d.status === "success")
        .forEach((d) => {
          console.log(`   ✅ ${d.title} (${d.channel})`);
        });
    }

    if (results.failed > 0) {
      console.log("\n⚠️ These videos still failed after improvements:");
      results.details
        .filter((d) => d.status === "failed")
        .forEach((d) => {
          console.log(`   ❌ ${d.title}`);
          console.log(`      Reason: ${d.error}`);
        });
    }

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ Test completed!\n");
  } catch (error) {
    console.error("❌ Test script error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

// Run the test
testTranscriptImprovements();

