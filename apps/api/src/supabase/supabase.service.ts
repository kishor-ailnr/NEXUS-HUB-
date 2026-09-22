import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (globalThis as any).WebSocket = require('ws');
  } catch {
    // Ignore if not present
  }
}

const DEFAULT_SUPABASE_URL = 'https://facnvxbznmbhzdkbumby.supabase.co';
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhY252eGJ6bm1iaHpka2J1bWJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODQ5MDc0OCwiZXhwIjoyMTA0MDY2NzQ4fQ.8uK3v-uUFumUVuL2kXz2D6F6iJmuZvwn0x6kSmbmKwc';
const DEFAULT_SUPABASE_JWT_SECRET =
  'JGlVFMx95a3KR3+sLaqcUva4DWO6EiwkeE+oyVzlVtQMqWw0uOXG4AXNazEhYBtRYLvsBBq8w4/6bIA1Af3w2Q==';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private _client: SupabaseClient | null = null;
  private readonly supabaseUrl: string;
  private readonly supabaseServiceRoleKey: string;
  private readonly jwtSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      process.env.SUPABASE_URL ||
      DEFAULT_SUPABASE_URL;
    this.supabaseServiceRoleKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
    this.jwtSecret =
      this.configService.get<string>('SUPABASE_JWT_SECRET') ||
      process.env.SUPABASE_JWT_SECRET ||
      DEFAULT_SUPABASE_JWT_SECRET;

    if (this.supabaseUrl && this.supabaseServiceRoleKey) {
      this._client = createClient(this.supabaseUrl, this.supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    } else {
      this.logger.warn('Supabase URL or Service Role Key missing. Mock or test mode active.');
    }
  }

  get client(): SupabaseClient {
    return this.adminClient;
  }

  get adminClient(): SupabaseClient {
    if (!this._client) {
      const url = this.supabaseUrl || DEFAULT_SUPABASE_URL;
      const key = this.supabaseServiceRoleKey || DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
      this._client = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
    return this._client;
  }

  createIsolatedClient(): SupabaseClient {
    const url = this.supabaseUrl || DEFAULT_SUPABASE_URL;
    const key = this.supabaseServiceRoleKey || DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
    return createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  getSecret(): string {
    return this.jwtSecret;
  }

  /**
   * Verify JWT token signature.
   * Supports raw secret, base64-decoded secret, and Supabase client verification.
   */
  async verifyJwt(token: string): Promise<any> {
    if (!token) {
      throw new Error('Token is missing');
    }

    // 1. Try standard string secret (HS256 minted token)
    if (this.jwtSecret) {
      try {
        return jwt.verify(token, this.jwtSecret);
      } catch (err1) {
        // 2. Try base64 decoded buffer (Supabase often uses base64-encoded HMAC secrets)
        try {
          return jwt.verify(token, Buffer.from(this.jwtSecret, 'base64'));
        } catch (err2) {
          // Fall through to client verification
        }
      }
    }

    // 3. Fallback to Supabase Auth API verification (handles ES256 / remote Supabase tokens)
    try {
      const { data, error } = await this.adminClient.auth.getUser(token);
      if (!error && data?.user) {
        const decoded = (jwt.decode(token) as any) || {};
        return {
          sub: data.user.id,
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata,
          ...decoded,
        };
      }
    } catch (clientErr) {
      this.logger.debug('Supabase getUser verification failed:', clientErr);
    }

    throw new Error('Invalid or tampered access token signature');
  }

  signToken(payload: object, expiresIn: string | number = '1h'): string {
    const secret = this.jwtSecret || DEFAULT_SUPABASE_JWT_SECRET;
    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
  }
}
