import { IsNotEmpty, IsString } from 'class-validator';

export class CreateOrderDto {
    @IsNotEmpty({message: "El nombre del cliente es obligatorio"})
    @IsString()
    clientName: string;
    
    @IsNotEmpty({message: "El teléfono del cliente es obligatorio"})
    @IsString()
    clientPhone: string;
    
    @IsNotEmpty()
    @IsString()
    originName: string;
    
    @IsNotEmpty()
    @IsString()
    originAddress: string;
    
    @IsNotEmpty()
    @IsString()
    destinationAddress: string;
    
    @IsNotEmpty()
    @IsString()
    details: string;

   
}
