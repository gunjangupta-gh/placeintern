const { Client } = require('pg');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'placeintern_db',
  user: 'postgres',
  password: 'postgres123',
};

// PostgreSQL to MySQL type mapping
const typeMapping = {
  'uuid': 'VARCHAR(36)',
  'character varying': 'VARCHAR',
  'varchar': 'VARCHAR',
  'text': 'TEXT',
  'integer': 'INT',
  'bigint': 'BIGINT',
  'smallint': 'SMALLINT',
  'boolean': 'TINYINT(1)',
  'timestamp without time zone': 'DATETIME',
  'timestamp with time zone': 'DATETIME',
  'date': 'DATE',
  'time': 'TIME',
  'numeric': 'DECIMAL',
  'decimal': 'DECIMAL',
  'real': 'FLOAT',
  'double precision': 'DOUBLE',
  'json': 'JSON',
  'jsonb': 'JSON',
  'bytea': 'BLOB',
};

function escapeMySQL(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
  }
  // Escape string
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function convertToMySQLType(pgType, charMaxLength) {
  const baseType = pgType.toLowerCase();

  for (const [pgPattern, mysqlType] of Object.entries(typeMapping)) {
    if (baseType.includes(pgPattern)) {
      if (mysqlType === 'VARCHAR' && charMaxLength) {
        return `VARCHAR(${charMaxLength})`;
      }
      if (mysqlType === 'VARCHAR' && !charMaxLength) {
        return 'TEXT';
      }
      return mysqlType;
    }
  }
  return 'TEXT'; // Default fallback
}

