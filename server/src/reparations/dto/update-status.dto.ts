import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateStatusDto {
  @IsInt()
  idStatut!: number;

  @IsOptional()
  @IsString()
  commentaire?: string;
}
