// create-user.dto.ts
export class CreateUserDto {
  userId;
  userName: string;
  chains?: string[];
  displayName?: string;
}

// update-user.dto.ts
export class UpdateUserDto {
  userName?: string;
  displayName?: string;
  active?: boolean;
  chains?: string[];
}
