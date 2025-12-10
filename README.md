# @seamagency/socially

[![npm version](https://badge.fury.io/js/@seamagency%2Fsocially.svg)](https://www.npmjs.com/package/@seamagency/socially)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive social media management library for Node.js with support for 12+ platforms including Instagram, YouTube, TikTok, Pinterest, Reddit, Threads, Discord, Slack, Telegram, and more.

## Features

- **OAuth Support** - Built-in OAuth flows for all platforms
- **Instagram API** - Posts, Stories, Comments, DMs (Instagram Login API)
- **YouTube** - Video uploads, comments, playlists
- **Twitter/X** - Tweets, threads, media
- **LinkedIn** - Posts, articles, company pages
- **Pinterest** - Pins, boards
- **TikTok** - Video uploads
- **Threads** - Posts, replies
- **Discord/Slack/Telegram** - Messages, webhooks
- **Analytics** - Unified stats across platforms

## Installation

```bash
npm install @seamagency/socially
```

## Quick Start

### Instagram Example

```typescript
import { Instagram } from '@seamagency/socially';

// 1. Initialize with OAuth credentials
const instagram = new Instagram({
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    redirectUri: 'https://yourapp.com/callback'
});

// 2. Generate OAuth URL
const authUrl = instagram.generateAuthUrl();
// Redirect user to authUrl

// 3. Exchange code for token (in callback)
const { accessToken, userId } = await instagram.exchangeCodeForToken(code);

// 4. Use the API
const ig = new Instagram({ accessToken, accountId: userId });

// Post an image
await ig.post({
    text: 'Hello from Socialy! 📸',
    media: ['https://example.com/image.jpg']
});

// Post a story
await ig.postStory('https://example.com/story.jpg');

// Get user profile
const profile = await ig.getUserProfile();
```

### Multi-Platform Example

```typescript
import { SocialManager } from '@seamagency/socially';

const manager = new SocialManager({
    instagram: { accessToken: '...', accountId: '...' },
    twitter: { apiKey: '...', apiSecret: '...', accessToken: '...', accessSecret: '...' },
    youtube: { accessToken: '...' }
});

// Post to multiple platforms at once
await manager.postToAll({
    text: 'Cross-platform post! 🚀',
    media: ['https://example.com/image.jpg']
});
```

## Supported Platforms

| Platform | OAuth | Post | Media | Comments | DMs | Analytics |
|----------|-------|------|-------|----------|-----|-----------|
| Instagram | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| YouTube | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Twitter/X | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| LinkedIn | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| TikTok | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Pinterest | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Threads | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Reddit | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Discord | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Slack | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Telegram | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Facebook | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

## Instagram API Setup

This library uses the **Instagram API with Instagram Login** (not Facebook Login).

### Prerequisites

1. Create a Meta Developer account at [developers.facebook.com](https://developers.facebook.com)
2. Create a new app and add "Instagram API with Instagram Login"
3. Add your Instagram Business/Creator account as a tester
4. Configure OAuth redirect URIs

### Required Scopes

```typescript
instagram.generateAuthUrl([
    'instagram_business_basic',
    'instagram_business_content_publish',
    'instagram_business_manage_messages',
    'instagram_business_manage_comments',
    'instagram_business_manage_insights'
]);
```

## API Reference

### Instagram

```typescript
// OAuth
generateAuthUrl(scopes?: string[]): string
exchangeCodeForToken(code: string): Promise<TokenData>
refreshAccessToken(token: string): Promise<TokenData>

// Content
post(content: PostContent): Promise<PostResult>
postStory(mediaUrl: string, mediaType?: 'IMAGE' | 'VIDEO'): Promise<StoryResult>

// User
getUserProfile(): Promise<UserProfile>
getMedia(): Promise<MediaList>
getStories(): Promise<StoryList>

// Engagement
getComments(mediaId: string): Promise<CommentList>
replyToComment(commentId: string, message: string): Promise<Result>
deleteComment(commentId: string): Promise<Result>

// Messaging
sendMessage(recipientId: string, message: string): Promise<Result>
getConversations(): Promise<ConversationList>
```

## Environment Variables

```env
# Instagram
INSTAGRAM_CLIENT_ID=your_client_id
INSTAGRAM_CLIENT_SECRET=your_client_secret
INSTAGRAM_REDIRECT_URI=https://yourapp.com/auth/instagram/callback

# Twitter
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret

# YouTube
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [Muhammet Eroglu](https://github.com/seam-agency)
