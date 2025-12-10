import { SocialPlatform, PostContent, PostResult } from '../types';
import axios from 'axios';
import * as crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import * as fs from 'fs';
import FormData from 'form-data';

export class Twitter implements SocialPlatform {
    name: string = 'twitter';
    private oauth?: OAuth;
    private token?: { key: string; secret: string };

    // OAuth 2.0 PKCE fields
    private clientId?: string;
    private clientSecret?: string;
    private redirectUri?: string;
    private accessToken?: string;
    private refreshToken?: string;

    constructor(config: {
        // OAuth 1.0a (legacy)
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
    }) {
        // OAuth 1.0a setup
        if (config.apiKey && config.apiSecret) {
            this.oauth = new OAuth({
                consumer: { key: config.apiKey, secret: config.apiSecret },
                signature_method: 'HMAC-SHA1',
                hash_function(base_string, key) {
                    return crypto
                        .createHmac('sha1', key)
                        .update(base_string)
                        .digest('base64');
                },
            });
            if (config.accessToken && config.accessSecret) {
                this.token = {
                    key: config.accessToken,
                    secret: config.accessSecret,
                };
            }
        }

        // OAuth 2.0 PKCE setup
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
        this.accessToken = config.oauth2AccessToken;
        this.refreshToken = config.oauth2RefreshToken;
    }

