import * as XLSX from 'xlsx';

const EXCEL_FILE_PATH = 'D:\\chrome download\\FDP 2026 Annual Training Plan (Final) .xlsx';

try {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(EXCEL_FILE_PATH);

  console.log('\n=== WORKBOOK INFO ===');
  console.log('Sheet Names:', workbook.SheetNames);

  // Read first sheet
  const sheetName = workbook.SheetNames[0];
  console.log('\nAnalyzing sheet:', sheetName);

  const worksheet = workbook.Sheets[sheetName];
  const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

  console.log('\n=== DATA SUMMARY ===');
  console.log('Total rows:', rawData.length);

  if (rawData.length > 0) {
    console.log('\n=== COLUMN NAMES ===');
    const columns = Object.keys(rawData[0]);
    columns.forEach((col, idx) => {
      console.log(`${idx + 1}. "${col}"`);
    });

    console.log('\n=== FIRST 5 ROWS ===');
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      console.log(`\n--- Row ${i + 1} ---`);
      console.log(JSON.stringify(rawData[i], null, 2));
    }

    // Find rows with actual data
    console.log('\n=== FINDING DATA ROWS ===');
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
      const row = rawData[i];
      const hasData = Object.values(row).some(v => v && v.toString().trim().length > 0);
      if (hasData) {
        const firstValue = row[Object.keys(row)[0]];
        const secondValue = row[Object.keys(row)[1]];
        console.log(`Row ${i + 1}: "${firstValue}" | "${secondValue}"`);
      }
    }
  }

  console.log('\n=== Analysis Complete ===');
} catch (error) {
  console.error('Error reading Excel file:', error);
}
