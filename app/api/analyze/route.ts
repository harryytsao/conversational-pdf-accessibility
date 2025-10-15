import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { file_name } = await req.json();
    const file_path = path.join(process.cwd(), "uploads", file_name);
    if (!fs.existsSync(file_path)) 
      return NextResponse.json({ error: "File not found" }, { status: 404 });

    const buffer = fs.readFileSync(file_path);
    const pdf_doc = await PDFDocument.load(buffer);
    const page_count = pdf_doc.getPageCount();

    // Check if pages have text (simple heuristic)
    let full_text = "";
    const meta_data = {
      file_name,
      page_count,
      title: pdf_doc.getTitle() || "Unknown",
      author: pdf_doc.getAuthor() || "Unknown",
    };

    fs.writeFileSync(
      path.join(process.cwd(), "data", `${file_name}.json`),
      JSON.stringify(meta_data, null, 2)
    );

    return NextResponse.json(meta_data);
  } catch (err: any) {
    console.error("Analyze error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
