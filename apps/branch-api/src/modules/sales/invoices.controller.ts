import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Invoice } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { HoldInvoiceDto } from './dto/hold-invoice.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { CreateReturnDto } from './dto/create-return.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('api/v1/invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
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

  @Post('hold')
  @RequirePermission('pos.sale.create')
  hold(@CurrentUser() user: AuthenticatedUser, @Body() dto: HoldInvoiceDto): Promise<Invoice> {
    return this.invoicesService.holdInvoice(dto.branchId, user.userId, dto);
  }

  @Get('held')
  listHeld(@Query('branchId') branchId: string) {
    return this.invoicesService.listHeld(branchId);
  }

  @Post(':id/resume')
  @RequirePermission('pos.sale.create')
  resume(@Param('id') id: string) {
    return this.invoicesService.resumeInvoice(id);
  }

  @Post(':id/void')
  @RequirePermission('pos.sale.void')
  voidInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: VoidInvoiceDto): Promise<Invoice> {
    return this.invoicesService.voidInvoice(id, user.userId, dto.reason);
  }

  @Post(':id/returns')
  @RequirePermission('invoice.return.partial')
  createReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateReturnDto,
  ) {
    return this.prisma.invoice.findUniqueOrThrow({ where: { id } }).then((original) =>
      this.invoicesService.createReturn(original.branchId, user.userId, id, dto),
    );
  }

  @Get()
  list(@Query('branchId') branchId: string, @Query('status') status?: string) {
    return this.prisma.invoice.findMany({
      where: { branchId, ...(status ? { status: status as never } : { status: { not: 'held' } }) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get(':id')
  async getInvoice(@Param('id') id: string): Promise<Invoice & { lines: unknown[]; payments: unknown[] }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lines: { include: { product: true } }, payments: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found.`);
    return invoice;
  }
}
