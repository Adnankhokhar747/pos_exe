import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Customer, CustomerLedgerEntry } from '@prisma/client';
import { IsNumberString } from 'class-validator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';

class RecordPaymentDto {
  @IsNumberString()
  amount!: string;
}

@Controller('api/v1/customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('search') search?: string): Promise<Customer[]> {
    return this.customersService.list(user.tenantId, search);
  }

  @Post()
  @RequirePermission('customer.write')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomerDto): Promise<Customer> {
    return this.customersService.create(user.tenantId, dto);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Customer> {
    const customer = await this.customersService.findOne(user.tenantId, id);
    if (!customer) throw new NotFoundException(`Customer ${id} not found.`);
    return customer;
  }

  @Get(':id/ledger')
  getLedger(@Param('id') id: string): Promise<CustomerLedgerEntry[]> {
    return this.customersService.getLedger(id);
  }

  @Post(':id/payments')
  @RequirePermission('customer.write')
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<Customer> {
    return this.customersService.recordPayment(user.tenantId, id, dto.amount);
  }
}
