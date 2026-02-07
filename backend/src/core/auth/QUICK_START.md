# Quick Start Guide - Auth Module

## Setup

1. **Environment Variables**

   Add these to your `.env` file:
   ```env
   JWT_SECRET=your-very-secret-key-change-this-in-production
   JWT_EXPIRATION=15m
   JWT_REFRESH_SECRET=your-refresh-secret-key-change-this-too
   JWT_REFRESH_EXPIRATION=7d
   DATABASE_URL=mongodb://localhost:27017/your-database
   ```

2. **Import Auth Module**

   The module is already marked as `@Global()`, so it's available everywhere once imported in your main app module.

   ```typescript
   import { Module } from '@nestjs/common';
   import { AuthModule } from './core/auth';

   @Module({
     imports: [AuthModule],
   })
   export class AppModule {}
   ```

3. **Apply Global Guard (Optional)**

   If you want all routes to be protected by default:

   ```typescript
   // main.ts
   import { NestFactory, Reflector } from '@nestjs/core';
   import { JwtAuthGuard } from './core/auth';

   async function bootstrap() {
     const app = await NestFactory.create(AppModule);

     // Apply JWT guard globally
     const reflector = app.get(Reflector);
     app.useGlobalGuards(new JwtAuthGuard(reflector));

     await app.listen(3000);
   }
   bootstrap();
   ```

## Usage Examples

### 1. Public Route (No Authentication)

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '@/core/auth';

@Controller('public')
export class PublicController {
  @Public()
  @Get()
  getPublicData() {
    return { message: 'This is public' };
  }
}
```

### 2. Protected Route (Authentication Required)

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '@/core/auth';

@Controller('protected')
export class ProtectedController {
  @Get()
  @UseGuards(JwtAuthGuard)
  getProtectedData(@CurrentUser() user) {
    return {
      message: 'This is protected',
      user: user
    };
  }
}
```

### 3. Role-Based Access

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '@/core/auth';
import { Role } from '@prisma/client';

@Controller('admin')
export class AdminController {
  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SYSTEM_ADMIN, Role.PRINCIPAL)
  getDashboard(@CurrentUser() user) {
    return {
      message: 'Admin dashboard',
      user: user
    };
  }
}
```

### 4. Using Auth Service in Other Services

```typescript
import { Injectable } from '@nestjs/common';
import { AuthService } from '@/core/auth';

@Injectable()
export class UserService {
  constructor(private authService: AuthService) {}

  async createUserWithAuth(userData: any) {
    // Register user through auth service
    return this.authService.register(userData);
  }

  async getUserProfile(userId: string) {
    return this.authService.getUserProfile(userId);
  }
}
```

### 5. Using Token Service

```typescript
import { Injectable } from '@nestjs/common';
import { TokenService } from '@/core/auth';

@Injectable()
export class CustomService {
  constructor(private tokenService: TokenService) {}

  async createCustomToken(user: any) {
    return this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      roles: [user.role],
    });
  }

  async verifyCustomToken(token: string) {
    return this.tokenService.verifyToken(token);
  }
}
```

## API Testing with cURL

### Register
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "role": "STUDENT"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Get Current User
```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Change Password
```bash
curl -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "password123",
    "newPassword": "newpassword123"
  }'
```

### Refresh Token
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "YOUR_REFRESH_TOKEN"
  }'
```

### Forgot Password
```bash
curl -X POST http://localhost:3000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

### Reset Password
```bash
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "RESET_TOKEN",
    "password": "newpassword123"
  }'
```

## Testing with Postman/Insomnia

1. **Create Environment Variables:**
   - `BASE_URL`: `http://localhost:3000`
   - `ACCESS_TOKEN`: (will be set after login)
   - `REFRESH_TOKEN`: (will be set after login)

2. **Login Request:**
   - Method: POST
   - URL: `{{BASE_URL}}/auth/login`
   - Body: JSON
   ```json
   {
     "email": "test@example.com",
     "password": "password123"
   }
   ```
   - Save `access_token` and `refresh_token` from response

3. **Protected Request:**
   - Method: GET
   - URL: `{{BASE_URL}}/auth/me`
   - Headers:
     - `Authorization`: `Bearer {{ACCESS_TOKEN}}`

## Common Issues & Solutions

### Issue: "Invalid credentials"
- **Cause**: Wrong email or password
- **Solution**: Verify credentials, ensure user exists

### Issue: "Token has expired"
- **Cause**: Access token expired (default 15 minutes)
- **Solution**: Use refresh token to get new access token

### Issue: "Account is inactive"
- **Cause**: User account is deactivated
- **Solution**: Check `active` field in database, set to `true`

### Issue: "Unauthorized"
- **Cause**: Missing or invalid token
- **Solution**: Ensure Bearer token is in Authorization header

### Issue: Refresh token not working
- **Cause**: Refresh token expired or invalid
- **Solution**: User must login again

## Role-Based Access Control

Available roles (from Prisma schema):
- `PRINCIPAL`
- `ACCOUNTANT`
- `ADMISSION_OFFICER`
- `EXAMINATION_OFFICER`
- `TEACHER`
- `PLACEMENT_OFFICER`
- `PMS_OFFICER`
- `EXTRACURRICULAR_HEAD`
- `STUDENT`
- `INDUSTRY`
- `INDUSTRY_SUPERVISOR`
- `STATE_DIRECTORATE`
- `FACULTY_SUPERVISOR`
- `SYSTEM_ADMIN`

Example usage:
```typescript
@Roles(Role.SYSTEM_ADMIN, Role.PRINCIPAL)
@UseGuards(JwtAuthGuard, RolesGuard)
@Get('admin-only')
adminOnly() {
  return { message: 'Admin access' };
}
```

## Development Tips

1. **Use environment-specific secrets**: Different secrets for dev/staging/production
2. **Token expiration**: Adjust based on security needs
3. **Password requirements**: Modify validators in DTOs for stricter rules
4. **Logging**: Add logging for authentication events
5. **Rate limiting**: Consider adding rate limiting for login attempts

## Security Best Practices

1. ✅ Never commit `.env` file
2. ✅ Use strong, random secrets for JWT
3. ✅ Implement HTTPS in production
4. ✅ Set appropriate CORS policies
5. ✅ Consider adding rate limiting
6. ✅ Monitor failed login attempts
7. ✅ Implement token rotation
8. ✅ Use strong password requirements
9. ✅ Enable account lockout after failed attempts
10. ✅ Log all authentication events

## Next Steps

1. Set up email service for password reset
2. Implement token blacklisting for logout
3. Add rate limiting
4. Set up monitoring and alerts
5. Implement 2FA (optional)
6. Add session management
7. Configure refresh token rotation
