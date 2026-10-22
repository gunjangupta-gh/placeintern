import * as ExcelJS from 'exceljs';
import type { CmDashboardData, CmGroupData, CollegeInfoData } from './state-cm-report.service';

/**
 * Renders the report JSON into Excel sheets that mirror the Word formats
 * (CM_Dashboard_Information_Format / Complete_Information_Courses): same
 * blocks, headings and column order, bordered tables, shaded headers.
 */

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};
const HEAD_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
const BLOCK_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };

type Align = Partial<ExcelJS.Alignment>;
const CENTER: Align = { horizontal: 'center', vertical: 'middle', wrapText: true };
const LEFT: Align = { horizontal: 'left', vertical: 'middle', wrapText: true };

const yn = (v: boolean | null | undefined) => (v === null || v === undefined ? '' : v ? 'Yes' : 'No');
const num = (v: number | null | undefined) => (v === null || v === undefined ? '' : v);

/** Write a cell with the shared table styling. */
function put(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: ExcelJS.CellValue,
  opts: { bold?: boolean; fill?: ExcelJS.Fill; align?: Align; border?: boolean } = {},
) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.font = { name: 'Calibri', size: 11, bold: !!opts.bold };
  cell.alignment = opts.align ?? CENTER;
  if (opts.fill) cell.fill = opts.fill;
  if (opts.border !== false) cell.border = BORDER;
  return cell;
}

/** Merge a range and style the whole range so borders show on every edge. */
function mergeRange(
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  value: ExcelJS.CellValue,
  opts: { bold?: boolean; fill?: ExcelJS.Fill; align?: Align; border?: boolean } = {},
) {
  if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      if (opts.fill) cell.fill = opts.fill;
      if (opts.border !== false) cell.border = BORDER;
    }
  }
  return put(ws, r1, c1, value, opts);
}

