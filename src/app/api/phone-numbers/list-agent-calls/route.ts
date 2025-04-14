import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";
import { ResponseService } from "@/services/responses.service";
import { PhoneNumberService } from "@/services/phone-numbers.service";

export async function POST(req: NextRequest) {
  const { userId, orgId } = auth();
  
  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Get the request body
    const body = await req.json();
    const { agentId, interviewId } = body;
    
    logger.info(`Fetching calls for agent: ${agentId}, interview: ${interviewId}`);
    
    if (!agentId) {
      logger.error("Missing agent ID");
      
      return NextResponse.json(
        { error: "Missing agent ID" },
        { status: 400 }
      );
    }
    
    if (!interviewId) {
      logger.error("Missing interview ID");
      
      return NextResponse.json(
        { error: "Missing interview ID" },
        { status: 400 }
      );
    }
    
    try {
      // First get existing responses for this interview
      const existingResponses = await ResponseService.getAllResponses(interviewId);
      const existingCallIds = new Set(existingResponses.map(r => r.call_id));
      
      logger.info(`Found ${existingResponses.length} existing responses for interview ${interviewId}`);
      
      // Use Retell v2 API to list calls by agent ID
      const apiUrl = `https://api.retellai.com/v2/list-calls`;
      logger.info(`Calling Retell API at ${apiUrl} for agent ID: ${agentId}`);
      
      // Prepare the request body exactly as shown in the example
      const requestBody = {
        sort_order: "descending",
        limit: 50,
        filter_criteria: {
          agent_id: [agentId]
          // We don't need to filter by call_status as we want all calls
        }
      };
      
      logger.info(`Request body: ${JSON.stringify(requestBody)}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RETELL_API_KEY || ""}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Error from Retell API (${response.status}): ${errorText}`);
        
        throw new Error(`Retell API error: ${response.statusText}`);
      }
      
      // Get the response as JSON and log some info about it
      const callData = await response.json();
      
      // The response is an array of calls, not an object with a calls property
      const calls = Array.isArray(callData) ? callData : [];
      
      logger.info(`Found ${calls.length} calls from Retell for agent ${agentId}`);
      logger.info(`Sample call data: ${JSON.stringify(calls.slice(0, 1)).substring(0, 300)}...`);
      
      // Process any new calls not already in our database
      const newCalls = calls.filter((call: any) => 
        !existingCallIds.has(call.call_id) && 
        call.end_timestamp // Only include ended calls
      );
      
      logger.info(`Found ${newCalls.length} new calls to add to our database`);
      
      // Add each new call as a response
      const addedCalls = [];
      for (const call of newCalls) {
        try {
          // Extract caller name if possible from transcript
          let callerName = "Phone Caller";
          
          // If the call has a transcript, try to extract the name
          if (call.transcript) {
            try {
              // Simple transcript parsing - look for name in transcript
              const transcript = typeof call.transcript === 'string' 
                ? call.transcript 
                : JSON.stringify(call.transcript);
              
              // Look for common name patterns in the transcript
              const nameMatch = transcript.match(/my name is ([^.\n,]+)/i) || 
                                transcript.match(/this is ([^.\n,]+)/i) ||
                                transcript.match(/I'm ([^.\n,]+)/i);
              
              if (nameMatch && nameMatch[1]) {
                // Clean up the extracted name
                callerName = nameMatch[1].trim();
                logger.info(`Extracted caller name from transcript: ${callerName}`);
              }
            } catch (nameError) {
              logger.error(`Error extracting name from transcript: ${nameError}`);
            }
          }
          
          // Create a response record for this call with all available data
          const responseId = await ResponseService.createResponse({
            interview_id: interviewId,
            call_id: call.call_id,
            name: callerName,
            is_ended: Boolean(call.end_timestamp),
            is_analysed: Boolean(call.call_analysis),
            details: {
              ...call,
              // Add metadata if not present
              metadata: call.metadata || {
                interview_id: interviewId
              }
            },
            // If the call already has analysis, include it
            analytics: call.call_analysis ? {
              call_summary: call.call_analysis.call_summary,
              user_sentiment: call.call_analysis.user_sentiment,
              call_successful: call.call_analysis.call_successful
            } : undefined
          });
          
          // If the call doesn't have analysis yet, trigger it
          if (!call.call_analysis) {
            logger.info(`Triggering analysis for call ${call.call_id}`);
            const analysisUrl = `https://api.retellai.com/v1/calls/${call.call_id}/analyzation`;
            try {
              const analysisResponse = await fetch(analysisUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.RETELL_API_KEY || ""}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (analysisResponse.ok) {
                logger.info(`Successfully triggered analysis for call ${call.call_id}`);
              } else {
                const analysisError = await analysisResponse.text();
                logger.error(`Error triggering analysis for call ${call.call_id}: ${analysisError}`);
              }
            } catch (analysisError) {
              logger.error(`Exception triggering analysis: ${analysisError}`);
            }
          }
          
          logger.info(`Added new call ${call.call_id} and triggered analysis`);
          addedCalls.push(call.call_id);
        } catch (error: any) {
          logger.error(`Error processing call ${call.call_id}: ${error.message}`);
        }
      }
      
      // Fetch updated responses
      const updatedResponses = await ResponseService.getAllResponses(interviewId);
      
      return NextResponse.json({
        success: true,
        totalCalls: calls.length,
        newCalls: addedCalls.length,
        callIds: addedCalls,
        responses: updatedResponses
      });
      
    } catch (error: any) {
      logger.error(`Error fetching calls by agent: ${error.message}`);
      throw error;
    }
  } catch (error: any) {
    logger.error(`Error in list-agent-calls: ${error.message}`);
    
    return NextResponse.json(
      { error: `Failed to fetch calls: ${error.message}` },
      { status: 500 }
    );
  }
} 