import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlatformAuthGuard } from '../auth/platform-auth.guard';

@Controller('api/v1/platform/plans')
@UseGuards(PlatformAuthGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  list(): Promise<Plan[]> {
    return this.plansService.list();
  }

  @Post()
  create(@Body() dto: CreatePlanDto): Promise<Plan> {
    return this.plansService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto): Promise<Plan> {
    return this.plansService.update(id, dto);
  }
}
