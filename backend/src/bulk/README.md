# Bulk Operations Module

This module provides comprehensive bulk upload functionality for the CMS system, enabling efficient mass data import through CSV/Excel files.

## Features

### 1. Bulk User Upload (Staff/Faculty)
- Upload multiple staff members (Faculty, Mentors, Principals) via Excel/CSV
- Automatic validation and error reporting
- Default password generation
- Supports up to 500 users per upload

### 2. Bulk Student Upload
- Upload student records with complete profile information
- Automatic user account creation with temporary credentials
- Batch and branch assignment
- Supports up to 1000 students per upload

### 3. Bulk Institution Upload (Admin Only)
- Upload multiple institutions with optional principal user creation
- Automatic institution code validation
- System Admin and State Directorate access only
- Supports up to 100 institutions per upload

## API Endpoints

### Bulk User Operations

#### Upload Users
```
POST /bulk/users/upload
Authorization: Bearer <token>
Roles: PRINCIPAL, SYSTEM_ADMIN
Content-Type: multipart/form-data

Form Data:
- file: Excel/CSV file
```

#### Validate Users
```
POST /bulk/users/validate
Authorization: Bearer <token>
Roles: PRINCIPAL, SYSTEM_ADMIN
Content-Type: multipart/form-data

Form Data:
- file: Excel/CSV file
```

#### Download Template
```
GET /bulk/users/template
Authorization: Bearer <token>
Roles: PRINCIPAL, SYSTEM_ADMIN
```

### Bulk Student Operations

#### Upload Students
```
POST /bulk/students/upload
Authorization: Bearer <token>
Roles: PRINCIPAL, SYSTEM_ADMIN
Content-Type: multipart/form-data

Form Data:
- file: Excel/CSV file
```

#### Validate Students
```
POST /bulk/students/validate
Authorization: Bearer <token>
Roles: PRINCIPAL, SYSTEM_ADMIN
Content-Type: multipart/form-data

Form Data:
- file: Excel/CSV file
```

#### Download Template
```
GET /bulk/students/template
Authorization: Bearer <token>
Roles: PRINCIPAL, SYSTEM_ADMIN
```

### Bulk Institution Operations

#### Upload Institutions
```
POST /bulk/institutions/upload
Authorization: Bearer <token>
Roles: SYSTEM_ADMIN, STATE_DIRECTORATE
Content-Type: multipart/form-data

Form Data:
- file: Excel/CSV file
```

#### Validate Institutions
```
POST /bulk/institutions/validate
Authorization: Bearer <token>
Roles: SYSTEM_ADMIN, STATE_DIRECTORATE
Content-Type: multipart/form-data

Form Data:
- file: Excel/CSV file
```

#### Download Template
```
GET /bulk/institutions/template
Authorization: Bearer <token>
Roles: SYSTEM_ADMIN, STATE_DIRECTORATE
```

### Template Downloads (Unified Endpoint)

```
GET /bulk/templates/:type
Authorization: Bearer <token>
Roles: PRINCIPAL, SYSTEM_ADMIN, STATE_DIRECTORATE

Parameters:
- type: users | students | institutions
```

## Template Format

### User Template Fields

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| Name | Yes | Full name of the user | John Doe |
| Email | Yes | Valid email address (unique) | john.doe@example.com |
| Phone | No | Contact phone number | 9876543210 |
| Role | Yes | FACULTY, MENTOR, or PRINCIPAL | FACULTY |
| Designation | No | Job designation | Professor |
| Department | No | Department name | Computer Science |
| Employee ID | No | Employee identification | EMP001 |

**Default Password:** `Welcome@123`

### Student Template Fields

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| Name | Yes | Full name of the student | Jane Doe |
| Email | Yes | Valid email address (unique) | jane.doe@example.com |
| Phone | No | Contact phone number | 9876543210 |
| Enrollment Number | Yes | Unique enrollment/admission number | EN2023001 |
| Roll Number | No | Student roll number | R2023001 |
| Batch | Yes | Batch name (must exist in system) | 2023-2026 |
| Branch | No | Branch/Department name | Computer Science |
| Semester | No | Current semester (1-8) | 1 |
| Date of Birth | No | Date of birth (YYYY-MM-DD) | 2005-01-15 |
| Gender | No | MALE, FEMALE, or OTHER | MALE |
| Address | No | Residential address | 123 Main Street |
| Parent Name | No | Parent/Guardian name | Robert Doe |
| Parent Contact | No | Parent contact number | 9876543211 |
| 10th % | No | 10th grade percentage | 85.5 |
| 12th % | No | 12th grade percentage | 88.0 |

