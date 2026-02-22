import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const ALLOWED = new Set(["DEVLOG.md", "GRAVITY_CONTEXT.md", "DEVELOPER_GUIDE.md", "SOUL.md"]);

export async function GET(_request: Request, context: { params: { name: string } }) {
  const name = context.params.name;
  if (!ALLOWED.has(name)) {
    return NextResponse.json({ error: "unsupported document" }, { status: 400 });
  }

  const filePath = path.resolve(process.cwd(), name);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: `${name} not found` }, { status: 404 });
  }

  return NextResponse.json({ content: fs.readFileSync(filePath, "utf8") });
}
