import { SocialManager } from '../src/SocialManager';
import { Facebook } from '../src/platforms/Facebook';

// Mock all platform dependencies
jest.mock('../src/platforms/Facebook');
jest.mock('../src/platforms/Instagram');
jest.mock('../src/platforms/Twitter');
jest.mock('../src/platforms/LinkedIn');
jest.mock('../src/platforms/YouTube');
jest.mock('../src/platforms/TikTok');
jest.mock('../src/platforms/Pinterest');
jest.mock('../src/platforms/Reddit');
jest.mock('../src/platforms/Threads');
jest.mock('../src/platforms/Discord');
jest.mock('../src/platforms/Slack');
jest.mock('../src/platforms/Telegram');

describe('SocialManager', () => {
    let manager: SocialManager;
    const mockFacebookPost = jest.fn();

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        (Facebook as jest.Mock).mockImplementation(() => ({
            post: mockFacebookPost,
            name: 'facebook'
        }));
    });

    it('should initialize with provided config', () => {
        manager = new SocialManager({
            facebook: { accessToken: 'token', pageId: '123' }
        });
        // Check if Facebook constructor was called
        expect(Facebook).toHaveBeenCalledTimes(1);
    });

    it('should initialize with multiple platforms', () => {
        manager = new SocialManager({
            facebook: { accessToken: 'fb_token', pageId: '123' },
            twitter: {
                apiKey: 'key',
                apiSecret: 'secret',
                accessToken: 'token',
                accessSecret: 'secret'
            },
            youtube: {
                clientId: 'yt_id',
                clientSecret: 'yt_secret',
                redirectUri: 'http://localhost',
                accessToken: 'yt_token'
            }
        });

        expect(manager.getPlatform('facebook')).toBeDefined();
        expect(manager.getPlatform('twitter')).toBeDefined();
        expect(manager.getPlatform('youtube')).toBeDefined();
    });

    it('should share content to configured platforms', async () => {
        manager = new SocialManager({
            facebook: { accessToken: 'token', pageId: '123' }
        });

        mockFacebookPost.mockResolvedValue({
            platform: 'facebook',
            success: true,
            postId: 'fb_123'
        });

        const result = await manager.share({ text: 'Hello' });

        expect(mockFacebookPost).toHaveBeenCalledWith({ text: 'Hello' });
        expect(result).toHaveLength(1);
        expect(result[0].success).toBe(true);
        expect(result[0].postId).toBe('fb_123');
    });

    it('should handle errors gracefully', async () => {
        manager = new SocialManager({
            facebook: { accessToken: 'token', pageId: '123' }
        });

        mockFacebookPost.mockRejectedValue(new Error('API Error'));

        const result = await manager.share({ text: 'Hello' });

        expect(result[0].success).toBe(false);
        expect(result[0].error).toBeDefined();
    });

    it('should return platform via getPlatform', () => {
        manager = new SocialManager({
            facebook: { accessToken: 'token', pageId: '123' }
        });

        const fb = manager.getPlatform('facebook');
        expect(fb).toBeDefined();
        expect(fb?.name).toBe('facebook');
    });

    it('should return undefined for unconfigured platform', () => {
        manager = new SocialManager({
            facebook: { accessToken: 'token', pageId: '123' }
        });

        const tw = manager.getPlatform('twitter');
        expect(tw).toBeUndefined();
    });
});

