import { Injectable } from '@nestjs/common';
import { Currency, ExchangeRate, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertCurrencyDto } from './dto/upsert-currency.dto';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Currency[]> {
    return this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
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