    /**
     * Generates a PKCE code verifier and challenge.
     * @returns Object with codeVerifier and codeChallenge
     */
    private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const codeChallenge = crypto
            .createHash('sha256')
            .update(codeVerifier)
            .digest('base64url');
        return { codeVerifier, codeChallenge };
    }

    /**
     * Generates Twitter OAuth 2.0 authorization URL with PKCE.
     * @param scopes - OAuth scopes (default includes tweet.read, tweet.write, users.read)
     * @returns Object with authUrl and codeVerifier (save codeVerifier for token exchange)
     */
    generateAuthUrl(scopes: string[] = ['tweet.read', 'tweet.write', 'users.read', 'offline.access']): { authUrl: string; codeVerifier: string } {
        if (!this.clientId || !this.redirectUri) {
            throw new Error('Twitter OAuth 2.0 requires clientId and redirectUri');
        }

        const { codeVerifier, codeChallenge } = this.generatePKCE();
        const state = crypto.randomBytes(16).toString('hex');
        const scopeString = scopes.join(' ');

        const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${encodeURIComponent(scopeString)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

        return { authUrl, codeVerifier };
    }

    /**
     * Exchanges authorization code for access token using PKCE.
     * @param code - Authorization code from callback
     * @param codeVerifier - The code verifier from generateAuthUrl
     * @returns Token data including accessToken, refreshToken, and expiresIn
     */
    async exchangeCodeForToken(code: string, codeVerifier: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
        if (!this.clientId || !this.redirectUri) {
            throw new Error('Twitter OAuth 2.0 requires clientId and redirectUri');
        }

        try {
            const params = new URLSearchParams();
            params.append('code', code);
            params.append('grant_type', 'authorization_code');
            params.append('client_id', this.clientId);
            params.append('redirect_uri', this.redirectUri);
            params.append('code_verifier', codeVerifier);

            const headers: any = { 'Content-Type': 'application/x-www-form-urlencoded' };

            // If client secret is available (confidential client), use Basic auth
            if (this.clientSecret) {
                const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
                headers['Authorization'] = `Basic ${auth}`;
            }

            const response = await axios.post('https://api.twitter.com/2/oauth2/token', params, { headers });

            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token;

            return {
                accessToken: this.accessToken!,
                refreshToken: this.refreshToken,
                expiresIn: response.data.expires_in
            };
        } catch (error: any) {
            throw new Error(`Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`);
        }
    }

    /**
     * Refreshes the access token using refresh token.
     * @returns New access token
     */
    async refreshAccessToken(): Promise<string> {
        if (!this.refreshToken || !this.clientId) {
            throw new Error('Twitter token refresh requires refreshToken and clientId');
        }

        try {
            const params = new URLSearchParams();
            params.append('refresh_token', this.refreshToken);
            params.append('grant_type', 'refresh_token');
            params.append('client_id', this.clientId);

            const headers: any = { 'Content-Type': 'application/x-www-form-urlencoded' };

            if (this.clientSecret) {
                const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
                headers['Authorization'] = `Basic ${auth}`;
            }

            const response = await axios.post('https://api.twitter.com/2/oauth2/token', params, { headers });

            this.accessToken = response.data.access_token;
            if (response.data.refresh_token) {
                this.refreshToken = response.data.refresh_token;
            }

            return this.accessToken!;
        } catch (error: any) {
            throw new Error(`Failed to refresh token: ${error.response?.data?.error_description || error.message}`);
        }
    }

    async post(content: PostContent): Promise<PostResult> {
        // OAuth 1.0a is required for posting
        if (!this.oauth || !this.token) {
            return {
                platform: this.name,
                success: false,
                error: 'Twitter posting requires OAuth 1.0a credentials (apiKey, apiSecret, accessToken, accessSecret).'
            };
        }

        try {
            let mediaIds: string[] = [];

            if (content.media && content.media.length > 0) {
                for (const mediaPath of content.media) {
                    // Upload Media (v1.1)
                    // Note: This is complex with raw HTTP (INIT, APPEND, FINALIZE).
                    // For simplicity in this "no-library" approach, we'll assume a small image (< 5MB) 
                    // that can be uploaded in a single chunk if supported, or implement basic multipart.
                    // Twitter v1.1 upload.json supports multipart/form-data.

                    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';

                    let fileBuffer: Buffer;
                    if (mediaPath.startsWith('http')) {
                        const res = await axios.get(mediaPath, { responseType: 'arraybuffer' });
                        fileBuffer = Buffer.from(res.data);
                    } else {
                        fileBuffer = fs.readFileSync(mediaPath);
                    }

                    const form = new FormData();
                    form.append('media', fileBuffer);

                    const authHeader = this.oauth!.toHeader(
                        this.oauth!.authorize(
                            {
                                url: uploadUrl,
                                method: 'POST',
                            },
                            this.token
                        )
                    );

                    const uploadResponse = await axios.post(uploadUrl, form, {
                        headers: {
                            ...authHeader,
                            ...form.getHeaders()
                        }
                    });

                    mediaIds.push(uploadResponse.data.media_id_string);
                }
            }

            // Create Tweet (v2)
            const tweetUrl = 'https://api.twitter.com/2/tweets';
            const tweetBody: any = {};

            if (content.text) tweetBody.text = content.text;
            if (mediaIds.length > 0) tweetBody.media = { media_ids: mediaIds };

            const authHeader = this.oauth!.toHeader(
                this.oauth!.authorize(
                    {
                        url: tweetUrl,
                        method: 'POST',
                    },
                    this.token
                )
            );

            const response = await axios.post(tweetUrl, tweetBody, {
                headers: {
                    ...authHeader,
                    'Content-Type': 'application/json'
                }
            });

            return {
                platform: this.name,
                success: true,
                postId: response.data.data.id
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
        if (!this.oauth || !this.token) {
            return {
                platform: this.name,
                success: false,
                error: 'Twitter getStats requires OAuth 1.0a credentials.'
            };
        }

        try {
            const url = 'https://api.twitter.com/2/users/me?user.fields=public_metrics';

            const authHeader = this.oauth.toHeader(
                this.oauth.authorize(
                    {
                        url: url,
                        method: 'GET',
                    },
                    this.token
                )
            );

            const response = await axios.get(url, {
                headers: {
                    ...authHeader
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
                error: error.response?.data || error.message || error
            };
        }
    }
}
