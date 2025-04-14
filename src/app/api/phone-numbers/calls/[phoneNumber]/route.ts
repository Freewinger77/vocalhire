import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { phoneNumber: string } }
) {
  const { userId, orgId } = auth();
  
  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const phoneNumber = params.phoneNumber;
    logger.info(`Fetching calls for phone number: ${phoneNumber}`);
    
    if (!phoneNumber) {
      logger.error("Missing phone number");
      
      return NextResponse.json(
        { error: "Missing phone number" },
        { status: 400 }
      );
    }
    
    // Format phone number to E.164 format if needed
    const formattedNumber = phoneNumber.startsWith('+') 
      ? phoneNumber 
      : `+${phoneNumber}`;
    
    // Make a direct call to Retell API to get calls for this number
    try {
      // Use the raw API request via fetch
      // The correct endpoint should include query parameters to filter by phone number
      const retellCallsResponse = await fetch(
        `https://api.retellai.com/v1/calls?limit=50`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${process.env.RETELL_API_KEY || ""}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      if (!retellCallsResponse.ok) {
        const errorBody = await retellCallsResponse.text();
        logger.error(`Retell API error (${retellCallsResponse.status}): ${errorBody}`);
        
        return NextResponse.json(
          { error: `Retell API error: ${retellCallsResponse.statusText}` },
          { status: retellCallsResponse.status }
        );
      }
      
      const retellCalls = await retellCallsResponse.json();
      const allCalls = retellCalls.calls || [];
      
      // Filter to calls from this specific phone number
      const phoneCalls = allCalls.filter((call: any) => 
        call.phone_number === formattedNumber
      );
      
      logger.info(`Found ${phoneCalls.length} calls for number ${formattedNumber} out of ${allCalls.length} total calls`);
      
      return NextResponse.json(
        { 
          calls: phoneCalls,
          phoneNumber: formattedNumber
        },
        { status: 200 }
      );
    } catch (error: any) {
      logger.error(`Error getting call history: ${error.message}`);
      
      return NextResponse.json(
        { error: `Failed to fetch calls: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger.error(`Error processing request: ${error.message}`);
    
    return NextResponse.json(
      { error: `Failed to process request: ${error.message}` },
      { status: 500 }
    );
  }
} 