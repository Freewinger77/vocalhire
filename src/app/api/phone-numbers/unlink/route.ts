import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { PhoneNumberService } from "@/services/phone-numbers.service";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const { userId, orgId } = auth();
  
  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { phoneNumberId } = body;
    
    if (!phoneNumberId) {
      return NextResponse.json(
        { error: "Missing phone number ID" },
        { status: 400 }
      );
    }
    
    const unlinkedPhoneNumber = await PhoneNumberService.unlinkPhoneNumber(phoneNumberId);
    
    return NextResponse.json(
      { phoneNumber: unlinkedPhoneNumber },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`Error unlinking phone number: ${error}`);
    
    return NextResponse.json(
      { error: "Failed to unlink phone number" },
      { status: 500 }
    );
  }
} 