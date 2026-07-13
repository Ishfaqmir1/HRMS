import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 50, ttl: 60000 } }) // 50 requests per minute
  @Post('register')
  @ApiOperation({ summary: 'Self-service tenant signup: creates a new Company + Owner user' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 200, ttl: 60000 } }) // 200 requests per minute
  @Post('login')
  @ApiOperation({ summary: 'Authenticate and receive an access/refresh token pair' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Throttle({ default: { limit: 200, ttl: 60000 } }) // 200 requests per minute
  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a valid refresh token for a new token pair (rotates refresh token)' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Returns the authenticated user\'s roles and permissions' })
  getMe(@CurrentUser('userId') userId: string) {
    return this.authService.getMe(userId);
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke the given refresh token (logs out current device)' })
  logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(user.userId, dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @ApiOperation({ summary: 'Revoke all refresh tokens for the current user (logs out everywhere)' })
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAllDevices(user.userId);
  }
}
