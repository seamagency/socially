import { SocialPlatform, PostContent, PostResult } from "../types";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";

export class YouTube implements SocialPlatform {
  name: string = "youtube";
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken?: string;
  private refreshToken?: string;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    accessToken?: string;
    refreshToken?: string;
  }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
  }

  generateAuthUrl(
    scopes: string[] = [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ],
  ): string {
    const scopeString = scopes.join(" ");
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${encodeURIComponent(scopeString)}&response_type=code&access_type=offline&prompt=consent`;
  }

  async exchangeCodeForToken(
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    try {
      const response = await axios.post("https://oauth2.googleapis.com/token", {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri,
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`,
      );
    }
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const response = await axios.post("https://oauth2.googleapis.com/token", {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      });

      this.accessToken = response.data.access_token;
      return this.accessToken!;
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
        error: "YouTube posting requires accessToken.",
      };
    }

    if (!content.media || content.media.length === 0) {
      return {
        platform: this.name,
        success: false,
        error: "YouTube requires a video file.",
      };
    }

    const videoPath = content.media[0];
    // Simple check for video extension
    if (!videoPath.match(/\.(mp4|mov|avi|mkv)$/i)) {
      return {
        platform: this.name,
        success: false,
        error: "File does not appear to be a video.",
      };
    }

    try {
      // Using multipart upload for simplicity
      const metadata = {
        snippet: {
          title: content.text
            ? content.text.substring(0, 100)
            : "Uploaded Video",
          description: content.text || "",
          tags: ["socialy"],
        },
        status: {
          privacyStatus: "private", // Default to private for safety
        },
      };

      const form = new FormData();
      form.append("metadata", JSON.stringify(metadata), {
        contentType: "application/json",
      });
      form.append("file", fs.createReadStream(videoPath));

      const response = await axios.post(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
        form,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            ...form.getHeaders(),
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );

      return {
        platform: this.name,
        success: true,
        postId: response.data.id,
      };
    } catch (error: any) {
      // Attempt to refresh token if 401
      if (error.response?.status === 401 && this.refreshToken) {
        try {
          await this.refreshAccessToken();
          return this.post(content); // Retry once
        } catch (refreshError) {
          return {
            platform: this.name,
            success: false,
            error: "Token expired and refresh failed.",
          };
        }
      }

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
        error: "YouTube stats require accessToken.",
      };
    }

    try {
      // Get Channel Stats
      const response = await axios.get(
        "https://www.googleapis.com/youtube/v3/channels",
        {
          params: {
            part: "statistics",
            mine: true,
          },
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      return {
        platform: this.name,
        success: true,
        data: response.data.items?.[0]?.statistics,
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
