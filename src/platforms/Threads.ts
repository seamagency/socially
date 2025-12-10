import { SocialPlatform, PostContent, PostResult } from '../types';
import axios from 'axios';

export class Threads implements SocialPlatform {
    name: string = 'threads';
    private clientId: string;
    private clientSecret: string;
    private redirectUri: string;
    private accessToken?: string;
    private userId?: string;

    constructor(config: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        accessToken?: string;
        userId?: string;
    }) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
        this.accessToken = config.accessToken;
        this.userId = config.userId;
    }

    generateAuthUrl(scopes: string[] = ['threads_basic', 'threads_content_publish', 'threads_manage_replies', 'threads_manage_insights']): string {
        const state = Math.random().toString(36).substring(7);
        const scopeString = scopes.join(',');
        return `https://threads.net/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${encodeURIComponent(scopeString)}&response_type=code&state=${state}`;
    }

    async exchangeCodeForToken(code: string): Promise<{ accessToken: string; userId: string; expiresIn: number }> {
        try {
            // 1. Get Short-lived Token
            const response = await axios.post('https://graph.threads.net/oauth/access_token', new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'authorization_code',
                redirect_uri: this.redirectUri,
                code: code
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const shortLivedToken = response.data.access_token;
            const userId = response.data.user_id; // Note: Threads might return user_id here or we fetch it later

            // 2. Exchange for Long-lived Token
            const longLivedResponse = await axios.get('https://graph.threads.net/access_token', {
                params: {
                    grant_type: 'th_exchange_token',
                    client_secret: this.clientSecret,
                    access_token: shortLivedToken
                }
            });

            this.accessToken = longLivedResponse.data.access_token;
            this.userId = userId; // Or fetch from /me if not present

            // Fetch user ID if not present
            if (!this.userId) {
                const userResponse = await axios.get('https://graph.threads.net/v1.0/me', {
                    params: { fields: 'id,username', access_token: this.accessToken }
                });
                this.userId = userResponse.data.id;
            }

            return {
                accessToken: this.accessToken!,
                userId: this.userId!,
                expiresIn: longLivedResponse.data.expires_in
            };
        } catch (error: any) {
            throw new Error(`Failed to exchange code for token: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Refreshes the long-lived access token.
     * Threads long-lived tokens can be refreshed if not expired.
     * @param accessToken Optional - The access token to refresh. If not provided, uses the instance's accessToken.
     * @returns New access token and expiry
     */
    async refreshAccessToken(accessToken?: string): Promise<{ accessToken: string; expiresIn: number }> {
        const tokenToUse = accessToken || this.accessToken;
        if (!tokenToUse) {
            throw new Error('Threads token refresh requires accessToken');
        }

        try {
            const response = await axios.get('https://graph.threads.net/refresh_access_token', {
                params: {
                    grant_type: 'th_refresh_token',
                    access_token: tokenToUse
                }
            });

            this.accessToken = response.data.access_token;

            return {
                accessToken: response.data.access_token,
                expiresIn: response.data.expires_in
            };
        } catch (error: any) {
            throw new Error(`Failed to refresh token: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async post(content: PostContent): Promise<PostResult> {
        if (!this.accessToken) {
            return {
                platform: this.name,
                success: false,
                error: 'Threads posting requires accessToken.'
            };
        }

        if (!this.userId) {
            // Try to fetch userId if missing
            try {
                const userResponse = await axios.get('https://graph.threads.net/v1.0/me', {
                    params: { fields: 'id', access_token: this.accessToken }
                });
                this.userId = userResponse.data.id;
            } catch (e) {
                return {
                    platform: this.name,
                    success: false,
                    error: 'Threads posting requires userId.'
                };
            }
        }

        try {
            const mediaType = content.media && content.media.length > 0
                ? (content.media[0].endsWith('.mp4') ? 'VIDEO' : 'IMAGE')
                : 'TEXT';

            const params = new URLSearchParams();
            params.append('media_type', mediaType);
            params.append('text', content.text || '');
            params.append('access_token', this.accessToken);

            if (mediaType !== 'TEXT') {
                const mediaUrl = content.media![0];
                if (!mediaUrl.startsWith('http')) {
                    return {
                        platform: this.name,
                        success: false,
                        error: 'Threads requires public URLs for media.'
                    };
                }
                if (mediaType === 'VIDEO') {
                    params.append('video_url', mediaUrl);
                } else {
                    params.append('image_url', mediaUrl);
                }
            }

            // 1. Create Container
            const containerResponse = await axios.post(`https://graph.threads.net/v1.0/${this.userId}/threads`, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const creationId = containerResponse.data.id;

            // 2. Poll Status
            let status = 'IN_PROGRESS';
            let attempts = 0;
            while (status !== 'FINISHED') {
                if (attempts > 10) throw new Error('Media processing timed out');
                await new Promise(resolve => setTimeout(resolve, 3000));
                const statusResponse = await axios.get(`https://graph.threads.net/v1.0/${creationId}`, {
                    params: { fields: 'status,error_message', access_token: this.accessToken }
                });
                status = statusResponse.data.status;
                if (status === 'ERROR') {
                    throw new Error(`Media processing failed: ${statusResponse.data.error_message}`);
                }
                attempts++;
            }

            // 3. Publish
            const publishResponse = await axios.post(`https://graph.threads.net/v1.0/${this.userId}/threads_publish`, new URLSearchParams({
                creation_id: creationId,
                access_token: this.accessToken
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            return {
                platform: this.name,
                success: true,
                postId: publishResponse.data.id
            };

        } catch (error: any) {
            return {
                platform: this.name,
                success: false,
                error: error.response?.data?.error?.message || error.message || error
            };
        }
    }

    async getStats(): Promise<any> {
        if (!this.accessToken || !this.userId) {
            return {
                platform: this.name,
                success: false,
                error: 'Threads stats require accessToken and userId.'
            };
        }

        try {
            const response = await axios.get(`https://graph.threads.net/v1.0/${this.userId}/threads_insights`, {
                params: {
                    metric: 'views,likes,replies,reposts,quotes',
                    period: 'day',
                    access_token: this.accessToken
                }
            });

            return {
                platform: this.name,
                success: true,
                data: response.data.data
            };
        } catch (error: any) {
            return {
                platform: this.name,
                success: false,
                error: error.response?.data?.error?.message || error.message || error
            };
        }
    }
}
