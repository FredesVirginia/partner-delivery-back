import { IsNotEmpty, IsString } from 'class-validator';

export class CreateOrderDto {
    @IsNotEmpty()
    @IsString()
    clientName: string;
    
    @IsNotEmpty()
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
