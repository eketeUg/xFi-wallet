import { Module } from '@nestjs/common';
import { XfiDefiSolService } from './xfi-defi-sol.service';
import { WalletModule } from 'src/wallet/wallet.module';
import { HttpModule } from '@nestjs/axios';
import {
  Transaction,
  TransactionSchema,
} from 'src/database/schemas/transactions.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { XfiDefiBaseService } from './xfi-defi-base.service';
import { XfiDefiEthereumService } from './xfi-defi-ethereum.service';

@Module({
  imports: [
    WalletModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  exports: [XfiDefiSolService, XfiDefiBaseService, XfiDefiEthereumService],
  providers: [XfiDefiSolService, XfiDefiBaseService, XfiDefiEthereumService],
})
export class XfiDexModule {}
