import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as TwitterStrategy, Profile } from 'passport-twitter';

@Injectable()
export class TwitterAuthStrategy extends PassportStrategy(
  TwitterStrategy,
  'twitter',
) {
  constructor() {
    super({
      consumerKey: process.env.CONSUMER_KEY,
      consumerSecret: process.env.CONSUMER_SECRET,
      // callbackURL: ' http://localhost:3827/auth/twitter/callback',
      callbackURL: 'https://app.eventblink.xyz/xfi-mantle/auth/twitter/callback',
      includeEmail: true,
    });
  }

  async validate(
    token: string,
    tokenSecret: string,
    profile: Profile,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    done: Function,
  ) {
    const userProfile = {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      photos: profile.photos ? profile.photos.map((photo) => photo.value) : [],
    };

    done(null, userProfile);
  }
}
