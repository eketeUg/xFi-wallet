import { Module } from '@nestjs/common';
import { XfiDefiSolService } from './xfi-defi-sol.service';
import { WalletModule } from 'src/wallet/wallet.module';
import { HttpModule } from '@nestjs/axios';
import {
  Transaction,
  TransactionSchema,
} from 'src/database/schemas/transactions.schema';
import { MongooseModule } from '@nestjs/mongoose';
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
  exports: [XfiDefiSolService, XfiDefiEthereumService, XfiDefiMantleService],
  providers: [XfiDefiSolService, XfiDefiEthereumService, XfiDefiMantleService],
})
export class XfiDexModule {}
