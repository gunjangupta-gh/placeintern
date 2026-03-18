import * as XLSX from 'xlsx';

const EXCEL_FILE_PATH = 'D:\\placeintern\\FDP 2026 Annual Training Plan (Final) .xlsx';

try {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(EXCEL_FILE_PATH);

  console.log('\n=== WORKBOOK INFO ===');
  console.log('Sheet Names:', workbook.SheetNames);

  // Analyze each sheet
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== SHEET: ${sheetName} ===`);
    console.log('='.repeat(60));

    const worksheet = workbook.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

    console.log('Total rows:', rawData.length);

    if (rawData.length > 0) {
      console.log('\n--- COLUMN NAMES ---');
      const columns = Object.keys(rawData[0]);
      columns.forEach((col, idx) => {
        console.log(`  ${idx + 1}. "${col}"`);
      });

      console.log('\n--- FIRST 10 ROWS ---');
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        console.log(`\n[Row ${i + 1}]`);
        const row = rawData[i];
        Object.entries(row).forEach(([key, value]) => {
          const displayKey = key.startsWith('__EMPTY') ? `Col${key.replace('__EMPTY', '') || '0'}` : key;
          const displayValue = value?.toString().substring(0, 100);
          console.log(`  ${displayKey}: ${displayValue}`);
        });
      }

      // Look for specific keywords
      console.log('\n--- SEARCHING FOR KEYWORDS ---');
      const keywords = ['polytechnic', 'wing', 'branch', 'target', 'department'];
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowStr = JSON.stringify(row).toLowerCase();
        for (const keyword of keywords) {
          if (rowStr.includes(keyword)) {
            console.log(`Found "${keyword}" in row ${i + 1}:`, JSON.stringify(row).substring(0, 200));
            break;
          }
        }
      }
    }
  }

  console.log('\n=== Analysis Complete ===');
} catch (error) {
  console.error('Error reading Excel file:', error);
}
