import { SocialPlatform, PostContent, PostResult } from '../types';
import axios from 'axios';

export class Instagram implements SocialPlatform {
    name: string = 'instagram';
    private accountId?: string;
    private accessToken?: string;
    private clientId?: string;
    private clientSecret?: string;
    private redirectUri?: string;

    constructor(config: {
        accessToken?: string;
        accountId?: string;
        clientId?: string;
        clientSecret?: string;
        redirectUri?: string;
    }) {
        this.accountId = config.accountId;
        this.accessToken = config.accessToken;
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
    }

    /**
     * Generates the URL for the user to authorize the app using Instagram Login.
     * Uses the new Instagram API with Instagram Login (api.instagram.com)
     * @param scopes Array of permissions to request
     * Default scopes: instagram_business_basic, instagram_business_manage_messages, 
     * instagram_business_manage_comments, instagram_business_content_publish, instagram_business_manage_insights
     */
    generateAuthUrl(scopes: string[] = [
        'instagram_business_basic',
        'instagram_business_manage_messages',
        'instagram_business_manage_comments',
        'instagram_business_content_publish',
        'instagram_business_manage_insights'
    ]): string {
        if (!this.clientId || !this.redirectUri) {
            throw new Error('Instagram OAuth requires clientId and redirectUri');
        }

        const scopeString = scopes.join(',');
        // Using Instagram Login OAuth endpoint (not Facebook Login)
        return `https://www.instagram.com/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${encodeURIComponent(scopeString)}&response_type=code&enable_fb_login=0&force_authentication=1`;
    }

