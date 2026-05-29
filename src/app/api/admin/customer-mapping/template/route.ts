import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/jwt-auth";
import { buildCustomerMappingTemplateBuffer } from "@/lib/customer-mapping-import";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const buffer = buildCustomerMappingTemplateBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="customer-mapping-template.xlsx"',
    },
  });
}
