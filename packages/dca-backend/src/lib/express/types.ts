import { z } from 'zod';

import { ScheduleIdentitySchema, ScheduleParamsSchema, OrderEventSchema } from './schema';

export type ScheduleParams = z.infer<typeof ScheduleParamsSchema>;

export type ScheduleIdentity = z.infer<typeof ScheduleIdentitySchema>;

export type OrderEvent = z.infer<typeof OrderEventSchema>;
