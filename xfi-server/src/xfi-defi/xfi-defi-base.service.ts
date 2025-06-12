import { Injectable, Logger } from '@nestjs/common';
import { WalletService } from 'src/wallet/wallet.service';
import { HttpService } from '@nestjs/axios';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { console } from 'inspector';

const USDC_ADDRESS_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

@Injectable()
export class XfiDefiBaseService {
  private readonly logger = new Logger(XfiDefiBaseService.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly walletService: WalletService,
    @InjectModel(Transaction.name)
    readonly transactionModel: Model<Transaction>,
  ) {}

  async sendEth(
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
        process.env.BASE_RPC_URL,
      );

      this.logger.log(balance);

      if (balance < Number(amount)) {
        return 'Insufficient balance.';
      }

      const txn = await this.walletService.transferEth(
        privateKey,
        reciever,
        parseFloat(amount),
        process.env.BASE_RPC_URL,
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
        return `https://basescan.org/tx/${receipt.transactionHash}`;
      }
      return;
    } catch (error) {
      console.log(error);
      this.logger.log(error);
      return `error sending token`;
    }
  }

  async sendEthSmartAccount(
    privateKey: string,
    amount: string,
    reciever: string,
    data: Partial<Transaction>,
  ) {
    try {
      const { address } =
        await this.walletService.getEvmAddressFromPrivateKey(privateKey);

      const { balance } = await this.walletService.getNativeEthBalance(
        String(address),
        process.env.BASE_RPC_URL,
      );

      if (balance < Number(amount)) {
        return 'Insufficient balance.';
      }

      const txn = await this.walletService.transferEth(
        privateKey,
        reciever,
        parseFloat(amount),
        process.env.SOLANA_RPC,
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
        return `https://basescan.org/tx/${receipt.transactionHash}`;
      }
      return;
    } catch (error) {
      this.logger.log(error);
      return `error sending token`;
    }
  }

  async sendERC20(
    privateKey: string,
    token: string,
    amount: string,
    reciever: string,
    data: Partial<Transaction>,
  ) {
    try {
      const { address } =
        await this.walletService.getEvmAddressFromPrivateKey(privateKey);

      console.log(address);

      const { balance } = await this.walletService.getERC20Balance(
        String(address),
        USDC_ADDRESS_BASE,
        process.env.BASE_RPC_URL,
      );
      console.log(balance);

      if (balance < Number(amount)) {
        return 'Insufficient balance.';
      }

      const response = await this.walletService.transferERC20(
        privateKey,
        reciever,
        USDC_ADDRESS_BASE,
        parseFloat(amount),
        process.env.BASE_RPC_URL,
      );

      if (response.signature) {
        try {
          await new this.transactionModel({
            ...data,
            txHash: response.signature,
          }).save();
        } catch (err) {
          console.error('Failed to save transaction:', err.message);
        }
        return `https://basescan.org/tx/${response.signature}`;
      }
      return;
    } catch (error) {
      this.logger.log(error);
      console.log(error);
      return `error sending token`;
    }
  }
}
