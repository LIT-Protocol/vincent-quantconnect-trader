import { Job } from '@whisthub/agenda';
import consola from 'consola';
import { ethers } from 'ethers';

import { getAssetPriceUsd } from './assetPriceLoader';
import { getErc20Info, getEstimatedGasForApproval, getEstimatedUniswapCosts } from './utils';
import { getERC20Contract, getExistingUniswapAllowance } from './utils/get-erc20-info';
import { getErc20ApprovalToolClient, getUniswapToolClient } from './vincentTools';
import { env } from '../../../env';
import { PurchasedCoin } from '../../../mongo/models/PurchasedCoin';

export type JobType = Job<JobParams>;
export type JobParams = {
  direction: number;
  name: string;
  quantity: number;
  tokenContractAddress: string;
  updatedAt: Date;
  vincentAppVersion: number;
  walletAddress: string;
};

const { BASE_RPC_URL } = env;

const BASE_CHAIN_ID = '8453';

const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function addApproval({
  baseProvider,
  fromTokenAmount,
  nativeEthBalance,
  tokenContractAddress,
  tokenDecimals,
  walletAddress,
}: {
  baseProvider: ethers.providers.StaticJsonRpcProvider;
  fromTokenAmount: number;
  nativeEthBalance: ethers.BigNumber;
  tokenContractAddress: string;
  tokenDecimals: number;
  walletAddress: string;
}): Promise<ethers.BigNumber> {
  const approvalGasCost = await getEstimatedGasForApproval(
    baseProvider,
    BASE_CHAIN_ID,
    tokenContractAddress,
    (fromTokenAmount * 5).toFixed(tokenDecimals),
    tokenDecimals.toString(),
    walletAddress
  );

  const requiredApprovalGasCost = approvalGasCost.estimatedGas.mul(approvalGasCost.maxFeePerGas);

  consola.log('requiredApprovalGasCost', requiredApprovalGasCost);

  if (nativeEthBalance.lt(requiredApprovalGasCost)) {
    throw new Error(
      `Not enough ETH to pay for gas for token approval - balance is ${nativeEthBalance.toString()}, needed ${requiredApprovalGasCost.toString()}`
    );
  }

  const erc20ApprovalToolClient = getErc20ApprovalToolClient({ vincentAppVersion: 11 });
  const toolExecutionResult = await erc20ApprovalToolClient.execute({
    amountIn: (fromTokenAmount * 5).toFixed(tokenDecimals).toString(), // Approve 5x the amount to spend so we don't wait for approval tx's every time we run
    chainId: BASE_CHAIN_ID,
    pkpEthAddress: walletAddress,
    rpcUrl: BASE_RPC_URL,
    tokenIn: tokenContractAddress,
  });

  consola.trace('ERC20 Approval Vincent Tool Response:', toolExecutionResult);
  consola.log('Logs from approval tool exec:', toolExecutionResult.logs);

  const approvalResult = JSON.parse(toolExecutionResult.response as string);
  if (approvalResult.status === 'success' && approvalResult.approvalTxHash) {
    consola.log('Approval successful. Waiting for transaction confirmation...');

    const receipt = await baseProvider.waitForTransaction(approvalResult.approvalTxHash);

    if (receipt.status === 1) {
      consola.log('Approval transaction confirmed:', approvalResult.approvalTxHash);
    } else {
      consola.error('Approval transaction failed:', approvalResult.approvalTxHash);
      throw new Error(`Approval transaction failed for hash: ${approvalResult.approvalTxHash}`);
    }
  } else {
    consola.log('Approval action failed');
    throw new Error(JSON.stringify(approvalResult, null, 2));
  }

  return approvalGasCost.estimatedGas.mul(approvalGasCost.maxFeePerGas);
}

