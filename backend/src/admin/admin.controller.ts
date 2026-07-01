import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApproveUserDto } from './admin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('approve-user')
  async approveUser(@Body() dto: ApproveUserDto, @CurrentUser() user: { sub: string }) {
    return this.adminService.approveUser(dto.user_id, user.sub);
  }

  @Post('reject-user')
  async rejectUser(@Body() dto: ApproveUserDto) {
    return this.adminService.rejectUser(dto.user_id);
  }

  @Get('pending-approvals')
  async getPendingApprovals() {
    return this.adminService.getPendingApprovals();
  }

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }
}
