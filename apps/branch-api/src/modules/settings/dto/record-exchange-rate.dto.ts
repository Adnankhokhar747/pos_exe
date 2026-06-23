import { IsNumberString } from 'class-validator';

export class RecordExchangeRateDto {
  @IsNumberString()
  rateToBase!: string;
}
