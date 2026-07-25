import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { currentUser } from '../auth/decorators/current-user.decorator';
import { accessPublic } from '../auth/decorators/public.decorator';
import { User } from '../users/entity/user.entity';
import { SubscribeDto, UnsubscribeDto } from './dtos/push-subscription.dto';
import { PushService } from './push.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly pushService: PushService) {}

  @accessPublic()
  @Get('vapid-public-key')
  getPublicKey(): { publicKey: string | null } {
    return { publicKey: this.pushService.getPublicKey() };
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  subscribe(
    @Body() dto: SubscribeDto,
    @currentUser() user: User,
  ): Promise<{ id: string }> {
    return this.pushService.subscribe(user.id, dto);
  }

  @Delete('subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(
    @Body() dto: UnsubscribeDto,
    @currentUser() user: User,
  ): Promise<void> {
    await this.pushService.unsubscribe(user.id, dto.endpoint);
  }


  //TODO FUNCION A INTEGRAR (DUDU)
  @Post('test')
  @HttpCode(HttpStatus.OK)
  sendTest(
    @currentUser() user: User,
  ): Promise<{ enabled: boolean; devices: number }> {
    return this.pushService.sendTest(user.id);
  }

}
