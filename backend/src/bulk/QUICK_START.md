# Bulk Operations - Quick Start Guide

## Overview
Quickly upload users, students, or institutions in bulk using Excel/CSV files.

## Quick Steps

### 1. Download Template
```bash
GET /bulk/templates/{type}

Types: users | students | institutions
```

### 2. Fill Template
Open the downloaded Excel file and fill in your data following the instructions sheet.

### 3. Validate (Optional but Recommended)
```bash
POST /bulk/{type}/validate

Upload your file to check for errors before actual upload.
```

### 4. Upload
```bash
POST /bulk/{type}/upload

Upload your file to create records.
```

## Examples

### Bulk User Upload (Staff/Faculty)

**Step 1:** Download template
```bash
curl -X GET "http://localhost:3000/bulk/templates/users" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o user-template.xlsx
```

**Step 2:** Fill template with data
- Name: John Doe
- Email: john.doe@college.edu
- Role: FACULTY
- etc.

**Step 3:** Upload
```bash
curl -X POST "http://localhost:3000/bulk/users/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@filled-users.xlsx"
```

### Bulk Student Upload

**Step 1:** Download template
```bash
curl -X GET "http://localhost:3000/bulk/templates/students" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o student-template.xlsx
```

**Step 2:** Fill template
- Name: Jane Smith
- Email: jane.smith@student.college.edu
- Enrollment Number: EN2023001
- Batch: 2023-2026
- etc.

**Step 3:** Upload
```bash
curl -X POST "http://localhost:3000/bulk/students/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@filled-students.xlsx"
```

## Role Requirements

| Operation | Required Roles |
|-----------|----------------|
| Bulk Users | PRINCIPAL, SYSTEM_ADMIN |
| Bulk Students | PRINCIPAL, SYSTEM_ADMIN |
| Bulk Institutions | SYSTEM_ADMIN, STATE_DIRECTORATE |

## File Requirements

- **Format:** CSV or Excel (.xlsx, .xls)
- **Size Limits:**
  - Users: 5MB (max 500 records)
  - Students: 10MB (max 1000 records)
  - Institutions: 5MB (max 100 records)

## Response Format

```json
{
  "total": 100,
  "success": 95,
  "failed": 5,
  "successRecords": [...],
  "failedRecords": [
    {
      "row": 10,
      "name": "John Doe",
      "email": "john@example.com",
      "error": "Email already exists"
    }
  ],
  "processingTime": 2345
}
```

## Common Issues & Solutions

### Issue: "Batch not found"
**Solution:** Create the batch first or use an existing batch name exactly as it appears in the system.

### Issue: "Email already exists"
**Solution:** Check if the user already exists in the system. Update the email or remove the duplicate entry.

### Issue: "Invalid role"
**Solution:** Use only these roles for users: FACULTY, MENTOR, PRINCIPAL

### Issue: "File too large"
**Solution:** Split your file into smaller batches (500 users, 1000 students, or 100 institutions per file).

### Issue: "Invalid email format"
**Solution:** Ensure emails follow the format: name@domain.com

## Default Passwords

- **Users (Staff):** `Welcome@123`
- **Students:** First 4 letters of name + last 4 digits of enrollment + `@123`
  - Example: For "John Doe" with enrollment "EN2023001" → `john3001@123`
- **Principals (when creating institutions):** `Principal@123`

**Important:** All users must change their password on first login.

## Tips for Success

1. **Always download the latest template** - Column names must match exactly
2. **Use the validation endpoint first** - Catch errors before upload
3. **Start with a small test file** - Upload 5-10 records to test
4. **Check prerequisites:**
   - For students: Ensure batches exist
   - For users: Verify institution is set up
5. **Keep enrollment numbers unique** - No duplicates allowed
6. **Use consistent date format** - YYYY-MM-DD (e.g., 2005-01-15)

## Support

If you encounter issues:
1. Check the error message in the response
2. Verify your data against the template
3. Use the validation endpoint to identify issues
4. Review the full documentation in README.md

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/bulk/templates/{type}` | GET | Download template |
| `/bulk/users/validate` | POST | Validate user data |
| `/bulk/users/upload` | POST | Upload users |
| `/bulk/students/validate` | POST | Validate student data |
| `/bulk/students/upload` | POST | Upload students |
| `/bulk/institutions/validate` | POST | Validate institution data |
| `/bulk/institutions/upload` | POST | Upload institutions |

---

**Need more details?** See the full [README.md](./README.md) documentation.