async function handleSwapExecution({
  approvalGasCost,
  baseProvider,
  fromTokenAmount,
  fromTokenContractAddress,
  fromTokenDecimals,
  nativeEthBalance,
  tokenOutInfo,
  toTokenContractAddress,
  walletAddress,
}: {
  approvalGasCost: ethers.BigNumber;
  baseProvider: ethers.providers.StaticJsonRpcProvider;
  fromTokenAmount: number;
  fromTokenContractAddress: string;
  fromTokenDecimals: number;
  nativeEthBalance: ethers.BigNumber;
  toTokenContractAddress: string;
  tokenOutInfo: { decimals: ethers.BigNumber };
  walletAddress: string;
}): Promise<void> {
  const { gasCost, swapCost } = await getEstimatedUniswapCosts({
    amountIn: fromTokenAmount.toFixed(fromTokenDecimals).toString(),
    pkpEthAddress: walletAddress,
    tokenInAddress: fromTokenContractAddress,
    tokenInDecimals: ethers.BigNumber.from(fromTokenDecimals),
    tokenOutAddress: toTokenContractAddress,
    tokenOutDecimals: tokenOutInfo.decimals,
    userChainId: BASE_CHAIN_ID,
    userRpcProvider: baseProvider,
  });

  consola.log('swapCost', swapCost);

  const requiredSwapGasCost = gasCost.estimatedGas.mul(gasCost.maxFeePerGas);
  if (!nativeEthBalance.sub(approvalGasCost).gte(requiredSwapGasCost)) {
    throw new Error(
      `Not enough ETH to pay for gas for swap - balance is ${nativeEthBalance.toString()}, needed ${requiredSwapGasCost.toString()}`
    );
  }

  const uniswapToolClient = getUniswapToolClient({ vincentAppVersion: 11 });
  const uniswapSwapToolResponse = await uniswapToolClient.execute({
    amountIn: fromTokenAmount.toFixed(fromTokenDecimals).toString(),
    chainId: BASE_CHAIN_ID,
    pkpEthAddress: walletAddress,
    rpcUrl: BASE_RPC_URL,
    tokenIn: fromTokenContractAddress,
    tokenOut: toTokenContractAddress,
  });

  consola.trace('Swap Vincent Tool Response:', uniswapSwapToolResponse);
  consola.log('Logs from swap tool exec:', uniswapSwapToolResponse.logs);

  const swapResult = JSON.parse(uniswapSwapToolResponse.response as string);

  if (swapResult.status === 'success' && swapResult.swapTxHash) {
    consola.log('Swap successful. Waiting for transaction confirmation...');

    const receipt = await baseProvider.waitForTransaction(swapResult.swapTxHash);

    if (receipt.status === 1) {
      consola.log('Swap transaction confirmed:', swapResult.swapTxHash);
    } else {
      consola.error('Swap transaction failed:', swapResult.swapTxHash);
      throw new Error(`Swap transaction failed for hash: ${swapResult.swapTxHash}`);
    }
  } else {
    consola.log('Swap action failed', swapResult);
    throw new Error(JSON.stringify(swapResult, null, 2));
  }

  return swapResult.swapTxHash;
}

