import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

/** Private bucket. Created once by hand — see admin/README.md for the SQL. */
export const FEEDBACK_BUCKET = 'feedback-attachments';

/** 5 MB per image after the picker's on-device compression. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/** Minimal shape of a multer file — @types/multer is not installed. */
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
}

@Injectable()
export class FeedbackStorageService {
  private readonly logger = new Logger(FeedbackStorageService.name);
  private readonly client: SupabaseClient | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL');
    const serviceKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    /**
     * A SEPARATE service-role client from SupabaseAuthService's.
     *
     * That one is documented as being deliberately shared between admin and
     * public *auth* calls, on the grounds that auth operations are not
     * RLS-bearing data queries. Storage is a data query. Reusing that client
     * would quietly extend an exemption written for `auth.signInWithPassword`
     * to cover reading and writing farmers' photos, so this owns its own.
     *
     * Null (rather than throwing) when env is missing: this service is only
     * reached from the feedback endpoints, and a missing key should fail those
     * requests, not crash-loop the whole deploy the way a constructor throw in
     * SupabaseAuthService does.
     */
    this.client =
      url && serviceKey
        ? createClient(url, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : null;

    if (!this.client) {
      this.logger.warn(
        'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — feedback attachments are disabled.',
      );
    }
  }

  /**
   * Store one image and return its object PATH.
   *
   * Paths are namespaced by user id (`<userId>/<uuid>.<ext>`) so ownership is
   * checkable from the path alone — that is what
   * `FeedbackService.assertOwnsPaths` relies on when the client hands paths
   * back on create.
   */
  async upload(userId: string, file: UploadedImage): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException('Attachments are not available');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Empty file');
    }
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException('Image is too large');
    }

    const ext = file.mimetype.split('/')[1].replace('jpeg', 'jpg');
    const path = `${userId}/${randomUUID()}.${ext}`;

    const { error } = await this.client.storage
      .from(FEEDBACK_BUCKET)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Attachment upload failed: ${error.message}`);
      throw new ServiceUnavailableException('Could not store the image');
    }
    return path;
  }

  /**
   * Signed, short-lived URLs for a report's attachments.
   *
   * Degrades to an empty list rather than throwing: a farmer must still be
   * able to read the team's reply when the bucket is missing or Storage is
   * having a bad day. Losing the thumbnails is a smaller failure than losing
   * the whole screen.
   */
  async signAttachments(paths: string[]): Promise<string[]> {
    if (!this.client || !paths?.length) return [];
    try {
      const { data, error } = await this.client.storage
        .from(FEEDBACK_BUCKET)
        .createSignedUrls(paths, 3600);
      if (error) throw error;
      return (data ?? [])
        .map((d) => d.signedUrl)
        .filter((u): u is string => !!u);
    } catch (err: any) {
      this.logger.warn(`Could not sign attachments: ${err?.message ?? err}`);
      return [];
    }
  }
}
