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
    const { phoneNumberId, agentId, interviewId } = body;
    
    logger.info(`Attempting to link phone number: Phone ID=${phoneNumberId}, Agent ID=${agentId}, Interview ID=${interviewId}`);
    
    if (!phoneNumberId) {
      logger.error("Missing phone number ID in link request");
      return NextResponse.json(
        { error: "Missing phone number ID" },
        { status: 400 }
      );
    }
    
    if (!agentId) {
      logger.error("Missing agent ID in link request");
      return NextResponse.json(
        { error: "Missing agent ID" },
        { status: 400 }
      );
    }
    
    if (!interviewId) {
      logger.error("Missing interview ID in link request");
      return NextResponse.json(
        { error: "Missing interview ID" },
        { status: 400 }
      );
    }
    
    const linkedPhoneNumber = await PhoneNumberService.linkPhoneNumber(
      phoneNumberId,
      agentId,
      interviewId
    );
    
    logger.info(`Successfully linked phone number ${linkedPhoneNumber.number} to agent ${agentId}`);
    
    return NextResponse.json(
      { phoneNumber: linkedPhoneNumber },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error(`Error linking phone number: ${error.message}`);
    logger.error(`Error details: ${JSON.stringify(error)}`);
    
    return NextResponse.json(
      { error: `Failed to link phone number: ${error.message}` },
      { status: 500 }
    );
  }
} 