import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { IdentityModule } from '../identity/identity.module';
import { LicensingModule } from '../licensing/licensing.module';

@Module({
  imports: [IdentityModule, LicensingModule],
  controllers: [UsersController, RolesController],
  providers: [UsersService, RolesService],
})
export class UsersModule {}
