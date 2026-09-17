import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private _client: SupabaseClient | null = null;
  private readonly supabaseUrl: string;
  private readonly supabaseServiceRoleKey: string;
  private readonly jwtSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    this.supabaseServiceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '';
    this.jwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET') || '';

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
      if (this.supabaseUrl && this.supabaseServiceRoleKey) {
        this._client = createClient(this.supabaseUrl, this.supabaseServiceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });
      } else {
        throw new Error('Supabase client not initialized. Check environment variables.');
      }
    }
    return this._client;
  }

  createIsolatedClient(): SupabaseClient {
    if (this.supabaseUrl && this.supabaseServiceRoleKey) {
      return createClient(this.supabaseUrl, this.supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
    throw new Error('Supabase client not initialized. Check environment variables.');
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

    // 1. Try standard string secret
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

    // 3. Fallback to Supabase Auth API verification
    if (this.client) {
      try {
        const { data, error } = await this.client.auth.getUser(token);
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
    }

    throw new Error('Invalid or tampered access token signature');
  }

  signToken(payload: object, expiresIn: string | number = '1h'): string {
    if (!this.jwtSecret) {
      throw new Error('SUPABASE_JWT_SECRET is not configured');
    }
    return jwt.sign(payload, this.jwtSecret, { expiresIn: expiresIn as any });
  }
}
