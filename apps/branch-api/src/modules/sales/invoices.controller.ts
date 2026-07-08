import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Invoice } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { HoldInvoiceDto } from './dto/hold-invoice.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { CreateReturnDto } from './dto/create-return.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('api/v1/invoices')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @RequirePermission('pos.sale.create')
  createInvoice(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto): Promise<Invoice> {
    return this.invoicesService.createInvoice(user.tenantId, user.userId, dto);
  }

  // Every method below used to trust a client-supplied branchId/invoice id with
  // no check that it actually belongs to the caller's own tenant — a Company
  // Admin (or even a Cashier) from one company could read, hold-against,
  // resume-delete, or void another company's invoices just by knowing or
  // guessing an id. Each is now scoped through the branch's tenantId.
  private async assertBranchInTenant(tenantId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new NotFoundException(`Branch ${branchId} not found.`);
  }

  @Post('hold')
  @RequirePermission('pos.sale.create')
  async hold(@CurrentUser() user: AuthenticatedUser, @Body() dto: HoldInvoiceDto): Promise<Invoice> {
    await this.assertBranchInTenant(user.tenantId, dto.branchId);
    return this.invoicesService.holdInvoice(dto.branchId, user.userId, dto);
  }

  @Get('held')
  async listHeld(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {
    await this.assertBranchInTenant(user.tenantId, branchId);
    return this.invoicesService.listHeld(branchId);
  }

  @Post(':id/resume')
  @RequirePermission('pos.sale.create')
  resume(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoicesService.resumeInvoice(user.tenantId, id);
  }

  @Post(':id/void')
  @RequirePermission('pos.sale.void')
  voidInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: VoidInvoiceDto): Promise<Invoice> {
    return this.invoicesService.voidInvoice(user.tenantId, id, user.userId, dto.reason);
  }

  @Post(':id/returns')
  @RequirePermission('invoice.return.partial')
  async createReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateReturnDto,
  ) {
    const original = await this.prisma.invoice.findFirst({ where: { id, branch: { tenantId: user.tenantId } } });
    if (!original) throw new NotFoundException(`Invoice ${id} not found.`);
    return this.invoicesService.createReturn(original.branchId, user.userId, id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string, @Query('status') status?: string) {
    return this.prisma.invoice.findMany({
      where: {
        branchId,
        branch: { tenantId: user.tenantId },
        ...(status ? { status: status as never } : { status: { not: 'held' } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get(':id')
  async getInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<Invoice & { lines: unknown[]; payments: unknown[]; customer: unknown }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, branch: { tenantId: user.tenantId } },
      include: { lines: { include: { product: true } }, payments: true, customer: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found.`);
    return invoice;
  }
}
