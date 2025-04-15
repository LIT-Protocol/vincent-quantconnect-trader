import { Response, Request } from 'express';

import { serviceLogger } from '../logger';
// import { PurchasedCoin } from '../mongo/models/PurchasedCoin';

// import type { ExpressAuthHelpers } from '@lit-protocol/vincent-sdk';

export const handleTradeRoute = async (req: Request, res: Response) => {
  // just log the request
  serviceLogger.debug(req.body);

  res.json({ success: true });
};
