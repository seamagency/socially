# Socially - Comprehensive Social Media Library

A complete Node.js/TypeScript library for managing social media platforms with unified APIs.

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Architecture](#architecture)
- [Platforms](#platforms)
  - [Instagram](#instagram)
  - [YouTube](#youtube)
  - [Twitter/X](#twitterx)
  - [LinkedIn](#linkedin)
  - [Facebook](#facebook)
  - [TikTok](#tiktok)
  - [Threads](#threads)
  - [Pinterest](#pinterest)
  - [Reddit](#reddit)
  - [Discord](#discord)
  - [Slack](#slack)
  - [Telegram](#telegram)
- [SocialManager](#socialmanager)
- [Types](#types)
- [Error Handling](#error-handling)

---

## Overview

Socially provides a unified interface to interact with 12+ social media platforms. Each platform class implements a common `SocialPlatform` interface, making it easy to:

- Authenticate users via OAuth
- Post content (text, images, videos)
- Manage comments and engagement
- Retrieve analytics and insights

---

## Installation

```bash
npm install @seamagency/socially
```

**TypeScript Support**: Full TypeScript definitions included.

**Peer Dependencies**: Requires `axios` (automatically installed).

---

## Architecture

```
@seamagency/socially
├── SocialManager        # Multi-platform orchestrator
├── platforms/
│   ├── Instagram        # Instagram Login API
│   ├── YouTube          # YouTube Data API v3
│   ├── Twitter          # Twitter API v2 + OAuth 1.0a/2.0
│   ├── LinkedIn         # LinkedIn Marketing API
│   ├── Facebook         # Facebook Graph API
│   ├── TikTok           # TikTok API v2
│   ├── Threads          # Threads Graph API
│   ├── Pinterest        # Pinterest API v5
│   ├── Reddit           # Reddit API
│   ├── Discord          # Discord Bot API
│   ├── Slack            # Slack Web API
│   └── Telegram         # Telegram Bot API
└── types.ts             # Shared TypeScript interfaces
```

---

## Platforms

### Instagram

Uses **Instagram API with Instagram Login** (not Facebook Login).

#### Constructor

```typescript
import { Instagram } from '@seamagency/socially';

const instagram = new Instagram({
    // For OAuth flow
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    
    // For API usage (after auth)
    accessToken?: string;
    accountId?: string;
});
```

#### OAuth Methods

| Method | Description |
|--------|-------------|
| `generateAuthUrl(scopes?: string[])` | Generate authorization URL |
| `exchangeCodeForToken(code: string)` | Exchange auth code for tokens |
| `refreshAccessToken(token: string)` | Refresh long-lived token |

**Default Scopes**: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_messages`, `instagram_business_manage_comments`

#### Content Methods

| Method | Description |
|--------|-------------|
| `post(content: PostContent)` | Post image/video with caption |
| `postStory(mediaUrl: string, mediaType?: 'IMAGE' \| 'VIDEO')` | Post a story |
| `getMedia()` | Get user's media list |
| `getStories()` | Get user's stories |

#### Engagement Methods

| Method | Description |
|--------|-------------|
| `getComments(mediaId: string)` | Get comments on media |
| `replyToComment(commentId: string, message: string)` | Reply to a comment |
| `deleteComment(commentId: string)` | Delete a comment |
| `hideComment(commentId: string)` | Hide a comment |

#### Messaging Methods

| Method | Description |
|--------|-------------|
| `sendMessage(recipientId: string, message: string)` | Send a DM |
| `getConversations()` | Get conversation list |

#### User Methods

| Method | Description |
|--------|-------------|
| `getUserProfile()` | Get authenticated user profile |
| `getStats()` | Get account insights |

---

### YouTube

Uses **YouTube Data API v3**.

#### Constructor

```typescript
import { YouTube } from '@seamagency/socially';

const youtube = new YouTube({
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    accessToken?: string;
    refreshToken?: string;
});
```

#### OAuth Methods

| Method | Description |
|--------|-------------|
| `generateAuthUrl(scopes?: string[])` | Generate authorization URL |
| `exchangeCodeForToken(code: string)` | Exchange auth code for tokens |
| `refreshAccessToken()` | Refresh access token |

#### Content Methods

| Method | Description |
|--------|-------------|
| `post(content: PostContent)` | Upload video |
| `getStats()` | Get channel statistics |

---

### Twitter/X

Supports both **OAuth 1.0a** (for posting) and **OAuth 2.0 with PKCE**.

#### Constructor

```typescript
import { Twitter } from '@seamagency/socially';

const twitter = new Twitter({
    // OAuth 1.0a (required for posting)
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    accessSecret?: string;
    
    // OAuth 2.0 PKCE
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    oauth2AccessToken?: string;
    oauth2RefreshToken?: string;
});
```

#### OAuth 2.0 Methods

| Method | Description |
|--------|-------------|
| `generateAuthUrl(scopes?: string[])` | Returns `{ authUrl, codeVerifier }` |
| `exchangeCodeForToken(code, codeVerifier)` | Exchange with PKCE verification |
| `refreshAccessToken()` | Refresh OAuth 2.0 token |

**Default Scopes**: `tweet.read`, `tweet.write`, `users.read`, `offline.access`

#### Content Methods

| Method | Description |
|--------|-------------|
| `post(content: PostContent)` | Post tweet with optional media |
| `getStats()` | Get user metrics |

---

### LinkedIn

Uses **LinkedIn Marketing API**.

#### Constructor

```typescript
import { LinkedIn } from '@seamagency/socially';

const linkedin = new LinkedIn({
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    accessToken?: string;
    refreshToken?: string;
    authorId?: string;  // urn:li:person:xxx or urn:li:organization:xxx
});
```

#### OAuth Methods

| Method | Description |
|--------|-------------|
| `generateAuthUrl(scopes?: string[])` | Generate authorization URL |
| `exchangeCodeForToken(code: string)` | Exchange auth code for tokens |
| `refreshAccessToken()` | Refresh access token |

**Default Scopes**: `openid`, `profile`, `email`, `w_member_social`

#### Content Methods

| Method | Description |
|--------|-------------|
| `post(content: PostContent)` | Create a post |
| `getUserProfile()` | Get user profile via OpenID |
| `getStats(organizationUrn?: string)` | Get organization stats |

---

### Facebook

Uses **Facebook Graph API v21.0**.

#### Constructor

```typescript
import { Facebook } from '@seamagency/socially';

const facebook = new Facebook({
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    accessToken?: string;
    pageId?: string;
});
```

#### OAuth Methods

| Method | Description |
|--------|-------------|
| `generateAuthUrl(scopes?: string[])` | Generate authorization URL |
| `exchangeCodeForToken(code: string)` | Exchange for long-lived token |
| `refreshAccessToken()` | Refresh long-lived token |
| `getPages()` | Get user's managed pages |

**Default Scopes**: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, `public_profile`

#### Content Methods

| Method | Description |
|--------|-------------|
| `post(content: PostContent)` | Post to page feed |
| `getStats()` | Get page insights |

---

### TikTok

Uses **TikTok API v2**.

#### Constructor

```typescript
import { TikTok } from '@seamagency/socially';

const tiktok = new TikTok({
    clientKey: string;
    clientSecret: string;
    redirectUri: string;
    accessToken?: string;
    refreshToken?: string;
});
```

#### OAuth Methods

| Method | Description |
|--------|-------------|
| `generateAuthUrl(scopes?: string[])` | Generate authorization URL |
| `exchangeCodeForToken(code: string)` | Exchange auth code for tokens |
| `refreshAccessToken()` | Refresh access token |

**Default Scopes**: `user.info.basic`, `video.publish`, `video.upload`

#### Content Methods

| Method | Description |
|--------|-------------|
| `post(content: PostContent)` | Upload video via URL |
| `getStats()` | Get user info and metrics |

---

### Threads

Uses **Threads Graph API**.

#### Constructor

```typescript
import { Threads } from '@seamagency/socially';

const threads = new Threads({
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    accessToken?: string;
    userId?: string;
});
```

#### OAuth Methods

| Method | Description |
|--------|-------------|
| `generateAuthUrl(scopes?: string[])` | Generate authorization URL |
| `exchangeCodeForToken(code: string)` | Exchange for long-lived token |
| `refreshAccessToken()` | Refresh long-lived token |

**Default Scopes**: `threads_basic`, `threads_content_publish`, `threads_manage_replies`, `threads_manage_insights`

#### Content Methods

| Method | Description |
|--------|-------------|
| `post(content: PostContent)` | Create a thread |
| `getStats()` | Get thread insights |

---

### Pinterest

Uses **Pinterest API v5**.

#### Constructor

```typescript
import { Pinterest } from '@seamagency/socially';

const pinterest = new Pinterest({
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    accessToken?: string;
    refreshToken?: string;
    boardId?: string;
});
```

#### OAuth Methods

| Method | Description |
|--------|-------------|
| `generateAuthUrl(scopes?: string[])` | Generate authorization URL |
| `exchangeCodeForToken(code: string)` | Exchange auth code for tokens |
| `refreshAccessToken()` | Refresh access token |

**Default Scopes**: `boards:read`, `boards:write`, `pins:read`, `pins:write`, `user_accounts:read`

#### Content Methods

| Method | Description |
|--------|-------------|
| `post(content: PostContent)` | Create a pin (image or video) |
| `getStats()` | Get account analytics |

---

### Reddit

Uses **Reddit API**.

#### Constructor

```typescript
import { Reddit } from '@seamagency/socially';

const reddit = new Reddit({
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    accessToken?: string;
    refreshToken?: string;
    subreddit?: string;
});
```

#### OAuth Methods

| Method | Description |
|--------|-------------|
| `generateAuthUrl(scopes?: string[])` | Generate authorization URL |
| `exchangeCodeForToken(code: string)` | Exchange auth code for tokens |
| `refreshAccessToken()` | Refresh access token |

**Default Scopes**: `read`, `identity`, `submit`, `flair`

#### Content Methods

| Method | Description |
|--------|-------------|
| `post(content: PostContent)` | Submit to subreddit |
| `getStats()` | Get user info |

---

### Discord

**Bot-based integration** (no OAuth required for bot functionality).

#### Constructor

```typescript
import { Discord } from '@seamagency/socially';

const discord = new Discord({
    botToken: string;
    guildId?: string;
    channelId?: string;
});
```

#### Static Methods

| Method | Description |
|--------|-------------|
| `Discord.generateBotInviteUrl(clientId, permissions?)` | Generate bot invite URL |

#### Bot Methods

| Method | Description |
|--------|-------------|
| `getBotInfo()` | Get bot user information |
| `getGuilds()` | Get guilds bot is in |
| `getChannels(guildId?)` | Get text channels in guild |

#### Content Methods

| Method | Description |
|--------|-------------|
| `post(content: PostContent, channelId?)` | Send message to channel |
| `postEmbed(embed, channelId?)` | Send embed message |
| `getStats(guildId?)` | Get bot and guild info |

---

### Slack

Uses **Slack Web API**.

#### Constructor

```typescript
import { Slack } from '@seamagency/socially';

const slack = new Slack({
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    botToken?: string;
    channelId?: string;
});
```

#### OAuth Methods

| Method | Description |
|--------|-------------|
| `generateAuthUrl(scopes?: string[])` | Generate authorization URL |
| `exchangeCodeForToken(code: string)` | Exchange auth code for bot token |

#### Content Methods

| Method | Description |
|--------|-------------|
| `post(content: PostContent, channelId?)` | Post message |
| `getStats()` | Get team info |

---

### Telegram

**Bot-based integration** using Telegram Bot API.

#### Constructor

```typescript
import { Telegram } from '@seamagency/socially';

const telegram = new Telegram({
    botToken: string;
    chatId?: string;
});
```

#### Content Methods

| Method | Description |
|--------|-------------|
| `post(content: PostContent, chatId?)` | Send message/media |
| `getStats()` | Get bot info |

---

## SocialManager

Orchestrates multiple platforms for unified posting.

```typescript
import { SocialManager } from '@seamagency/socially';

const manager = new SocialManager({
    instagram: { accessToken: '...', accountId: '...' },
    twitter: { apiKey: '...', apiSecret: '...', accessToken: '...', accessSecret: '...' },
    youtube: { accessToken: '...' },
    discord: { botToken: '...', channelId: '...' }
});

// Post to all configured platforms
const results = await manager.postToAll({
    text: 'Hello from all platforms!',
    media: ['https://example.com/image.jpg']
});

// Check results
results.forEach(result => {
    console.log(`${result.platform}: ${result.success ? 'OK' : result.error}`);
});
```

---

## Types

### PostContent

```typescript
interface PostContent {
    text?: string;
    media?: string[];  // URLs or file paths
    link?: string;
}
```

### PostResult

```typescript
interface PostResult {
    platform: string;
    success: boolean;
    postId?: string;
    error?: string | object;
}
```

### SocialPlatform Interface

All platform classes implement:

```typescript
interface SocialPlatform {
    name: string;
    post(content: PostContent): Promise<PostResult>;
    getStats(): Promise<any>;
}
```

---

## Error Handling

All methods throw descriptive errors or return error objects in results:

```typescript
try {
    const result = await instagram.post({ text: 'Hello!' });
    if (!result.success) {
        console.error('Post failed:', result.error);
    }
} catch (error) {
    console.error('API error:', error.message);
}
```

OAuth methods throw on failure:

```typescript
try {
    const tokens = await instagram.exchangeCodeForToken(code);
} catch (error) {
    console.error('OAuth failed:', error.message);
}
```

---

## License

MIT © Muhammet Eroglu