async function exportToMySQLAndExcel() {
  const client = new Client(DB_CONFIG);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const mysqlOutputPath = path.join(__dirname, '..', 'backups', `placeintern_mysql_${timestamp}.sql`);
  const excelOutputPath = path.join(__dirname, '..', 'backups', `placeintern_db_${timestamp}.xlsx`);

  let mysqlDump = '';

  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();

    // MySQL header
    mysqlDump += `-- MySQL Dump converted from PostgreSQL\n`;
    mysqlDump += `-- Generated: ${new Date().toISOString()}\n`;
    mysqlDump += `-- Source Database: ${DB_CONFIG.database}\n\n`;
    mysqlDump += `SET NAMES utf8mb4;\n`;
    mysqlDump += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    // Get all table names
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables: ${tables.join(', ')}\n`);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PlaceIntern Export';
    workbook.created = new Date();

    for (const tableName of tables) {
      console.log(`Processing table: ${tableName}...`);

      // Get column information
      const columnsResult = await client.query(`
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      // Get primary key
      const pkResult = await client.query(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary
      `, [tableName]);
      const primaryKeys = pkResult.rows.map(r => r.attname);

      // Generate CREATE TABLE statement
      mysqlDump += `-- ----------------------------\n`;
      mysqlDump += `-- Table structure for ${tableName}\n`;
      mysqlDump += `-- ----------------------------\n`;
      mysqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      mysqlDump += `CREATE TABLE \`${tableName}\` (\n`;

      const columnDefs = columnsResult.rows.map(col => {
        const mysqlType = convertToMySQLType(col.data_type, col.character_maximum_length);
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        let defaultVal = '';

        if (col.column_default) {
          // Convert PostgreSQL defaults to MySQL
          if (col.column_default.includes('uuid_generate')) {
            defaultVal = ''; // MySQL doesn't have UUID generation by default
          } else if (col.column_default === 'true') {
            defaultVal = 'DEFAULT 1';
          } else if (col.column_default === 'false') {
            defaultVal = 'DEFAULT 0';
          } else if (col.column_default.match(/^'.*'::.*$/)) {
            // Extract value from PostgreSQL cast
            const match = col.column_default.match(/^'(.*)'::.*$/);
            if (match) {
              defaultVal = `DEFAULT '${match[1]}'`;
            }
          } else if (col.column_default.match(/^\d+$/)) {
            defaultVal = `DEFAULT ${col.column_default}`;
          }
        }

        return `  \`${col.column_name}\` ${mysqlType} ${nullable} ${defaultVal}`.trim();
      });

      if (primaryKeys.length > 0) {
        columnDefs.push(`  PRIMARY KEY (${primaryKeys.map(k => `\`${k}\``).join(', ')})`);
      }

      mysqlDump += columnDefs.join(',\n');
      mysqlDump += `\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

      // Get table data
      const dataResult = await client.query(`SELECT * FROM "${tableName}"`);

      if (dataResult.rows.length === 0) {
        console.log(`  - No data in ${tableName}, skipping data export...`);
        mysqlDump += `-- No data in ${tableName}\n\n`;
        continue;
      }

      // Generate INSERT statements
      mysqlDump += `-- ----------------------------\n`;
      mysqlDump += `-- Records of ${tableName}\n`;
      mysqlDump += `-- ----------------------------\n`;

      const columns = dataResult.fields.map(f => f.name);
      const columnList = columns.map(c => `\`${c}\``).join(', ');

      // Batch inserts (100 rows per INSERT for efficiency)
      const batchSize = 100;
      for (let i = 0; i < dataResult.rows.length; i += batchSize) {
        const batch = dataResult.rows.slice(i, i + batchSize);
        const values = batch.map(row => {
          const rowValues = columns.map(col => escapeMySQL(row[col]));
          return `(${rowValues.join(', ')})`;
        });
        mysqlDump += `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n${values.join(',\n')};\n\n`;
      }

      console.log(`  - MySQL: ${dataResult.rows.length} rows`);

      // Create Excel worksheet
      const worksheet = workbook.addWorksheet(tableName);

      // Modify column headers - rename _cents columns
      const excelColumns = dataResult.fields.map(field => {
        let headerName = field.name;
        if (field.name.endsWith('_cents')) {
          headerName = field.name.replace('_cents', '');
        }
        return {
          header: headerName,
          key: field.name,
          width: Math.max(headerName.length + 2, 15),
        };
      });
      worksheet.columns = excelColumns;

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add data rows
      for (const row of dataResult.rows) {
        const processedRow = {};
        for (const [key, value] of Object.entries(row)) {
          if (value === null || value === undefined) {
            processedRow[key] = '';
          } else if (typeof value === 'object' && !(value instanceof Date)) {
            processedRow[key] = JSON.stringify(value);
          } else if (key.endsWith('_cents')) {
            processedRow[key] = Number(value) / 100;
          } else {
            processedRow[key] = value;
          }
        }
        worksheet.addRow(processedRow);
      }

      // Format currency columns
      worksheet.columns.forEach((col, index) => {
        if (col.key && col.key.endsWith('_cents')) {
          worksheet.getColumn(index + 1).numFmt = '#,##0.00';
        }
      });

      // Auto-filter
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: excelColumns.length },
      };

      console.log(`  - Excel: ${dataResult.rows.length} rows`);
    }

    // MySQL footer
    mysqlDump += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    // Save MySQL dump
    fs.writeFileSync(mysqlOutputPath, mysqlDump, 'utf8');
    console.log(`\nMySQL dump saved to: ${mysqlOutputPath}`);

    // Save Excel file
    await workbook.xlsx.writeFile(excelOutputPath);
    console.log(`Excel file saved to: ${excelOutputPath}`);

    // Print summary
    const mysqlSize = (fs.statSync(mysqlOutputPath).size / 1024 / 1024).toFixed(2);
    const excelSize = (fs.statSync(excelOutputPath).size / 1024 / 1024).toFixed(2);

    console.log(`\n========================================`);
    console.log(`Export Complete!`);
    console.log(`========================================`);
    console.log(`MySQL Dump: ${mysqlOutputPath} (${mysqlSize} MB)`);
    console.log(`Excel File: ${excelOutputPath} (${excelSize} MB)`);
    console.log(`========================================\n`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

exportToMySQLAndExcel();
