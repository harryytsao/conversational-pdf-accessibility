import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const write_file = promisify(fs.writeFile);
const upload_dir = path.join(process.cwd(), "uploads");
//Does the upload folder exist?
if (!fs.existsSync(upload_dir)) fs.mkdirSync(upload_dir);

export async function POST(req: Request) {
    try {
        const form_data = await req.formData();
        const file = form_data.get("file") as File | null;
        if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        //convert the file into a buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const file_path = path.join(upload_dir, file.name);
        //save the file to /uploads
        await write_file(file_path, buffer);
        return NextResponse.json({
        message: "File uploaded successfully",
        file_name: file.name,
        savedTo: file_path
    });
    } catch (err: any) {
        return NextResponse.json({
            error: "Upload failed",
            details: err.message},
            {status: 500
        });
    }
}
