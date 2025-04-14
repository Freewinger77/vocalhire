import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { PhoneNumberService } from "@/services/phone-numbers.service";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  const { userId, orgId } = auth();
  
  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const phoneNumbers = await PhoneNumberService.getPhoneNumbers(orgId);
    
    return NextResponse.json(
      { phoneNumbers },
      { status: 200 }
    );
  } catch (error) {
    logger.error(`Error getting phone numbers: ${error}`);
    
    return NextResponse.json(
      { error: "Failed to get phone numbers" },
      { status: 500 }
    );
  }
} 