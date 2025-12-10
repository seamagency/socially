import { SocialConfig, PostContent, PostResult, SocialPlatform } from './types';
import { Facebook, Instagram, Twitter, LinkedIn, YouTube, TikTok, Pinterest, Reddit, Threads, Discord, Slack, Telegram } from './platforms';

export class SocialManager {
    private platforms: Map<string, SocialPlatform> = new Map();

    constructor(config: SocialConfig) {
        if (config.facebook) {
            this.platforms.set('facebook', new Facebook(config.facebook));
        }
        if (config.instagram) {
            this.platforms.set('instagram', new Instagram(config.instagram));
        }
        if (config.twitter) {
            this.platforms.set('twitter', new Twitter(config.twitter));
        }
        if (config.linkedin) {
            this.platforms.set('linkedin', new LinkedIn(config.linkedin));
        }
        if (config.youtube) {
            this.platforms.set('youtube', new YouTube(config.youtube));
        }
        if (config.tiktok) {
            this.platforms.set('tiktok', new TikTok(config.tiktok));
        }
        if (config.pinterest) {
            this.platforms.set('pinterest', new Pinterest(config.pinterest));
        }
        if (config.reddit) {
            this.platforms.set('reddit', new Reddit(config.reddit));
        }
        if (config.threads) {
            this.platforms.set('threads', new Threads(config.threads));
        }
        if (config.discord) {
            this.platforms.set('discord', new Discord(config.discord));
        }
        if (config.slack) {
            this.platforms.set('slack', new Slack(config.slack));
        }
        if (config.telegram) {
            this.platforms.set('telegram', new Telegram(config.telegram));
        }
    }

    getPlatform(name: string): SocialPlatform | undefined {
        return this.platforms.get(name);
    }

    async share(content: PostContent, platforms?: string[]): Promise<PostResult[]> {
        const targetPlatforms = platforms
            ? platforms.filter(p => this.platforms.has(p))
            : Array.from(this.platforms.keys());

        const results: PostResult[] = [];

        for (const platformName of targetPlatforms) {
            const platform = this.platforms.get(platformName);
            if (platform) {
                try {
                    const result = await platform.post(content);
                    results.push(result);
                } catch (error) {
                    results.push({
                        platform: platformName,
                        success: false,
                        error: error
                    });
                }
            }
        }

        return results;
    }
}
