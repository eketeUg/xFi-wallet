import { Injectable, Logger } from '@nestjs/common';
import {
  AgentKit,
  // CdpWalletProvider,
  walletActionProvider,
  erc721ActionProvider,
  cdpApiActionProvider,
  // cdpWalletActionProvider,
  pythActionProvider,
  SmartWalletProvider,
  erc20ActionProvider,
  basenameActionProvider,
} from '@coinbase/agentkit';
import { createWalletClient, Hex, http } from 'viem';
import { privateKeyToAccount, privateKeyToAddress } from 'viem/accounts';
import { getVercelAITools } from '@coinbase/agentkit-vercel-ai-sdk';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { WalletService } from 'src/wallet/wallet.service';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'src/database/schemas/user.schema';
import { Model } from 'mongoose';
import { baseSepolia } from 'viem/chains';
// import { http } from 'viem/clients/transports/http';

// type WalletData = {
//   privateKey: Hex;
//   smartWalletAddress: Address;
// };

@Injectable()
export class XfiAgentService {
  private readonly logger = new Logger(XfiAgentService.name);
  private readonly system = `You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are
empowered to interact onchain using your tools. If you ever need funds, you can request them from the
faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet details and request
funds from the user. Before executing your first action, get the wallet details to see what network
you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone
asks you to do something you can't do with your currently available tools, you must say so, and
encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to
docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from
restating your tools' descriptions unless it is explicitly requested.`;

  constructor(
    private readonly walletService: WalletService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {
    console.log(process.env.PAYMASTER_URL);
    const newUser = this.newUser();
    newUser
      .then(async (user) => {
        console.log('New user created:', user);
        const decryptedEvmWallet = await this.walletService.decryptEvmWallet(
          process.env.DEFAULT_WALLET_PIN!,
          user!.evmWalletDetails,
        );
        // const privateKey = decryptedEvmWallet.privateKey;
        console.log('Decrypted EVM Wallet:', decryptedEvmWallet);
        // const AgentResponse = await this.BaseAgent(
        //   privateKey as Hex,
        //   'what is my wallet address?',
        // );
        // console.log(AgentResponse);
      })
      .catch((error) => {
        console.error('Error creating new user:', error);
      });
  }

  async newUser() {
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
      const user = await this.userModel.findOneAndUpdate(
        { userId: '424252662' },
        {
          evmWalletDetails: encryptedEvmWalletDetails.json,
          evmWalletAddress: newEvmWallet.address,
          svmWalletDetails: encryptedSvmWalletDetails.json,
          svmWalletAddress: newSolanaWallet.address,
        },
        { new: true, upsert: true },
      );
      return user;
    } catch (error) {
      console.error('Error in newUser:', error);
    }
  }

  async BaseAgent(privateKey: Hex, prompt: string) {
    try {
      const signer = privateKeyToAccount(privateKey);
      const networkId = process.env.NETWORK_ID;
      // Configure Smart Wallet Provider
      const walletProvider = await SmartWalletProvider.configureWithWallet({
        networkId: 'base-sepolia',
        signer,
        smartWalletAddress: privateKeyToAddress(privateKey),
        paymasterUrl: process.env.PAYMASTER_URL,
        cdpApiKeyName: process.env.CDP_API_KEY_NAME,
        cdpApiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
      });

      // const walletProvider = await CdpWalletProvider.configureWithWallet({
      //   networkId: 'base-sepolia',
      //   // signer,
      //   // smartWalletAddress: privateKeyToAddress(privateKey),
      //   // paymasterUrl: process.env.PAYMASTER_URL,
      //   apiKeyName: process.env.CDP_API_KEY_NAME,
      //   apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
      // });

      // const agentKit = await AgentKit.from({
      //   cdpApiKeyName: process.env.CDP_API_KEY_NAME,
      //   cdpApiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
      // });

      const account = privateKeyToAccount(
        '0x4c0883a69102937d6231471b5dbb6208ffd70c02a813d7f2da1c54f2e3be9f38',
      );

      const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
      });

      // const walletProvider = new ViemWalletProvider(client);

      const agentKit = await AgentKit.from({
        walletProvider,
        actionProviders: [
          cdpApiActionProvider({
            apiKeyName: process.env.CDP_API_KEY_NAME,
            apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
          }),
          erc721ActionProvider(),
          pythActionProvider(),
          walletActionProvider(),
          erc20ActionProvider(),
          basenameActionProvider(),
        ],
      });

      console.log('this is kit ', agentKit);

      const tools = getVercelAITools(agentKit);

      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        system: this.system,
        prompt,
        tools,
        maxSteps: 10,
      });

      console.log('Agent response:', text);
      return text;
    } catch (error) {
      console.error('Error in BaseAgent:', error);
      throw error;
    }
  }
}
