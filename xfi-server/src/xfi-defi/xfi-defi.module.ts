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
import { XfiDefiMantleService } from './xfi-defi-mantle.service';

@Module({
  imports: [
    WalletModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  exports: [
    XfiDefiSolService,
    XfiDefiBaseService,
    XfiDefiEthereumService,
    XfiDefiMantleService,
  ],
  providers: [
    XfiDefiSolService,
    XfiDefiBaseService,
    XfiDefiEthereumService,
    XfiDefiMantleService,
  ],
})
export class XfiDexModule {}
