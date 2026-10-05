import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Port de ManagerDashboard.handleSubmit (web) : upsert client par email + création
// appareil + création reparation, en une seule requête côté client.
export class CreateReparationDto {
  @IsString()
  @IsNotEmpty()
  clientNom!: string;

  @IsString()
  @IsNotEmpty()
  clientPrenom!: string;

  @IsEmail()
  clientEmail!: string;

  @IsOptional()
  @IsString()
  clientTelephone?: string;

  @IsString()
  @IsNotEmpty()
  marque!: string;

  @IsString()
  @IsNotEmpty()
  modele!: string;

  @IsString()
  @IsNotEmpty()
  descriptionPanne!: string;

  @IsInt()
  idTechnicien!: number;
}
