import { addChannel } from '../services/channel.service.ts';
import { prisma } from '../lib/prisma.ts';

/**
 * Admin script to add multiple YouTube channels
 * 
 * Usage:
 *   bun run src/scripts/add-channels.ts "https://www.youtube.com/@Channel1" "https://www.youtube.com/@Channel2"
 * 
 * Or from a file:
 *   bun run src/scripts/add-channels.ts --file channels.txt
 * 
 * File format (channels.txt):
 *   https://www.youtube.com/@Channel1
 *   https://www.youtube.com/@Channel2
 *   https://www.youtube.com/channel/UCxxxxx
 */

const parseChannels = async (): Promise<string[]> => {
  const args = process.argv.slice(2);
  
  // Check for --file flag
  const fileIndex = args.indexOf('--file');
  if (fileIndex !== -1) {
    const filePath = args[fileIndex + 1];
    if (!filePath) {
      console.error('Error: --file flag requires a file path');
      process.exit(1);
    }
    
    try {
      const file = Bun.file(filePath);
      const content = await file.text();
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      process.exit(1);
    }
  }
  
  // Otherwise, treat all args as channel URLs
  return args.filter(arg => arg && !arg.startsWith('--'));
};

const main = async () => {
  const channelUrls = await parseChannels();
  
  if (channelUrls.length === 0) {
    console.log(`
Usage:
  bun run src/scripts/add-channels.ts "https://www.youtube.com/@Channel1" "https://www.youtube.com/@Channel2"
  
  Or from a file:
  bun run src/scripts/add-channels.ts --file channels.txt
  
File format (channels.txt):
  https://www.youtube.com/@Channel1
  https://www.youtube.com/@Channel2
  https://www.youtube.com/channel/UCxxxxx
    `);
    process.exit(1);
  }
  
  console.log(`\n📺 Adding ${channelUrls.length} channel(s)...\n`);
  
  const results = {
    success: [] as string[],
    skipped: [] as string[],
    errors: [] as { url: string; error: string }[],
  };
  
  for (let i = 0; i < channelUrls.length; i++) {
    const url = channelUrls[i];
    console.log(`[${i + 1}/${channelUrls.length}] Processing: ${url}`);
    
    try {
      const channel = await addChannel(url);
      
      // Check if it was already existing (returned without creating)
      const existing = await prisma.youTuber.findUnique({
        where: { channelId: channel.channelId },
      });
      
      if (existing && existing.id !== channel.id) {
        // This shouldn't happen, but handle it
        results.skipped.push(url);
        console.log(`  ⏭️  Already exists: ${channel.name}`);
      } else {
        results.success.push(url);
        console.log(`  ✅ Added: ${channel.name} (${channel.channelId})`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.errors.push({ url, error: errorMessage });
      console.log(`  ❌ Error: ${errorMessage}`);
    }
    
    // Small delay to avoid rate limiting
    if (i < channelUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  ✅ Successfully added: ${results.success.length}`);
  console.log(`  ⏭️  Skipped (already exists): ${results.skipped.length}`);
  console.log(`  ❌ Errors: ${results.errors.length}`);
  
  if (results.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    results.errors.forEach(({ url, error }) => {
      console.log(`  - ${url}: ${error}`);
    });
  }
  
  await prisma.$disconnect();
};

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

