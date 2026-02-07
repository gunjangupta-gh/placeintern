# Authentication Module

Complete authentication module for the CMS backend using NestJS, Prisma, and JWT.

## Features

- JWT-based authentication
- User registration and login
- Password reset flow
- Password change for authenticated users
- Token refresh mechanism
- Role-based access control (RBAC)
- Google OAuth2 integration
- Login tracking and analytics
- Public route decorator

## API Endpoints

### Public Endpoints (No Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login with email and password |
| POST | `/auth/register` | Register new user |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with token |
| GET | `/auth/google` | Initiate Google OAuth login |
| GET | `/auth/google/callback` | Google OAuth callback |

### Protected Endpoints (Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/me` | Get current user profile |
| POST | `/auth/change-password` | Change password |
| POST | `/auth/logout` | Logout user |

## Services

### AuthService

Main authentication service with the following methods:

- `login(user)` - Generate tokens for authenticated user
- `validateUser(email, password)` - Validate user credentials
- `register(userData)` - Register new user
- `refreshToken(token)` - Refresh access token
- `forgotPassword(email)` - Generate password reset token
- `resetPassword(token, newPassword)` - Reset password with token
- `changePassword(userId, oldPassword, newPassword)` - Change user password
- `getUserProfile(userId)` - Get user profile
- `validateUserById(userId)` - Validate user by ID (used by JWT strategy)

### TokenService

Token management service with the following methods:

- `generateAccessToken(payload, expiresIn?)` - Generate access token
- `generateRefreshToken(payload)` - Generate refresh token
- `verifyToken(token, isRefreshToken?)` - Verify token
- `decodeToken(token)` - Decode token without verification
- `validateAccessToken(token)` - Validate access token
- `validateRefreshToken(token)` - Validate refresh token
- `refreshTokens(refreshToken)` - Refresh both tokens
- `getTokenExpiration(token)` - Get token expiration date
- `isTokenExpired(token)` - Check if token is expired
- `getUserIdFromToken(token)` - Extract user ID from token

## Guards

### JwtAuthGuard

Protects routes requiring authentication. Automatically applied globally except for routes marked with `@Public()` decorator.

Usage:
```typescript
@Get('protected')
@UseGuards(JwtAuthGuard)
async protectedRoute() {
  return { message: 'This is protected' };
}
```

### RolesGuard

Restricts access based on user roles.

Usage:
```typescript
@Get('admin-only')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SYSTEM_ADMIN, Role.PRINCIPAL)
async adminRoute() {
  return { message: 'Admin access only' };
}
```

## Decorators

### @Public()

Mark routes as public (no authentication required).

```typescript
@Public()
@Get('public')
async publicRoute() {
  return { message: 'Public access' };
}
```

### @CurrentUser()

Extract current user from request.

```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile(@CurrentUser() user) {
  return user;
}
```

### @Roles()

Specify required roles for a route.

```typescript
@Post('admin-action')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SYSTEM_ADMIN)
async adminAction() {
  return { message: 'Admin action' };
}
```

## Environment Variables

Required environment variables:

```env
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=your-refresh-secret-key-here
JWT_REFRESH_EXPIRATION=7d
```

## DTOs (Data Transfer Objects)

All endpoints use validated DTOs:

- `LoginDto` - Login credentials
- `RegisterDto` - Registration data
- `RefreshTokenDto` - Refresh token
- `ForgotPasswordDto` - Forgot password request
- `ResetPasswordDto` - Reset password data
- `ChangePasswordDto` - Change password data

## Database Schema

Uses Prisma User model with the following fields:

- Authentication: email, password, role, active
- Password Reset: resetPasswordToken, resetPasswordExpiry
- Login Tracking: lastLoginAt, loginCount, previousLoginAt, lastLoginIp
- Password Management: hasChangedDefaultPassword, passwordChangedAt

## Security Features

1. **Password Hashing**: Uses bcryptjs with salt rounds of 10
2. **Token Expiration**: Access tokens expire in 15 minutes, refresh tokens in 7 days
3. **Login Tracking**: Tracks login attempts, timestamps, and IP addresses
4. **Password Validation**: Enforces minimum length and prevents password reuse
5. **Account Status**: Checks if account is active before authentication
6. **Secure Password Reset**: Tokens expire after 1 hour

## Usage Examples

### Login
```typescript
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Register
```typescript
POST /auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "John Doe",
  "phoneNo": "+1234567890",
  "role": "STUDENT"
}
```

### Refresh Token
```typescript
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "your-refresh-token"
}
```

### Change Password
```typescript
POST /auth/change-password
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "oldPassword": "oldpass123",
  "newPassword": "newpass123"
}
```

### Get Current User
```typescript
GET /auth/me
Authorization: Bearer your-access-token
```

## Integration

To use in other modules:

```typescript
import { AuthModule, JwtAuthGuard, RolesGuard, Public } from '@/core/auth';

@Module({
  imports: [AuthModule],
  // ...
})
export class YourModule {}
```

## Notes

- The module is marked as `@Global()` for application-wide availability
- PrismaService is used for database operations
- Guards and decorators are exported for use in other modules
- Email service integration is required for password reset (currently TODO)
