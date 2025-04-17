import { Types } from 'mongoose';
import { z } from 'zod';

export const ScheduleParamsSchema = z.object({
  direction: z.number().refine((val) => val === 0 || val === 1, {
    message: 'Invalid direction',
  }),
  name: z.string().default('QCTrader'),
  quantity: z.number(),
  tokenContractAddress: z.string().refine((val) => /^0x[a-fA-F0-9]{40}$/.test(val), {
    message: 'Invalid Ethereum contract address',
  }),
  walletAddress: z.string().refine((val) => /^0x[a-fA-F0-9]{40}$/.test(val), {
    message: 'Invalid Ethereum wallet address',
  }),
});
export const ScheduleIdentitySchema = z.object({
  scheduleId: z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), { message: 'Invalid ObjectId' }),
});

export const OrderEventSchema = z.object({
  Direction: z.number(),
  FillPrice: z.number(),
  FillPriceCurrency: z.string(),
  FillQuantity: z.number(),
  Id: z.number(),
  IsAssignment: z.boolean(),
  OrderFee: z.object({
    Value: z.object({
      Amount: z.number(),
      Currency: z.string(),
    }),
  }),
  OrderId: z.number(),
  Quantity: z.number(),
  Status: z.number(),
  Symbol: z.object({
    id: z.string(),
    permtick: z.string(),
    value: z.string(),
  }),
  UtcTime: z.string(),
});
