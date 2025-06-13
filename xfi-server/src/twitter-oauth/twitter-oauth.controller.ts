import {
  Controller,
  Get,
  Req,
  Res,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { TwitterOAuthService } from './twitter-oauth.service';

@Controller('auth/twitter')
export class TwitterOAuthController {
  constructor(private readonly twitterService: TwitterOAuthService) {}

  @Get()
  async twitterAuthRedirect(@Res() res: Response) {
    // Initiate Twitter OAuth
    return res.redirect('/xfi/auth/twitter/login');
  }

  @Get('login')
  @UseGuards(AuthGuard('twitter'))
  twitterLogin() {
    // Redirect handled by Passport
  }

  @Get('callback')
  @UseGuards(AuthGuard('twitter'))
  async twitterCallback(@Req() req: Request, @Res() res: Response) {
    if (!req.user) {
      throw new HttpException(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const twitterUser = req.user as any;
    // You can update the user DB here if needed
    try {
      await this.twitterService.saveTwitterUser({
        userId: twitterUser.id,
        userName: twitterUser.username,
        displayName: twitterUser.displayName,
      });
      // return res.redirect(`http://localhost:5173/home?twitterId=${twitterUser.id}`);
      return res.redirect(
        `https://xfi-web.vercel.app/home?twitterId=${twitterUser.id}`,
      );
    } catch (err) {
      console.error(err);
      throw new HttpException(
        'Failed to save user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
