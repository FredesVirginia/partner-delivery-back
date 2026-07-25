import { OrderService } from './order.service';
import { WhatsappService } from '../chat/whatsapp.service';
import { CreateOrderDto } from './dtos/order.dto';
import { currentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entity/user.entity';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Patch,
} from '@nestjs/common';
import { ListMessagesDto } from './dtos/list-messages.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { ListOrdersDto } from './dtos/list-orders.dto';
import { CreateMessageDto } from './dtos/create-message.dto';

@Controller('orders') //Esto hace que todos los endpoits empiecen con orders
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @currentUser() user: User,
  ) {
    const order = await this.orderService.create(createOrderDto, user.id);
    await this.whatsappService.notifyNewOrder(order); // Avisamos a la operadora
    return order;
  }

  @Get('/inbox/admin')
  @Roles(UserRole.ADMIN)
  findInbox(@Query() query: ListOrdersDto) {
    return this.orderService.listInboxAdmin(query);
  }

  @Get('my')
  findMyOrders(@currentUser() user: User) {
    return this.orderService.findMyOrders(user.id);
  }

  @Get(':id')
  findOnePriceAndLinkPaymente(
    @Param('id', ParseIntPipe) id: number,
    @currentUser() user: User,
  ) {
    return this.orderService.findForUser(id, user);
  }

  @Get(':id/history-messages')
  historyMessages(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ListMessagesDto,
    @currentUser() user: User,
  ) {
    return this.orderService.historyMessages(id, user, query);
  }

  @Post(':id/write/messages')
  @HttpCode(HttpStatus.CREATED)
  sendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMessageDto,
    @currentUser() user: User,
  ) {
    return this.orderService.sendMessage(id, user, dto);
  }

  @Patch(':id/messages/read')
  @HttpCode(HttpStatus.OK)
  markMessagesAsRead(
    @Param('id', ParseIntPipe) id: number,
    @currentUser() user: User,
  ) {
    return this.orderService.markMessagesAsRead(id, user);
  }
}
