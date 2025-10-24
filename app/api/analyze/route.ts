import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const runtime = "nodejs";

interface ExtractedTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

interface TableCell {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

interface TableRow {
  cells: TableCell[];
}

interface Table {
  type: "table";
  rows: TableRow[];
}

interface Figure {
  type: "figure";
  label: string;
  number: string;
  caption: string;
  x: number;
  y: number;
  altText: string;
}

interface Equation {
  type: "equation";
  text: string;
  items: ExtractedTextItem[];
  y: number;
}

interface PageContent {
  pageNumber: number;
  text: string;
  textLength: number;
  items: ExtractedTextItem[];
  width?: number;
  height?: number;
  columns?: number;
  hasTable?: boolean;
  table?: Table | null;
  figures?: Figure[];
  equations?: Equation[];
  structures?: any[];
}

async function extractTextWithPdfjs(filePath: string) {
  try {
    // Run extraction in separate Node process to avoid Next.js bundling issues
    const scriptPath = path.join(process.cwd(), "lib", "extract-script.mjs");
    const command = `node "${scriptPath}" "${filePath}"`;

    console.log("Running extraction script:", command);

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large PDFs
      timeout: 120000, // 2 minute timeout
    });

    if (stderr && !stderr.includes("ExperimentalWarning")) {
      console.error("Extraction stderr:", stderr);
    }

    const result = JSON.parse(stdout);

    if (!result.success) {
      console.error("Extraction failed:", result.error);
      return null;
    }

    console.log("✅ Extraction successful, pages:", result.pages.length);

    return {
      pages: result.pages,
      totalTextLength: result.totalTextLength,
    };
  } catch (error: any) {
    console.error("PDF extraction error:", error.message);
    console.error("stderr:", error.stderr);
    console.error("stdout:", error.stdout);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    console.log("📄 Analyze API called");
    const { file_name } = await req.json();
    console.log("File name:", file_name);

    const file_path = path.join(process.cwd(), "uploads", file_name);
    if (!fs.existsSync(file_path))
      return NextResponse.json({ error: "File not found" }, { status: 404 });

    const buffer = fs.readFileSync(file_path);
    console.log("File read, size:", buffer.length, "bytes");

    // Extract metadata using pdf-lib
    console.log("Extracting metadata...");
    const pdf_doc = await PDFDocument.load(buffer);
    const page_count = pdf_doc.getPageCount();

    // Use filename as fallback if no embedded title
    const embeddedTitle = pdf_doc.getTitle();
    const title = embeddedTitle || file_name.replace(/\.pdf$/i, "");

    const author = pdf_doc.getAuthor() || "Unknown";
    console.log(`Metadata: ${page_count} pages, title: "${title}"`);

    // Extract text using external script (bypasses Next.js bundling)
    console.log("Starting text extraction...");
    const extraction = await extractTextWithPdfjs(file_path);
    console.log("Text extraction complete");

    let pages: PageContent[] = [];
    let totalTextLength = 0;
    let isScanned = false;
    let body_font_size = 12.0;
    let maxFontSize = 14.0;

    if (extraction) {
      pages = extraction.pages;
      totalTextLength = extraction.totalTextLength;

      // Detect if scanned (very little text)
      isScanned = totalTextLength < 100 || totalTextLength / page_count < 20;

      // Analyze font sizes for heading detection
      //Determine body font and max font. We can find body font by looking at the font that takes up the most text area
      const font_stats = new Map<number, number>(); // fontSize -> total text length
      for (const page of pages) {
        for (const item of page.items) {
          const size = Math.round(item.fontSize * 10) / 10;
          const len = item.text?.length || 0;
          if (len > 0 && size > 0)
            font_stats.set(size, (font_stats.get(size) || 0) + len);
        }
      }
      const all_font_sizes = Array.from(font_stats.keys());
      if (all_font_sizes.length > 0) {
        //find the font size responsible for the most text
        body_font_size = all_font_sizes.reduce((a, b) =>
          (font_stats.get(a) ?? 0) > (font_stats.get(b) ?? 0) ? a : b
        );
        maxFontSize = Math.round(Math.max(...all_font_sizes) * 10) / 10;
      }
    } else {
      // Fallback if extraction fails
      isScanned = true;
      pages = Array.from({ length: page_count }, (_, i) => ({
        pageNumber: i + 1,
        text: "",
        textLength: 0,
        items: [],
      }));
    }

    const result = {
      file_name,
      page_count,
      title,
      author,
      isScanned,
      textLength: totalTextLength,
      body_font_size,
      maxFontSize,
      pages: pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text.substring(0, 500), // Preview for response
        textLength: p.textLength,
        items: p.items, // Store full items
        // Include new fields from improved extraction
        width: p.width,
        height: p.height,
        columns: p.columns,
        hasTable: p.hasTable,
        table: p.table,
        figures: p.figures,
        equations: p.equations,
        structures: p.structures,
      })),
      extractedAt: new Date().toISOString(),
    };

    // Save full data to JSON file
    fs.writeFileSync(
      path.join(process.cwd(), "data", `${file_name}.json`),
      JSON.stringify(result, null, 2)
    );

    // Return simplified response (without full items for performance)
    const response = {
      ...result,
      pages: result.pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text,
        textLength: p.textLength,
        hasTable: p.hasTable,
        columns: p.columns,
        figures: p.figures,
        equations: p.equations,
      })),
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}