**Temporary Password:** Generated from first 4 letters of name + last 4 digits of enrollment + "@123"
Example: `john2001@123`

### Institution Template Fields

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| Name | Yes | Full name of the institution | ABC Engineering College |
| Code | Yes | Unique institution code | ABC001 |
| Type | No | Institution type | Engineering |
| Email | Yes | Institution contact email | contact@abc.edu |
| Phone | No | Institution contact phone | 0121-2345678 |
| Address | No | Institution address | 123 College Road |
| City | No | City name | Bangalore |
| State | No | State name | Karnataka |
| Pin Code | No | Postal pin code | 560001 |
| Website | No | Institution website URL | https://www.abc.edu |
| Principal Name | No | Principal full name (creates user) | Dr. John Smith |
| Principal Email | No | Principal email (required if creating) | principal@abc.edu |
| Principal Phone | No | Principal contact number | 9876543210 |

**Default Principal Password (if created):** `Principal@123`

## Validation Features

### Pre-Upload Validation
- File type validation (CSV, Excel only)
- File size limits (5MB for users/institutions, 10MB for students)
- Maximum record limits per upload

### Data Validation
- Required field checks
- Email format validation
- Duplicate detection (within file and against database)
- Role/enum value validation
- Batch and branch existence checks
- Phone number format validation (optional)
- Date format validation (optional)

### Response Format

#### Success Response
```json
{
  "total": 100,
  "success": 95,
  "failed": 5,
  "successRecords": [
    {
      "row": 2,
      "name": "John Doe",
      "email": "john.doe@example.com",
      "userId": "507f1f77bcf86cd799439011"
    }
  ],
  "failedRecords": [
    {
      "row": 5,
      "name": "Jane Smith",
      "email": "invalid-email",
      "error": "Invalid email format",
      "details": "Field: email, Value: invalid-email"
    }
  ],
  "processingTime": 3456
}
```

#### Validation Response
```json
{
  "isValid": false,
  "totalRows": 100,
  "validRows": 95,
  "invalidRows": 5,
  "errors": [
    {
      "row": 3,
      "field": "email",
      "value": "duplicate@example.com",
      "error": "Email already exists in the system"
    }
  ],
  "warnings": [
    {
      "row": 10,
      "field": "branchName",
      "message": "Branch 'Mechanical' not found. Student will be created without branch."
    }
  ]
}
```

## Architecture

### Module Structure
```
bulk/
├── bulk-user/
│   ├── dto/
│   │   └── bulk-user.dto.ts
│   ├── bulk-user.controller.ts
│   ├── bulk-user.service.ts
│   └── bulk-user.module.ts
├── bulk-student/
│   ├── dto/
│   │   └── bulk-student.dto.ts
│   ├── bulk-student.controller.ts
│   ├── bulk-student.service.ts
│   └── bulk-student.module.ts
├── bulk-institution/
│   ├── dto/
│   │   └── bulk-institution.dto.ts
│   ├── bulk-institution.controller.ts
│   ├── bulk-institution.service.ts
│   └── bulk-institution.module.ts
├── shared/
│   ├── bulk-validation.service.ts
│   └── bulk.processor.ts
├── templates/
│   └── template.controller.ts
├── bulk.module.ts
└── README.md
```

### Processing Flow

1. **File Upload** → Controller receives multipart form data
2. **File Validation** → Check file type, size, and format
3. **Data Parsing** → Extract data from Excel/CSV using `xlsx` library
4. **Pre-Validation** → Validate all records before processing
5. **Batch Processing** → Process records in batches (5-10 at a time)
6. **Database Operations** → Create user accounts and profiles
7. **Result Collection** → Collect success and failure records
8. **Response** → Return detailed report with processing time

### Queue Integration

