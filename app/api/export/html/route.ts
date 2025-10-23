import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { file_name } = await req.json();

    const dataPath = path.join(process.cwd(), "data", `${file_name}.json`);
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json(
        { error: "Document data not found" },
        { status: 404 }
      );
    }

    const documentData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    // Generate accessible HTML
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${documentData.title || "Accessible Document"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
      color: #333;
    }
    h1 { font-size: 2em; margin-top: 0.67em; margin-bottom: 0.67em; }
    h2 { font-size: 1.5em; margin-top: 0.83em; margin-bottom: 0.83em; }
    h3 { font-size: 1.17em; margin-top: 1em; margin-bottom: 1em; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1.5em 0;
      border: 2px solid #333;
    }
    th, td {
      border: 1px solid #666;
      padding: 0.75rem;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    figure {
      margin: 2em 0;
      padding: 1em;
      border: 1px solid #ccc;
      background-color: #f9f9f9;
    }
    figcaption {
      font-style: italic;
      margin-top: 0.5em;
      color: #666;
    }
    .equation {
      margin: 1.5em 0;
      padding: 1em;
      background-color: #f5f5ff;
      border-left: 4px solid #6366f1;
      font-family: 'Courier New', monospace;
    }
    .page-break {
      margin: 2em 0;
      border-top: 2px dashed #ccc;
      padding-top: 2em;
    }
    .page-number {
      color: #999;
      font-size: 0.9em;
      margin-bottom: 1em;
    }
  </style>
</head>
<body>
  <header>
    <h1>${documentData.title || "Document"}</h1>
    ${
      documentData.author !== "Unknown"
        ? `<p><strong>Author:</strong> ${documentData.author}</p>`
        : ""
    }
    <p><strong>Pages:</strong> ${documentData.page_count}</p>
    <nav aria-label="Table of Contents">
      <h2>Contents</h2>
      <ul>
`;

    // Build table of contents from headings
    const headings: any[] = [];
    documentData.pages.forEach((page: any) => {
      page.items?.forEach((item: any) => {
        if (
          item.fontSize > documentData.body_font_size &&
          item.text.trim().length > 3
        ) {
          headings.push({
            text: item.text,
            page: page.pageNumber,
            level: item.fontSize > documentData.body_font_size * 1.5 ? 1 : 2,
          });
        }
      });
    });

    headings.slice(0, 20).forEach((h, i) => {
      html += `        <li><a href="#heading-${i}">${h.text}</a> (Page ${h.page})</li>\n`;
    });

    html += `      </ul>
    </nav>
  </header>
  <main>
`;

    // Process each page
    let headingIndex = 0;
    documentData.pages.forEach((page: any, pageIndex: number) => {
      if (pageIndex > 0) {
        html += `    <div class="page-break"></div>\n`;
      }

      html += `    <div class="page-number" aria-label="Page ${page.pageNumber}">Page ${page.pageNumber}</div>\n`;

      // Process items for semantic structure
      page.items?.forEach((item: any) => {
        const text = item.text?.trim();
        if (!text) return;

        // Check if it's a heading
        if (item.fontSize > documentData.body_font_size && text.length > 3) {
          const level =
            item.fontSize > documentData.body_font_size * 1.5
              ? 1
              : item.fontSize > documentData.body_font_size * 1.2
              ? 2
              : 3;
          const tag = `h${level + 1}`; // Shift down since h1 is title
          html += `    <${tag} id="heading-${headingIndex++}">${text}</${tag}>\n`;
        } else {
          // Regular paragraph text
          html += `    <p>${text}</p>\n`;
        }
      });

      // Add tables
      if (page.hasTable && page.table) {
        html += `    <table role="table" aria-label="Table on page ${page.pageNumber}">\n`;

        page.table.rows.forEach((row: any, rowIndex: number) => {
          const isHeader = rowIndex === 0;
          const tag = isHeader ? "th" : "td";

          html += `      <tr>\n`;
          row.cells
            .filter((cell: any) => cell.text.trim().length > 0)
            .forEach((cell: any) => {
              html += `        <${tag}>${cell.text}</${tag}>\n`;
            });
          html += `      </tr>\n`;
        });

        html += `    </table>\n`;
      }

      // Add figures
      if (page.figures && page.figures.length > 0) {
        page.figures.forEach((figure: any) => {
          html += `    <figure role="img" aria-label="${
            figure.altText || figure.caption
          }">\n`;
          html += `      <div>[${figure.label}]</div>\n`;
          html += `      <figcaption>${figure.caption}</figcaption>\n`;
          if (figure.altText) {
            html += `      <p><strong>Description:</strong> ${figure.altText}</p>\n`;
          }
          html += `    </figure>\n`;
        });
      }

      // Add equations
      if (page.equations && page.equations.length > 0) {
        page.equations.forEach((eq: any, eqIndex: number) => {
          html += `    <div class="equation" role="math" aria-label="Equation ${
            eqIndex + 1
          }: ${eq.text}">\n`;
          html += `      <code>${eq.text}</code>\n`;
          html += `    </div>\n`;
        });
      }
    });

    html += `  </main>
  <footer>
    <p><small>Generated from: ${file_name} on ${new Date().toLocaleString()}</small></p>
  </footer>
</body>
</html>`;

    // Return HTML as downloadable file
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="${file_name.replace(
          ".pdf",
          ""
        )}-accessible.html"`,
      },
    });
  } catch (err: any) {
    console.error("HTML export error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
