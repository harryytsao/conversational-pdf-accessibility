import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

    // Create new PDF with pdf-lib
    const pdfDoc = await PDFDocument.create();

    // Set metadata for PDF/UA compliance
    pdfDoc.setTitle(documentData.title || "Accessible Document");
    pdfDoc.setAuthor(documentData.author || "Unknown");
    pdfDoc.setSubject("Accessible PDF generated from " + file_name);
    pdfDoc.setKeywords(["accessible", "pdf/ua", "structured"]);
    pdfDoc.setProducer("Conversational PDF Accessibility Tool");
    pdfDoc.setCreator("BLV Accessibility System");
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());

    // Get fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612; // Letter size
    const pageHeight = 792;
    const margin = 50;
    const maxWidth = pageWidth - 2 * margin;

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    const drawText = (
      text: string,
      options: {
        size?: number;
        font?: any;
        color?: any;
        maxWidth?: number;
      } = {}
    ) => {
      const {
        size = 12,
        font: textFont = font,
        color = rgb(0, 0, 0),
        maxWidth: textMaxWidth = maxWidth,
      } = options;

      const lines = [];
      const words = text.split(" ");
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = textFont.widthOfTextAtSize(testLine, size);

        if (width > textMaxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      for (const line of lines) {
        if (yPosition < margin + 20) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          yPosition = pageHeight - margin;
        }

        currentPage.drawText(line, {
          x: margin,
          y: yPosition,
          size,
          font: textFont,
          color,
        });

        yPosition -= size * 1.5;
      }
    };

    // Title
    drawText(documentData.title || "Accessible Document", {
      size: 24,
      font: boldFont,
    });
    yPosition -= 10;

    if (documentData.author !== "Unknown") {
      drawText(`By ${documentData.author}`, { size: 14 });
      yPosition -= 10;
    }

    yPosition -= 20;

    // Process each page's content
    for (const page of documentData.pages) {
      // Page number
      drawText(`Page ${page.pageNumber}`, {
        size: 10,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 10;

      // Process structured content
      if (page.items) {
        let lastY = -1;

        for (const item of page.items) {
          const text = item.text?.trim();
          if (!text) continue;

          // Check if new paragraph (significant Y change)
          const isNewParagraph =
            lastY !== -1 && Math.abs(item.y - lastY) > item.fontSize * 1.5;
          if (isNewParagraph) {
            yPosition -= 10;
          }

          // Determine if heading
          const isHeading = item.fontSize > documentData.body_font_size;
          const size = isHeading ? Math.min(item.fontSize, 18) : 12;
          const textFont = isHeading ? boldFont : font;

          drawText(text, { size, font: textFont });
          lastY = item.y;
        }
      }

      // Add tables
      if (page.hasTable && page.table) {
        yPosition -= 20;
        drawText("Table:", { font: boldFont, size: 14 });
        yPosition -= 5;

        const cellPadding = 5;
        const cellWidth =
          maxWidth / Math.max(3, page.table.rows[0]?.cells.length || 3);

        page.table.rows.forEach((row: any, rowIndex: number) => {
          if (yPosition < margin + 60) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            yPosition = pageHeight - margin;
          }

          const isHeader = rowIndex === 0;
          const rowHeight = 20;
          let xPos = margin;

          // Draw row background for header
          if (isHeader) {
            currentPage.drawRectangle({
              x: margin,
              y: yPosition - rowHeight,
              width: maxWidth,
              height: rowHeight,
              color: rgb(0.9, 0.9, 0.9),
            });
          }

          // Draw cells
          row.cells
            .filter((cell: any) => cell.text.trim().length > 0)
            .forEach((cell: any) => {
              // Cell border
              currentPage.drawRectangle({
                x: xPos,
                y: yPosition - rowHeight,
                width: cellWidth,
                height: rowHeight,
                borderColor: rgb(0, 0, 0),
                borderWidth: 1,
              });

              // Cell text
              const cellText = cell.text.substring(0, 30); // Truncate if needed
              currentPage.drawText(cellText, {
                x: xPos + cellPadding,
                y: yPosition - rowHeight + cellPadding + 5,
                size: isHeader ? 11 : 10,
                font: isHeader ? boldFont : font,
              });

              xPos += cellWidth;
            });

          yPosition -= rowHeight;
        });

        yPosition -= 10;
      }

      // Add figures
      if (page.figures && page.figures.length > 0) {
        page.figures.forEach((figure: any) => {
          yPosition -= 20;
          drawText(`[${figure.label}]`, { font: boldFont, size: 12 });
          drawText(figure.caption, { size: 11 });
          if (figure.altText) {
            drawText(`Description: ${figure.altText}`, {
              size: 10,
              color: rgb(0.3, 0.3, 0.3),
            });
          }
          yPosition -= 10;
        });
      }

      // Add equations
      if (page.equations && page.equations.length > 0) {
        page.equations.forEach((eq: any, eqIndex: number) => {
          yPosition -= 20;
          drawText(`Equation ${eqIndex + 1}:`, { font: boldFont, size: 11 });
          drawText(eq.text, { size: 10, font: font });
          yPosition -= 5;
        });
      }

      yPosition -= 30; // Space between pages
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${file_name.replace(
          ".pdf",
          ""
        )}-accessible.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("PDF/UA export error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
