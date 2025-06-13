import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction } from 'src/database/schemas/transactions.schema';
import { User } from 'src/database/schemas/user.schema';
import { WalletService } from 'src/wallet/wallet.service';
import { XfiDefiSolService } from 'src/xfi-defi/xfi-defi-sol.service';
import { ethers, Contract } from 'ethers';
import L2ResolverAbi from './utils/l2ResolverAbi';
import { XfiDefiEthereumService } from 'src/xfi-defi/xfi-defi-ethereum.service';
import { TwitterClientBase } from './base.provider';
import { UserService } from './user.service';
import { XfiDefiMantleService } from 'src/xfi-defi/xfi-defi-mantle.service';

const BASENAME_L2_RESOLVER_ADDRESS =
  '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD';

type Action = 'buy' | 'sell' | 'send' | 'tip';
// type Chain = 'solana' | 'ethereum' | 'base' | 'arbitrum';
type TokenType = 'native' | 'stable' | 'token';
type ReceiverType = 'wallet' | 'ens' | 'username';

interface Token {
  value: string;
  type: TokenType;
}

interface Receiver {
  address: string;
  type: ReceiverType;
  value?: string;
  userId?: string;
}
interface UserKey {
  evmPK: string;
  svmPK: string;
  userId: string;
}

interface ParsedCommand {
  action: Action;
  chain?: string;
  amount?: string;
  token?: Token;
  receiver?: Receiver;
}

// --- Helper Data ---
const NATIVE_TOKENS = ['sol', 'eth', 'mnt'];
const STABLE_TOKENS = ['usdc', 'usdt'];

// const CHAINS = ['solana', 'ethereum', 'mantle', 'arbitrum'];

