import { SocialPlatform, PostContent, PostResult } from '../types';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export class Pinterest implements SocialPlatform {
    name: string = 'pinterest';
    private clientId: string;
    private clientSecret: string;
    private redirectUri: string;
    private accessToken?: string;
    private refreshToken?: string;
    private defaultBoardId?: string;

    constructor(config: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        accessToken?: string;
        refreshToken?: string;
        boardId?: string;
    }) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
        this.accessToken = config.accessToken;
        this.refreshToken = config.refreshToken;
        this.defaultBoardId = config.boardId;
    }

    generateAuthUrl(scopes: string[] = ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read']): string {
        const state = Math.random().toString(36).substring(7);
        const scopeString = scopes.join(',');
        return `https://www.pinterest.com/oauth/?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&response_type=code&scope=${encodeURIComponent(scopeString)}&state=${state}`;
    }

    async exchangeCodeForToken(code: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('redirect_uri', this.redirectUri);

            const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

            const response = await axios.post('https://api.pinterest.com/v5/oauth/token', params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${auth}`
                }
            });

            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token;

            return {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in
            };
        } catch (error: any) {
            throw new Error(`Failed to exchange code for token: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Refreshes the access token using refresh token.
     * @returns New token data
     */
    async refreshAccessToken(): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
        if (!this.refreshToken) {
            throw new Error('Pinterest token refresh requires refreshToken');
        }

        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', this.refreshToken);

            const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

            const response = await axios.post('https://api.pinterest.com/v5/oauth/token', params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${auth}`
                }
            });

            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token;

            return {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresIn: response.data.expires_in
            };
        } catch (error: any) {
            throw new Error(`Failed to refresh token: ${error.response?.data?.message || error.message}`);
        }
    }

    async post(content: PostContent): Promise<PostResult> {
        if (!this.accessToken) {
            return {
                platform: this.name,
                success: false,
                error: 'Pinterest posting requires accessToken.'
            };
        }

        if (!this.defaultBoardId) {
            return {
                platform: this.name,
                success: false,
                error: 'Pinterest posting requires a boardId (configure in SocialConfig).'
            };
        }

        if (!content.media || content.media.length === 0) {
            return {
                platform: this.name,
                success: false,
                error: 'Pinterest requires media (image URL or video file).'
            };
        }

        const mediaPath = content.media[0];
        const isVideo = mediaPath.match(/\.(mp4|mov|m4v)$/i);

        try {
            let mediaSource: any;

            if (isVideo) {
                // Video Upload Flow
                // 1. Register Upload
                const registerResponse = await axios.post('https://api.pinterest.com/v5/media', {
                    media_type: 'video'
                }, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                const { upload_url, media_id, upload_parameters } = registerResponse.data;

                // 2. Upload File
                const form = new FormData();
                Object.keys(upload_parameters).forEach(key => {
                    form.append(key, upload_parameters[key]);
                });
                form.append('file', fs.createReadStream(mediaPath));

                await axios.post(upload_url, form, {
                    headers: {
                        ...form.getHeaders()
                    }
                });

                // 3. Poll Status
                let status = 'processing';
                while (status !== 'succeeded') {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const statusResponse = await axios.get(`https://api.pinterest.com/v5/media/${media_id}`, {
                        headers: { 'Authorization': `Bearer ${this.accessToken}` }
                    });
                    status = statusResponse.data.status;
                    if (status === 'failed') {
                        throw new Error('Video upload failed processing.');
                    }
                }

                mediaSource = {
                    source_type: 'video_id',
                    media_id: media_id,
                    cover_image_url: content.media[1] || 'https://placehold.co/600x400.png' // Pinterest requires cover image for video
                };

            } else {
                // Image URL Flow
                if (!mediaPath.startsWith('http')) {
                    return {
                        platform: this.name,
                        success: false,
                        error: 'Pinterest only supports image URLs (or local video files).'
                    };
                }
                mediaSource = {
                    source_type: 'image_url',
                    url: mediaPath
                };
            }

            // Create Pin
            const pinResponse = await axios.post('https://api.pinterest.com/v5/pins', {
                board_id: this.defaultBoardId,
                title: content.text ? content.text.substring(0, 100) : 'New Pin',
                description: content.text || '',
                media_source: mediaSource
            }, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return {
                platform: this.name,
                success: true,
                postId: pinResponse.data.id
            };

        } catch (error: any) {
            return {
                platform: this.name,
                success: false,
                error: error.response?.data || error.message || error
            };
        }
    }

    async getStats(): Promise<any> {
        if (!this.accessToken) {
            return {
                platform: this.name,
                success: false,
                error: 'Pinterest stats require accessToken.'
            };
        }

        try {
            const response = await axios.get('https://api.pinterest.com/v5/user_account/analytics', {
                params: {
                    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    end_date: new Date().toISOString().split('T')[0]
                },
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            return {
                platform: this.name,
                success: true,
                data: response.data
            };
        } catch (error: any) {
            return {
                platform: this.name,
                success: false,
                error: error.response?.data || error.message || error
            };
        }
    }
}
