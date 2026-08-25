import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import {
  OWNS_RESOURCE_KEY,
  OwnsResourceOptions,
} from '../decorators/owns-resource.decorator';
import { FarmAccessService } from '../../farm-access/farm-access.service';
import { roleSatisfies } from '../../farm-access/farm-capability';

@Injectable()
export class OwnershipGuard implements CanActivate {
  private readonly logger = new Logger(OwnershipGuard.name);

  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
    private farmAccessService: FarmAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<OwnsResourceOptions>(
      OWNS_RESOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      // Fail CLOSED: OwnershipGuard is applied but @OwnsResource is missing.
      // A route that opts into the guard yet forgets the decorator would
      // otherwise ship wide open — deny loudly so the omission is caught in
      // dev/test rather than in production.
      const handler = context.getHandler?.()?.name ?? 'unknown';
      const cls = context.getClass?.()?.name ?? 'unknown';
      this.logger.error(
        `OwnershipGuard applied to ${cls}.${handler} without an @OwnsResource decorator — denying (fail-closed). Add @OwnsResource or remove the guard.`,
      );
      throw new ForbiddenException(
        'Ownership check is misconfigured for this route',
      );
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Find the resource ID in params, then body, then query
    const resourceId =
      request.params[options.paramName] ||
      (request.body && request.body[options.paramName]) ||
      (request.query && request.query[options.paramName]);

    if (!user || !user.id) {
      throw new ForbiddenException(
        'User is not authenticated or id is missing',
      );
    }

    if (!resourceId) {
      throw new NotFoundException(
        `Resource ID (${options.paramName}) missing in request`,
      );
    }

    // We use the entity metadata to dynamically fetch and check ownership
    const entityMetadata = this.dataSource.getMetadata(options.entityType);
    if (!entityMetadata) {
      throw new Error(`Entity ${options.entityType} not found in TypeORM`);
    }

    const repository = this.dataSource.getRepository(options.entityType);

    // Parse the ownerPath to automatically load relations
    // e.g. 'farm.userId' -> load ['farm']
    // e.g. 'pond.farm.userId' -> load ['pond', 'pond.farm']
    const pathParts = options.ownerPath.split('.');
    const relations: string[] = [];
    let currentRelation = '';

    for (let i = 0; i < pathParts.length - 1; i++) {
      currentRelation = currentRelation
        ? `${currentRelation}.${pathParts[i]}`
        : pathParts[i];
      relations.push(currentRelation);
    }

    // Find the record by ID, including necessary relations
    const findOptions: any = { where: { id: resourceId } };
    if (relations.length > 0) {
      findOptions.relations = relations;
    }

    const record = await repository.findOne(findOptions);

    if (!record) {
      throw new NotFoundException(
        `Resource of type ${options.entityType} not found`,
      );
    }

    // Resolve the actual owner ID from the object path
    let actualOwnerId: any = record;
    for (const part of pathParts) {
      if (actualOwnerId) {
        actualOwnerId = actualOwnerId[part];
      }
    }

    // Fast path: the direct farm owner always passes (any capability).
    if (actualOwnerId === user.id) {
      return true;
    }

    // Otherwise resolve the requester's per-farm role and apply the
    // route's capability. The owner path tail is always '*.userId'; the
    // object one level up is the farm node, whose id we need for the lookup.
    const farmNode = this.resolveFarmNode(record, pathParts);
    const farmId = farmNode?.id ?? farmNode?.farmId;

    if (farmId) {
      // Membership, not just role: roleSatisfies consults the per-farm
      // financial grant for VIEW_FINANCIALS, and the guard must reach the same
      // verdict as the service layer or the two disagree on the same request.
      const { role, canViewFinancials } =
        await this.farmAccessService.getMembershipOnFarm(user.id, farmId);
      if (roleSatisfies(role, options.capability, canViewFinancials)) {
        return true;
      }
    }

    throw new ForbiddenException(
      `You do not have permission to access this ${options.entityType}`,
    );
  }

  /**
   * Walk the owner path but stop one level before the final '*.userId' segment,
   * returning the object that carries the farm id (either a Farm entity with
   * `.id`, or — when ownerPath is just 'userId' on the Farm itself — the record).
   */
  private resolveFarmNode(record: any, pathParts: string[]): any {
    if (pathParts.length === 1) {
      // ownerPath === 'userId' → the record IS the farm.
      return record;
    }
    let node: any = record;
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (node) node = node[pathParts[i]];
    }
    return node;
  }
}
