import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Get,
  Query,
} from '@nestjs/common';
import { EvmChain, SolAsset, UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { TwitterApi } from 'twitter-api-v2';

@Controller('users')
export class UserController {
  private twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Patch(':userId')
  async updateUser(
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(userId, updateUserDto);
  }

  @Get(':userId')
  async getUser(@Param('userId') userId: string) {
    // let twitterData: any = {};
    // try {
    //   twitterData = await this.twitterClient.v1.user({ user_id: userId });
    // } catch (err) {
    //   console.error('Failed to fetch Twitter user:', err);
    //   return null;
    // }
    const user = await this.userService.getUserById(userId);
    return {
      userId: userId,
      evmWalletAddress: user.evmWalletAddress,
      svmWalletAddress: user.svmWalletAddress,
      chains: user.chains,
      username: user.userName,
      name: user.displayName,
    };
  }

  @Get(':userId/svm-balance')
  async getUserSvmAssets(@Param('userId') userId: string): Promise<SolAsset[]> {
    return await this.userService.getUserSVMBalance(userId);
  }

  @Get(':userId/evm-balance')
  async getUserEVMBalance(
    @Param('userId') userId: string,
    @Query('chain') chain: EvmChain,
  ): Promise<SolAsset[]> {
    return await this.userService.getUserEVMBalance(userId, chain);
  }

  @Get('history/:userId')
  async getHistory(@Param('userId') userId: string) {
    return await this.userService.getTransactionHistory(userId);
  }
}
