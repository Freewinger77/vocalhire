import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { PhoneNumberService } from "@/services/phone-numbers.service";
import { ResponseService } from "@/services/responses.service";
import { auth } from "@clerk/nextjs/server";
import Retell from "retell-sdk";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

export async function GET(req: NextRequest) {
  const { userId, orgId } = auth();
  
  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Get query parameters 
    const url = new URL(req.url);
    const interviewId = url.searchParams.get("interviewId");
    const phoneNumberId = url.searchParams.get("phoneNumberId");
    
    logger.info(`Fetching calls for interview: ${interviewId}, phone: ${phoneNumberId}`);
    
    if (!interviewId) {
      logger.error("Missing interview ID");
      
      return NextResponse.json(
        { error: "Missing interview ID" },
        { status: 400 }
      );
    }
    
    // Get responses for this interview
    const responses = await ResponseService.getAllResponses(interviewId);
    
    // If phone number ID is provided, filter to just get calls for that number
    if (phoneNumberId) {
      // Get the phone number details
      try {
        const phoneNumber = await PhoneNumberService.getPhoneNumberById(parseInt(phoneNumberId));
        
        if (phoneNumber) {
          // Optionally fetch recent call history directly from Retell
          // Use a direct API request instead of the SDK due to type issues
          try {
            // Use the raw API request via fetch
            // The correct endpoint should include any query parameters needed
            const apiUrl = `https://api.retellai.com/v1/calls?limit=50`;
            logger.info(`Calling Retell API URL: ${apiUrl}`);
            
            const retellCallsResponse = await fetch(
              apiUrl,
              {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${process.env.RETELL_API_KEY || ""}`,
                  "Content-Type": "application/json"
                }
              }
            );
            
            logger.info(`Retell API response status: ${retellCallsResponse.status}`);
            
            if (!retellCallsResponse.ok) {
              const errorBody = await retellCallsResponse.text();
              logger.error(`Retell API error (${retellCallsResponse.status}): ${errorBody}`);
              
              // Special case for "Not Found" errors which might indicate API issue
              if (retellCallsResponse.status === 404) {
                // Return a specific message for 404 errors
                return NextResponse.json(
                  { 
                    error: "Retell API returned a Not Found error. This may be due to API key permissions or endpoint changes.",
                    status: 404,
                    message: errorBody
                  },
                  { status: 500 }
                );
              }
              
              throw new Error(`Retell API error (${retellCallsResponse.status}): ${retellCallsResponse.statusText}`);
            }
            
            const retellCalls = await retellCallsResponse.json();
            logger.info(`Raw Retell API response: ${JSON.stringify(retellCalls).substring(0, 200)}...`);
            
            const calls = retellCalls.calls || [];
            
            logger.info(`Found ${calls.length} calls from Retell API`);
            
            // Filter to calls from this phone number
            const phoneCalls = calls.filter((call: any) => 
              call.phone_number === phoneNumber.number && call.end_timestamp
            );
            
            logger.info(`Found ${phoneCalls.length} calls for number ${phoneNumber.number}`);
            
            // Merge with our database responses
            // Create a map of call IDs we already have
            const existingCallIds = new Set(responses.map(r => r.call_id));
            
            // Check for calls in Retell that aren't in our database
            const missingCalls = phoneCalls.filter(
              (call: any) => !existingCallIds.has(call.call_id)
            );
            
            if (missingCalls.length > 0) {
              logger.info(`Found ${missingCalls.length} calls missing from our database`);
              
              // Create response records for these calls
              for (const call of missingCalls) {
                try {
                  await ResponseService.createResponse({
                    interview_id: interviewId,
                    call_id: call.call_id,
                    name: "Phone Caller",
                    is_ended: true,
                    is_analysed: false,
                    details: call
                  });
                  
                  // Trigger call analysis
                  try {
                    // Use the raw API to trigger analysis
                    const analysisResponse = await fetch(
                      `https://api.retellai.com/v1/calls/${call.call_id}/analyzation`,
                      {
                        method: "POST",
                        headers: {
                          "Authorization": `Bearer ${process.env.RETELL_API_KEY}`,
                          "Content-Type": "application/json"
                        }
                      }
                    );
                    
                    if (!analysisResponse.ok) {
                      logger.error(`Error triggering analysis: ${analysisResponse.statusText}`);
                    } else {
                      logger.info(`Triggered analysis for call ${call.call_id}`);
                    }
                  } catch (analysisError: any) {
                    logger.error(`Error triggering analysis: ${analysisError.message}`);
                  }
                  
                  logger.info(`Created response for missing call: ${call.call_id}`);
                } catch (error: any) {
                  logger.error(`Error creating response for call ${call.call_id}: ${error.message}`);
                }
              }
              
              // Refetch responses after creating the missing ones
              const updatedResponses = await ResponseService.getAllResponses(interviewId);
              
              return NextResponse.json(
                { 
                  responses: updatedResponses,
                  phoneNumber: phoneNumber.number 
                },
                { status: 200 }
              );
            }
          } catch (error: any) {
            logger.error(`Error getting call history: ${error.message}`);
          }
        }
      } catch (error: any) {
        logger.error(`Error getting phone number details: ${error.message}`);
      }
    }
    
    return NextResponse.json(
      { responses },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error(`Error fetching calls: ${error.message}`);
    
    return NextResponse.json(
      { error: `Failed to fetch calls: ${error.message}` },
      { status: 500 }
    );
  }
} 