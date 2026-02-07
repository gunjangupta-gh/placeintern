import * as ExcelJS from 'exceljs';

/**
 * Excel utility module using exceljs (secure alternative to xlsx)
 * Provides similar API to xlsx for easy migration
 */

export interface SheetToJsonOptions {
  defval?: string | number | boolean | null;
  header?: number | 'A' | string[];
}

/**
 * Read an Excel file from a buffer
 */
export async function readExcelBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  return workbook;
}

/**
 * Get the first worksheet from a workbook
 */
export function getFirstSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  return workbook.worksheets[0];
}

/**
 * Get a worksheet by name
 */
export function getSheetByName(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet | undefined {
  return workbook.getWorksheet(name);
}

/**
 * Convert a worksheet to JSON array (similar to XLSX.utils.sheet_to_json)
 */
export function sheetToJson<T = Record<string, any>>(
  worksheet: ExcelJS.Worksheet,
  options: SheetToJsonOptions = {},
): T[] {
  const { defval = '' } = options;
  const result: T[] = [];

  if (!worksheet || worksheet.rowCount === 0) {
    return result;
  }

  // Get headers from first row
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = cell.value;
    headers[colNumber - 1] = value ? String(value).trim() : `Column${colNumber}`;
  });

  // Process data rows (starting from row 2)
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const rowData: Record<string, any> = {};
    let hasData = false;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        let value = cell.value;

        // Handle different cell value types
        if (value === null || value === undefined) {
          value = defval;
        } else if (typeof value === 'object') {
          // Handle rich text, formulas, etc.
          if ('richText' in value) {
            value = (value as ExcelJS.CellRichTextValue).richText
              .map((rt) => rt.text)
              .join('');
          } else if ('result' in value) {
            value = (value as ExcelJS.CellFormulaValue).result;
          } else if ('text' in value) {
            value = (value as ExcelJS.CellHyperlinkValue).text;
          } else if (value instanceof Date) {
            value = value.toISOString();
          } else {
            value = String(value);
          }
        }

        rowData[header] = value;
        if (value !== defval && value !== '' && value !== null) {
          hasData = true;
        }
      }
    });

    // Only add rows that have actual data
    if (hasData) {
      result.push(rowData as T);
    }
  }

  return result;
}

/**
 * Create a new workbook
 */
export function createWorkbook(): ExcelJS.Workbook {
  return new ExcelJS.Workbook();
}

/**
 * Add a worksheet with data from JSON array (similar to XLSX.utils.json_to_sheet)
 */
export function addSheetFromJson(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  data: Record<string, any>[],
  options: { columnWidths?: Record<string, number> } = {},
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(sheetName);

  if (data.length === 0) {
    return worksheet;
  }

  // Get all unique headers from all objects
  const headersSet = new Set<string>();
  data.forEach((row) => {
    Object.keys(row).forEach((key) => headersSet.add(key));
  });
  const headers = Array.from(headersSet);

  // Add header row
  worksheet.addRow(headers);

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Add data rows
  data.forEach((rowData) => {
    const values = headers.map((header) => {
      const value = rowData[header];
      // Handle undefined/null values
      if (value === undefined || value === null) {
        return '';
      }
      return value;
    });
    worksheet.addRow(values);
  });

  // Auto-fit columns (approximate)
  headers.forEach((header, index) => {
    const column = worksheet.getColumn(index + 1);
    const customWidth = options.columnWidths?.[header];
    if (customWidth) {
      column.width = customWidth;
    } else {
      // Calculate width based on header and max content length
      let maxLength = header.length;
      data.forEach((row) => {
        const value = row[header];
        if (value !== null && value !== undefined) {
          const len = String(value).length;
          if (len > maxLength) {
            maxLength = len;
          }
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    }
  });

  return worksheet;
}

/**
 * Write workbook to buffer
 */
export async function writeToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Simplified API that matches xlsx usage patterns
 */
export const ExcelUtils = {
  /**
   * Read Excel file from buffer (async version of XLSX.read)
   */
  async read(buffer: Buffer): Promise<{ workbook: ExcelJS.Workbook; sheets: string[] }> {
    const workbook = await readExcelBuffer(buffer);
    const sheets = workbook.worksheets.map((ws) => ws.name);
    return { workbook, sheets };
  },

  /**
   * Get sheet data as JSON (similar to XLSX.utils.sheet_to_json)
   */
  sheetToJson<T = Record<string, any>>(
    workbook: ExcelJS.Workbook,
    sheetNameOrIndex: string | number = 0,
    options: SheetToJsonOptions = {},
  ): T[] {
    const worksheet =
      typeof sheetNameOrIndex === 'number'
        ? workbook.worksheets[sheetNameOrIndex]
        : workbook.getWorksheet(sheetNameOrIndex);

    if (!worksheet) {
      return [];
    }

    return sheetToJson<T>(worksheet, options);
  },

  /**
   * Create a new workbook with sheets from JSON data
   */
  async createFromJson(
    sheets: Array<{ name: string; data: Record<string, any>[] }>,
  ): Promise<Buffer> {
    const workbook = createWorkbook();

    for (const sheet of sheets) {
      addSheetFromJson(workbook, sheet.name, sheet.data);
    }

    return writeToBuffer(workbook);
  },

  /**
   * Create workbook, add sheets, and write to buffer
   * (combines XLSX.utils.book_new, book_append_sheet, and XLSX.write)
   */
  async buildWorkbook(
    builder: (workbook: ExcelJS.Workbook) => void | Promise<void>,
  ): Promise<Buffer> {
    const workbook = createWorkbook();
    await builder(workbook);
    return writeToBuffer(workbook);
  },

  // Re-export helpers for more complex use cases
  createWorkbook,
  addSheetFromJson,
  writeToBuffer,
  sheetToJsonFromWorksheet: sheetToJson,
};

export default ExcelUtils;
