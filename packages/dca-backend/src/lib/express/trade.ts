import { Response, Request } from 'express';

import { ScheduleParamsSchema } from './schema';
import { OrderEvent } from './types';
import { createImmediateJob } from '../agenda/jobs/dcaSwapJobManager';
import { serviceLogger } from '../logger';

// hardcode the user to me for now
const userPkpAddress = '0xE505ed7D2EEe0cadF386866F05809dF3d5d01687';

const symbolToContractAddressMap: Record<string, string> = {
  AAVEUSD: '0x63706e401c06ac8513145b7687A14804d17f814b',
  AEROUSD: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
  AXLUSD: '0x23ee2343B892b1BB63503a4FAbc840E0e2C6810f',
  COMPUSD: '0x9e1028F5F1D5eDE59748FFceE5532509976840E0',
  LINKUSD: '0xd403D1624DAEF243FbcBd4A80d8A6F36afFe32b2',
  SNXUSD: '0x22e6966B799c4D5B13BE962E1D117b56327FDa66',
  XCNUSD: '0x9c632E6Aaa3eA73f91554f8A3cB2ED2F29605e0C',
};

export const handleTradeRoute = async (req: Request, res: Response) => {
  // just log the request
  serviceLogger.debug(JSON.stringify(req.body, null, 2));

  // let's get the order events from the request body
  const { OrderEvents } = req.body;

  serviceLogger.debug(`There are ${OrderEvents.length} order events`);

  // loop over each order event, and use vincent to make the trade
  // each order event looks like this:
  /*
  {
    "OrderId": 105,
    "Id": 1,
    "Symbol": {
      "value": "ETHUSD",
      "id": "ETHUSD 2XR",
      "permtick": "ETHUSD"
    },
    "UtcTime": "2025-04-16T03:10:00.0475805Z",
    "Status": 1,
    "OrderFee": {
      "Value": {
        "Amount": 0,
        "Currency": "QCC"
      }
    },
    "FillPrice": 0,
    "FillPriceCurrency": "USD",
    "FillQuantity": 0,
    "Direction": 0,
    "IsAssignment": false,
    "Quantity": 0.00192381
  }
*/

  await Promise.all(
    OrderEvents.map(async (orderEvent: OrderEvent) => {
      const {
        Direction: direction,
        FillQuantity: quantity,
        OrderId,
        Status: status,
        Symbol,
      } = orderEvent;

      serviceLogger.debug(`Processing order ${JSON.stringify(orderEvent, null, 2)}`);

      const symbol = Symbol.value;
      // 0 = buy, 1 = sell

      const tokenContractAddress = symbolToContractAddressMap[symbol];

      serviceLogger.debug(`Token contract address for ${symbol} is ${tokenContractAddress}`);

      if (quantity === 0) {
        serviceLogger.debug(`Skipping order ${OrderId} for symbol ${symbol} with quantity 0`);
        return;
      }

      // status 2 = partially filled
      // status 3 = fully filled
      if (status !== 2 && status !== 3) {
        serviceLogger.debug(`Skipping order ${OrderId} for symbol ${symbol} with status ${status}`);
        return;
      }

      if (direction === 0) {
        // buy
        serviceLogger.debug(`Making buy order ${OrderId} for ${symbol} with quantity ${quantity}`);
        try {
          const scheduleParams = ScheduleParamsSchema.parse({
            tokenContractAddress,
            purchaseAmount: quantity.toString(),
            purchaseIntervalHuman: 'none',
            walletAddress: userPkpAddress,
          });

          const job = await createImmediateJob({ ...scheduleParams, vincentAppVersion: 11 });
          serviceLogger.debug(`Created job ${JSON.stringify(job, null, 2)} for order ${OrderId}`);
        } catch (err) {
          serviceLogger.error(`Error creating job: ${err}`);
        }
      } else if (direction === 1) {
        // sell
        serviceLogger.debug(
          `Not making sell order for ${OrderId} because we only support buys right now`
        );
      } else {
        serviceLogger.error(`Invalid direction ${direction} for order ${OrderId}`);
      }
    })
  );
  res.json({ success: true });
};
