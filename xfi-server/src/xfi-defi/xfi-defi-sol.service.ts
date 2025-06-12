import { Injectable } from '@nestjs/common';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';
import { firstValueFrom } from 'rxjs';
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import { WalletService } from 'src/wallet/wallet.service';
import { HttpService } from '@nestjs/axios';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Metaplex } from '@metaplex-foundation/js';

const USDC_ADDRESS_SOL = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_ADDRESS_SOL = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

@Injectable()
export class XfiDefiSolService {
  constructor(
    private readonly httpService: HttpService,
    private readonly walletService: WalletService,
    @InjectModel(Transaction.name)
    readonly transactionModel: Model<Transaction>,
  ) {}

  async botBuyToken(
    privateKey: string,
    tokenMint: string,
    amount: string,
    userId: string,
    originalCommand: string,
  ) {
    let swapResponse = null;
    const inputMint = 'So11111111111111111111111111111111111111112';

    try {
      console.log('buy token', privateKey, tokenMint, amount);
      const outputMint = tokenMint;
      const userAccount = Keypair.fromSecretKey(bs58.decode(privateKey));
      const userAddress = userAccount.publicKey;
      const connection = new Connection(process.env.SOLANA_RPC, {
        commitment: 'confirmed',
      });
      // Validate inputs
      if (!privateKey || !tokenMint || isNaN(parseFloat(amount))) {
        return 'Invalid input parameters';
      }

      // Fetch token details and balance concurrently
      const { balance } = await this.walletService.getSolBalance(
        String(userAddress),
        process.env.SOLANA_RPC,
      );

      if (balance < parseFloat(amount) || balance - parseFloat(amount) < 0.01) {
        return 'Insufficient balance.';
      }

      // Fetch swap quote and priority fee concurrently
      const [priorityFeeData, swapResp] = await Promise.all([
        firstValueFrom(
          this.httpService.get(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`),
        ),
        this.getSwapQuote(inputMint, outputMint, Number(amount) * 10 ** 9),
      ]);

      swapResponse = swapResp;

      // Create associated token accounts concurrently
      const [inputAccount, outputAccount] = await Promise.all([
        getOrCreateAssociatedTokenAccount(
          connection,
          userAccount,
          new PublicKey(inputMint),
          userAddress,
        ),
        getOrCreateAssociatedTokenAccount(
          connection,
          userAccount,
          new PublicKey(outputMint),
          userAddress,
        ),
      ]);
      console.log('fee  :', priorityFeeData.data);

      const swapUrl = `${API_URLS.SWAP_HOST}/transaction/swap-base-in`;
      const swapTrx = await firstValueFrom(
        this.httpService.post(swapUrl, {
          computeUnitPriceMicroLamports: String(
            priorityFeeData.data.data.high ||
              priorityFeeData.data.data.default.h * 2,
          ),
          swapResponse,
          txVersion: 'V0',
          wallet: userAddress,
          wrapSol: true,
          unwrapSol: false,
          inputAccount: inputAccount.address.toBase58(),
          outputAccount: outputAccount.address.toBase58(),
        }),
      );

      const txBuffer = Buffer.from(swapTrx.data.data[0].transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);

      // Send transaction
      const signature = await this.sendTransactionWithRetry(
        connection,
        transaction,
        userAccount,
      );

      // Verify status
      const statuses = await connection.getSignatureStatuses([signature]);
      const status = statuses.value[0];

      if (
        status &&
        (status.confirmationStatus === 'confirmed' ||
          status.confirmationStatus === 'finalized')
      ) {
        try {
          await new this.transactionModel({
            userId,
            transactionType: 'buy',
            chain: 'solana',
            amount: amount,
            token: {
              address: swapResponse.data.outputMint,
              tokenType: 'token',
            },
            txHash: signature,
            meta: {
              platform: 'twitter',
              originalCommand,
            },
          }).save();
        } catch (err) {
          console.error('Failed to save transaction:', err.message);
        }

        return `https://explorer.solana.com/tx/${signature}?cluster=mainnet`;
      } else {
        throw new Error('Transaction not confirmed');
      }
    } catch (error: any) {
      const regex = /(?:signature|Signature)\s+([1-9A-HJ-NP-Za-km-z]{87,88})/i;
      const match = error.message.match(regex);
      if (match) {
        const connection = new Connection(process.env.SOLANA_RPC, {
          commitment: 'confirmed',
        });
        const signature = match[1];
        const statuses = await connection.getSignatureStatuses([signature]);
        const status = statuses.value[0];
        if (
          status &&
          (status.confirmationStatus === 'confirmed' ||
            status.confirmationStatus === 'finalized')
        ) {
          try {
            await new this.transactionModel({
              userId,
              transactionType: 'buy',
              chain: 'solana',
              amount: amount,
              token: {
                address: swapResponse.data.outputMint,
                tokenType: 'token',
              },
              txHash: signature,
              meta: {
                platform: 'twitter',
                originalCommand,
              },
            }).save();
          } catch (err) {
            console.error('Failed to save transaction:', err.message);
          }
          return `https://explorer.solana.com/tx/${signature}?cluster=mainnet`;
        }
      }
      console.error('Error in botBuyToken:', error);
      return `Error buying token: ${error.message}`;
    }
  }

  async botSellToken(
    privateKey: string,
    tokenMint: string,
    amountPercent: string,
    userId: string,
    originalCommand: string,
  ) {
    const outputMint = 'So11111111111111111111111111111111111111112';
    let inputTokenDetails = null;
    let swapResponse = null;
    try {
      console.log(amountPercent, privateKey, tokenMint);
      if (!privateKey || !tokenMint || isNaN(parseFloat(amountPercent))) {
        return 'Invalid input parameters';
      }

      const inputMint = tokenMint;
      const userAccount = Keypair.fromSecretKey(bs58.decode(privateKey));
      const userAddress = userAccount.publicKey;

      const inputDetails = await this.getTokenDetails(inputMint);
      inputTokenDetails = inputDetails;

      const { balance } = await this.walletService.getSPLTokenBalance(
        String(userAddress),
        inputMint,
        process.env.SOLANA_RPC,
        Number(inputDetails.decimals),
      );

      console.log('token details :', inputTokenDetails);

      let amount = (balance * parseFloat(amountPercent)) / 100;
      amount = this.truncateTo9Decimals(amount);

      if (balance < amount) {
        return 'Insufficient balance.';
      }

      const [priorityFeeData, swapResp] = await Promise.all([
        firstValueFrom(
          this.httpService.get(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`),
        ),
        this.getSwapQuote(
          inputMint,
          outputMint,
          Number(amount) * 10 ** inputTokenDetails.decimals,
        ),
      ]);
      swapResponse = swapResp;

      const connection = new Connection(process.env.SOLANA_RPC, {
        commitment: 'confirmed',
      });

      const [inputAccount, outputAccount] = await Promise.all([
        getOrCreateAssociatedTokenAccount(
          connection,
          userAccount,
          new PublicKey(inputMint),
          userAddress,
        ),
        getOrCreateAssociatedTokenAccount(
          connection,
          userAccount,
          new PublicKey(outputMint),
          userAddress,
        ),
      ]);

      const swapUrl = `${API_URLS.SWAP_HOST}/transaction/swap-base-in`;
      const swapTrx = await firstValueFrom(
        this.httpService.post(swapUrl, {
          computeUnitPriceMicroLamports: String(
            priorityFeeData.data.data.high ||
              priorityFeeData.data.data.default.h * 2,
          ),
          swapResponse,
          txVersion: 'V0',
          wallet: userAddress,
          wrapSol: false,
          unwrapSol: true,
          inputAccount: inputAccount.address.toBase58(),
          outputAccount: outputAccount.address.toBase58(),
        }),
      );

      const txBuffer = Buffer.from(swapTrx.data.data[0].transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);

      const signature = await this.sendTransactionWithRetry(
        connection,
        transaction,
        userAccount,
      );

      const statuses = await connection.getSignatureStatuses([signature]);
      const status = statuses.value[0];

      if (
        status &&
        (status.confirmationStatus === 'confirmed' ||
          status.confirmationStatus === 'finalized')
      ) {
        try {
          await new this.transactionModel({
            userId,
            transactionType: 'sell',
            chain: 'solana',
            amount: swapResponse.data.inputAmount,
            token: { address: swapResponse.data.inputMint, tokenType: 'token' },
            txHash: signature,
            meta: {
              platform: 'twitter',
              originalCommand,
            },
          }).save();
        } catch (err) {
          console.error('Failed to save transaction:', err.message);
        }

        return `https://explorer.solana.com/tx/${signature}?cluster=mainnet`;
      } else {
        throw new Error('Transaction not confirmed');
      }
    } catch (error: any) {
      const regex =
        /^Signature\s([a-zA-Z0-9]{87})\shas\sexpired:\sblock\sheight\sexceeded\.$/;
      const match = error.message.match(regex);
      if (match) {
        const connection = new Connection(process.env.SOLANA_RPC, {
          commitment: 'confirmed',
        });
        const signature = match[1];
        const statuses = await connection.getSignatureStatuses([signature]);
        const status = statuses.value[0];
        if (
          status &&
          (status.confirmationStatus === 'confirmed' ||
            status.confirmationStatus === 'finalized')
        ) {
          try {
            await new this.transactionModel({
              userId,
              transactionType: 'sell',
              chain: 'solana',
              amount: swapResponse.data.inputAmount,
              token: {
                address: swapResponse.data.inputMint,
                tokenType: 'token',
              },
              txHash: signature,
              meta: {
                platform: 'twitter',
                originalCommand,
              },
            }).save();
          } catch (err) {
            console.error('Failed to save transaction:', err.message);
          }
          return `https://explorer.solana.com/tx/${signature}?cluster=mainnet`;
        }
      }
      console.error('Error in botSellToken:', error);
      return `Error selling token: ${error.message}`;
    }
  }

  async sendTransactionWithRetry(
    connection,
    transaction,
    userAccount,
    maxRetries = 3,
  ) {
    let signature;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.message.recentBlockhash = blockhash;
        transaction.sign([userAccount]);

        signature = await connection.sendTransaction(transaction, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        for (let i = 0; i < 30; i++) {
          const statuses = await connection.getSignatureStatuses([signature]);
          const status = statuses.value[0];

          if (status) {
            if (status.err) {
              throw new Error(`Transaction failed: ${status.err}`);
            }
            if (
              status.confirmationStatus === 'confirmed' ||
              status.confirmationStatus === 'finalized'
            ) {
              return signature;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        console.log(
          `Transaction not confirmed yet (attempt ${attempt}), retrying...`,
        );
      } catch (error) {
        if (
          error.message.includes('block height exceeded') &&
          attempt < maxRetries
        ) {
          console.log(`Blockhash expired (attempt ${attempt}), retrying...`);
          continue;
        }
        throw error;
      }
    }
    throw new Error(`Transaction failed after ${maxRetries} attempts`);
  }

  async getSwapQuote(
    inputMint: string,
    outputMint: string,
    amountInDecimals: number,
  ) {
    const slippage = 0.5;
    const txVersion = 'V0';

    const swapComputeUrl = `https://transaction-v1.raydium.io/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInDecimals}&slippageBps=${slippage * 100}&txVersion=${txVersion}`;

    const { data: swapResponse } = await firstValueFrom(
      this.httpService.get(swapComputeUrl),
    );

    if (swapResponse.success === false) {
      throw new Error(`Swap failed: ${swapResponse.msg}`);
    }

    return swapResponse;
  }

  async getTokenDetails(address: string) {
    try {
      const url = `https://api-v3.raydium.io/mint/ids?mints=${address}`;
      const response = await firstValueFrom(this.httpService.get(url));

      return response.data.data[0];
    } catch (error: any) {
      console.error(
        `Error fetching token details for ${address}:`,
        error.message,
      );
      return error.message;
    }
  }

  fetchSupportedTokenPrice = async (address: string) => {
    try {
      const response = await this.httpService.axiosRef.get(
        `https://api-v3.raydium.io/mint/price?mints=${address}`,
      );
      const price = Object.values(response.data.data)[0];
      return price;
    } catch (error) {
      console.error(error);
    }
  };

  truncateTo9Decimals(num: number): number {
    return Math.floor(num * 1e6) / 1e6;
  }

  async sendSol(
    privateKey: string,
    amount: string,
    reciever: string,
    data: Partial<Transaction>,
  ) {
    try {
      const userAccount = Keypair.fromSecretKey(bs58.decode(privateKey));
      const userAddress = userAccount.publicKey;

      const { balance } = await this.walletService.getSolBalance(
        String(userAddress),
        process.env.SOLANA_RPC,
      );

      if (balance < Number(amount)) {
        return 'Insufficient balance.';
      }

      const response = await this.walletService.transferSOL(
        privateKey,
        reciever,
        parseFloat(amount),
        process.env.SOLANA_RPC,
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
        return `https://solscan.io/tx/${response.signature}`;
      }
      return;
    } catch (error) {
      console.log(error);
      return `error sending token`;
    }
  }

  async sendSplToken(
    privateKey: string,
    token: string,
    amount: string,
    reciever: string,
    data: Partial<Transaction>,
  ) {
    try {
      const tokenMint =
        token.toLowerCase() === 'usdc' ? USDC_ADDRESS_SOL : USDT_ADDRESS_SOL;

      const userAccount = Keypair.fromSecretKey(bs58.decode(privateKey));
      const userAddress = userAccount.publicKey;

      const { balance } = await this.walletService.getSPLTokenBalance(
        String(userAddress),
        tokenMint,
        process.env.SOLANA_RPC,
        6,
      );

      if (balance < Number(amount)) {
        return 'Insufficient balance.';
      }

      const response = await this.walletService.transferSPLToken(
        privateKey,
        reciever,
        parseFloat(amount),
        tokenMint,
        process.env.SOLANA_RPC,
        6,
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
        return `https://solscan.io/tx/${response.signature}`;
      }
      return;
    } catch (error) {
      console.log(error);
      return `error sending token`;
    }
  }

  // utility function
  async getTokenMetadata(mint: any) {
    try {
      const connection = new Connection(process.env.SOLANA_RPC, {
        commitment: 'confirmed',
      });
      const metaplex = Metaplex.make(connection);

      const mintAddress = new PublicKey(mint);

      let tokenName;
      let tokenSymbol;

      const metadataAccount = metaplex
        .nfts()
        .pdas()
        .metadata({ mint: mintAddress });

      const metadataAccountInfo =
        await connection.getAccountInfo(metadataAccount);

      if (metadataAccountInfo) {
        const token = await metaplex
          .nfts()
          .findByMint({ mintAddress: mintAddress });
        tokenName = token.name;
        tokenSymbol = token.symbol;
        return { tokenName, tokenSymbol };
      }
    } catch (error) {
      console.log(error);
    }
  }
}
