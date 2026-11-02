import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';

export class LoginDto {
  @ApiProperty({ type: String, format: 'email' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class AccessTokenResponseDto {
  @ApiProperty({ type: String })
  accessToken: string;
}

export class LoginResponseDto extends AccessTokenResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}
