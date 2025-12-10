import { SocialPlatform, PostContent, PostResult } from '../types';
import axios from 'axios';

export class Facebook implements SocialPlatform {
    name: string = 'facebook';
    private clientId?: string;
    private clientSecret?: string;
    private redirectUri?: string;
    private accessToken?: string;
    private pageId?: string;

    constructor(config: {
        clientId?: string;
        clientSecret?: string;
        redirectUri?: string;
        accessToken?: string;
        pageId?: string;
    }) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
        this.accessToken = config.accessToken;
        this.pageId = config.pageId;
    }

    /**
     * Generates Facebook OAuth 2.0 authorization URL.
     * @param scopes - OAuth scopes (default includes pages_manage_posts, pages_read_engagement)
     * @returns Authorization URL to redirect user to
     */
    generateAuthUrl(scopes: string[] = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list', 'public_profile']): string {
        if (!this.clientId || !this.redirectUri) {
            throw new Error('Facebook OAuth requires clientId and redirectUri');
        }

        const state = Math.random().toString(36).substring(7);
        const scopeString = scopes.join(',');
        return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${encodeURIComponent(scopeString)}&response_type=code&state=${state}`;
    }

    /**
     * Exchanges authorization code for access token and converts to long-lived token.
     * @param code - Authorization code from callback
     * @returns Token data including accessToken and expiresIn
     */
    async exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiresIn: number; userId: string }> {
        if (!this.clientId || !this.clientSecret || !this.redirectUri) {
            throw new Error('Facebook OAuth requires clientId, clientSecret, and redirectUri');
        }

        try {
            // Step 1: Get short-lived token
            const response = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
                params: {
                    client_id: this.clientId,
                    redirect_uri: this.redirectUri,
                    client_secret: this.clientSecret,
                    code: code
                }
            });

            const shortLivedToken = response.data.access_token;

            // Step 2: Exchange for long-lived token (60 days)
            const longLivedResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    fb_exchange_token: shortLivedToken
                }
            });

            this.accessToken = longLivedResponse.data.access_token;

            // Fetch user ID
            const userResponse = await axios.get('https://graph.facebook.com/v21.0/me', {
                params: { access_token: this.accessToken }
            });

            return {
                accessToken: this.accessToken!,
                expiresIn: longLivedResponse.data.expires_in || 5184000, // ~60 days
                userId: userResponse.data.id
            };
        } catch (error: any) {
            throw new Error(`Failed to exchange code for token: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Refreshes the access token. For Facebook long-lived tokens, you need to exchange again.
     * @returns New access token
     */
    async refreshAccessToken(): Promise<string> {
        if (!this.accessToken || !this.clientId || !this.clientSecret) {
            throw new Error('Facebook token refresh requires accessToken, clientId, and clientSecret');
        }

        try {
            const response = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    fb_exchange_token: this.accessToken
                }
            });

            this.accessToken = response.data.access_token;
            return this.accessToken!;
        } catch (error: any) {
            throw new Error(`Failed to refresh token: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Gets the list of pages the user manages.
     * @returns List of pages with their access tokens
     */
    async getPages(): Promise<{ id: string; name: string; accessToken: string }[]> {
        if (!this.accessToken) {
            throw new Error('Facebook getPages requires accessToken');
        }

        try {
            const response = await axios.get('https://graph.facebook.com/v21.0/me/accounts', {
                params: { access_token: this.accessToken }
            });

            return response.data.data.map((page: any) => ({
                id: page.id,
                name: page.name,
                accessToken: page.access_token
            }));
        } catch (error: any) {
            throw new Error(`Failed to get pages: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async post(content: PostContent): Promise<PostResult> {
        try {
            // Step 1: Ensure we have a Page Access Token
            let pageAccessToken = this.accessToken;
            let targetPageId = this.pageId;
            const version = 'v21.0';

            console.log('📘 Facebook Post - Checking credentials...');

            try {
                // Fetch user's pages to find the correct Page Access Token
                const accountsResponse = await axios.get(`https://graph.facebook.com/${version}/me/accounts`, {
                    params: { access_token: this.accessToken, fields: 'id,access_token,name' }
                });

                if (accountsResponse.data?.data?.length > 0) {
                    const pages = accountsResponse.data.data;
                    let targetPage;

                    if (this.pageId) {
                        targetPage = pages.find((p: any) => p.id === this.pageId);
                    }

                    if (!targetPage) {
                        // Fallback to first page if pageId is invalid or user ID provided
                        targetPage = pages[0];
                        console.warn(`📘 Target Page ID ${this.pageId} not found/invalid. Defaulting to: ${targetPage.name}`);
                    }

                    if (targetPage && targetPage.access_token) {
                        pageAccessToken = targetPage.access_token;
                        targetPageId = targetPage.id;
                        console.log(`📘 Using Page Access Token for: ${targetPage.name}`);
                    }
                }
            } catch (err) {
                console.warn('📘 Failed to fetch pages list. Trying with current token/ID as is (might fail if User Token).');
            }

            if (!targetPageId) {
                throw new Error('No target Page ID found for Facebook post.');
            }

            let response;
            console.log(`📘 Posting to Page ID: ${targetPageId}`);

            if (content.media && content.media.length > 0) {
                // Handle Media Post (Image)
                const mediaPath = content.media[0];

                if (!mediaPath.startsWith('http')) {
                    throw new Error('Facebook Graph API (Axios implementation) requires public URLs for media.');
                }

                response = await axios.post(
                    `https://graph.facebook.com/${version}/${targetPageId}/photos`,
                    {},
                    {
                        params: {
                            url: mediaPath,
                            caption: content.text,
                            access_token: pageAccessToken
                        }
                    }
                );
            } else if (content.text) {
                // Text/Link Post
                response = await axios.post(
                    `https://graph.facebook.com/${version}/${targetPageId}/feed`,
                    {},
                    {
                        params: {
                            message: content.text,
                            access_token: pageAccessToken
                        }
                    }
                );
            } else {
                throw new Error('No content provided for Facebook post');
            }

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
            const response = await axios.get(
                `https://graph.facebook.com/v18.0/${this.pageId}/insights`,
                {
                    params: {
                        metric: 'page_impressions,page_engaged_users',
                        period: 'day',
                        access_token: this.accessToken
                    }
                }
            );
            return {
                platform: this.name,
                success: true,
                data: response.data.data
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
