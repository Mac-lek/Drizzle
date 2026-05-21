import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

const HEAR_ABOUT_US_OPTIONS = [
  "social_media",
  "friend_referral",
  "google_search",
  "app_store",
  "news_article",
  "other",
] as const;

export class JoinWaitlistDto {
  @ApiProperty({ example: "Amaka" })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: "Okafor" })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty({ example: "amaka@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "08012345678", required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ enum: HEAR_ABOUT_US_OPTIONS })
  @IsIn(HEAR_ABOUT_US_OPTIONS)
  hearAboutUs: string;
}
