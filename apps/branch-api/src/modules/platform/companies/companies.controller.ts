import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CompaniesService, CompanySummary } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { PlatformAuthGuard } from '../auth/platform-auth.guard';

@Controller('api/v1/platform/companies')
@UseGuards(PlatformAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  list(): Promise<CompanySummary[]> {
    return this.companiesService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<CompanySummary> {
    return this.companiesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto): Promise<CompanySummary> {
    return this.companiesService.create(dto);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string): Promise<CompanySummary> {
    return this.companiesService.activate(id);
  }

  @Patch(':id/suspend')
  suspend(@Param('id') id: string): Promise<CompanySummary> {
    return this.companiesService.suspend(id);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string): Promise<void> {
    return this.companiesService.delete(id);
  }

  @Post(':id/subscription/renew')
  renewSubscription(@Param('id') id: string, @Body() dto: RenewSubscriptionDto): Promise<CompanySummary> {
    return this.companiesService.renewSubscription(id, dto);
  }

  @Patch(':id/subscription/plan')
  changePlan(@Param('id') id: string, @Body() dto: ChangePlanDto): Promise<CompanySummary> {
    return this.companiesService.changePlan(id, dto);
  }
}
