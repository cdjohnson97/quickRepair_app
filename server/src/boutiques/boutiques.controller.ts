import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { BoutiquesService } from './boutiques.service.js';
import { CreateBoutiqueDto } from './dto/create-boutique.dto.js';
import { UpdateBoutiqueDto } from './dto/update-boutique.dto.js';

@Controller('boutiques')
export class BoutiquesController {
  constructor(private boutiquesService: BoutiquesService) {}

  // Public — page d'accueil client (liste des boutiques, carte, contact), sans session.
  @Get('public')
  findPublic() {
    return this.boutiquesService.findPublic();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.boutiquesService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  @Post()
  create(@Body() dto: CreateBoutiqueDto) {
    return this.boutiquesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBoutiqueDto) {
    return this.boutiquesService.update(id, dto);
  }
}
