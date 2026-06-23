import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Branch } from '@prisma/client';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

@Controller('api/v1/branches')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<Branch[]> {
    return this.branchesService.list(user.tenantId);
  }

  @Post()
  @RequirePermission('settings.write')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBranchDto): Promise<Branch> {
    return this.branchesService.create(user.tenantId, dto);
  }
}
