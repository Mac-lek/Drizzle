import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '@prisma-client/prisma.service';
import { normalizeNigerianPhone } from '@common/lib/utils/util.phone';
import { UpdateProfileDto } from './lib/dto/dto.users.update-profile';

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
        ...(phoneNumber && { phoneNumber }),
        ...(email && { email }),
        kycStatusId: kycStatus.id,
        statusId: userStatus.id,
        wallet: { create: {} },
      },
    });

    return { user, created: true };
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
        ...(dto.fcmToken !== undefined && { fcmToken: dto.fcmToken }),
      },
    });
  }
}
