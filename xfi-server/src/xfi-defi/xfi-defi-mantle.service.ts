import { Injectable, Logger } from '@nestjs/common';
import { WalletService } from 'src/wallet/wallet.service';
import { HttpService } from '@nestjs/axios';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { http } from 'viem';
import { createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mantle } from 'viem/chains';
import { getOnChainTools } from '@goat-sdk/adapter-vercel-ai';
import { viem } from '@goat-sdk/wallet-viem';

const USDT_ADDRESS_MANTLE = '0x201eba5cc46d216ce6dc03f6a759e8e766e956ae';
const USDC_ADDRESS_MANTLE = '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9';

@Injectable()
export class XfiDefiMantleService {
  private readonly logger = new Logger(XfiDefiMantleService.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly walletService: WalletService,
    @InjectModel(Transaction.name)
    readonly transactionModel: Model<Transaction>,
  ) {}

  async sendMNT(
    privateKey: string,
    amount: string,
    reciever: string,
    data: Partial<Transaction>,
  ) {
    try {
      const { address } =
        await this.walletService.getEvmAddressFromPrivateKey(privateKey);

      this.logger.log(address);

      const { balance } = await this.walletService.getNativeEthBalance(
        String(address),
        process.env.MANTLE_RPC,
      );

      this.logger.log(balance);

      if (balance < Number(amount)) {
        return 'Insufficient balance.';
      }

      const txn = await this.walletService.transferEth(
        privateKey,
        reciever,
        parseFloat(amount),
        process.env.MANTLE_RPC,
      );
      const receipt =
        txn?.wait && typeof txn.wait === 'function' ? await txn.wait() : txn;

      if (receipt.status === 1) {
        try {
          await new this.transactionModel({
            ...data,
            txHash: receipt.transactionHash,
          }).save();
        } catch (err) {
          console.error('Failed to save transaction:', err.message);
        }
        return `https://mantlescan.xyz/tx/${receipt.transactionHash}`;
      }
      return;
    } catch (error) {
      console.log(error);
      this.logger.log(error);
      return `error sending token`;
    }
  }

  async sendERC20(
    privateKey: string,
    token: string,
    amount: string,
    receiver: string,
    data: Partial<Transaction>,
  ) {
    try {
      this.logger.log(token);
      const tokenAddresses: Record<string, string> = {
        usdc: USDC_ADDRESS_MANTLE,
        usdt: USDT_ADDRESS_MANTLE,
      };

      const tokenAddress = tokenAddresses[token.toLowerCase()];
      if (!tokenAddress) return 'Unsupported token.';

      const { address } =
        await this.walletService.getEvmAddressFromPrivateKey(privateKey);

      this.logger.log('Sender Address:', address);

      const { balance } = await this.walletService.getERC20Balance(
        String(address),
        tokenAddress,
        process.env.MANTLE_RPC,
      );
      this.logger.log('Balance:', balance);

      if (balance < Number(amount)) {
        return 'Insufficient balance.';
      }

      const response = await this.walletService.transferERC20(
        privateKey,
        receiver,
        tokenAddress,
        parseFloat(amount),
        process.env.MANTLE_RPC,
      );

      if (response?.signature) {
        try {
          await new this.transactionModel({
            ...data,
            txHash: response.signature,
          }).save();
        } catch (err) {
          console.error('Failed to save transaction:', err.message);
        }
        return `https://mantlescan.xyz/tx/${response.signature}`;
      }

      return 'Transfer failed. No signature received.';
    } catch (error) {
      this.logger.log(error);
      console.error(error);
      return 'Error sending token.';
    }
  }
}
