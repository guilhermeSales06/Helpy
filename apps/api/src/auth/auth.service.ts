import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserResponse, userSelect } from '../users/users.mapper.js';
import { REFRESH_TOKEN_TTL_MS } from './auth.constants.js';
import { LoginDto } from './dto/login.dto.js';
import { hashPassword, verifyPassword } from './password.js';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

function newRefreshToken(userId: string) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  };
}

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...userSelect, passwordHash: true },
    });

    // Always verify a hash, so that response time doesn't reveal which emails exist.
    this.dummyHash ??= hashPassword(randomUUID());
    const passwordMatches = await verifyPassword(
      user?.passwordHash ?? (await this.dummyHash),
      password,
    );
    if (!user || !user.active || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });
    const refresh = newRefreshToken(user.id);
    await this.prisma.refreshToken.create({ data: refresh.data });

    return {
      accessToken: await this.signAccessToken(user.id, user.role),
      refreshToken: refresh.token,
      user: toUserResponse(user),
    };
  }

  async refresh(token: string | undefined) {
    if (!token) throw new UnauthorizedException();

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, role: true, active: true } } },
    });
    if (!stored) throw new UnauthorizedException();
    if (stored.revokedAt) await this.handleReuse(stored.userId);
    if (stored.expiresAt <= new Date() || !stored.user.active) {
      throw new UnauthorizedException();
    }

    const refresh = newRefreshToken(stored.userId);
    const rotated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count !== 1) return false;
      await tx.refreshToken.create({ data: refresh.data });
      return true;
    });
    if (!rotated) await this.handleReuse(stored.userId);

    return {
      accessToken: await this.signAccessToken(stored.userId, stored.user.role),
      refreshToken: refresh.token,
    };
  }

  async logout(token: string | undefined) {
    if (!token) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!user || !user.active) throw new UnauthorizedException();
    return toUserResponse(user);
  }

  // A rotated token should never come back. If it does, it may have been stolen,
  // and we can't tell which party is legitimate, so every session ends.
  private async handleReuse(userId: string): Promise<never> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedException();
  }

  private signAccessToken(userId: string, role: Role) {
    return this.jwt.signAsync({ sub: userId, role });
  }
}
