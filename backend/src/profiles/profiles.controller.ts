import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from '../auth/dto/delete-account.dto';
import { InviteDto } from './dto/invite.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { Public } from '../auth/decorators/auth.decorators';
import { EmailService } from '../email.service';

@Controller('profiles')
export class ProfilesController {
  private readonly logger = new Logger(ProfilesController.name);

  constructor(
    private readonly profilesService: ProfilesService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  create(@Body() createProfileDto: CreateProfileDto) {
    this.logger.log(
      `POST /profiles — body: ${JSON.stringify(createProfileDto)}`,
    );
    return this.profilesService.create(createProfileDto);
  }

  @Public()
  @Get('check-username/:username')
  async checkUsername(@Param('username') username: string) {
    const existing = await this.profilesService.findByUsername(username);
    return { available: !existing };
  }

  @Public()
  @Get('public/:username')
  async findPublicByUsername(@Param('username') username: string) {
    const profile = await this.profilesService.findPublicByUsername(username);
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  @Post('invite')
  async inviteFriend(@Body() body: InviteDto, @CurrentUser() user) {
    const inviterProfile = await this.profilesService.findOne(user.id);
    const inviterName =
      inviterProfile?.fullName || inviterProfile?.username || user.email;
    await this.emailService.sendInviteEmail(body.toEmail, inviterName);
    return { success: true };
  }

  @Get('me')
  async findMe(@CurrentUser() user) {
    const { id, email } = user;
    this.logger.log(`GET /profiles/me — user.id: ${id}`);
    return this.profilesService.upsert(id, email);
  }

  /**
   * The caller's own onboarding preferences.
   *
   * Deliberately has no `:id` param — reading or writing another user's
   * preferences is not a permission that exists, so the route is shaped so it
   * cannot be asked for rather than guarded after the fact.
   */
  @Get('me/preferences')
  async getMyPreferences(@CurrentUser() user) {
    return this.profilesService.getPreferences(user.id);
  }

  /**
   * Persist the onboarding intent server-side.
   *
   * It routes the first run ("set up a farm" vs "join one with a code") and
   * grants nothing. Persisting it means a farmer who reinstalls, or signs in on
   * a second phone mid-setup, resumes where they were instead of being asked
   * again — which device-local storage cannot do.
   *
   * It is stored on the `users` row, NOT in Supabase Auth `user_metadata`.
   * That distinction is the whole of W3: `user_metadata` is client-mutable, and
   * the previous `accountType` flag lived there while being read for an
   * authorization decision.
   */
  @Patch('me/preferences')
  async updateMyPreferences(
    @CurrentUser() user,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.profilesService.setPreferences(user.id, { ...dto });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user) {
    // Self-only: reading another user's profile leaks their email/PII, and the
    // previous upsert() branch would either mint a junk row or overwrite the
    // victim's email with the caller's. Callers wanting their own profile use
    // GET /profiles/me.
    if (id !== user.id) {
      throw new ForbiddenException('You can only view your own profile');
    }
    const result = await this.profilesService.findOne(id);
    if (!result) throw new NotFoundException('Profile not found');
    return result;
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@Body() dto: DeleteAccountDto, @CurrentUser() user) {
    this.logger.log(`DELETE /profiles/me — user.id: ${user.id}`);
    await this.profilesService.deleteAccount(user.id, dto?.password);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() user,
  ) {
    this.logger.log(`PATCH /profiles/${id} — user.id: ${user?.id}`);
    if (id !== user.id) {
      this.logger.warn(
        `PATCH /profiles/${id} — FORBIDDEN: user.id=${user?.id} != param id=${id}`,
      );
      throw new ForbiddenException('You can only update your own profile');
    }
    return this.profilesService.update(id, updateProfileDto);
  }
}
