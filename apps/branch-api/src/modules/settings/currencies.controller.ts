import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Currency, ExchangeRate } from '@prisma/client';
import { CurrenciesService } from './currencies.service';
import { UpsertCurrencyDto } from './dto/upsert-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { RecordExchangeRateDto } from './dto/record-exchange-rate.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { LicenseGuard } from '../licensing/license.guard';
import { RequirePermission } from '../../common/auth/require-permission.decorator';

@Controller('api/v1/currencies')
@UseGuards(JwtAuthGuard, LicenseGuard, PermissionsGuard)
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  list(): Promise<Currency[]> {
    return this.currenciesService.list();
  }

  @Post()
  @RequirePermission('settings.write')
  upsert(@Body() dto: UpsertCurrencyDto): Promise<Currency> {
    return this.currenciesService.upsert(dto);
  }

  @Get(':code/exchange-rates')
  listExchangeRates(@Param('code') code: string): Promise<ExchangeRate[]> {
    return this.currenciesService.listExchangeRates(code);
  }

  @Post(':code/exchange-rates')
  @RequirePermission('settings.write')
  recordExchangeRate(@Param('code') code: string, @Body() dto: RecordExchangeRateDto): Promise<ExchangeRate> {
    return this.currenciesService.recordExchangeRate(code, dto.rateToBase);
  }

  @Get(':code')
  async findOne(@Param('code') code: string): Promise<Currency> {
    const currency = await this.currenciesService.findOne(code);
    if (!currency) throw new NotFoundException(`Currency ${code} not found.`);
    return currency;
  }

  @Patch(':code')
  @RequirePermission('settings.write')
  async update(@Param('code') code: string, @Body() dto: UpdateCurrencyDto): Promise<Currency> {
    const currency = await this.currenciesService.findOne(code);
    if (!currency) throw new NotFoundException(`Currency ${code} not found.`);
    return this.currenciesService.update(code, dto);
  }

  @Delete(':code')
  @RequirePermission('settings.write')
  async remove(@Param('code') code: string): Promise<Currency> {
    const currency = await this.currenciesService.findOne(code);
    if (!currency) throw new NotFoundException(`Currency ${code} not found.`);
    return this.currenciesService.remove(code);
  }
}
