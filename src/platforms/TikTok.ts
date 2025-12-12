import { SocialPlatform, PostContent, PostResult } from "../types";
import axios from "axios";

export class TikTok implements SocialPlatform {
  name: string = "tiktok";
  private clientKey: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken?: string;
  private refreshToken?: string;

  constructor(config: {
    clientKey: string;
    clientSecret: string;
    redirectUri: string;
    accessToken?: string;
    refreshToken?: string;
  }) {
    this.clientKey = config.clientKey;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
  }

  generateAuthUrl(
    scopes: string[] = ["user.info.basic", "video.publish", "video.upload"],
  ): string {
    const state = Math.random().toString(36).substring(7);
    const scopeString = scopes.join(",");
    return `https://www.tiktok.com/v2/auth/authorize/?client_key=${this.clientKey}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${encodeURIComponent(scopeString)}&response_type=code&state=${state}`;
  }

  async exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    openId: string;
    expiresIn: number;
  }> {
    try {
      const params = new URLSearchParams();
      params.append("client_key", this.clientKey);
      params.append("client_secret", this.clientSecret);
      params.append("code", code);
      params.append("grant_type", "authorization_code");
      params.append("redirect_uri", this.redirectUri);

      const response = await axios.post(
        "https://open.tiktokapis.com/v2/oauth/token/",
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        openId: response.data.open_id,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`,
      );
    }
  }

  /**
   * Refreshes the access token using refresh token.
   * @returns New token data
   */
  async refreshAccessToken(): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    if (!this.refreshToken) {
      throw new Error("TikTok token refresh requires refreshToken");
    }

    try {
      const params = new URLSearchParams();
      params.append("client_key", this.clientKey);
      params.append("client_secret", this.clientSecret);
      params.append("grant_type", "refresh_token");
      params.append("refresh_token", this.refreshToken);

      const response = await axios.post(
        "https://open.tiktokapis.com/v2/oauth/token/",
        params,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to refresh token: ${error.response?.data?.error_description || error.message}`,
      );
    }
  }

  async post(content: PostContent): Promise<PostResult> {
    if (!this.accessToken) {
      return {
        platform: this.name,
        success: false,
        error: "TikTok posting requires accessToken.",
      };
    }

    if (!content.media || content.media.length === 0) {
      return {
        platform: this.name,
        success: false,
        error: "TikTok requires a video URL.",
      };
    }

    const videoUrl = content.media[0];
    if (!videoUrl.startsWith("http")) {
      return {
        platform: this.name,
        success: false,
        error:
          "TikTok integration currently only supports public URLs (PULL_FROM_URL).",
      };
    }

    try {
      // Step 1: Init Post
      const response = await axios.post(
        "https://open.tiktokapis.com/v2/post/publish/video/init/",
        {
          post_info: {
            title: content.text || "",
            privacy_level: "PUBLIC_TO_EVERYONE",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: videoUrl,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
        },
      );

      const publishId = response.data.data.publish_id;

      // Step 2: Poll for status (simplified)
      // In a real app, we should poll status/fetch/ like Postiz does.
      // For now, we return success with the publishId.

      return {
        platform: this.name,
        success: true,
        postId: publishId,
      };
    } catch (error: any) {
      return {
        platform: this.name,
        success: false,
        error: error.response?.data || error.message || error,
      };
    }
  }

  async getStats(): Promise<any> {
    if (!this.accessToken) {
      return {
        platform: this.name,
        success: false,
        error: "TikTok stats require accessToken.",
      };
    }

    try {
      const response = await axios.get(
        "https://open.tiktokapis.com/v2/user/info/",
        {
          params: {
            fields:
              "open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count",
          },
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      return {
        platform: this.name,
        success: true,
        data: response.data.data.user,
      };
    } catch (error: any) {
      return {
        platform: this.name,
        success: false,
        error: error.response?.data || error.message || error,
      };
    }
  }
}
