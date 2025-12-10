import { SocialPlatform, PostContent, PostResult } from '../types';
import axios from 'axios';

export class Telegram implements SocialPlatform {
    name: string = 'telegram';
    private botToken: string;
    private chatId?: string;

    constructor(config: {
        botToken: string;
        chatId?: string;
    }) {
        this.botToken = config.botToken;
        this.chatId = config.chatId;
    }

    // Telegram uses bot tokens, not OAuth, so no generateAuthUrl or exchangeCodeForToken
    // Users need to add the bot to their channel/group and provide the chat ID

    async getChatInfo(chatId: string): Promise<any> {
        try {
            const response = await axios.get(`https://api.telegram.org/bot${this.botToken}/getChat`, {
                params: { chat_id: chatId }
            });

            if (!response.data.ok) {
                throw new Error(response.data.description || 'Failed to get chat info');
            }

            return response.data.result;
        } catch (error: any) {
            throw new Error(`Failed to get chat info: ${error.response?.data?.description || error.message}`);
        }
    }

    async post(content: PostContent, chatId?: string): Promise<PostResult> {
        const targetChatId = chatId || this.chatId;

        if (!targetChatId) {
            return {
                platform: this.name,
                success: false,
                error: 'Telegram posting requires a chatId.'
            };
        }

        try {
            let messageId: number | undefined;

            // If no media, send text message
            if (!content.media || content.media.length === 0) {
                const response = await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                    chat_id: targetChatId,
                    text: content.text || '',
                    parse_mode: 'HTML'
                });

                if (!response.data.ok) {
                    throw new Error(response.data.description || 'Failed to send message');
                }

                messageId = response.data.result.message_id;
            }
            // Single media
            else if (content.media.length === 1) {
                const mediaUrl = content.media[0];
                // Determine if it's a photo or video based on URL extension
                const isVideo = mediaUrl.match(/\.(mp4|mov|avi)$/i);

                const endpoint = isVideo ? 'sendVideo' : 'sendPhoto';
                const mediaField = isVideo ? 'video' : 'photo';

                const response = await axios.post(`https://api.telegram.org/bot${this.botToken}/${endpoint}`, {
                    chat_id: targetChatId,
                    [mediaField]: mediaUrl,
                    caption: content.text || '',
                    parse_mode: 'HTML'
                });

                if (!response.data.ok) {
                    throw new Error(response.data.description || 'Failed to send media');
                }

                messageId = response.data.result.message_id;
            }
            // Multiple media (media group)
            else {
                const media = content.media.slice(0, 10).map((url, index) => {
                    const isVideo = url.match(/\.(mp4|mov|avi)$/i);
                    return {
                        type: isVideo ? 'video' : 'photo',
                        media: url,
                        ...(index === 0 && content.text ? { caption: content.text, parse_mode: 'HTML' } : {})
                    };
                });

                const response = await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMediaGroup`, {
                    chat_id: targetChatId,
                    media: media
                });

                if (!response.data.ok) {
                    throw new Error(response.data.description || 'Failed to send media group');
                }

                messageId = response.data.result[0].message_id;
            }

            return {
                platform: this.name,
                success: true,
                postId: messageId?.toString()
            };

        } catch (error: any) {
            return {
                platform: this.name,
                success: false,
                error: error.response?.data?.description || error.message || error
            };
        }
    }

    async getStats(): Promise<any> {
        if (!this.chatId) {
            return {
                platform: this.name,
                success: false,
                error: 'Telegram stats require chatId.'
            };
        }

        try {
            const response = await axios.get(`https://api.telegram.org/bot${this.botToken}/getChatMemberCount`, {
                params: { chat_id: this.chatId }
            });

            if (!response.data.ok) {
                throw new Error(response.data.description || 'Failed to get member count');
            }

            return {
                platform: this.name,
                success: true,
                data: {
                    memberCount: response.data.result
                }
            };
        } catch (error: any) {
            return {
                platform: this.name,
                success: false,
                error: error.response?.data?.description || error.message
            };
        }
    }
}
