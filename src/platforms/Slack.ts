import { SocialPlatform, PostContent, PostResult } from '../types';
import axios from 'axios';

export class Slack implements SocialPlatform {
    name: string = 'slack';
    private clientId: string;
    private clientSecret: string;
    private redirectUri: string;
    private accessToken?: string;
    private teamId?: string;

    constructor(config: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        accessToken?: string;
        teamId?: string;
    }) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
        this.accessToken = config.accessToken;
        this.teamId = config.teamId;
    }

    generateAuthUrl(scopes: string[] = ['channels:read', 'chat:write', 'users:read', 'groups:read', 'channels:join', 'chat:write.customize']): string {
        const state = Math.random().toString(36).substring(7);
        return `https://slack.com/oauth/v2/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${encodeURIComponent(scopes.join(','))}&state=${state}`;
    }

    async exchangeCodeForToken(code: string): Promise<{ accessToken: string; teamId: string; botUserId: string }> {
        try {
            const params = new URLSearchParams();
            params.append('client_id', this.clientId);
            params.append('client_secret', this.clientSecret);
            params.append('code', code);
            params.append('redirect_uri', this.redirectUri);

            const response = await axios.post('https://slack.com/api/oauth.v2.access', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (!response.data.ok) {
                throw new Error(response.data.error || 'Failed to exchange code for token');
            }

            this.accessToken = response.data.access_token;
            this.teamId = response.data.team.id;

            return {
                accessToken: response.data.access_token,
                teamId: response.data.team.id,
                botUserId: response.data.bot_user_id
            };
        } catch (error: any) {
            throw new Error(`Failed to exchange code for token: ${error.response?.data?.error || error.message}`);
        }
    }

    async getChannels(): Promise<{ id: string; name: string }[]> {
        if (!this.accessToken) {
            throw new Error('Slack getChannels requires accessToken.');
        }

        try {
            const response = await axios.get('https://slack.com/api/conversations.list', {
                params: { types: 'public_channel,private_channel' },
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });

            if (!response.data.ok) {
                throw new Error(response.data.error || 'Failed to fetch channels');
            }

            return response.data.channels.map((c: any) => ({ id: c.id, name: c.name }));
        } catch (error: any) {
            throw new Error(`Failed to fetch channels: ${error.response?.data?.error || error.message}`);
        }
    }

    async post(content: PostContent, channelId?: string): Promise<PostResult> {
        if (!this.accessToken) {
            return {
                platform: this.name,
                success: false,
                error: 'Slack posting requires accessToken.'
            };
        }

        if (!channelId) {
            return {
                platform: this.name,
                success: false,
                error: 'Slack posting requires a channelId.'
            };
        }

        try {
            // Join channel first (Slack requirement for bot posting)
            await axios.post('https://slack.com/api/conversations.join',
                { channel: channelId },
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Build blocks for message
            const blocks: any[] = [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: content.text || ''
                    }
                }
            ];

            // Add media as image blocks
            if (content.media && content.media.length > 0) {
                for (const mediaUrl of content.media) {
                    blocks.push({
                        type: 'image',
                        image_url: mediaUrl,
                        alt_text: 'Image'
                    });
                }
            }

            const response = await axios.post('https://slack.com/api/chat.postMessage',
                {
                    channel: channelId,
                    blocks: blocks
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.ok) {
                throw new Error(response.data.error || 'Failed to post message');
            }

            return {
                platform: this.name,
                success: true,
                postId: response.data.ts
            };

        } catch (error: any) {
            return {
                platform: this.name,
                success: false,
                error: error.response?.data?.error || error.message || error
            };
        }
    }

    async getStats(): Promise<any> {
        if (!this.accessToken) {
            return {
                platform: this.name,
                success: false,
                error: 'Slack stats require accessToken.'
            };
        }

        try {
            const response = await axios.get('https://slack.com/api/team.info', {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });

            if (!response.data.ok) {
                throw new Error(response.data.error || 'Failed to fetch team info');
            }

            return {
                platform: this.name,
                success: true,
                data: response.data.team
            };
        } catch (error: any) {
            return {
                platform: this.name,
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }
}