The module integrates with BullMQ for asynchronous processing:
- Queue Name: `bulk-operations`
- Jobs: `bulk-upload-users`, `bulk-upload-students`, `bulk-upload-institutions`
- Retry: 2 attempts with exponential backoff
- Progress tracking enabled

### Security Features

- **Role-based access control**
  - Principal: Can upload users and students for their institution
  - System Admin: Can upload all entity types
  - State Directorate: Can upload institutions

- **Institution scoping**
  - Users and students are automatically linked to the principal's institution
  - Prevents cross-institution data manipulation

- **Password security**
  - Default passwords are hashed using bcrypt
  - Users must change password on first login (tracked via `hasChangedDefaultPassword`)

## Error Handling

### Common Errors

1. **Duplicate Email**
   - Within file: Detected during validation
   - In database: Checked before creation

2. **Invalid Batch/Branch**
   - Validated against existing records
   - Provides list of available options in error message

3. **File Format Issues**
   - Invalid column names
   - Missing required columns
   - Empty rows

4. **Database Constraints**
   - Unique constraint violations
   - Foreign key violations
   - Data type mismatches

### Error Response Details

Each failed record includes:
- Row number (for easy identification in source file)
- Field name (if applicable)
- Invalid value
- Descriptive error message
- Additional details (stack trace first line)

## Best Practices

### For Users

1. **Download the template first** - Always use the provided template to ensure correct format
2. **Validate before upload** - Use the validation endpoint to check data before actual upload
3. **Start small** - Test with a few records before uploading large files
4. **Check prerequisites** - Ensure batches and branches exist before uploading students
5. **Review errors** - Carefully review error messages and fix source data

### For Developers

1. **Batch size tuning** - Adjust batch sizes based on database performance
2. **Timeout handling** - Monitor processing time for large uploads
3. **Memory management** - Stream large files instead of loading entirely in memory
4. **Logging** - Monitor logs for performance and error patterns
5. **Cache invalidation** - Ensure caches are invalidated after bulk operations

## Performance Considerations

- **Parallel processing**: Records are processed in parallel within batches
- **Database optimization**: Uses Prisma transactions for atomicity
- **Validation caching**: Batch validation of emails and enrollment numbers
- **Progress tracking**: Real-time progress updates for long-running jobs

## Future Enhancements

1. **Async upload with notifications** - Process large files asynchronously and notify on completion
2. **Upload history** - Track and store upload history with downloadable reports
3. **Rollback support** - Ability to rollback failed bulk uploads
4. **Update mode** - Support updating existing records in addition to creation
5. **Field mapping UI** - Allow users to map custom CSV columns to system fields
6. **Duplicate handling strategies** - Skip, update, or error on duplicates
7. **Email notifications** - Send credentials to users after bulk upload
8. **Audit trail** - Enhanced audit logging for bulk operations

## Dependencies

- `@nestjs/common` - NestJS framework
- `@nestjs/bullmq` - Queue processing
- `@prisma/client` - Database ORM
- `xlsx` - Excel file parsing
- `bcryptjs` - Password hashing
- `class-validator` - DTO validation
- `class-transformer` - DTO transformation

## Testing

### Manual Testing

1. Download template: `GET /bulk/templates/users`
2. Fill in sample data
3. Validate: `POST /bulk/users/validate` with file
4. Review validation results
5. Upload: `POST /bulk/users/upload` with file
6. Verify created records in database

### Example cURL Commands

```bash
# Download template
curl -X GET "http://localhost:3000/bulk/templates/students" \
  -H "Authorization: Bearer <token>" \
  -o student-template.xlsx

# Validate file
curl -X POST "http://localhost:3000/bulk/students/validate" \
  -H "Authorization: Bearer <token>" \
  -F "file=@students.xlsx"

# Upload file
curl -X POST "http://localhost:3000/bulk/students/upload" \
  -H "Authorization: Bearer <token>" \
  -F "file=@students.xlsx"
```

## Support

For issues or questions:
1. Check validation error messages
2. Review this documentation
3. Examine server logs
4. Contact system administrator

---

**Version:** 1.0.0
**Last Updated:** December 2024
**Module Status:** Production Ready
