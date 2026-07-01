import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, TaskFilterDto, CreateNoteDto } from './tasks.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post()
  async create(@Body() dto: CreateTaskDto, @CurrentUser() user: { sub: string }) {
    return this.tasksService.create(dto, user.sub);
  }

  @Get()
  async findAll(
    @Query() filters: TaskFilterDto,
    @CurrentUser() user: { sub: string; role: string },
  ) {
    return this.tasksService.findAll(filters, user.sub, user.role);
  }

  @Get('dashboard')
  async getDashboard(
    @CurrentUser() user: { sub: string; role: string },
  ) {
    return this.tasksService.getDashboardStats(user.sub, user.role);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tasksService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.tasksService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async delete(@Param('id') id: string) {
    return this.tasksService.delete(id);
  }

  @Get(':id/notes')
  async getNotes(@Param('id') id: string) {
    return this.tasksService.getNotes(id);
  }

  @Post(':id/notes')
  async addNote(
    @Param('id') id: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.tasksService.addNote(id, dto, user.sub);
  }

  @Get(':id/activities')
  async getActivities(@Param('id') id: string) {
    return this.tasksService.getActivities(id);
  }
}
