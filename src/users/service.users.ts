import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { User } from "@prisma/client";
import { PrismaService } from "@prisma-client/prisma.service";
import { normalizeNigerianPhone } from "@common/lib/utils/util.phone";
import { generateId } from "@common/lib/utils/util.id";
import { UpdateProfileDto } from "./lib/dto/dto.users.update-profile";
import { SubmitBvnDto } from "./lib/dto/dto.users.submit-bvn";
import { DojahProvider } from "../kyc/providers/provider.dojah";
import { encryptBvn } from "../kyc/lib/util.bvn-encrypt";

export interface UserProfile {
  id: string;
  phoneNumber: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  bvnVerified: boolean;
  kycStatus: string;
  status: string;
  profileComplete: boolean;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dojah: DojahProvider,
    private readonly config: ConfigService,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phoneNumber: phone } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findOrCreate(
    rawPhone?: string,
    email?: string,
  ): Promise<{ user: User; created: boolean }> {
    const phoneNumber = rawPhone ? normalizeNigerianPhone(rawPhone) : undefined;

    const existing = phoneNumber
      ? await this.findByPhone(phoneNumber)
      : await this.findByEmail(email!);

    if (existing) return { user: existing, created: false };

    const [kycStatus, userStatus] = await Promise.all([
      this.prisma.kycStatus.findUniqueOrThrow({ where: { name: "NONE" } }),
      this.prisma.userStatus.findUniqueOrThrow({ where: { name: "ACTIVE" } }),
    ]);

    const user = await this.prisma.user.create({
      data: {
        id: generateId("usr"),
        ...(phoneNumber && { phoneNumber }),
        ...(email && { email }),
        kycStatusId: kycStatus.id,
        statusId: userStatus.id,
        wallet: { create: { id: generateId("wlt") } },
      },
    });

    return { user, created: true };
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        kycStatus: { select: { name: true } },
        status: { select: { name: true } },
      },
    });
    if (!user) throw new NotFoundException("User not found");

    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      bvnVerified: user.bvnVerified,
      kycStatus: user.kycStatus.name,
      status: user.status.name,
      profileComplete: !!(
        user.firstName &&
        user.lastName &&
        user.email &&
        user.phoneNumber &&
        user.bvnVerified
      ),
      createdAt: user.createdAt,
    };
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async setTransactionPin(userId: string, transactionPinHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { transactionPinHash } });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && {
          phoneNumber: normalizeNigerianPhone(dto.phone),
        }),
      },
    });
  }

  async submitBvn(userId: string, dto: SubmitBvnDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { bvnVerified: true, firstName: true, lastName: true },
    });

    if (user.bvnVerified) {
      throw new ConflictException("BVN already verified");
    }

    if (!user.firstName || !user.lastName) {
      throw new BadRequestException(
        "Complete your profile (first and last name) before submitting BVN",
      );
    }

    const encryptionKey = this.config.getOrThrow<string>("BVN_ENCRYPTION_KEY");
    const bvnData = await this.dojah.verifyBvn(dto.bvn);

    if (
      !this.nameMatches(user.firstName, bvnData.firstName) ||
      !this.nameMatches(user.lastName, bvnData.lastName)
    ) {
      throw new BadRequestException("Name on BVN does not match your profile");
    }

    const bvnEncrypted = encryptBvn(dto.bvn, encryptionKey);

    await this.prisma.user.update({
      where: { id: userId },
      data: { bvnEncrypted, bvnVerified: true },
    });
  }

  private nameMatches(profileName: string, dojahName: string): boolean {
    const norm = (s: string) => s.trim().toUpperCase();
    const target = norm(profileName);
    return dojahName.split(/\s+/).map(norm).includes(target);
  }
}
