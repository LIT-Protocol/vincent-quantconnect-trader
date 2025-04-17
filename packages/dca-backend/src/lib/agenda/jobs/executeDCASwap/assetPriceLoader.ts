import consola from 'consola';
import DataLoader from 'dataloader';
import Cache from 'node-cache';

import { wrapNodeCacheForDataloader } from './dataLoaderCache';
import { env } from '../../../env';

const { COINRANKING_API_KEY } = env;

const logger = consola.withTag('AssetPriceLoader');

const cache = new Cache({ checkperiod: 0, stdTTL: 1, useClones: false });

const contractAddressToCoinrankingUUIDMap: Record<string, string> = {
  // AXLUSD
  '0x23ee2343B892b1BB63503a4FAbc840E0e2C6810f': 'tpnGd1xa_q',

  // COMPUSD
  '0x9e1028F5F1D5eDE59748FFceE5532509976840E0': '7Dg6y_Ywg',

  // SNXUSD
  '0x22e6966B799c4D5B13BE962E1D117b56327FDa66': 'sgxZRXbK0FDc',

  // AAVEUSD
  '0x63706e401c06ac8513145b7687A14804d17f814b': 'ixgUfzmLR',

  // XCNUSD
  '0x9c632E6Aaa3eA73f91554f8A3cB2ED2F29605e0C': 'RMI3WkSpS',

  // AEROUSD
  '0x940181a94A35A4569E4529A3CDfB74e38FD98631': 'cbh_u5L08',
  // LINKUSD
  '0xd403D1624DAEF243FbcBd4A80d8A6F36afFe32b2': 'VLqpJwogdhHNb',
};

export function assertCoinRankingPriceData(
  data: unknown
): asserts data is { data: { price: string } } {
  // Check if data is an object
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response: Expected an object');
  }

  // Check if the data property exists and is an object
  const dataObj = data as Record<string, unknown>;
  if (!dataObj.data || typeof dataObj.data !== 'object' || dataObj.data === null) {
    throw new Error('Invalid response: Missing or invalid "data" property');
  }

  // Check if the usd property exists and is a number
  const innerDataObj = dataObj.data as Record<string, unknown>;
  if (typeof innerDataObj.price !== 'string') {
    throw new Error('Invalid response: Missing or invalid "data.price" property');
  }
}

async function batchLoadFn(keys: readonly string[]): Promise<ArrayLike<number | Error>> {
  return Promise.all(
    keys.map(async (key) => {
      const url = new URL(
        `https://api.coinranking.com/v2/coin/${contractAddressToCoinrankingUUIDMap[key]}/price`
      );
      url.searchParams.append('blockchains[]', 'base');
      url.searchParams.append('tags[]', 'meme');

      logger.info(`Fetching top coins from CoinRanking API: ${url.toString()}`);
      const response = await fetch(url, {
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'x-access-token': COINRANKING_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      assertCoinRankingPriceData(data);

      return parseFloat(data.data.price);
    })
  );
}

const loader = new DataLoader(batchLoadFn, {
  cacheMap: wrapNodeCacheForDataloader<number>(cache),
});

export const getAssetPriceUsd = async (contractAddress: string): Promise<number> => {
  const val = await loader.load(contractAddress);

  if (!val || typeof val !== 'number') {
    throw new Error('Invalid response: Missing or invalid "ethereum.usd" property');
  }

  return val;
};
