import { SocialManager } from '../src/SocialManager';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

async function verify() {
    const config = {
        // Original Platforms
        facebook: process.env.FB_ACCESS_TOKEN ? {
            accessToken: process.env.FB_ACCESS_TOKEN,
            pageId: process.env.FB_PAGE_ID!
        } : undefined,
        instagram: process.env.IG_ACCESS_TOKEN ? {
            accessToken: process.env.IG_ACCESS_TOKEN,
            accountId: process.env.IG_ACCOUNT_ID!
        } : undefined,
        twitter: process.env.TWITTER_API_KEY ? {
            apiKey: process.env.TWITTER_API_KEY,
            apiSecret: process.env.TWITTER_API_SECRET!,
            accessToken: process.env.TWITTER_ACCESS_TOKEN!,
            accessSecret: process.env.TWITTER_ACCESS_SECRET!
        } : undefined,
        linkedin: process.env.LINKEDIN_ACCESS_TOKEN ? {
            accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
            authorId: process.env.LINKEDIN_AUTHOR_ID!
        } : undefined,

        // Major Socials
        youtube: process.env.YOUTUBE_CLIENT_ID ? {
            clientId: process.env.YOUTUBE_CLIENT_ID,
            clientSecret: process.env.YOUTUBE_CLIENT_SECRET!,
            redirectUri: process.env.YOUTUBE_REDIRECT_URI!,
            accessToken: process.env.YOUTUBE_ACCESS_TOKEN,
            refreshToken: process.env.YOUTUBE_REFRESH_TOKEN
        } : undefined,
        tiktok: process.env.TIKTOK_CLIENT_KEY ? {
            clientKey: process.env.TIKTOK_CLIENT_KEY,
            clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
            redirectUri: process.env.TIKTOK_REDIRECT_URI!,
            accessToken: process.env.TIKTOK_ACCESS_TOKEN,
            refreshToken: process.env.TIKTOK_REFRESH_TOKEN
        } : undefined,
        pinterest: process.env.PINTEREST_CLIENT_ID ? {
            clientId: process.env.PINTEREST_CLIENT_ID,
            clientSecret: process.env.PINTEREST_CLIENT_SECRET!,
            redirectUri: process.env.PINTEREST_REDIRECT_URI!,
            accessToken: process.env.PINTEREST_ACCESS_TOKEN,
            refreshToken: process.env.PINTEREST_REFRESH_TOKEN,
            boardId: process.env.PINTEREST_BOARD_ID
        } : undefined,
        reddit: process.env.REDDIT_CLIENT_ID ? {
            clientId: process.env.REDDIT_CLIENT_ID,
            clientSecret: process.env.REDDIT_CLIENT_SECRET!,
            redirectUri: process.env.REDDIT_REDIRECT_URI!,
            accessToken: process.env.REDDIT_ACCESS_TOKEN,
            refreshToken: process.env.REDDIT_REFRESH_TOKEN,
            subreddit: process.env.REDDIT_SUBREDDIT
        } : undefined,
        threads: process.env.THREADS_CLIENT_ID ? {
            clientId: process.env.THREADS_CLIENT_ID,
            clientSecret: process.env.THREADS_CLIENT_SECRET!,
            redirectUri: process.env.THREADS_REDIRECT_URI!,
            accessToken: process.env.THREADS_ACCESS_TOKEN,
            userId: process.env.THREADS_USER_ID
        } : undefined,

        // Messaging & Community
        discord: process.env.DISCORD_CLIENT_ID ? {
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            redirectUri: process.env.DISCORD_REDIRECT_URI!,
            botToken: process.env.DISCORD_BOT_TOKEN!,
            accessToken: process.env.DISCORD_ACCESS_TOKEN,
            guildId: process.env.DISCORD_GUILD_ID
        } : undefined,
        slack: process.env.SLACK_CLIENT_ID ? {
            clientId: process.env.SLACK_CLIENT_ID,
            clientSecret: process.env.SLACK_CLIENT_SECRET!,
            redirectUri: process.env.SLACK_REDIRECT_URI!,
            accessToken: process.env.SLACK_ACCESS_TOKEN,
            teamId: process.env.SLACK_TEAM_ID
        } : undefined,
        telegram: process.env.TELEGRAM_BOT_TOKEN ? {
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            chatId: process.env.TELEGRAM_CHAT_ID
        } : undefined
    };

    const manager = new SocialManager(config);

    console.log('Social Manager initialized with configured platforms.');
    console.log('Available platforms:', Array.from(['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'reddit', 'threads', 'discord', 'slack', 'telegram']).filter(p => manager.getPlatform(p)).join(', '));

    const postContent = {
        text: 'Hello from Socialy Node.js Package! 🚀 Testing new platform integrations.',
        // Uncomment to test media (make sure test files exist):
        // media: [path.resolve(__dirname, 'test-image.jpg')] // For images
        // media: ['https://example.com/video.mp4'] // For video URLs (TikTok, Threads, etc.)
    };

    console.log('\n--- Testing Post ---');
    console.log('Content:', postContent);

    const results = await manager.share(postContent);

    console.log('\nResults:', JSON.stringify(results, null, 2));

    // Analytics Verification
    console.log('\n--- Verifying Analytics ---');

    const platforms = [
        'facebook', 'instagram', 'twitter', 'linkedin',
        'youtube', 'tiktok', 'pinterest', 'reddit', 'threads',
        'discord', 'slack', 'telegram'
    ];

    for (const platformName of platforms) {
        const platform = manager.getPlatform(platformName);
        if (platform && platform.getStats) {
            console.log(`\nFetching ${platformName} Stats...`);
            try {
                const stats = await platform.getStats();
                console.log(`${platformName} Stats:`, JSON.stringify(stats, null, 2));
            } catch (error: any) {
                console.error(`${platformName} Stats Error:`, error.message);
            }
        }
    }

    console.log('\n✅ Verification Complete!');
}

verify().catch(console.error);

