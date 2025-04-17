/* eslint-disable no-console */

import { ethers } from 'ethers';

import { getAddressesByChainId } from './get-addresses-by-chain-id';

const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
];

export function getERC20Contract(address: string, provider: ethers.providers.JsonRpcProvider) {
  return new ethers.Contract(address, ERC20_ABI, provider);
}

export const getErc20Info = async (
  userRpcProvider: ethers.providers.StaticJsonRpcProvider,
  tokenAddress: string
): Promise<{ decimals: ethers.BigNumber; ethersContract: ethers.Contract; name: string }> => {
  const contractCode = await userRpcProvider.getCode(tokenAddress);
  if (contractCode === '0x') {
    throw new Error(`No contract code found at ${tokenAddress}`);
  }

  const ethersContract = getERC20Contract(tokenAddress, userRpcProvider);
  const decimals = await ethersContract.decimals();
  const name = await ethersContract.name();
  return {
    decimals,
    ethersContract,
    name,
  };
};

export async function getExistingUniswapAllowance(
  chainId: string,
  contract: ethers.Contract,
  userAddress: string
): Promise<ethers.BigNumber> {
  const { UNISWAP_V3_ROUTER } = getAddressesByChainId(chainId);

  const currentAllowance = await contract.allowance(userAddress, UNISWAP_V3_ROUTER);
  console.log(
    `Current router allowance for ${contract.address}: ${ethers.utils.formatEther(currentAllowance)}`
  );

  return currentAllowance;
}
