/**
 * Extração de texto de documentos — camada Ingestor da pipeline RAG.
 * Suporta PDF, DOCX/DOC, TXT/MD, CSV/XLSX/XLS.
 */

export interface ExtractResult {
  text: string;
  pages: number;
  hasTextLayer: boolean;
}

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
};

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md', '.csv', '.xlsx', '.xls'];

export function detectFileType(file: { type: string; name: string }): string | null {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
  return ALLOWED_TYPES[file.type] ?? (ALLOWED_EXTENSIONS.includes(ext) ? ext.slice(1) : null);
}

export async function extractDocument(buffer: Buffer, fileType: string): Promise<ExtractResult> {
  switch (fileType) {
    case 'pdf':
      return extractPdf(buffer);

    case 'docx':
    case 'doc': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value || '', pages: 1, hasTextLayer: true };
    }

    case 'txt':
    case 'md':
      return { text: buffer.toString('utf-8'), pages: 1, hasTextLayer: true };

    case 'csv':
    case 'xlsx':
    case 'xls': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const parts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const csvData = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        if (csvData.trim()) parts.push(`--- Planilha: ${sheetName} ---\n${csvData}`);
      }
      return { text: parts.join('\n\n'), pages: workbook.SheetNames.length, hasTextLayer: true };
    }

    default:
      throw new Error(`Tipo de arquivo não suportado: ${fileType}`);
  }
}

async function extractPdf(buffer: Buffer): Promise<ExtractResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require('pdf-parse');

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text.replace(/\n--\s*\d+\s+of\s+\d+\s*--\n?/g, '\n');
    return { text, pages: result.total, hasTextLayer: text.trim().length > 0 };
  } finally {
    await parser.destroy();
  }
}
