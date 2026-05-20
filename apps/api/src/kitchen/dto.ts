import { IsString, IsIn } from 'class-validator';

export type KitchenOrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered';

export class TransitionDto {
  @IsString()
  @IsIn(['pending', 'preparing', 'ready', 'delivered'])
  status: KitchenOrderStatus;
}