@Injectable()
export class ParseCommandService {
  private readonly logger = new Logger(ParseCommandService.name);
  private ethProvider: ethers.JsonRpcProvider;
  private mantleProvider: ethers.JsonRpcApiProvider;
  constructor(
    private readonly walletService: WalletService,
    private readonly defiEthereumService: XfiDefiEthereumService,
    private readonly defiMantleService: XfiDefiMantleService,
    private readonly dexService: XfiDefiSolService,
    private readonly twitterClientBase: TwitterClientBase,
    private readonly userService: UserService,
    @InjectModel(User.name)
    readonly userModel: Model<User>,
  ) {
    this.ethProvider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC);
    this.mantleProvider = new ethers.JsonRpcProvider(process.env.MANTLE_RPC);
  }

  //   private getEnsChainType(ensName: string): string {
  //     const parts = ensName.toLowerCase().split('.');

  //     if (parts.length === 3 && parts[2] === 'eth') {
  //       return parts[1];
  //     }

  //     if (parts.length === 2 && parts[1] === 'eth') {
  //       return 'ethereum';
  //     }

  //     return 'unknown';
  //   }

  private getEnsChainType(identifier: string): string {
    if (identifier.startsWith('@')) {
      return 'twitter';
    }

    const parts = identifier.toLowerCase().split('.');

    if (parts.length === 3 && parts[2] === 'eth') {
      return parts[1]; // e.g., 'mantle' from 'dami.base.eth'
    }

    if (parts.length === 2 && parts[1] === 'eth') {
      return 'ethereum'; // e.g., 'dami.eth'
    }

    return 'unknown';
  }

  private convertChainIdToCoinType(chainId: number): string {
    if (chainId === 1) {
      return 'addr';
    }
    const coinType = (0x80000000 | chainId) >>> 0;
    return coinType.toString(16).toUpperCase();
  }

  private convertReverseNodeToBytes(address: string, chainId: number): string {
    const addressFormatted = address.toLowerCase();
    const addressNode = ethers.solidityPackedKeccak256(
      ['string'],
      [addressFormatted.substring(2)],
    );

    const coinType = this.convertChainIdToCoinType(chainId);
    const baseReverseNode = ethers.namehash(`${coinType}.reverse`);

    const addressReverseNode = ethers.solidityPackedKeccak256(
      ['bytes32', 'bytes32'],
      [baseReverseNode, addressNode],
    );

    return addressReverseNode;
  }

  private encodeDnsName(name: string): string {
    const labels = name.split('.');
    const buffers = labels.map((label) => {
      const len = Buffer.from([label.length]);
      const str = Buffer.from(label, 'utf8');
      return Buffer.concat([len, str]);
    });
    return ethers.hexlify(Buffer.concat([...buffers, Buffer.from([0])]));
  }

  // --- Helper Functions ---
  //   detectChain(word: string): Chain | undefined {
  //     const lower = word.toLowerCase();
  //     if (lower === 'sol') return 'solana';
  //     if (CHAINS.includes(lower)) return lower as Chain;
  //   }

  detectChain(chainOrToken: string): string {
    const normalized = chainOrToken.toLowerCase();

    if (normalized.includes('sol')) return 'solana';
    if (normalized.includes('base')) return 'base';
    if (normalized.includes('mode')) return 'mode';
    if (normalized.includes('mantle')) return 'mantle';
    if (/^0x[a-fA-F0-9]{40}$/.test(chainOrToken)) return 'ethereum'; // EVM
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(chainOrToken)) return 'solana'; // Solana pubkey format
    return 'mantle'; // Default fallback
  }

  detectTokenType(value: string): TokenType {
    const lower = value.toLowerCase();
    if (NATIVE_TOKENS.includes(lower)) return 'native';
    if (STABLE_TOKENS.includes(lower)) return 'stable';
    return 'token';
  }

  detectReceiverType(value: string): ReceiverType {
    if (value.endsWith('.eth') || value.endsWith('.base.eth')) return 'ens';
    if (value.startsWith('@')) return 'username';
    return 'wallet';
  }

  parseTweetCommand(tweet: string): ParsedCommand | null {
    const normalized = tweet.replace(/\s+/g, ' ').trim();

    // === SEND / TIP ===
    const sendRegex =
      /(send|tip)\s+([\d.]+)\s+(\w+)\s+to\s+([a-zA-Z0-9.@]+)(?:\s+on\s+(\w+))?/i;
    const sendMatch = normalized.match(sendRegex);
    if (sendMatch) {
      const [, actionRaw, amount, tokenValue, receiverValue, chainMaybe] =
        sendMatch;
      const action = actionRaw.toLowerCase() as Action;

      return {
        action,
        amount,
        token: {
          value: tokenValue,
          type: this.detectTokenType(tokenValue),
        },
        receiver: {
          address: receiverValue,
          value: receiverValue,
          type: this.detectReceiverType(receiverValue),
        },
        chain: this.detectChain(chainMaybe ?? tokenValue),
      };
    }

    // === BUY / SELL: [amount][token] of [targetToken] ===
    const buySellOfRegex =
      /(buy|sell)\s+([\d.]+)\s*([a-zA-Z]+)\s+(?:worth\s+of|of)\s+([a-zA-Z0-9]+)(?:\s+on\s+(\w+))?/i;
    const buySellOfMatch = normalized.match(buySellOfRegex);
    if (buySellOfMatch) {
      const [, actionRaw, amount, payToken, targetToken, chainMaybe] =
        buySellOfMatch;
      return {
        action: actionRaw.toLowerCase() as Action,
        amount,
        token: {
          value: targetToken,
          type: this.detectTokenType(targetToken),
        },
        chain: this.detectChain(chainMaybe ?? payToken),
      };
    }

    // === BUY / SELL: [token] for [amount][payToken] ===
    const buySellForRegex =
      /(buy|sell)\s+([a-zA-Z0-9]+)\s+for\s+([\d.]+)\s*([a-zA-Z]+)(?:\s+on\s+(\w+))?/i;
    const buySellForMatch = normalized.match(buySellForRegex);
    if (buySellForMatch) {
      const [, actionRaw, targetToken, amount, payToken, chainMaybe] =
        buySellForMatch;
      return {
        action: actionRaw.toLowerCase() as Action,
        amount,
        token: {
          value: targetToken,
          type: this.detectTokenType(targetToken),
        },
        chain: this.detectChain(chainMaybe ?? payToken),
      };
    }

    // === SELL all / half / percent ===
    const sellPercentageRegex =
      /sell\s+(all|half|\d{1,3}%)\s+(?:of\s+)?([a-zA-Z0-9]+)(?:\s+on\s+(\w+))?/i;
    const sellPercentMatch = normalized.match(sellPercentageRegex);
    if (sellPercentMatch) {
      const [, portion, tokenValue, chainMaybe] = sellPercentMatch;
      let amount = '100';
      if (portion.toLowerCase() === 'half') amount = '50';
      else if (portion.endsWith('%')) amount = portion.replace('%', '');

      return {
        action: 'sell',
        amount,
        token: {
          value: tokenValue,
          type: this.detectTokenType(tokenValue),
        },
        chain: this.detectChain(chainMaybe ?? tokenValue),
      };
    }

    return null;
  }

  // --- Placeholder Action Handlers ---

  async resolveENS(name: string, chain: string): Promise<Receiver> {
    console.log('name  :', name);
    const ensChain = this.getEnsChainType(name);
    console.log(ensChain);
    switch (ensChain) {
      case 'ethereum':
      case 'mantle':
        const ethAddress = await this.ethProvider.resolveName(name);
        console.log('ens name:', ethAddress);
        return {
          address: ethAddress,
          type: 'ens',
          value: name,
        };

      case 'twitter':
        try {
          const cleanUsername = name.replace(/^@/, '');
          const user = await this.twitterClientBase.fetchProfile(cleanUsername);
          console.log('User :', user);
          if (!user) {
            throw new Error('user does not exist');
          }
          const userExist = await this.getOrCreateUser({
            id: user.id,
            username: user.username,
          });
          if (!userExist) {
            throw new Error('error creating User');
          }
          return {
            address:
              chain == 'solana'
                ? userExist.svmWalletAddress
                : userExist.evmWalletAddress,
            type: 'username',
            value: name,
            userId: user.id,
          };
        } catch (error) {
          console.log(error);
          return;
        }

      default:
        return {
          address:
            chain == 'solana'
              ? process.env.ADMIN_WALLET_SVM
              : process.env.ADMIN_WALLET_EVM,
          type: 'ens',
          value: name,
        };
    }
  }

  async handleNativeSend(
    chain: string,
    to: string,
    amount: string,
    userKey: UserKey,
    originalCommand: string,
  ) {
    console.log(`Sending ${amount} native on ${chain} to ${to}`);
    try {
      if (chain == 'ethereum') {
        const data: Partial<Transaction> = {
          userId: userKey.userId,
          transactionType: 'send',
          chain: 'ethereum',
          amount: amount,
          token: { address: 'eth', tokenType: 'native' },
          receiver: { value: to, receiverType: 'wallet' },
          meta: {
            platform: 'twitter',
            originalCommand: originalCommand,
          },
        };
        const response = await this.defiEthereumService.sendEth(
          userKey.evmPK,
          amount,
          to,
          data,
        );
        return response;
      } else if (chain == 'mantle') {
        const data: Partial<Transaction> = {
          userId: userKey.userId,
          transactionType: 'send',
          chain: 'mantle',
          amount: amount,
          token: { address: 'mnt', tokenType: 'native' },
          receiver: { value: to, receiverType: 'wallet' },
          meta: {
            platform: 'twitter',
            originalCommand: originalCommand,
          },
        };
        const response = await this.defiMantleService.sendMNT(
          userKey.evmPK,
          amount,
          to,
          data,
        );
        return response;
      } else if (chain == 'solana') {
        const data: Partial<Transaction> = {
          userId: userKey.userId,
          transactionType: 'send',
          chain: 'solana',
          amount: amount,
          token: { address: 'solana', tokenType: 'native' },
          receiver: { value: to, receiverType: 'wallet' },
          meta: {
            platform: 'twitter',
            originalCommand: originalCommand,
          },
        };
        const response = await this.dexService.sendSol(
          userKey.svmPK,
          amount,
          to,
          data,
        );
        return response;
      }
    } catch (error) {
      console.log(error);
    }
  }

  async handleStableSend(
    chain: string,
    token: string,
    to: string,
    amount: string,
    userKey: UserKey,
    originalCommand: string,
  ) {
    console.log(`Sending ${amount} stable ${token} on ${chain} to ${to}`);

    try {
      if (chain == 'ethereum') {
        console.log(to);
        const data: Partial<Transaction> = {
          userId: userKey.userId,
          transactionType: 'send',
          chain: 'ethereum',
          amount: amount,
          token: { address: token, tokenType: 'stable' },
          receiver: { value: to, receiverType: 'wallet' },
          meta: {
            platform: 'twitter',
            originalCommand: originalCommand,
          },
        };
        const response = await this.defiEthereumService.sendERC20(
          userKey.evmPK,
          token,
          amount,
          to,
          data,
        );
        return response;
      } else if (chain == 'mantle') {
        const data: Partial<Transaction> = {
          userId: userKey.userId,
          transactionType: 'send',
          chain: 'mantle',
          amount: amount,
          token: { address: token, tokenType: 'stable' },
          receiver: { value: to, receiverType: 'wallet' },
          meta: {
            platform: 'twitter',
            originalCommand: originalCommand,
          },
        };
        const response = await this.defiMantleService.sendERC20(
          userKey.evmPK,
          token,
          amount,
          to,
          data,
        );
        return response;
      } else if (chain == 'solana') {
        const data: Partial<Transaction> = {
          userId: userKey.userId,
          transactionType: 'send',
          chain: 'solana',
          amount: amount,
          token: { address: token, tokenType: 'stable' },
          receiver: { value: to, receiverType: 'wallet' },
          meta: {
            platform: 'twitter',
            originalCommand: originalCommand,
          },
        };
        const response = await this.dexService.sendSplToken(
          userKey.svmPK,
          token,
          amount,
          to,
          data,
        );
        return response;
      }
    } catch (error) {
      console.log(error);
    }
  }

  //   async handleTokenSend(
  //     chain: string,
  //     token: string,
  //     to: string,
  //     amount: string,
  //     originalCommand: string,
  //   ) {
  //     console.log(`Sending ${amount} of token ${token} on ${chain} to ${to}`);
  //   }

  async handleBuy(
    chain: string,
    token: string,
    nativeAmount: string,
    userPk: UserKey,
    originalCommand: string,
  ) {
    try {
      if (chain == 'solana') {
        const response = await this.dexService.botBuyToken(
          userPk.svmPK,
          token,
          nativeAmount,
          userPk.userId,
          originalCommand,
        );
        return response;
      }
    } catch (error) {
      console.log(error);
    }
  }

  async handleSell(
    chain: string,
    token: string,
    amount: string,
    userPk: UserKey,
    originalCommand: string,
  ) {
    console.log(`Selling ${amount}% of ${token} on ${chain}`);
    try {
      if (chain == 'solana') {
        const response = await this.dexService.botSellToken(
          userPk.svmPK,
          token,
          amount,
          userPk.userId,
          originalCommand,
        );
        return response;
      }
    } catch (error) {
      console.log(error);
    }
  }

  // --- 🎯 BUNDLED ENTRY FUNCTION ---
  async handleTweetCommand(tweet: string, userId: string, username?: string) {
    const normalized = tweet.replace(/\s+/g, ' ').trim();

    const balanceRegex =
      /\b(?:get(?:\s+me)?|check|show|see|what(?:'|’)?s|what\s+is|can\s+you\s+get|i\s+want\s+to\s+see)?\s*(?:my\s*)?(?:(solana|sol|ethereum|mantle)\s+)?balance(?:\s*(?:on|of|for)?\s*(solana|sol|ethereum|eth|mantle))?\b/i;

    // for directMessages
    const createAccountRegex =
      /\b((c(?:rea|ret|re)te?|a(?:ctiv|ctvat|ctiv)ate?)( (my )?(new )?account)?|i want (to )?(c(?:rea|ret|re)te?|a(?:ctiv|ctvat|ctiv)ate?)(( a)?( new)?( my)? account)?)\b/i;

    const walletRegex =
      /\b(?:get(?:\s+me)?|show|see|what(?:'|’)?s|what\s+is|can\s+you\s+show|i\s+want\s+to\s+see|give(?:\s+me)?)?\s*(?:my\s*)?(wallet(?:\s+address)?|wallet\s+addr|walletaddr|walletaddress)\b/i;

    const createAccountMatch = normalized.match(createAccountRegex);
    const balanceMatch = normalized.toLowerCase().match(balanceRegex);
    const getWalletMatch = normalized.toLowerCase().match(walletRegex);

    try {
      this.logger.log(tweet);
      const user = await this.userModel.findOne({ userId });

      if (!user || !user.active) {
        // === CREATE / ACTIVATE ACCOUNT ===
        if (createAccountMatch) {
          if (user) {
            const updatedUser = await this.userModel.findOneAndUpdate(
              { userId: user.userId },
              { active: true },
              { new: true },
            );

            return `Account Activated\n\nEVM ADDRESS:\n${updatedUser.evmWalletAddress}`;
          } else {
            const newUser = await this.getOrCreateUser(
              {
                id: userId,
                username,
              },
              true,
            );
            return `Account created\n\nEVM ADDRESS:\n${newUser.evmWalletAddress}`;
          }
        }
        const appUrl = process.env.APP_URL;
        return `Please go to ${appUrl} or send a direct message to create/activate your account to use this bot`;
      } else if (balanceMatch) {
        const rawChain = balanceMatch?.[1] || balanceMatch?.[2]; // either position
        const chain = this.normalizeChain(rawChain);
        // const action = balanceMatch ? 'balance' : null;
        let solanaBalance;
        let ethBalance;
        let mantleBalance;
        let formattedUserBalance;
        if (chain) {
          switch (chain) {
            case 'solana':
              solanaBalance = await this.userService.getUserSVMBalance(userId);
              console.log(solanaBalance);
              formattedUserBalance = this.formatBalances({
                solana: solanaBalance,
              });
              return formattedUserBalance;

            case 'mantle':
              mantleBalance = await this.userService.getUserEVMBalance(
                userId,
                'mantle',
              );
              console.log(mantleBalance);
              formattedUserBalance = this.formatBalances({
                mantle: mantleBalance,
              });
              return formattedUserBalance;

            case 'ethereum':
              ethBalance = await this.userService.getUserEVMBalance(
                userId,
                'ethereum',
              );
              console.log(ethBalance);
              formattedUserBalance = this.formatBalances({
                ethereum: ethBalance,
              });
              return formattedUserBalance;

            default:
              solanaBalance = await this.userService.getUserSVMBalance(userId);
              mantleBalance = await this.userService.getUserEVMBalance(
                userId,
                'mantle',
              );
              ethBalance = await this.userService.getUserEVMBalance(
                userId,
                'ethereum',
              );
              formattedUserBalance = this.formatBalances({
                ethereum: ethBalance,
                mantle: mantleBalance,
                solana: solanaBalance,
              });
              return formattedUserBalance;
          }
        }
        solanaBalance = await this.userService.getUserSVMBalance(userId);
        mantleBalance = await this.userService.getUserEVMBalance(
          userId,
          'mantle',
        );
        ethBalance = await this.userService.getUserEVMBalance(
          userId,
          'ethereum',
        );
        formattedUserBalance = this.formatBalances({
          ethereum: ethBalance,
          mantle: mantleBalance,
        });
        return formattedUserBalance;
      } else if (createAccountMatch || getWalletMatch) {
        return `Your Account:\n\nEVM ADDRESS:\n${user.evmWalletAddress}`;
      }

      const [decryptedSVMWallet, decryptedEvmWallet] = await Promise.all([
        this.walletService.decryptSVMWallet(
          process.env.DEFAULT_WALLET_PIN!,
          user!.svmWalletDetails,
        ),
        this.walletService.decryptEvmWallet(
          process.env.DEFAULT_WALLET_PIN!,
          user!.evmWalletDetails,
        ),
      ]);

      const userKeys: UserKey = {
        evmPK: decryptedEvmWallet.privateKey,
        svmPK: decryptedSVMWallet.privateKey,
        userId,
      };

      const parsed = this.parseTweetCommand(tweet);
      if (!parsed) {
        console.error('Invalid tweet format.');
        const promptDocsUrl = process.env.PROMPT_DOC || 'https://x.com/xFi_bot';
        return `Hi, if you’re trying to use a command or just curious how I work, you can check out the available prompts and formats here:👉  ${promptDocsUrl}`;
      }

      const { action, chain, amount, token, receiver } = parsed;
      let to: Receiver;

      if (receiver) {
        if (receiver.type === 'ens' || receiver.type === 'username') {
          //TODO:
          to = await this.resolveENS(receiver.value, chain);
        } else {
          to = {
            address: receiver.value,
            type: 'wallet',
            value: receiver.value,
          };
        }
      }

      switch (action) {
        case 'send':
        case 'tip':
          if (!to) return console.error('Receiver address missing.');
          if (token.type === 'native') {
            //TODO: capture usernames here and try to send messages
            const nativeResponse = await this.handleNativeSend(
              chain,
              to.address,
              amount,
              userKeys,
              tweet,
            );

            const startsWithHttps = /^https/.test(nativeResponse);
            if (startsWithHttps && to.type == 'username') {
              try {
                await this.twitterClientBase.sendDirectMessage(
                  to.userId,
                  `🔔 Transaction Notification\n${nativeResponse}`,
                );
              } catch (error) {
                console.error('Failed to send DM:', error.message);
              }
              return nativeResponse;
            }
            return nativeResponse;
          }

          if (token.type === 'stable') {
            const stableResponse = await this.handleStableSend(
              chain,
              token.value,
              to.address,
              amount,
              userKeys,
              tweet,
            );
            const startsWithHttps = /^https/.test(stableResponse);
            if (startsWithHttps && to.type == 'username') {
              try {
                await this.twitterClientBase.sendDirectMessage(
                  to.userId,
                  `🔔 Transaction Notification\n${stableResponse}`,
                );
              } catch (error) {
                console.error('Failed to send DM:', error.message);
              }
              return stableResponse;
            }
            return stableResponse;
          }

        //   return this.handleTokenSend(
        //     chain,
        //     token.value,
        //     to.address,
        //     amount,
        //     tweet,
        //   );

        case 'buy':
          return this.handleBuy(chain, token.value, amount, userKeys, tweet);

        case 'sell':
          return this.handleSell(chain, token.value, amount, userKeys, tweet);
      }
    } catch (error) {
      console.log(error);
    }
  }

  private async getOrCreateUser(
    user: { id: string; username: string },
    dm?: boolean,
  ) {
    let existingUser = await this.userModel.findOne({ userId: user.id });

    if (!existingUser) {
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

      existingUser = new this.userModel({
        userId: user.id,
        userName: user.username,
        evmWalletDetails: encryptedEvmWalletDetails.json,
        evmWalletAddress: newEvmWallet.address,
        svmWalletDetails: encryptedSvmWalletDetails.json,
        svmWalletAddress: newSolanaWallet.address,
        active: dm ? true : false, // make account active ii it was a directmessage comamnd
      });
      return existingUser.save();
    }

    return existingUser;
  }

  private normalizeChain = (raw) => {
    if (!raw) return null;
    const value = raw.toLowerCase();
    if (value === 'sol' || value === 'solana') return 'solana';
    if (value === 'eth' || value === 'ethereum') return 'ethereum';
    if (value === 'mantle') return 'mantle';
    return null;
  };

  // to formate directMessge balance response
  private formatBalances(balances: Record<string, any[]>): string {
    let result = 'BALANCE:\n\n';

    for (const [chain, tokens] of Object.entries(balances)) {
      result += `chain: ${chain}\n`;

      for (const token of tokens) {
        const amountNum =
          typeof token.amount === 'number'
            ? token.amount
            : parseFloat(token.amount);

        const formattedAmount = Number(amountNum).toPrecision(4);
        result += `${formattedAmount} - ${token.tokenSymbol}\n`;
      }

      result += `\n`; // extra newline between chains
    }

    return result.trim(); // remove last extra newline
  }
}
