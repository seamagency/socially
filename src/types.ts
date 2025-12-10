export interface SocialPlatform {
    name: string;
    post(content: PostContent): Promise<PostResult>;
    getStats?(): Promise<any>;
}

export interface PostContent {
    text?: string;
    media?: string[]; // Paths or URLs
}

export interface PostResult {
    platform: string;
    success: boolean;
    postId?: string;
    error?: any;
}

export interface SocialConfig {
    facebook?: { accessToken: string; pageId: string };
    instagram?: {
        accessToken?: string;
        accountId?: string;
        clientId?: string;
        clientSecret?: string;
        redirectUri?: string;
    }; // Business
    youtube?: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        accessToken?: string;
        refreshToken?: string;
    };
    tiktok?: {
        clientKey: string;
        clientSecret: string;
        redirectUri: string;
        accessToken?: string;
        refreshToken?: string;
    };
    pinterest?: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        accessToken?: string;
        refreshToken?: string;
        boardId?: string; // Default board ID
    };
    reddit?: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        accessToken?: string;
        refreshToken?: string;
        subreddit?: string; // Default subreddit
    };
    threads?: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        accessToken?: string;
        refreshToken?: string; // Threads uses long-lived access tokens, but we can store it here
        userId?: string;
    };
    discord?: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        botToken: string; // Required for bot actions
        accessToken?: string;
        guildId?: string;
    };
    slack?: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        accessToken?: string;
        teamId?: string;
    };
    telegram?: {
        botToken: string;
        chatId?: string; // Optional, can be fetched dynamically or provided
    };
    linkedin?: { accessToken: string; authorId: string };
    twitter?: { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string };
}
