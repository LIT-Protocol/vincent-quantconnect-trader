import { Types } from 'mongoose';
import { z } from 'zod';

export const ScheduleParamsSchema = z.object({
  name: z.string().default('DCASwap'),
  purchaseAmount: z
    .string()
    .refine((val) => /^\d+(\.\d{1,2})?$/.test(val), {
      message: 'Must be a valid decimal number with up to 2 decimal places (USD currency)',
    })
    .transform((val) => parseFloat(val)),
  purchaseIntervalHuman: z.string(),
  tokenContractAddress: z.string(),
  walletAddress: z
    .string()
    .refine((val) => /^0x[a-fA-F0-9]{40}$/.test(val), { message: 'Invalid Ethereum address' }),
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
