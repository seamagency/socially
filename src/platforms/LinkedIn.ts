import { SocialPlatform, PostContent, PostResult } from '../types';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export class LinkedIn implements SocialPlatform {
    name: string = 'linkedin';
    private clientId?: string;
    private clientSecret?: string;
    private redirectUri?: string;
    private accessToken?: string;
    private refreshToken?: string;
    private authorId?: string; // e.g., "urn:li:person:..." or "urn:li:organization:..."

    constructor(config: {
        clientId?: string;
        clientSecret?: string;
        redirectUri?: string;
        accessToken?: string;
        refreshToken?: string;
        authorId?: string;
    }) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
        this.accessToken = config.accessToken;
        this.refreshToken = config.refreshToken;
        this.authorId = config.authorId;
    }

    /**
     * Generates LinkedIn OAuth 2.0 authorization URL.
     * LinkedIn uses OAuth 2.0 with Authorization Code flow.
     * @param scopes - OAuth scopes (default includes openid, profile, w_member_social)
     * @returns Authorization URL to redirect user to
     */
    generateAuthUrl(scopes: string[] = ['openid', 'profile', 'email', 'w_member_social']): string {
        if (!this.clientId || !this.redirectUri) {
            throw new Error('LinkedIn OAuth requires clientId and redirectUri');
        }

        const state = Math.random().toString(36).substring(7);
        const scopeString = scopes.join(' ');
        return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${encodeURIComponent(scopeString)}&state=${state}`;
    }

    /**
     * Exchanges authorization code for access token.
     * @param code - Authorization code from callback
     * @returns Token data including accessToken, refreshToken (if available), and expiresIn
     */
    async exchangeCodeForToken(code: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number; authorId: string }> {
        if (!this.clientId || !this.clientSecret || !this.redirectUri) {
            throw new Error('LinkedIn OAuth requires clientId, clientSecret, and redirectUri');
        }

        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('client_id', this.clientId);
            params.append('client_secret', this.clientSecret);
            params.append('redirect_uri', this.redirectUri);

            const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token;

            // Fetch user profile to get authorId (URN)
            const profileResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });

            const userId = profileResponse.data.sub; // OpenID Connect sub claim
            this.authorId = `urn:li:person:${userId}`;

            return {
                accessToken: this.accessToken!,
                refreshToken: this.refreshToken,
                expiresIn: response.data.expires_in,
                authorId: this.authorId!
            };
        } catch (error: any) {
            throw new Error(`Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`);
        }
    }

    /**
     * Refreshes the access token using refresh token.
     * Note: LinkedIn refresh tokens are only available with specific API products.
     * @returns New access token
     */
    async refreshAccessToken(): Promise<string> {
        if (!this.refreshToken || !this.clientId || !this.clientSecret) {
            throw new Error('LinkedIn token refresh requires refreshToken, clientId, and clientSecret');
        }

        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', this.refreshToken);
            params.append('client_id', this.clientId);
            params.append('client_secret', this.clientSecret);

            const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            this.accessToken = response.data.access_token;
            if (response.data.refresh_token) {
                this.refreshToken = response.data.refresh_token;
            }

            return this.accessToken!;
        } catch (error: any) {
            throw new Error(`Failed to refresh token: ${error.response?.data?.error_description || error.message}`);
        }
    }

    /**
     * Gets the user profile information.
     * @returns User profile data
     */
    async getUserProfile(): Promise<any> {
        if (!this.accessToken) {
            throw new Error('LinkedIn getUserProfile requires accessToken');
        }

        try {
            const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` }
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
                error: error.response?.data || error.message
            };
        }
    }

    async post(content: PostContent): Promise<PostResult> {
        try {
            let asset: string | undefined;

            if (content.media && content.media.length > 0) {
                // Handle Image Upload (3-step process)
                // 1. Register Upload
                const registerResponse = await axios.post(
                    'https://api.linkedin.com/v2/assets?action=registerUpload',
                    {
                        registerUploadRequest: {
                            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                            owner: this.authorId,
                            serviceRelationships: [
                                {
                                    relationshipType: 'OWNER',
                                    identifier: 'urn:li:userGeneratedContent'
                                }
                            ]
                        }
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
                asset = registerResponse.data.value.asset;

                // 2. Upload Image
                const mediaPath = content.media[0];
                const fileBuffer = fs.readFileSync(mediaPath);

                await axios.put(uploadUrl, fileBuffer, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/octet-stream'
                    }
                });

                // 3. Verify Upload (Optional but recommended, skipping for brevity/speed)
            }

            // Create UGC Post
            const postBody: any = {
                author: this.authorId,
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: {
                            text: content.text || ''
                        },
                        shareMediaCategory: asset ? 'IMAGE' : 'NONE'
                    }
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
                }
            };

            if (asset) {
                postBody.specificContent['com.linkedin.ugc.ShareContent'].media = [
                    {
                        status: 'READY',
                        description: {
                            text: 'Image'
                        },
                        media: asset,
                        title: {
                            text: 'Image'
                        }
                    }
                ];
            }

            const response = await axios.post(
                'https://api.linkedin.com/v2/ugcPosts',
                postBody,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                platform: this.name,
                success: true,
                postId: response.data.id
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
        try {
            // Assuming authorId is the organization URN (e.g., urn:li:organization:12345)
            // If it's just the ID, we might need to construct the URN.
            // For safety, let's assume the user provides the full URN or we construct it if it looks like an ID.

            let organizationUrn = this.authorId || '';
            if (!organizationUrn.startsWith('urn:li:')) {
                // Fallback assumption: it's an organization ID
                organizationUrn = `urn:li:organization:${this.authorId}`;
            }

            const response = await axios.get(
                'https://api.linkedin.com/v2/organizationalEntityShareStatistics',
                {
                    params: {
                        q: 'organizationalEntity',
                        organizationalEntity: organizationUrn
                    },
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'X-Restli-Protocol-Version': '2.0.0'
                    }
                }
            );

            return {
                platform: this.name,
                success: true,
                data: response.data.elements
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
