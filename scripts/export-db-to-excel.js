const { Client } = require('pg');
const ExcelJS = require('exceljs');
const path = require('path');

const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'placeintern_db',
  user: 'postgres',
  password: 'postgres123',
};

async function exportToExcel() {
  const client = new Client(DB_CONFIG);

  try {
    console.log('Connecting to database...');
    await client.connect();

    // Get all table names
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PlaceIntern Export';
    workbook.created = new Date();

    for (const tableName of tables) {
      console.log(`Exporting table: ${tableName}...`);

      // Get table data
      const dataResult = await client.query(`SELECT * FROM "${tableName}"`);

      if (dataResult.rows.length === 0) {
        console.log(`  - No data in ${tableName}, skipping...`);
        continue;
      }

      // Create worksheet
      const worksheet = workbook.addWorksheet(tableName);

      // Modify column headers - rename _cents columns to show they're now in dollars
      const columns = dataResult.fields.map(field => {
        let headerName = field.name;
        if (field.name.endsWith('_cents')) {
          // Rename column: amount_cents -> amount (USD/INR)
          headerName = field.name.replace('_cents', '');
        }
        return {
          header: headerName,
          key: field.name,
          width: Math.max(headerName.length + 2, 15),
        };
      });
      worksheet.columns = columns;

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add data rows
      for (const row of dataResult.rows) {
        // Convert any objects/arrays to JSON strings for Excel compatibility
        const processedRow = {};
        for (const [key, value] of Object.entries(row)) {
          if (value === null || value === undefined) {
            processedRow[key] = '';
          } else if (typeof value === 'object' && !(value instanceof Date)) {
            processedRow[key] = JSON.stringify(value);
          } else if (key.endsWith('_cents')) {
            // Convert cents to dollars/currency units
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
        to: { row: 1, column: columns.length },
      };

      console.log(`  - Exported ${dataResult.rows.length} rows`);
    }

    // Save file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputPath = path.join(__dirname, '..', 'backups', `placeintern_db_${timestamp}.xlsx`);

    await workbook.xlsx.writeFile(outputPath);
    console.log(`\nExport complete!`);
    console.log(`File saved to: ${outputPath}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

exportToExcel();
