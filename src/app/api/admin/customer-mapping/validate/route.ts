import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/jwt-auth";
import { parseAndValidateCustomerMappingFile } from "@/lib/customer-mapping-import";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "An Excel file (.xlsx) is required." },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Only .xlsx files are supported." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File size must not exceed 5 MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = parseAndValidateCustomerMappingFile(buffer);

    if (result.fileError) {
      return NextResponse.json({ error: result.fileError }, { status: 400 });
    }

    if (result.summary.totalRows === 0) {
      return NextResponse.json(
        {
          error:
            "No data rows found. Add at least one mapping row below the header.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse the uploaded file." },
      { status: 500 },
    );
  }
}
