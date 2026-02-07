# Backend Restart Instructions

## Issue
After updating the report builder code to remove normalization logic, the backend needs to be restarted for changes to take effect.

**Error Message**:
```
Report generation failed: Unknown report type: industry-wise-students-stipend
```

## Solution: Restart Backend Server

### Option 1: Development Mode (Recommended)
If running in development mode with watch:

```bash
# Stop the current server (Ctrl+C)
# Then restart
cd backend
npm run start:dev
```

### Option 2: Production Build
If running in production mode:

```bash
cd backend

# Build the project
npm run build

# Start the server
npm run start:prod
```

### Option 3: Kill Process and Restart

**Windows**:
```bash
# Find the process
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Restart
cd backend
npm run start:dev
```

**Linux/Mac**:
```bash
# Find and kill the process
pkill -f "nest start"

# Or find by port
lsof -ti:3000 | xargs kill -9

# Restart
cd backend
npm run start:dev
```

## Verification

After restarting, the industry report should work properly:

1. **Check server logs** - Should see:
   ```
   [Nest] Starting Nest application...
   [ReportGenerator] Industry reports registered
   ```

2. **Test the report** - Make a request to generate the industry report

3. **Verify normalization** - Company names should use database values (no runtime normalization)

## What Changed

### Files Modified
1. ✅ `report-generator.service.ts` - Removed normalization function, improved active student counting
2. ✅ `industry-reports.definition.ts` - Updated column definitions
3. ✅ Report type properly registered at line 1915-1916

### Expected Behavior After Restart
- ✅ Industry report generates successfully
- ✅ Company names come directly from database (already normalized)
- ✅ Active students counted using `internshipPhase = 'ACTIVE'`
- ✅ Location information preserved (e.g., "PSPCL, Dasuya")

## Still Not Working?

### Check 1: Verify Build Output
```bash
cd backend
npm run build
# Look for any TypeScript errors
```

### Check 2: Check Server Logs
```bash
# Look for the server startup logs
# Should see all report types registered including 'industry-wise-students-stipend'
```

### Check 3: Clear Cache
```bash
cd backend
rm -rf dist
rm -rf node_modules/.cache
npm run build
npm run start:dev
```

### Check 4: Verify Report Type in Code
The report should be registered in `report-generator.service.ts` around line 1915:

```typescript
case 'industry-wise-students-stipend':
  return this.generateIndustryWiseStudentsStipendReport(filters, pagination);
```

## Quick Restart Command

```bash
# Navigate to backend
cd "D:\New folder (2)\cms-new\backend"

# Stop any running process
# Press Ctrl+C if running in terminal

# Restart in development mode
npm run start:dev
```

---

**Note**: After any code changes to the backend, especially service files, the server must be restarted for changes to take effect. In development mode with `--watch`, some changes auto-reload, but service registration changes typically require a full restart.
