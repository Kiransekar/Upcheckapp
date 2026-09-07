import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly isConfigured: boolean;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('BREVO_API_KEY', '');
    this.isConfigured = !!this.apiKey;

    if (!this.isConfigured) {
      this.logger.warn(
        'BREVO_API_KEY not set — emails will be logged but not sent.',
      );
    } else {
      this.logger.log('Brevo HTTP API email service ready.');
    }
  }

  private get senderEmail(): string {
    return this.configService.get('SMTP_SENDER_EMAIL', 'noreply@upcheck.in');
  }

  private get senderName(): string {
    return this.configService.get('SMTP_SENDER_NAME', 'Upcheck');
  }

  private get appName(): string {
    return this.configService.get('APP_NAME', 'Upcheck');
  }

  /** Where farmer-reported problems land. Config so it moves without a deploy. */
  private get adminAlertEmail(): string {
    return this.configService.get('ADMIN_ALERT_EMAIL', 'admin@upcheck.in');
  }

  private async postToBrevo(body: unknown): Promise<Response> {
    return fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Sends via the Brevo HTTP API. Throws on failure (network error, or a 4xx/5xx
   * after one bounded retry on 5xx) so callers can surface the failure instead of
   * silently reporting success — see AUDIT id 111. Recipient address is never
   * logged (PII) — only subject/outcome.
   */
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    if (!this.isConfigured) {
      this.logger.warn(`Email not sent (BREVO_API_KEY missing): ${subject}`);
      return;
    }

    const body = {
      sender: { name: this.senderName, email: this.senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    };

    let res: Response;
    try {
      res = await this.postToBrevo(body);
      if (!res.ok && res.status >= 500) {
        // ponytail: one bounded retry for transient 5xx, no queue/backoff.
        res = await this.postToBrevo(body);
      }
    } catch (err: any) {
      this.logger.error(`Brevo API fetch failed (${subject}): ${err.message}`);
      throw err;
    }

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Brevo API error ${res.status} (${subject}): ${text}`);
      throw new Error(`Brevo API error ${res.status}`);
    }
    this.logger.log(`Email sent via Brevo API: ${subject}`);
  }

  // ponytail: sendVerificationEmail/sendPasswordResetEmail/sendWelcomeEmail/
  // sendPasswordChangedNotification/sendOtpEmail removed — zero callers, grep-
  // confirmed (AUDIT id 114). Auth flows use supabaseAuthService's own same-named
  // methods instead. sendInviteEmail below is the only live path.
  async sendInviteEmail(toEmail: string, inviterName: string) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 30px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: bold; color: #1565C0; }
            .badge { display: inline-block; background: #e3f2fd; color: #1565C0; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
            .cta { text-align: center; margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 12px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">${this.appName}</div>
              <div class="badge">You've been invited!</div>
            </div>
            <p>Hi there,</p>
            <p><strong>${inviterName}</strong> thinks you'd love <strong>${this.appName}</strong> — the smart aquaculture management app for shrimp and fish farmers.</p>
            <p>With ${this.appName} you can:</p>
            <ul>
              <li>Track pond water quality in real time</li>
              <li>Monitor feeding, sampling, and harvest data</li>
              <li>Get disease alerts and smart recommendations</li>
              <li>Manage multiple farms and ponds in one place</li>
            </ul>
            <div class="cta">
              <p style="margin:0; font-weight:600; color:#1565C0;">🚀 We're in early access — stay tuned!</p>
              <p style="margin:8px 0 0; font-size:14px; color:#555;">${inviterName} has notified us that you're interested. We'll reach out as soon as the app is fully launched.</p>
            </div>
            <div class="footer">
              <p>You received this because ${inviterName} invited you to join ${this.appName}.</p>
              <p>&copy; ${new Date().getFullYear()} ${this.appName}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>`;

    await this.sendEmail(
      toEmail,
      `${inviterName} invited you to join ${this.appName}!`,
      html,
    );
  }

  /**
   * Tells the team a farmer filed a report, so it is not sat on until someone
   * happens to open the dashboard.
   *
   * Carries what triage needs and nothing else. The reporter's phone number and
   * email address are deliberately absent — the Privacy Policy governs sharing
   * contact details, and none of them help decide what to do about a bug. The
   * user id is enough to find the person in the dashboard if it comes to that.
   *
   * Throws like every other path here; the caller decides whether the failure
   * is fatal (for feedback, it is not).
   */
  async sendFeedbackAlertEmail(report: {
    id: string;
    userId: string;
    farmId: string | null;
    category: string;
    subject: string | null;
    message: string;
    attachmentCount: number;
  }): Promise<void> {
    const row = (label: string, value: string) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#666;">${label}</td><td style="padding:4px 0;"><strong>${esc(value)}</strong></td></tr>`;

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;">
          <h2 style="margin:0 0 4px;">New ${esc(report.category)} report</h2>
          <p style="margin:0 0 16px;color:#666;">${esc(report.subject ?? '(no title)')}</p>
          <table style="border-collapse:collapse;font-size:14px;">
            ${row('Report id', report.id)}
            ${row('User id', report.userId)}
            ${row('Farm id', report.farmId ?? '(none)')}
            ${row('Category', report.category)}
            ${row('Attachments', report.attachmentCount ? `${report.attachmentCount} photo(s)` : 'none')}
          </table>
          <h3 style="margin:20px 0 4px;">Message</h3>
          <pre style="white-space:pre-wrap;font-family:inherit;background:#f8f9fa;border-radius:8px;padding:12px;margin:0;">${esc(report.message)}</pre>
          <p style="margin-top:24px;font-size:12px;color:#888;">Reporter contact details are intentionally omitted — look the user id up in the dashboard if you need them.</p>
        </body>
      </html>`;

    await this.sendEmail(
      this.adminAlertEmail,
      `[${this.appName}] ${report.category}: ${report.subject?.trim() || report.message.trim().split('\n')[0].slice(0, 80)}`,
      html,
    );
  }
}

/** The message is farmer-typed free text going straight into an HTML body. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
