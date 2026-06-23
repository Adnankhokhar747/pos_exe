import { IsNumberString } from 'class-validator';

export class ReloadGiftCardDto {
  @IsNumberString()
  amount!: string;
}
