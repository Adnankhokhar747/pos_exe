import { Injectable } from '@nestjs/common';
import { ReceiptSettings } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateReceiptSettingsDto } from './dto/update-receipt-settings.dto';

@Injectable()
export class ReceiptSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string): Promise<ReceiptSettings> {
    const existing = await this.prisma.receiptSettings.findUnique({ where: { tenantId } });
    if (existing) return existing;
    return this.prisma.receiptSettings.create({ data: { tenantId } });
  }

  async update(tenantId: string, dto: UpdateReceiptSettingsDto): Promise<ReceiptSettings> {
    await this.get(tenantId);
    return this.prisma.receiptSettings.update({
      where: { tenantId },
      data: {
        headerText: dto.headerText,
        footerText: dto.footerText,
        paperWidthMm: dto.paperWidthMm,
      },
    });
  }
}
