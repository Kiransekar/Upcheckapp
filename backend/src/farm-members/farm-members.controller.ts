import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FarmMembersService } from './farm-members.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AddMemberDto } from './dto/add-member.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { LookupUserDto } from './dto/lookup-user.dto';
import { JoinFarmDto } from './dto/join-farm.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { JoinPolicyDto } from './dto/join-policy.dto';
import { SetPondScopeDto } from './dto/set-pond-scope.dto';
import { FinancialAccessDto } from './dto/financial-access.dto';
import { CapabilityOverridesDto } from './dto/capability-overrides.dto';
import { RecoveryContactDto } from './dto/recovery-contact.dto';
import { FarmRecoveryService } from './farm-recovery.service';
import { ApproveMemberDto } from './dto/approve-member.dto';
import { FarmInvitesService } from './farm-invites.service';

// Brute-force budget for code redemption; mirrors SENSITIVE_THROTTLE in
// supabase-auth.controller.ts.
const JOIN_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller()
export class FarmMembersController {
  constructor(
    private readonly membersService: FarmMembersService,
    private readonly invitesService: FarmInvitesService,
    private readonly recoveryService: FarmRecoveryService,
  ) {}

  /** Resolve a user to add by their unique id (QR), phone or email. */
  @Get('farm-members/users/lookup')
  lookup(@Query() query: LookupUserDto) {
    if (!query.userId && !query.phone && !query.email) {
      throw new BadRequestException(
        'Provide a userId, phone or email to look up',
      );
    }
    return this.membersService.lookupUser(query);
  }

  /** Farms the caller is a member of (owner or worker), with their role. */
  @Get('farm-members/mine')
  mine(@CurrentUser() user) {
    return this.membersService.listMine(user.id);
  }

  /**
   * Join requests the caller is still waiting on.
   *
   * Its own route rather than a field on `/mine`, so a pending row can never
   * be mistaken for a membership — see `listMyPendingRequests`. Grants nothing
   * and is scoped to the caller by construction.
   */
  @Get('farm-members/mine/pending')
  minePending(@CurrentUser() user) {
    return this.membersService.listMyPendingRequests(user.id);
  }

  /**
   * Redeem an invite code and become a member of that farm.
   *
   * Throttled: an 8-char code over a 32-char alphabet is ~10^12 combinations,
   * which is fine against a rate-limited attacker and not fine against an
   * unlimited one. Same 5/min bucket the sensitive auth endpoints use.
   */
  @Throttle(JOIN_THROTTLE)
  @Post('farm-members/join')
  join(@Body() dto: JoinFarmDto, @CurrentUser() user) {
    return this.invitesService.join(user.id, dto);
  }

  // ==================== Invites ====================

  @Post('farms/:farmId/invites')
  createInvite(
    @Param('farmId') farmId: string,
    @Body() dto: CreateInviteDto,
    @CurrentUser() user,
  ) {
    return this.invitesService.create(farmId, user.id, dto);
  }

  @Get('farms/:farmId/invites')
  listInvites(@Param('farmId') farmId: string, @CurrentUser() user) {
    return this.invitesService.list(farmId, user.id);
  }

  @Delete('farms/:farmId/invites/:inviteId')
  revokeInvite(
    @Param('farmId') farmId: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user,
  ) {
    return this.invitesService.revoke(farmId, inviteId, user.id);
  }

  // ============ Waiting to be let in ============

  /** The pending queue: people who used the code but are not in yet. */
  @Get('farms/:farmId/pending')
  listPending(@Param('farmId') farmId: string, @CurrentUser() user) {
    return this.invitesService.listPending(farmId, user.id);
  }

  /** Let someone in, optionally promoting them on the way. */
  @Post('farms/:farmId/pending/:userId/approve')
  approveMember(
    @Param('farmId') farmId: string,
    @Param('userId') userId: string,
    @Body() dto: ApproveMemberDto,
    @CurrentUser() user,
  ) {
    return this.invitesService.approve(farmId, userId, user.id, dto.role);
  }

  /** Turn someone away; the pending row is deleted, having granted nothing. */
  @Delete('farms/:farmId/pending/:userId')
  declineMember(
    @Param('farmId') farmId: string,
    @Param('userId') userId: string,
    @CurrentUser() user,
  ) {
    return this.invitesService.decline(farmId, userId, user.id);
  }

  /** Manual vs auto approval, and who may approve. Owner only. */
  @Post('farms/:farmId/join-policy')
  setJoinPolicy(
    @Param('farmId') farmId: string,
    @Body() dto: JoinPolicyDto,
    @CurrentUser() user,
  ) {
    return this.invitesService.setJoinPolicy(farmId, user.id, dto);
  }

