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
    const { areaCode, nickname } = body;
    
    logger.info(`Acquiring phone number with area code: ${areaCode}, type: ${typeof areaCode}`);
    
    if (!areaCode || !/^\d{1,3}$/.test(areaCode.toString())) {
      logger.error(`Invalid area code: ${areaCode}`);
      return NextResponse.json(
        { error: `Invalid area code: ${areaCode}. Must be a 3-digit number.` },
        { status: 400 }
      );
    }
    
    const newPhoneNumber = await PhoneNumberService.acquirePhoneNumber(
      orgId,
      areaCode,
      nickname
    );
    
    logger.info(`Successfully acquired phone number: ${newPhoneNumber.number}`);
    
    return NextResponse.json(
      { phoneNumber: newPhoneNumber },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error(`Error acquiring phone number: ${error.message}`);
    logger.error(`Error details: ${JSON.stringify(error)}`);
    
    return NextResponse.json(
      { error: `Failed to acquire phone number: ${error.message}` },
      { status: 500 }
    );
  }
} 