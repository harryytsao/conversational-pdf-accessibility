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

interface PageContent {
  pageNumber: number;
  text: string;
  textLength: number;
  items: ExtractedTextItem[];
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
    console.log("📁 File name:", file_name);

    const file_path = path.join(process.cwd(), "uploads", file_name);
    if (!fs.existsSync(file_path))
      return NextResponse.json({ error: "File not found" }, { status: 404 });

    const buffer = fs.readFileSync(file_path);
    console.log("✅ File read, size:", buffer.length, "bytes");

    // Extract metadata using pdf-lib
    console.log("🔍 Extracting metadata...");
    const pdf_doc = await PDFDocument.load(buffer);
    const page_count = pdf_doc.getPageCount();
    const title = pdf_doc.getTitle() || "Unknown";
    const author = pdf_doc.getAuthor() || "Unknown";
    console.log(`📊 Metadata: ${page_count} pages, title: "${title}"`);

    // Extract text using external script (bypasses Next.js bundling)
    console.log("🔤 Starting text extraction...");
    const extraction = await extractTextWithPdfjs(file_path);
    console.log("✅ Text extraction complete");

    let pages: PageContent[] = [];
    let totalTextLength = 0;
    let isScanned = false;
    let avgFontSize = 12.0;
    let maxFontSize = 14.0;

    if (extraction) {
      pages = extraction.pages;
      totalTextLength = extraction.totalTextLength;

      // Detect if scanned (very little text)
      isScanned = totalTextLength < 100 || totalTextLength / page_count < 20;

      // Analyze font sizes for heading detection
      const allFontSizes = pages.flatMap((p) => p.items.map((i) => i.fontSize));
      if (allFontSizes.length > 0) {
        avgFontSize =
          Math.round(
            (allFontSizes.reduce((a, b) => a + b, 0) / allFontSizes.length) * 10
          ) / 10;
        maxFontSize = Math.round(Math.max(...allFontSizes) * 10) / 10;
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
      avgFontSize,
      maxFontSize,
      pages: pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text.substring(0, 500), // Preview for response
        textLength: p.textLength,
        itemCount: p.items.length,
        items: p.items, // Store full items
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
        itemCount: p.itemCount,
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
