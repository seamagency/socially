import { SocialPlatform, PostContent, PostResult } from "../types";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";

export class Reddit implements SocialPlatform {
  name: string = "reddit";
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken?: string;
  private refreshToken?: string;
  private defaultSubreddit?: string;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    accessToken?: string;
    refreshToken?: string;
    subreddit?: string;
  }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.defaultSubreddit = config.subreddit;
  }

  generateAuthUrl(
    scopes: string[] = ["read", "identity", "submit", "flair"],
  ): string {
    const state = Math.random().toString(36).substring(7);
    const scopeString = scopes.join(" ");
    return `https://www.reddit.com/api/v1/authorize?client_id=${this.clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(this.redirectUri)}&duration=permanent&scope=${encodeURIComponent(scopeString)}`;
  }

  async exchangeCodeForToken(
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    try {
      const auth = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString("base64");
      const params = new URLSearchParams();
      params.append("grant_type", "authorization_code");
      params.append("code", code);
      params.append("redirect_uri", this.redirectUri);

      const response = await axios.post(
        "https://www.reddit.com/api/v1/access_token",
        params,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
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
        `Failed to exchange code for token: ${error.response?.data?.message || error.message}`,
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
      throw new Error("Reddit token refresh requires refreshToken");
    }

    try {
      const auth = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString("base64");
      const params = new URLSearchParams();
      params.append("grant_type", "refresh_token");
      params.append("refresh_token", this.refreshToken);

      const response = await axios.post(
        "https://www.reddit.com/api/v1/access_token",
        params,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      this.accessToken = response.data.access_token;
      // Reddit doesn't always return a new refresh token
      if (response.data.refresh_token) {
        this.refreshToken = response.data.refresh_token;
      }

      return {
        accessToken: response.data.access_token,
        refreshToken: this.refreshToken!,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to refresh token: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  private async uploadFile(filePath: string): Promise<string> {
    const filename = path.basename(filePath);
    const mimeType = filePath.endsWith(".mp4") ? "video/mp4" : "image/jpeg"; // Simplified mime check

    // 1. Get Upload Lease
    const form = new FormData();
    form.append("filepath", filename);
    form.append("mimetype", mimeType);

    const leaseResponse = await axios.post(
      "https://oauth.reddit.com/api/media/asset",
      form,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...form.getHeaders(),
        },
      },
    );

    const { args } = leaseResponse.data;
    const uploadUrl = `https:${args.action}`;
    const fields = args.fields;

    // 2. Upload to S3
    const uploadForm = new FormData();
    fields.forEach((field: any) => {
      uploadForm.append(field.name, field.value);
    });
    uploadForm.append("file", fs.createReadStream(filePath));

    const uploadResponse = await axios.post(uploadUrl, uploadForm, {
      headers: {
        ...uploadForm.getHeaders(),
      },
    });

    // 3. Extract Location
    // Reddit returns XML with <Location>...</Location>
    const locationMatch = uploadResponse.data.match(
      /<Location>(.*?)<\/Location>/,
    );
    if (locationMatch && locationMatch[1]) {
      return locationMatch[1];
    }

    // Fallback: construct URL if possible, but Reddit S3 usually requires the XML location
    throw new Error("Failed to retrieve uploaded file location from Reddit.");
  }

  async post(content: PostContent): Promise<PostResult> {
    if (!this.accessToken) {
      return {
        platform: this.name,
        success: false,
        error: "Reddit posting requires accessToken.",
      };
    }

    if (!this.defaultSubreddit) {
      return {
        platform: this.name,
        success: false,
        error:
          "Reddit posting requires a defaultSubreddit (configure in SocialConfig).",
      };
    }

    try {
      let kind = "self";
      let url = "";
      let video_poster_url = "";

      if (content.media && content.media.length > 0) {
        const mediaPath = content.media[0];
        if (mediaPath.startsWith("http")) {
          kind = "link";
          url = mediaPath;
        } else {
          // Upload local file
          url = await this.uploadFile(mediaPath);
          kind = mediaPath.endsWith(".mp4") ? "video" : "image";
        }
      }

      const params = new URLSearchParams();
      params.append("api_type", "json");
      params.append("sr", this.defaultSubreddit);
      params.append(
        "title",
        content.text
          ? content.text.split("\n")[0].substring(0, 300)
          : "New Post",
      ); // Title is required, max 300 chars
      params.append("kind", kind);

      if (kind === "self") {
        params.append("text", content.text || "");
      } else if (kind === "link") {
        params.append("url", url);
      } else {
        params.append("url", url);
        // For video/image, Reddit might require different handling or 'sr' specific requirements
        // But 'url' with kind 'image'/'video' is the standard API way for hosted assets
      }

      const response = await axios.post(
        "https://oauth.reddit.com/api/submit",
        params,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      if (response.data.json.errors && response.data.json.errors.length > 0) {
        return {
          platform: this.name,
          success: false,
          error: `Reddit API Error: ${JSON.stringify(response.data.json.errors)}`,
        };
      }

      return {
        platform: this.name,
        success: true,
        postId: response.data.json.data.id,
        // url: response.data.json.data.url // Often null in initial response
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
        error: "Reddit stats require accessToken.",
      };
    }

    try {
      const response = await axios.get("https://oauth.reddit.com/api/v1/me", {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return {
        platform: this.name,
        success: true,
        data: response.data,
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