function setup(ws: ExcelJS.Worksheet, widths: number[], landscape = true) {
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.pageSetup = { orientation: landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

// ======================================================================
// CM Dashboard
// ======================================================================

export async function buildCmDashboardWorkbook(data: CmDashboardData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Placeintern';
  const ws = wb.addWorksheet('CM Dashboard');
  setup(ws, [44, 30, 30, 30, 30]);

  let r = 1;
  mergeRange(ws, r, 1, r, 5, 'CM Dashboard Data – Government Polytechnic Colleges', {
    bold: true,
    fill: BLOCK_FILL,
    border: false,
  });
  ws.getRow(r).height = 24;
  r += 2;

  const { govt, other } = data.groups;
  const groups: CmGroupData[] = [govt, other];

  const blockTitle = (title: string) => {
    mergeRange(ws, r, 1, r, 5, title, { bold: true, fill: BLOCK_FILL, align: LEFT });
    r += 1;
  };
  const header = (labels: string[]) => {
    labels.forEach((l, i) => put(ws, r, i + 1, l, { bold: true, fill: HEAD_FILL }));
    r += 1;
  };
  const gap = () => (r += 1);

  // 1. Enrolment
  blockTitle(`Enrolment Data ${data.enrolmentYearLabel} (Till Date) to be updated on Completion of admission`);
  header(['Type of College', 'Sanctioned Seats', 'Total Enrolment', 'Girls Enrolment', 'SC Students Enrolment']);
  groups.forEach((g) => {
    put(ws, r, 1, g.label, { align: LEFT, bold: true });
    put(ws, r, 2, g.sanctionedSeats);
    put(ws, r, 3, g.enrolment.total);
    put(ws, r, 4, g.enrolment.girls);
    put(ws, r, 5, g.enrolment.sc);
    r += 1;
  });
  gap();

  // 2. Result
  blockTitle(`Result May ${data.year} of Final Year Students`);
  header(['Type of College', 'Total', 'Girls', 'SC Students']);
  groups.forEach((g) => {
    put(ws, r, 1, g.label, { align: LEFT, bold: true });
    (['total', 'girls', 'sc'] as const).forEach((k, i) =>
      put(ws, r, i + 2, `Appeared= ${g.result[k].appeared}\nPassed = ${g.result[k].passed}`, { align: LEFT }),
    );
    ws.getRow(r).height = 34;
    r += 1;
  });
  gap();

  // 3. Dropout
  blockTitle(`Dropout Data (${data.batchLabel} Batch)`);
  header(['Type of College', 'Total', 'Girls', 'SC Students']);
  groups.forEach((g) => {
    put(ws, r, 1, g.label, { align: LEFT, bold: true });
    (['total', 'girls', 'sc'] as const).forEach((k, i) => {
      const d = g.dropout[k];
      put(
        ws,
        r,
        i + 2,
        `1. Enrolled in First Year and LEET 2nd Year= ${d.enrolled}\n2. Appeared in Final Year Exam = ${d.appeared}\n3. Drop Out = ${d.dropout}`,
        { align: LEFT },
      );
    });
    ws.getRow(r).height = 62;
    r += 1;
  });
  gap();

  // 4. Placement
  blockTitle(`Placement Data (${data.year} Pass-out Batch)`);
  header(['Type of College', 'Total Placed', 'Girls Placed', 'SC Students Placed']);
  groups.forEach((g) => {
    put(ws, r, 1, g.label, { align: LEFT, bold: true });
    put(ws, r, 2, g.placement.total);
    put(ws, r, 3, g.placement.girls);
    put(ws, r, 4, g.placement.sc);
    r += 1;
  });
  gap();

  // 5. Vacancy
  blockTitle('Vacancy Position (Government Institutes Only)');
  header(['Type of College', '', 'Sanctioned Posts', 'Filled', 'Vacant']);
  const v = data.vacancy;
  mergeRange(ws, r, 1, r + 1, 1, govt.label, { align: LEFT, bold: true });
  put(ws, r, 2, 'Teaching Staff', { align: LEFT });
  put(ws, r, 3, v.teaching.sanctioned);
  put(ws, r, 4, v.teaching.filled);
  put(ws, r, 5, v.teaching.vacant);
  put(ws, r + 1, 2, 'Non Teaching Staff', { align: LEFT });
  put(ws, r + 1, 3, num(v.nonTeaching.sanctioned));
  put(ws, r + 1, 4, num(v.nonTeaching.filled));
  put(ws, r + 1, 5, num(v.nonTeaching.vacant));
  r += 3;

  put(ws, r, 1, `Generated on ${new Date(data.generatedAt).toLocaleString('en-IN')}`, {
    border: false,
    align: { horizontal: 'left' },
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ======================================================================
// Complete Information (Courses) - one college
// ======================================================================

export async function buildCollegeInfoWorkbook(data: CollegeInfoData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Placeintern';
  const ws = wb.addWorksheet('Course Information');
  const LAST = 17;
  setup(ws, [7, 34, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 12, 10, 12, 12, 12]);

  let r = 1;
  const section = (n: number | string, title: string) => {
    mergeRange(ws, r, 1, r, LAST, `${n}  ${title}`, { bold: true, fill: BLOCK_FILL, align: LEFT });
    r += 1;
  };
  const headerRow = (cells: Array<[number, number, string]>) => {
    cells.forEach(([c1, c2, label]) => mergeRange(ws, r, c1, r, c2, label, { bold: true, fill: HEAD_FILL }));
    r += 1;
  };
  const spacer = () => (r += 1);
  const blankRows = (count: number, cols: Array<[number, number]>) => {
    for (let i = 1; i <= count; i++) {
      cols.forEach(([c1, c2], idx) => mergeRange(ws, r, c1, r, c2, idx === 0 ? i : '', {}));
      r += 1;
    }
  };

  mergeRange(ws, r, 1, r, 2, 'Name of College', { bold: true, fill: HEAD_FILL, align: LEFT });
  mergeRange(ws, r, 3, r, LAST, data.institution.name, { align: LEFT });
  r += 2;

  // ---- 1. Course Information ----
  section(1, 'Course Information');
  const [y0, y1, y2] = data.yearLabels;
  mergeRange(ws, r, 1, r + 2, 1, 'Sr No', { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 2, r + 2, 2, 'Course', { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 3, r, 5, 'Student Enrolment Information', { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 6, r, 8, 'Current on roll students', { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 9, r, 11, 'Dropout Information', { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 12, r, 14, 'Regular Teaching Faculty Information', { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 15, r, 17, 'Supporting Staff', { bold: true, fill: HEAD_FILL });
  r += 1;
  mergeRange(ws, r, 3, r, 5, 'Admission year', { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 6, r, 8, '', { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 9, r, 11, '', { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 12, r, 14, '', { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 15, r, 17, '', { bold: true, fill: HEAD_FILL });
  r += 1;
  [y0, y1, y2, '1st Year', '2nd Year', '3rd Year', '1st Year(3-6)', '2nd Year(4-7)', '3rd Year(5-8)', 'Head', 'Sr Lecturer', 'Lecturer', 'Lab Technician', 'Lab Attendant', 'Other if any'].forEach(
    (label, i) => put(ws, r, i + 3, label, { bold: true, fill: HEAD_FILL }),
  );
  r += 1;
  for (let c = 1; c <= LAST; c++) put(ws, r, c, c, { bold: true, fill: HEAD_FILL });
  r += 1;

  data.courses.forEach((c, i) => {
    const row = [
      i + 1,
      c.name,
      ...c.enrolment,
      ...c.onRoll,
      ...c.dropouts,
      c.faculty.head,
      c.faculty.seniorLecturer,
      c.faculty.lecturer,
      c.supporting.labTechnician,
      c.supporting.labAttendant,
      c.supporting.other,
    ];
    row.forEach((v, idx) => put(ws, r, idx + 1, v, idx === 1 ? { align: LEFT } : {}));
    r += 1;
  });
  if (data.courses.length) {
    put(ws, r, 1, '', { bold: true, fill: HEAD_FILL });
    put(ws, r, 2, 'Total', { bold: true, fill: HEAD_FILL, align: LEFT });
    for (let col = 3; col <= LAST; col++) {
      const idx = col - 3;
      const sum = data.courses.reduce((s, c) => {
        const flat = [
          ...c.enrolment,
          ...c.onRoll,
          ...c.dropouts,
          c.faculty.head,
          c.faculty.seniorLecturer,
          c.faculty.lecturer,
          c.supporting.labTechnician,
          c.supporting.labAttendant,
          c.supporting.other,
        ];
        return s + flat[idx];
      }, 0);
      put(ws, r, col, sum, { bold: true, fill: HEAD_FILL });
    }
    r += 1;
  }
  mergeRange(ws, r, 1, r, LAST, 'Note : For Applied Science Department Leave Student information Blank', {
    align: LEFT,
    border: false,
  });
  r += 2;

  // ---- 2. Teaching staff ----
  section(2, 'Teaching Staff (working on his/ her own trade) Information');
  headerRow([[1, 1, 'Sr No'], [2, 2, 'Designation'], [3, 4, 'Sanctioned'], [5, 6, 'Filled'], [7, 8, 'Vacant'], [9, 17, 'Remarks']]);
  data.teaching.rows.forEach((t, i) => {
    mergeRange(ws, r, 1, r, 1, i + 1, {});
    mergeRange(ws, r, 2, r, 2, t.designation, { align: LEFT });
    mergeRange(ws, r, 3, r, 4, '', {});
    mergeRange(ws, r, 5, r, 6, t.filled, {});
    mergeRange(ws, r, 7, r, 8, '', {});
    mergeRange(ws, r, 9, r, 17, '', {});
    r += 1;
  });
  const tVacant = Math.max(data.teaching.sanctionedTotal - data.teaching.filledTotal, 0);
  mergeRange(ws, r, 1, r, 2, 'Total', { bold: true, fill: HEAD_FILL, align: LEFT });
  mergeRange(ws, r, 3, r, 4, data.teaching.sanctionedTotal, { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 5, r, 6, data.teaching.filledTotal, { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 7, r, 8, tVacant, { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 9, r, 17, 'Sanctioned posts are held course-wise (Staff tab), not per designation', {
    align: LEFT,
    fill: HEAD_FILL,
  });
  r += 2;

  // ---- 3. Long-term duty / adjusted staff (not captured in the system yet) ----
  section(3, 'Information of Staff Which are on Long Term Duty or Which are Adjusted on Other Trades');
  headerRow([[1, 1, 'Sr No'], [2, 2, 'Name'], [3, 6, 'Actual Designation and Trade'], [7, 11, 'Designation and Trade on which Posted'], [12, 17, 'Whether posted in your college, if not then Name of College where Working']]);
  blankRows(5, [[1, 1], [2, 2], [3, 6], [7, 11], [12, 17]]);
  headerRow([[1, 1, 'Sr No'], [2, 2, 'Name'], [3, 6, 'Designation and Trade'], [7, 11, 'Description of Duty'], [12, 14, 'Date From Which Faculty is on duty'], [15, 17, 'Remarks']]);
  blankRows(5, [[1, 1], [2, 2], [3, 6], [7, 11], [12, 14], [15, 17]]);
  spacer();

  // ---- 4. Workshop staff ----
  section(4, 'Workshop Staff Position');
  headerRow([[1, 1, 'Sr No'], [2, 2, 'Number of Trades where Workshop is applicable'], [3, 4, 'Number of Workshops'], [5, 7, 'Number of Workshop Superintendents'], [8, 10, 'Number of Foreman Instructors'], [11, 12, 'Number of Instructors'], [13, 14, 'Average Teaching Load'], [15, 17, 'Is Equipment Available and in Working Order in all Workshops']]);
  ws.getRow(r - 1).height = 48;
  mergeRange(ws, r, 1, r, 1, 1, {});
  mergeRange(ws, r, 2, r, 2, data.workshop.trades, {});
  mergeRange(ws, r, 3, r, 4, data.workshop.workshops, {});
  mergeRange(ws, r, 5, r, 7, data.workshop.superintendents, {});
  mergeRange(ws, r, 8, r, 10, data.workshop.foremen, {});
  mergeRange(ws, r, 11, r, 12, data.workshop.instructors, {});
  mergeRange(ws, r, 13, r, 14, '', {});
  mergeRange(ws, r, 15, r, 17, '', {});
  r += 2;

  // ---- 5. Instructional area ----
  section(5, 'Instructional Area Information');
  mergeRange(ws, r, 1, r, 2, '', { fill: HEAD_FILL });
  mergeRange(ws, r, 3, r, 7, 'Class Room Information', { bold: true, fill: HEAD_FILL });
  mergeRange(ws, r, 8, r, 17, '', { fill: HEAD_FILL });
  r += 1;
  headerRow([[1, 1, 'Sr No'], [2, 2, 'Course'], [3, 4, 'Number of Classrooms'], [5, 6, 'Furniture Available'], [7, 8, 'Number of Smartboards/ Smart TVs'], [9, 10, 'Number of Labs Available'], [11, 13, 'Is Equipment Available and in Working Order in all Labs'], [14, 17, 'Is Instructional Area Complete as per AICTE? If not then discrepancy']]);
  ws.getRow(r - 1).height = 48;
  data.courses.forEach((c, i) => {
    mergeRange(ws, r, 1, r, 1, i + 1, {});
    mergeRange(ws, r, 2, r, 2, c.name, { align: LEFT });
    mergeRange(ws, r, 3, r, 4, num(c.infra.classrooms), {});
    mergeRange(ws, r, 5, r, 6, yn(c.infra.furniture), {});
    mergeRange(ws, r, 7, r, 8, num(c.infra.smartBoards), {});
    mergeRange(ws, r, 9, r, 10, num(c.infra.labs), {});
    mergeRange(ws, r, 11, r, 13, '', {});
    mergeRange(ws, r, 14, r, 17, '', {});
    r += 1;
  });
  r += 1;

  // ---- 6. Non-teaching staff ----
  section(6, 'Non-Teaching Staff Information');
  headerRow([[1, 1, 'Sr No'], [2, 2, 'Designation'], [3, 4, 'Sanctioned'], [5, 6, 'Filled'], [7, 8, 'Vacant'], [9, 17, 'Remarks (Any staff on long Duty or adjustment)']]);
  data.nonTeaching.rows.forEach((t, i) => {
    mergeRange(ws, r, 1, r, 1, i + 1, {});
    mergeRange(ws, r, 2, r, 2, t.designation, { align: LEFT });
    mergeRange(ws, r, 3, r, 4, '', {});
    mergeRange(ws, r, 5, r, 6, t.filled, {});
    mergeRange(ws, r, 7, r, 8, '', {});
    mergeRange(ws, r, 9, r, 17, '', {});
    r += 1;
  });
  r += 1;

  // ---- 7. Other information ----
  section(7, 'Other Information');
  headerRow([[1, 1, 'Sr No'], [2, 2, 'Description'], [3, 5, 'Yes/ No'], [6, 12, 'Description'], [13, 17, 'Yes/No']]);
  const i = data.institution;
  const other: Array<[string, string | number, string, string | number]> = [
    ['Library Available', yn(i.hasLibrary), 'Books as per AICTE Norms Available', yn(i.libraryAictBooksAvailable)],
    ['College Bus/ Van', yn(i.hasCollegeBus), 'Driver', yn(i.busHasDriver)],
    ['Number of Computers', num(i.computersCount), 'Are all Computers Connected to Internet', yn(i.computersAllInternetConnected)],
  ];
  other.forEach(([d1, v1, d2, v2], idx) => {
    mergeRange(ws, r, 1, r, 1, idx + 1, {});
    mergeRange(ws, r, 2, r, 2, d1, { align: LEFT });
    mergeRange(ws, r, 3, r, 5, v1, {});
    mergeRange(ws, r, 6, r, 12, d2, { align: LEFT });
    mergeRange(ws, r, 13, r, 17, v2, {});
    r += 1;
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
