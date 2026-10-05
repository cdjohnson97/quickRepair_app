import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ReparationsService } from './reparations.service.js';
import { CreateReparationDto } from './dto/create-reparation.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';

@Controller('reparations')
export class ReparationsController {
  constructor(private reparationsService: ReparationsService) {}

  // Public — équivalent de ClientTracking.jsx (recherche par n° de suivi, sans session).
  @Get('track/:numeroSuivi')
  track(@Param('numeroSuivi') numeroSuivi: string) {
    return this.reparationsService.trackByNumero(numeroSuivi);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: any) {
    return this.reparationsService.findAll(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.reparationsService.findHistory(Number(id));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Responsable')
  @Post()
  create(@Body() dto: CreateReparationDto, @Req() req: any) {
    return this.reparationsService.create(dto, req.user.id_boutique);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Req() req: any) {
    return this.reparationsService.updateStatus(Number(id), dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Responsable')
  @Post(':id/invoice')
  createInvoice(@Param('id') id: string, @Body() dto: CreateInvoiceDto) {
    return this.reparationsService.createInvoice(Number(id), dto);
  }
}
