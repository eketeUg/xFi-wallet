import { Injectable } from '@nestjs/common';
import { UserService } from 'src/twitter-client/user.service';

@Injectable()
export class TwitterOAuthService {
  constructor(private readonly userService: UserService) {}

  public async saveTwitterUser(createUserDto: {
    userId: string;
    userName: string;
    displayName: string;
    chains?: string[];
  }) {
    //check if user exists
    const user = await this.userService.checkIfUserExists(createUserDto.userId);
    if (!user) {
      //create user
      await this.userService.createUser(createUserDto);
    } else {
      //update user
      await this.userService.updateUser(createUserDto.userId, createUserDto);
    }
  }
}
