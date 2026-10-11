import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

// Champs communs à la création et à la modification, tous facultatifs. Les longueurs
// maximales reprennent celles des colonnes de la table `boutiques`. `null` est accepté
// pour vider un champ (téléphone ou e-mail supprimé depuis le formulaire admin).
export class BoutiqueFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ville?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  adresse?: string | null;

  // Affiché sur la page d'accueil publique (bouton « Appeler »).
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[\d\s.()-]+$/, { message: 'telephone ne doit contenir que des chiffres, espaces, +, ., (, ) ou -' })
  telephone?: string | null;

  // Affiché sur la page d'accueil publique (bouton « Écrire un e-mail »).
  @IsOptional()
  @IsEmail({}, { message: 'email_contact doit être une adresse e-mail valide' })
  @MaxLength(100)
  email_contact?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;
}

export class CreateBoutiqueDto extends BoutiqueFieldsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom!: string;
}