    /**
     * Exchanges the authorization code for a long-lived access token.
     * Uses the new Instagram API with Instagram Login endpoints.
     * @param code The code received from the redirect (may include #_ suffix that needs to be stripped)
     * @returns Object containing accessToken, userId, and expiresIn
     */
    async exchangeCodeForToken(code: string): Promise<{ accessToken: string; userId: string; expiresIn: number }> {
        if (!this.clientId || !this.clientSecret || !this.redirectUri) {
            throw new Error('Instagram OAuth requires clientId, clientSecret, and redirectUri');
        }

        // Instagram sometimes appends #_ to the code, strip it
        const cleanCode = code.replace(/#_$/, '');

        try {
            // Step 1: Exchange code for short-lived access token (1 hour)
            const tokenResponse = await axios.post(
                'https://api.instagram.com/oauth/access_token',
                new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'authorization_code',
                    redirect_uri: this.redirectUri,
                    code: cleanCode
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            const shortLivedToken = tokenResponse.data.access_token;
            const userId = tokenResponse.data.user_id?.toString() || '';

            // Step 2: Exchange for long-lived access token (60 days)
            const longLivedResponse = await axios.get('https://graph.instagram.com/access_token', {
                params: {
                    grant_type: 'ig_exchange_token',
                    client_secret: this.clientSecret,
                    access_token: shortLivedToken
                }
            });

            const longLivedToken = longLivedResponse.data.access_token;
            const expiresIn = longLivedResponse.data.expires_in; // Seconds (60 days)

            // Store the token and userId for later use
            this.accessToken = longLivedToken;
            this.accountId = userId;

            return {
                accessToken: longLivedToken,
                userId: userId,
                expiresIn: expiresIn
            };
        } catch (error: any) {
            const errorMessage = error.response?.data?.error_message ||
                error.response?.data?.error?.message ||
                error.message;
            throw new Error(`Failed to exchange code for token: ${errorMessage}`);
        }
    }

    /**
     * Refreshes a long-lived access token before it expires.
     * Long-lived tokens are valid for 60 days and can be refreshed if at least 24 hours old.
     * @param accessToken Optional - The access token to refresh. If not provided, uses the instance's accessToken.
     * @returns Object containing the new accessToken and expiresIn
     */
    async refreshAccessToken(accessToken?: string): Promise<{ accessToken: string; expiresIn: number }> {
        const tokenToUse = accessToken || this.accessToken;
        if (!tokenToUse) {
            throw new Error('No access token to refresh');
        }

        try {
            const response = await axios.get('https://graph.instagram.com/refresh_access_token', {
                params: {
                    grant_type: 'ig_refresh_token',
                    access_token: tokenToUse
                }
            });

            const newToken = response.data.access_token;
            const expiresIn = response.data.expires_in;

            this.accessToken = newToken;

            return {
                accessToken: newToken,
                expiresIn: expiresIn
            };
        } catch (error: any) {
            const errorMessage = error.response?.data?.error_message ||
                error.response?.data?.error?.message ||
                error.message;
            throw new Error(`Failed to refresh access token: ${errorMessage}`);
        }
    }

    /**
     * Gets the authenticated user's profile information.
     * @returns User profile data including id, username, account_type, etc.
     */
    async getUserProfile(): Promise<{ success: boolean; data?: any; error?: string }> {
        if (!this.accessToken) {
            return {
                success: false,
                error: 'Access token is required to get user profile'
            };
        }

        try {
            const response = await axios.get('https://graph.instagram.com/v21.0/me', {
                params: {
                    fields: 'user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count',
                    access_token: this.accessToken
                }
            });

            // Store the user_id as accountId if not already set
            if (response.data.user_id && !this.accountId) {
                this.accountId = response.data.user_id;
            }

            return {
                success: true,
                data: response.data
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    async post(content: PostContent): Promise<PostResult> {
        if (!this.accessToken || !this.accountId) {
            return {
                platform: this.name,
                success: false,
                error: 'Instagram posting requires accessToken and accountId. Authenticate first.'
            };
        }

        try {
            if (!content.media || content.media.length === 0) {
                throw new Error('Instagram requires media (image or video)');
            }

            const mediaPath = content.media[0];
            if (!mediaPath.startsWith('http')) {
                throw new Error('Instagram Graph API requires a public URL for media.');
            }

            console.log('📸 Instagram Post - Starting media container creation...');
            console.log('📸 Media URL:', mediaPath);
            console.log('📸 Account ID:', this.accountId);

            // Step 1: Create Media Container using graph.instagram.com
            const isVideo = mediaPath.match(/\.(mp4|mov)$/i);

            const containerParams = new URLSearchParams();
            containerParams.append('access_token', this.accessToken);
            if (content.text) {
                containerParams.append('caption', content.text);
            }

            if (isVideo) {
                containerParams.append('media_type', 'VIDEO');
                containerParams.append('video_url', mediaPath);
            } else {
                containerParams.append('image_url', mediaPath);
            }

            console.log('📸 Container params:', containerParams.toString());

            const containerResponse = await axios.post(
                `https://graph.instagram.com/v21.0/me/media`,
                containerParams,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            console.log('📸 Container response:', containerResponse.data);

            const creationId = containerResponse.data.id;

            // Step 2: Poll for Status
            console.log('📸 Waiting for media processing...');
            let status = 'IN_PROGRESS';
            let attempts = 0;
            const maxAttempts = 30; // 30 attempts = ~60 seconds

            while (status !== 'FINISHED' && status !== 'READY') {
                if (status === 'ERROR') {
                    throw new Error('Media container status is ERROR');
                }
                if (attempts >= maxAttempts) {
                    throw new Error('Media processing timed out');
                }

                // Wait 2 seconds
                await new Promise(resolve => setTimeout(resolve, 2000));

                const statusResponse = await axios.get(
                    `https://graph.instagram.com/v21.0/${creationId}`,
                    {
                        params: {
                            fields: 'status_code',
                            access_token: this.accessToken
                        }
                    }
                );

                status = statusResponse.data.status_code;
                console.log(`📸 Media Status: ${status} (Attempt ${attempts + 1}/${maxAttempts})`);
                attempts++;
            }

            // Step 3: Publish Media
            console.log('📸 Publishing media...');
            const publishParams = new URLSearchParams();
            publishParams.append('creation_id', creationId);
            publishParams.append('access_token', this.accessToken);

            const publishResponse = await axios.post(
                `https://graph.instagram.com/v21.0/me/media_publish`,
                publishParams,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            console.log('📸 Publish response:', publishResponse.data);

            return {
                platform: this.name,
                success: true,
                postId: publishResponse.data.id
            };

        } catch (error: any) {
            console.error('📸 Instagram Post Error:', error.response?.data || error.message);
            return {
                platform: this.name,
                success: false,
                error: error.response?.data || error.message || error
            };
        }
    }

    /**
     * Gets comments on a specific media post.
     * Requires instagram_business_manage_comments permission.
     * @param mediaId The ID of the media to get comments for
     */
    async getComments(mediaId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
        if (!this.accessToken) {
            return { success: false, error: 'Access token is required' };
        }

        try {
            const response = await axios.get(
                `https://graph.instagram.com/v21.0/${mediaId}/comments`,
                {
                    params: {
                        fields: 'id,text,username,timestamp,like_count,replies{id,text,username,timestamp}',
                        access_token: this.accessToken
                    }
                }
            );

            return {
                success: true,
                data: response.data.data
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Replies to a comment on Instagram.
     * Requires instagram_business_manage_comments permission.
     * @param commentId The ID of the comment to reply to
     * @param message The reply message text
     */
    async replyToComment(commentId: string, message: string): Promise<{ success: boolean; commentId?: string; error?: string }> {
        if (!this.accessToken) {
            return { success: false, error: 'Access token is required' };
        }

        try {
            const response = await axios.post(
                `https://graph.instagram.com/v21.0/${commentId}/replies`,
                {
                    message: message,
                    access_token: this.accessToken
                }
            );

            return {
                success: true,
                commentId: response.data.id
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Send a private reply (DM) to a user who commented on your post.
     * Requires instagram_business_manage_messages permission.
     * This can only be sent within 7 days of the comment being posted.
     * @param commentId The ID of the comment to reply to privately
     * @param message The private message text
     */
    async sendPrivateReply(commentId: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
        if (!this.accessToken) {
            return { success: false, error: 'Access token is required' };
        }

        try {
            const response = await axios.post(
                `https://graph.instagram.com/v21.0/me/messages`,
                {
                    recipient: {
                        comment_id: commentId
                    },
                    message: {
                        text: message
                    },
                    access_token: this.accessToken
                }
            );

            return {
                success: true,
                messageId: response.data.message_id
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Send a direct message to a user by their Instagram-scoped ID (IGSID).
     * Requires instagram_business_manage_messages permission.
     * @param recipientId The Instagram-scoped ID of the recipient
     * @param message The message text
     */
    async sendMessage(recipientId: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
        if (!this.accessToken) {
            return { success: false, error: 'Access token is required' };
        }

        try {
            const response = await axios.post(
                `https://graph.instagram.com/v21.0/me/messages`,
                {
                    recipient: {
                        id: recipientId
                    },
                    message: {
                        text: message
                    },
                    access_token: this.accessToken
                }
            );

            return {
                success: true,
                messageId: response.data.message_id
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Get conversations (message threads) for the Instagram account.
     * Requires instagram_business_manage_messages permission.
     */
    async getConversations(): Promise<{ success: boolean; data?: any[]; error?: string }> {
        if (!this.accessToken) {
            return { success: false, error: 'Access token is required' };
        }

        try {
            const response = await axios.get(
                `https://graph.instagram.com/v21.0/me/conversations`,
                {
                    params: {
                        platform: 'instagram',
                        fields: 'id,participants,messages{id,message,from,created_time}',
                        access_token: this.accessToken
                    }
                }
            );

            return {
                success: true,
                data: response.data.data
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Get account insights/analytics.
     * Requires instagram_business_manage_insights permission.
     */
    async getStats(): Promise<any> {
        if (!this.accessToken || !this.accountId) {
            return {
                platform: this.name,
                success: false,
                error: 'Instagram stats require accessToken and accountId.'
            };
        }

        try {
            const response = await axios.get(
                `https://graph.instagram.com/v21.0/${this.accountId}/insights`,
                {
                    params: {
                        metric: 'impressions,reach,profile_views',
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

    /**
     * Get user's media posts.
     * Requires instagram_business_basic permission.
     */
    async getMedia(): Promise<{ success: boolean; data?: any[]; error?: string }> {
        if (!this.accessToken) {
            return { success: false, error: 'Access token is required' };
        }

        try {
            const response = await axios.get(
                `https://graph.instagram.com/v21.0/me/media`,
                {
                    params: {
                        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
                        access_token: this.accessToken
                    }
                }
            );

            return {
                success: true,
                data: response.data.data
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Post a Story to Instagram.
     * Requires instagram_business_content_publish permission.
     * Stories are visible for 24 hours.
     * @param mediaUrl Public URL of the image or video
     * @param mediaType 'IMAGE' or 'VIDEO'
     */
    async postStory(mediaUrl: string, mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE'): Promise<{ success: boolean; storyId?: string; error?: string }> {
        if (!this.accessToken || !this.accountId) {
            return { success: false, error: 'Access token and account ID are required' };
        }

        if (!mediaUrl.startsWith('http')) {
            return { success: false, error: 'Instagram requires a public URL for media.' };
        }

        try {
            // Step 1: Create Story Media Container
            const containerParams = new URLSearchParams();
            containerParams.append('media_type', 'STORIES');
            containerParams.append('access_token', this.accessToken);

            if (mediaType === 'VIDEO') {
                containerParams.append('video_url', mediaUrl);
            } else {
                containerParams.append('image_url', mediaUrl);
            }

            const containerResponse = await axios.post(
                `https://graph.instagram.com/v21.0/${this.accountId}/media`,
                containerParams,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            const creationId = containerResponse.data.id;

            // Step 2: Poll for Status
            let status = 'IN_PROGRESS';
            let attempts = 0;
            const maxAttempts = 20; // Wait up to 60 seconds for stories

            while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
                const statusResponse = await axios.get(
                    `https://graph.instagram.com/v21.0/${creationId}`,
                    {
                        params: {
                            fields: 'status_code',
                            access_token: this.accessToken
                        }
                    }
                );

                status = statusResponse.data.status_code;

                if (status === 'ERROR') {
                    throw new Error('Story container creation failed.');
                }

                if (status === 'IN_PROGRESS') {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    attempts++;
                }
            }

            if (status === 'IN_PROGRESS') {
                throw new Error('Story container timed out.');
            }

            // Step 3: Publish Story
            const publishParams = new URLSearchParams();
            publishParams.append('creation_id', creationId);
            publishParams.append('access_token', this.accessToken);

            const publishResponse = await axios.post(
                `https://graph.instagram.com/v21.0/${this.accountId}/media_publish`,
                publishParams,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            return {
                success: true,
                storyId: publishResponse.data.id
            };

        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Delete a media post from Instagram.
     * Note: Instagram API currently does not support deleting media via API.
     * This method is provided for future compatibility if/when the feature becomes available.
     * As of 2024, media deletion must be done manually through the Instagram app.
     * @param mediaId The ID of the media to delete
     */
    async deleteMedia(mediaId: string): Promise<{ success: boolean; error?: string }> {
        if (!this.accessToken) {
            return { success: false, error: 'Access token is required' };
        }

        try {
            // Note: Instagram Graph API does not currently support media deletion
            // This endpoint may return an error
            const response = await axios.delete(
                `https://graph.instagram.com/v21.0/${mediaId}`,
                {
                    params: {
                        access_token: this.accessToken
                    }
                }
            );

            return {
                success: response.data.success === true
            };
        } catch (error: any) {
            // If the API returns "unsupported operation", provide a helpful message
            const errorMessage = error.response?.data?.error?.message || error.message;
            if (errorMessage.includes('not supported') || errorMessage.includes('Unsupported')) {
                return {
                    success: false,
                    error: 'Instagram API does not currently support media deletion. Please delete manually through the Instagram app.'
                };
            }
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Hide/Unhide a comment on a media post.
     * Requires instagram_business_manage_comments permission.
     * @param commentId The ID of the comment
     * @param hide True to hide, false to unhide
     */
    async hideComment(commentId: string, hide: boolean = true): Promise<{ success: boolean; error?: string }> {
        if (!this.accessToken) {
            return { success: false, error: 'Access token is required' };
        }

        try {
            const response = await axios.post(
                `https://graph.instagram.com/v21.0/${commentId}`,
                {
                    hide: hide,
                    access_token: this.accessToken
                }
            );

            return {
                success: response.data.success === true
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Delete a comment from a media post.
     * Requires instagram_business_manage_comments permission.
     * @param commentId The ID of the comment to delete
     */
    async deleteComment(commentId: string): Promise<{ success: boolean; error?: string }> {
        if (!this.accessToken) {
            return { success: false, error: 'Access token is required' };
        }

        try {
            const response = await axios.delete(
                `https://graph.instagram.com/v21.0/${commentId}`,
                {
                    params: {
                        access_token: this.accessToken
                    }
                }
            );

            return {
                success: response.data.success === true
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }

    /**
     * Get stories for the authenticated user.
     * Requires instagram_business_basic permission.
     */
    async getStories(): Promise<{ success: boolean; data?: any[]; error?: string }> {
        if (!this.accessToken) {
            return { success: false, error: 'Access token is required' };
        }

        try {
            const response = await axios.get(
                `https://graph.instagram.com/v21.0/me/stories`,
                {
                    params: {
                        fields: 'id,media_type,media_url,thumbnail_url,timestamp',
                        access_token: this.accessToken
                    }
                }
            );

            return {
                success: true,
                data: response.data.data
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message
            };
        }
    }
}
