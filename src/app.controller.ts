import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { accessPublic } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @accessPublic()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
