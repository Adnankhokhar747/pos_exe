import { Injectable } from '@nestjs/common';
import { Currency, ExchangeRate, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertCurrencyDto } from './dto/upsert-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { CurrencyInUseError } from '../../common/exceptions/domain-exception';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Currency[]> {
    return this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
  }

  findOne(code: string): Promise<Currency | null> {
    return this.prisma.currency.findUnique({ where: { code } });
  }

  upsert(dto: UpsertCurrencyDto): Promise<Currency> {
    return this.prisma.currency.upsert({
      where: { code: dto.code },
      update: { name: dto.name, symbol: dto.symbol, decimalPlaces: dto.decimalPlaces },
      create: {
        code: dto.code,
        name: dto.name,
        symbol: dto.symbol,
        decimalPlaces: dto.decimalPlaces ?? 2,
      },
    });
  }

  update(code: string, dto: UpdateCurrencyDto): Promise<Currency> {
    return this.prisma.currency.update({
      where: { code },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.symbol !== undefined ? { symbol: dto.symbol } : {}),
        ...(dto.decimalPlaces !== undefined ? { decimalPlaces: dto.decimalPlaces } : {}),
      },
    });
  }

  async remove(code: string): Promise<Currency> {
    const tenantUsingIt = await this.prisma.tenant.findFirst({ where: { baseCurrency: code } });
    if (tenantUsingIt) throw new CurrencyInUseError(`it is the base currency for tenant "${tenantUsingIt.name}"`);

    const exchangeRateCount = await this.prisma.exchangeRate.count({ where: { currencyCode: code } });
    if (exchangeRateCount > 0) throw new CurrencyInUseError(`${exchangeRateCount} exchange rate record(s) reference it`);

    return this.prisma.currency.delete({ where: { code } });
  }

  recordExchangeRate(currencyCode: string, rateToBase: string): Promise<ExchangeRate> {
    return this.prisma.exchangeRate.create({
      data: { currencyCode, rateToBase: new Prisma.Decimal(rateToBase) },
    });
  }

  listExchangeRates(currencyCode: string): Promise<ExchangeRate[]> {
    return this.prisma.exchangeRate.findMany({
      where: { currencyCode },
      orderBy: { effectiveAt: 'desc' },
      take: 100,
    });
  }

  // Used by InvoicesService to snapshot a rate onto an invoice at sale time —
  // the most recent rate as of "now" is the only one that makes sense to apply.
  latestRate(currencyCode: string): Promise<ExchangeRate | null> {
    return this.prisma.exchangeRate.findFirst({
      where: { currencyCode },
      orderBy: { effectiveAt: 'desc' },
    });
  }
}
