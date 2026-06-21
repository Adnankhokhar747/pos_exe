import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { Invoice } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
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
