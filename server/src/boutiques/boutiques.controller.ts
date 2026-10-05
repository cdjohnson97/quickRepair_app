import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { BoutiquesService } from './boutiques.service.js';
import { CreateBoutiqueDto } from './dto/create-boutique.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('boutiques')
export class BoutiquesController {
  constructor(private boutiquesService: BoutiquesService) {}

  @Get()
  findAll() {
    return this.boutiquesService.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles('Administrateur')
  @Post()
  create(@Body() dto: CreateBoutiqueDto) {
    return this.boutiquesService.create(dto);
  }
}