  /** Retire every active invite for this farm and mint a fresh one. */
  @Post('farms/:farmId/invites/rotate')
  rotateInvite(
    @Param('farmId') farmId: string,
    @Body() dto: CreateInviteDto,
    @CurrentUser() user,
  ) {
    return this.invitesService.rotate(farmId, user.id, dto);
  }

  @Get('farms/:farmId/members')
  list(@Param('farmId') farmId: string, @CurrentUser() user) {
    return this.membersService.listMembers(farmId, user.id);
  }

  @Post('farms/:farmId/members')
  add(
    @Param('farmId') farmId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user,
  ) {
    return this.membersService.addMember(farmId, user.id, dto);
  }

  @Delete('farms/:farmId/members/:userId')
  remove(
    @Param('farmId') farmId: string,
    @Param('userId') userId: string,
    @CurrentUser() user,
  ) {
    return this.membersService.removeMember(farmId, user.id, userId);
  }

  /** Change a member's role (owner only). */
  @Patch('farms/:farmId/members/:userId')
  changeRole(
    @Param('farmId') farmId: string,
    @Param('userId') userId: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() user,
  ) {
    return this.membersService.changeMemberRole(
      farmId,
      user.id,
      userId,
      dto.role,
    );
  }

  /** Grant or revoke cost visibility for one member. Owner only. */
  @Patch('farms/:farmId/members/:userId/financials')
  setFinancialAccess(
    @Param('farmId') farmId: string,
    @Param('userId') userId: string,
    @Body() dto: FinancialAccessDto,
    @CurrentUser() user,
  ) {
    return this.membersService.setFinancialAccess(
      farmId,
      user.id,
      userId,
      dto.canViewFinancials ?? null,
    );
  }

  /**
   * Replace one member's capability overrides. Owner only.
   *
   * Supersedes the /financials route above, which is the same write with one
   * hard-coded key and stays for one release.
   */
  @Patch('farms/:farmId/members/:userId/capabilities')
  setCapabilities(
    @Param('farmId') farmId: string,
    @Param('userId') userId: string,
    @Body() dto: CapabilityOverridesDto,
    @CurrentUser() user,
  ) {
    return this.membersService.setCapabilities(
      farmId,
      user.id,
      userId,
      dto.overrides ?? null,
    );
  }

  /** Restrict a member to specific ponds; an empty list clears the scope. */
  @Patch('farms/:farmId/members/:userId/ponds')
  setPondScope(
    @Param('farmId') farmId: string,
    @Param('userId') userId: string,
  @Body() dto: SetPondScopeDto,
    @CurrentUser() user,
  ) {
    return this.membersService.setPondScope(farmId, user.id, userId, dto.pondIds);
  }

  // ============ Owner recovery (W5) ============

  /** Current recovery state — nominee, claim clock, waiting period. */
  @Get('farms/:farmId/recovery')
  recoveryStatus(@Param('farmId') farmId: string, @CurrentUser() user) {
    return this.recoveryService.status(farmId, user.id);
  }

  /** Nominate, or clear with null. Owner only. */
  @Post('farms/:farmId/recovery-contact')
  setRecoveryContact(
    @Param('farmId') farmId: string,
    @Body() dto: RecoveryContactDto,
    @CurrentUser() user,
  ) {
    return this.recoveryService.setRecoveryContact(farmId, user.id, dto.userId ?? null);
  }

  /** Nominee starts the waiting period. */
  @Post('farms/:farmId/recovery/claim')
  startRecoveryClaim(@Param('farmId') farmId: string, @CurrentUser() user) {
    return this.recoveryService.startClaim(farmId, user.id);
  }

  /** Owner (or the nominee) stops a claim in flight. */
  @Delete('farms/:farmId/recovery/claim')
  cancelRecoveryClaim(@Param('farmId') farmId: string, @CurrentUser() user) {
    return this.recoveryService.cancelClaim(farmId, user.id);
  }

  /** Nominee takes over, once the waiting period has elapsed. */
  @Post('farms/:farmId/recovery/complete')
  completeRecoveryClaim(@Param('farmId') farmId: string, @CurrentUser() user) {
    return this.recoveryService.completeClaim(farmId, user.id);
  }

  /** Transfer farm ownership to an existing member (owner only). */
  @Post('farms/:farmId/transfer-ownership')
  transferOwnership(
    @Param('farmId') farmId: string,
    @Body() dto: TransferOwnershipDto,
    @CurrentUser() user,
  ) {
    return this.membersService.transferOwnership(
      farmId,
      user.id,
      dto.newOwnerUserId,
    );
  }
}
