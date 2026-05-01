import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '@prisma-client/prisma.service';
import { normalizeNigerianPhone } from '@common/lib/utils/util.phone';
import { generateId } from '@common/lib/utils/util.id';
import { UpdateProfileDto } from './lib/dto/dto.users.update-profile';

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
  constructor(private readonly prisma: PrismaService) {}

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
      this.prisma.kycStatus.findUniqueOrThrow({ where: { name: 'NONE' } }),
      this.prisma.userStatus.findUniqueOrThrow({ where: { name: 'ACTIVE' } }),
    ]);

    const user = await this.prisma.user.create({
      data: {
        id: generateId('usr'),
        ...(phoneNumber && { phoneNumber }),
        ...(email && { email }),
        kycStatusId: kycStatus.id,
        statusId: userStatus.id,
        wallet: { create: { id: generateId('wlt') } },
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
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      bvnVerified: user.bvnVerified,
      kycStatus: user.kycStatus.name,
      status: user.status.name,
      profileComplete: !!(user.firstName && user.lastName && user.email && user.phoneNumber),
      createdAt: user.createdAt,
    };
  }

  async setPin(userId: string, pinHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { pinHash } });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phoneNumber: normalizeNigerianPhone(dto.phone) }),
        ...(dto.fcmToken !== undefined && { fcmToken: dto.fcmToken }),
      },
    });
  }
}
