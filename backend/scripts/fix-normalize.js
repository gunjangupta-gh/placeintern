const fs = require('fs');
const filePath = 'D:/placeintern/backend/scripts/link-faculty-branches-from-excel.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Find lines 215-222 and replace the function
const lines = content.split('\n');
let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function normalizeBranchName')) {
    startIdx = i;
  }
  if (startIdx !== -1 && lines[i].trim() === '}' && i > startIdx) {
    endIdx = i;
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  const newFunc = [
    'function normalizeBranchName(name: string): string {',
    '  return name',
    '    .toLowerCase()',
    '    .replace(/&/g, \'and\')',
    '    .replace(/[.,\\-_()\\[\\]\\/]/g, \' \')',
    '    .replace(/\\s+/g, \' \')',
    '    .trim();',
    '}'
  ];

  lines.splice(startIdx, endIdx - startIdx + 1, ...newFunc);
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log('Fixed normalizeBranchName function at lines', startIdx + 1, 'to', endIdx + 1);
} else {
  console.log('Could not find function boundaries');
}
