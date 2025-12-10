import { SocialPlatform, PostContent, PostResult } from '../types';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

/**
 * Discord bot integration.
 * Discord uses Bot Tokens instead of OAuth for bot functionality.
 * To use this integration:
 * 1. Create a Discord Application at https://discord.com/developers/applications
 * 2. Create a Bot and get the Bot Token
 * 3. Invite the bot to your server using the OAuth2 URL Generator
 */
export class Discord implements SocialPlatform {
    name: string = 'discord';
    private botToken: string;
    private defaultGuildId?: string;
    private defaultChannelId?: string;

    constructor(config: {
        botToken: string;
        guildId?: string;
        channelId?: string;
    }) {
        this.botToken = config.botToken;
        this.defaultGuildId = config.guildId;
        this.defaultChannelId = config.channelId;
    }

    /**
     * Generates a URL to invite the bot to a server.
     * @param clientId - The Discord Application Client ID
     * @param permissions - Permission integer (default: 2048 for Send Messages)
     * @returns URL to invite the bot
     */
    static generateBotInviteUrl(clientId: string, permissions: number = 2048): string {
        return `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot&permissions=${permissions}`;
    }

    /**
     * Gets bot information.
     * @returns Bot user data
     */
    async getBotInfo(): Promise<any> {
        try {
            const response = await axios.get('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bot ${this.botToken}` }
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
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Gets the list of guilds (servers) the bot is in.
     * @returns List of guilds
     */
    async getGuilds(): Promise<{ id: string; name: string; icon: string | null }[]> {
        try {
            const response = await axios.get('https://discord.com/api/users/@me/guilds', {
                headers: { Authorization: `Bot ${this.botToken}` }
            });
            return response.data.map((g: any) => ({
                id: g.id,
                name: g.name,
                icon: g.icon
            }));
        } catch (error: any) {
            throw new Error(`Failed to fetch guilds: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Gets the list of channels in a guild.
     * @param guildId - Guild ID (uses default if not provided)
     * @returns List of text channels
     */
    async getChannels(guildId?: string): Promise<{ id: string; name: string; type: number }[]> {
        const targetGuildId = guildId || this.defaultGuildId;
        if (!targetGuildId) {
            throw new Error('Discord getChannels requires guildId');
        }

        try {
            const response = await axios.get(`https://discord.com/api/guilds/${targetGuildId}/channels`, {
                headers: { Authorization: `Bot ${this.botToken}` }
            });
            // Filter for text channels (type 0) and announcement channels (type 5)
            return response.data
                .filter((c: any) => c.type === 0 || c.type === 5)
                .map((c: any) => ({ id: c.id, name: c.name, type: c.type }));
        } catch (error: any) {
            throw new Error(`Failed to fetch channels: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Posts a message to a Discord channel.
     * @param content - Message content
     * @param channelId - Channel ID (uses default if not provided)
     * @returns Post result
     */
    async post(content: PostContent, channelId?: string): Promise<PostResult> {
        const targetChannelId = channelId || this.defaultChannelId;

        if (!targetChannelId) {
            return {
                platform: this.name,
                success: false,
                error: 'Discord posting requires a channelId.'
            };
        }

        try {
            const finalForm = new FormData();
            let finalContent = content.text || '';
            let fileIndex = 0;

            if (content.media) {
                for (const media of content.media) {
                    if (fs.existsSync(media)) {
                        finalForm.append(`files[${fileIndex}]`, fs.createReadStream(media));
                        fileIndex++;
                    } else {
                        // If it's a URL, append it to content
                        finalContent += `\n${media}`;
                    }
                }
            }

            finalForm.append('payload_json', JSON.stringify({ content: finalContent }));

            const response = await axios.post(`https://discord.com/api/channels/${targetChannelId}/messages`, finalForm, {
                headers: {
                    Authorization: `Bot ${this.botToken}`,
                    ...finalForm.getHeaders()
                }
            });

            return {
                platform: this.name,
                success: true,
                postId: response.data.id
            };

        } catch (error: any) {
            return {
                platform: this.name,
                success: false,
                error: error.response?.data?.message || error.message || error
            };
        }
    }

    /**
     * Sends an embed message to a Discord channel.
     * @param embed - Discord embed object
     * @param channelId - Channel ID (uses default if not provided)
     * @returns Post result
     */
    async postEmbed(embed: {
        title?: string;
        description?: string;
        color?: number;
        url?: string;
        image?: { url: string };
        thumbnail?: { url: string };
        fields?: { name: string; value: string; inline?: boolean }[];
    }, channelId?: string): Promise<PostResult> {
        const targetChannelId = channelId || this.defaultChannelId;

        if (!targetChannelId) {
            return {
                platform: this.name,
                success: false,
                error: 'Discord posting requires a channelId.'
            };
        }

        try {
            const response = await axios.post(`https://discord.com/api/channels/${targetChannelId}/messages`, {
                embeds: [embed]
            }, {
                headers: {
                    Authorization: `Bot ${this.botToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return {
                platform: this.name,
                success: true,
                postId: response.data.id
            };
        } catch (error: any) {
            return {
                platform: this.name,
                success: false,
                error: error.response?.data?.message || error.message || error
            };
        }
    }

    /**
     * Gets stats about the bot and the guild.
     * @param guildId - Guild ID (uses default if not provided)
     * @returns Guild and bot stats
     */
    async getStats(guildId?: string): Promise<any> {
        const targetGuildId = guildId || this.defaultGuildId;

        try {
            const botResponse = await axios.get('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bot ${this.botToken}` }
            });

            let guildData = null;
            if (targetGuildId) {
                const guildResponse = await axios.get(`https://discord.com/api/guilds/${targetGuildId}?with_counts=true`, {
                    headers: { Authorization: `Bot ${this.botToken}` }
                });
                guildData = {
                    id: guildResponse.data.id,
                    name: guildResponse.data.name,
                    memberCount: guildResponse.data.approximate_member_count,
                    presenceCount: guildResponse.data.approximate_presence_count
                };
            }

            return {
                platform: this.name,
                success: true,
                data: {
                    bot: botResponse.data,
                    guild: guildData
                }
            };
        } catch (error: any) {
            return {
                platform: this.name,
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
}
