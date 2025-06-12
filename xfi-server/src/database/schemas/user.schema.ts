import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type UserDocument = mongoose.HydratedDocument<User>;

@Schema()
export class User {
  @Prop({ default: uuidv4, unique: true })
  userId: string;

  @Prop()
  userName: string;

  @Prop()
  displayName: string;

  @Prop()
  evmWalletAddress: string;

  @Prop()
  svmWalletAddress: string;

  @Prop()
  evmWalletDetails: string;

  @Prop()
  svmWalletDetails: string;

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: false })
  isBaseSmartWallet: boolean;

  @Prop()
  baseSmartWallet: string;

  @Prop({
    type: [String],
    enum: ['solana', 'base', 'ethereum', 'mantle', 'mode', 'arbitrum'],
    default: ['base', 'solana'],
  })
  chains: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
