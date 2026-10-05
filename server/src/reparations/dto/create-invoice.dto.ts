import { IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsNumber()
  @IsPositive()
  montantTotal!: number;

  @IsString()
  modePaiement!: string;
}