export async function executeDCASwap(job: JobType): Promise<void> {
  try {
    const {
      _id,
      data: { direction, quantity, tokenContractAddress, walletAddress },
    } = job.attrs;

    let fromTokenContractAddress;
    let toTokenContractAddress;
    let fromTokenAmount;
    if (direction === 0) {
      // it's a buy, so we swap USDC for the token
      fromTokenContractAddress = USDC_CONTRACT_ADDRESS;
      toTokenContractAddress = tokenContractAddress;

      // we need to calculate the swap amount.  if it's a buy, we swap USDC for the token, so we need to calculate the amount of USDC to spend
      // get the price of the asset in USD
      const toTokenPriceUsd = await getAssetPriceUsd(toTokenContractAddress);
      fromTokenAmount = quantity * toTokenPriceUsd;
    } else if (direction === 1) {
      // it's a sell, so we swap the token for USDC
      fromTokenContractAddress = tokenContractAddress;
      toTokenContractAddress = USDC_CONTRACT_ADDRESS;
      // we can just use the quantity if it's a sell.  but, quantconnect quantity comes in negative if it's a sell
      // so we need to make it positive
      fromTokenAmount = Math.abs(quantity);
    } else {
      throw new Error(`Invalid direction: ${direction}`);
    }

    const baseProvider = new ethers.providers.StaticJsonRpcProvider(BASE_RPC_URL);

    const fromTokenContract = getERC20Contract(fromTokenContractAddress, baseProvider);

    const [
      fromTokenName,
      fromTokenDecimals,
      fromTokenBalance,
      tokenOutInfo,
      assetPriceUsd,
      existingAllowance,
      nativeEthBalance,
    ] = await Promise.all([
      fromTokenContract.name(),
      fromTokenContract.decimals(),
      fromTokenContract.balanceOf(walletAddress),
      getErc20Info(baseProvider, toTokenContractAddress),
      getAssetPriceUsd(fromTokenContractAddress),
      getExistingUniswapAllowance(
        BASE_CHAIN_ID,
        getERC20Contract(fromTokenContractAddress, baseProvider),
        walletAddress
      ),
      baseProvider.getBalance(walletAddress),
    ]);

    if (!nativeEthBalance.gt(0)) {
      throw new Error(
        `No native eth balance on account ${walletAddress} - please fund this account with ETH to pay for gas`
      );
    }

    // from token balance is in wei / native token units, so we need to convert the amount to the same units
    consola.log('fromTokenBalance', fromTokenBalance);
    consola.log('fromTokenAmount', fromTokenAmount);
    consola.log('fromTokenDecimals', fromTokenDecimals);

    // if fromTokenAmount has more decimals than fromTokenDecimals, we need to truncate it, otherwise parseUnits will throw an error
    fromTokenAmount = parseFloat(fromTokenAmount.toFixed(fromTokenDecimals));

    if (
      fromTokenBalance.lt(ethers.utils.parseUnits(fromTokenAmount.toString(), fromTokenDecimals))
    ) {
      throw new Error(
        `The ${fromTokenContractAddress} balance for account ${walletAddress} is insufficient to complete the swap - please fund this account with ${fromTokenAmount} ${fromTokenContractAddress} to swap`
      );
    }

    consola.log('Job details', {
      assetPriceUsd,
      fromTokenAmount,
      fromTokenContractAddress,
      fromTokenName,
      toTokenContractAddress,
      walletAddress,
      existingAllowance: existingAllowance.toString(),
      fromTokenBalance: fromTokenBalance.toString(),
      nativeEthBalance: nativeEthBalance.toString(),
      toTokenName: tokenOutInfo.name,
    });

    const needsApproval = existingAllowance.lt(fromTokenAmount);

    let approvalGasCost = ethers.BigNumber.from(0);

    if (needsApproval) {
      approvalGasCost = await addApproval({
        baseProvider,
        fromTokenAmount,
        nativeEthBalance,
        walletAddress,
        tokenContractAddress: fromTokenContractAddress,
        tokenDecimals: fromTokenDecimals,
      });
    }

    const swapHash = await handleSwapExecution({
      approvalGasCost,
      baseProvider,
      fromTokenAmount,
      fromTokenContractAddress,
      fromTokenDecimals,
      nativeEthBalance,
      tokenOutInfo,
      toTokenContractAddress,
      walletAddress,
    });
    // Create a purchase record with all required fields
    const purchase = new PurchasedCoin({
      walletAddress,
      coinAddress: toTokenContractAddress,
      name: tokenOutInfo.name,
      purchaseAmount: fromTokenAmount,
      purchasePrice: assetPriceUsd,
      scheduleId: _id,
      success: true,
      symbol: tokenOutInfo.name,
      txHash: swapHash,
    });
    await purchase.save();

    consola.debug(
      `Successfully created purchase record for ${toTokenContractAddress} with tx hash ${swapHash}`
    );
  } catch (e) {
    // Catch-and-rethrow is usually an anti-pattern, but Agenda doesn't log failed job reasons to console
    // so this is our chance to log the job failure details using Consola before we throw the error
    // to Agenda, which will write the failure reason to the Agenda job document in Mongo
    const err = e as Error;
    consola.error(err.message, err.stack);
    throw e;
  }
}
