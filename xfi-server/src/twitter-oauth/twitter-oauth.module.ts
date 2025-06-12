import { Module } from '@nestjs/common';
import { TwitterOAuthController } from './twitter-oauth.controller';
import { TwitterOAuthService } from './twitter-oauth.service';
import { TwitterAuthStrategy } from './twitter.strategy';
import { TwitterClientModule } from 'src/twitter-client/twitter-client.module';

@Module({
    controllers: [TwitterOAuthController],
    providers: [TwitterOAuthService, TwitterAuthStrategy],
    imports: [TwitterClientModule]
})
export class TwitterOAuthModule { }
