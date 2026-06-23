import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumberString, IsString, ValidateNested } from 'class-validator';

export class BundleComponentDto {
  @IsString()
  componentProductId!: string;

  @IsNumberString()
  quantity!: string;
}

export class SetBundleComponentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BundleComponentDto)
  components!: BundleComponentDto[];
}
