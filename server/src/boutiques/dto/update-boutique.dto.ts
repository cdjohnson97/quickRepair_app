import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { BoutiqueFieldsDto } from './create-boutique.dto.js';

// Modification partielle : seuls les champs envoyés sont mis à jour. Le nom peut être
// omis, mais pas vidé.
export class UpdateBoutiqueDto extends BoutiqueFieldsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom?: string;
}
