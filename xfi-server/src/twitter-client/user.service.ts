import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/database/schemas/user.schema';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { WalletService } from 'src/wallet/wallet.service';
import { XfiDefiSolService } from 'src/xfi-defi/xfi-defi-sol.service';

export interface SolAsset {
  tokenName: string;
  tokenSymbol: string;
  tokenMint: string;
  amount: string;
}
export type EvmChain = 'ethereum' | 'mantle';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly walletService: WalletService,
    @InjectModel(Transaction.name)
    readonly transactionModel: Model<Transaction>,
    private readonly solDefiService: XfiDefiSolService,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    try {
      const newEvmWallet = await this.walletService.createEvmWallet();
      const newSolanaWallet = await this.walletService.createSVMWallet();

      const [encryptedEvmWalletDetails, encryptedSvmWalletDetails] =
        await Promise.all([
          this.walletService.encryptEvmWallet(
            process.env.DEFAULT_WALLET_PIN!,
            newEvmWallet.privateKey,
          ),
          this.walletService.encryptSVMWallet(
            process.env.DEFAULT_WALLET_PIN!,
            newSolanaWallet.privateKey,
          ),
        ]);
      const user = new this.userModel({
        userId: createUserDto.userId,
        userName: createUserDto.userName,
        evmWalletDetails: encryptedEvmWalletDetails.json,
        evmWalletAddress: newEvmWallet.address,
        svmWalletDetails: encryptedSvmWalletDetails.json,
        svmWalletAddress: newSolanaWallet.address,
        chains: createUserDto.chains,
      });
      return user.save();
    } catch (error) {
      console.log(error);
    }
  }

  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<User> {
    const user = await this.userModel.findOneAndUpdate(
      { userId },
      updateUserDto,
      { new: true },
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.userModel
      .findOne({ userId })
      .select('-evmWalletDetails -svmWalletDetails')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async checkIfUserExists(userId: string): Promise<User> {
    return await this.userModel
      .findOne({ userId })
      .select('-evmWalletDetails -svmWalletDetails')
      .exec();
  }

  async getTransactionHistory(userId: string): Promise<Transaction[]> {
    const transactions = await this.transactionModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();

    return transactions;
  }

  async getUserSVMBalance(userId: string): Promise<SolAsset[]> {
    const user = await this.userModel.findOne({ userId });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [{ balance }, walletAssets] = await Promise.all([
      this.walletService.getSolBalance(
        user.svmWalletAddress,
        process.env.SOLANA_RPC,
      ),
      this.walletService.getTokenBalances(user.svmWalletAddress),
    ]);

    const assetsMetadata = await Promise.all(
      walletAssets.map(async ({ tokenMint, amount }) => {
        try {
          const { tokenName, tokenSymbol } =
            await this.solDefiService.getTokenMetadata(tokenMint);
          return {
            tokenName,
            tokenSymbol,
            tokenMint,
            amount,
          };
        } catch (error) {
          console.log(error);
          return;
        }
      }),
    );
    return [
      {
        tokenName: 'solana',
        tokenSymbol: 'SOL',
        tokenMint: 'So11111111111111111111111111111111111111111',
        amount: balance.toString(),
      },
      ...assetsMetadata,
    ];
  }

  async getUserEVMBalance(
    userId: string,
    chain: EvmChain,
  ): Promise<SolAsset[]> {
    const user = await this.userModel.findOne({ userId });
    if (!user) throw new NotFoundException('User not found');

    switch (chain) {
      case 'ethereum': {
        const [ethBalance, usdcBalance, usdtBalance] = await Promise.all([
          this.walletService.getNativeEthBalance(
            user.evmWalletAddress,
            process.env.ETHEREUM_RPC,
          ),
          this.walletService.getERC20Balance(
            user.evmWalletAddress,
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            process.env.ETHEREUM_RPC,
          ),
          this.walletService.getERC20Balance(
            user.evmWalletAddress,
            '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            process.env.ETHEREUM_RPC,
          ),
        ]);

        return [
          {
            tokenName: 'ethereum',
            tokenSymbol: 'ETH',
            tokenMint: '0x0000000000000000000000000000000000000000',
            amount: ethBalance.balance.toString(),
          },
          {
            tokenName: 'usdc',
            tokenSymbol: 'USDC',
            tokenMint: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            amount: usdcBalance.balance.toString(),
          },
          {
            tokenName: 'usdt',
            tokenSymbol: 'USDT',
            tokenMint: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            amount: usdtBalance.balance.toString(),
          },
        ];
      }

      case 'mantle': {
        const [ethBalance, usdcBalance, usdtBalance] = await Promise.all([
          this.walletService.getNativeEthBalance(
            user.evmWalletAddress,
            process.env.MANTLE_RPC,
          ),
          this.walletService.getERC20Balance(
            user.evmWalletAddress,
            '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9',
            process.env.MANTLE_RPC,
          ),
          this.walletService.getERC20Balance(
            user.evmWalletAddress,
            '0x201eba5cc46d216ce6dc03f6a759e8e766e956ae',
            process.env.MANTLE_RPC,
          ),
        ]);

        return [
          {
            tokenName: 'MANTLE',
            tokenSymbol: 'MNT',
            tokenMint: '0x0000000000000000000000000000000000000000',
            amount: ethBalance.balance.toString(),
          },
          {
            tokenName: 'usdc',
            tokenSymbol: 'USDC',
            tokenMint: '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9',
            amount: usdcBalance.balance.toString(),
          },
          {
            tokenName: 'usdt',
            tokenSymbol: 'USDT',
            tokenMint: '0x201eba5cc46d216ce6dc03f6a759e8e766e956ae',
            amount: usdtBalance.balance.toString(),
          },
        ];
      }

      default:
        throw new BadRequestException(`Unsupported chain: ${chain}`);
    }
  }
}
