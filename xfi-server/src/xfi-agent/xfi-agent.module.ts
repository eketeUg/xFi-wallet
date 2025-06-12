import { Module } from '@nestjs/common';
import { XfiAgentService } from './xfi-agent.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/database/schemas/user.schema';
import { WalletModule } from 'src/wallet/wallet.module';
import { XfiAgentController } from './xfi-agent.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    WalletModule,
  ],
  providers: [XfiAgentService],
  controllers: [XfiAgentController],
})
export class XfiAgentModule {}
