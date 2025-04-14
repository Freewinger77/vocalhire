import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
import { Retell } from "retell-sdk";
import { logger } from "@/lib/logger";
import { ResponseService } from "@/services/responses.service";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const apiKey = process.env.RETELL_API_KEY || "";
const BASE_URL = process.env.NEXT_PUBLIC_LIVE_URL || "localhost:3000";
const serverUrl = BASE_URL.includes("localhost") ? "http://localhost:3000" : `https://${BASE_URL}`;

// Initialize Retell SDK for API calls
const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

export async function POST(req: NextRequest, res: NextResponse) {
  logger.info("Webhook event received");

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    // Skip signature verification in development for easier testing
    if (process.env.NODE_ENV === "production") {
      const signature = req.headers.get("x-retell-signature");
      if (!signature || !Retell.verify(rawBody, apiKey, signature)) {
        logger.error("Invalid signature");
        
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const { event, call } = body as { event: string; call: any };
    
    // Log the received call data for debugging
    logger.info(`Event ${event} received with call_id ${call?.call_id}`);
    logger.info(`Call details: ${JSON.stringify(call).substring(0, 500)}...`);
    
    // Determine if this is a phone call
    const isPhoneCall = Boolean(call?.phone_number);
    logger.info(`Call type: ${isPhoneCall ? 'Phone Call' : 'Web Call'}`);
    
    // For phone calls, we need to extract the interview_id from metadata or look it up
    let interviewId = call?.metadata?.interview_id;
    const agentId = call?.agent_id;
    const phoneNumber = call?.phone_number;
    
    // If we don't have an interviewId but we have a phone number, try to look it up
    if (!interviewId && phoneNumber) {
      try {
        const supabase = createServerComponentClient({ cookies });
        const { data } = await supabase
          .from("phone_numbers")
          .select("interview_id")
          .eq("number", phoneNumber)
          .single();
        
        if (data?.interview_id) {
          interviewId = data.interview_id;
          logger.info(`Found interview_id ${interviewId} for phone number ${phoneNumber}`);
        } else if (agentId) {
          // If we still don't have an interview_id but have an agent_id, try looking it up
          const { data: agentData } = await supabase
            .from("phone_numbers")
            .select("interview_id")
            .eq("agent_linked", agentId)
            .single();
            
          if (agentData?.interview_id) {
            interviewId = agentData.interview_id;
            logger.info(`Found interview_id ${interviewId} for agent_id ${agentId}`);
          }
        }
      } catch (error: any) {
        logger.error(`Error looking up interview_id: ${error.message}`);
      }
    }
    
    if (!interviewId) {
      logger.warn(`Could not determine interview_id for call ${call?.call_id}`);
    }

    switch (event) {
      case "call_started":
        logger.info(`Call started: ${call.call_id}, interviewId: ${interviewId}`);
        
        // Create initial response record for the call if we have an interview_id
        if (interviewId) {
          try {
            // For phone calls, we need to set basic initial values
            let initialName = isPhoneCall ? "Phone Caller" : "";
            
            const responseId = await ResponseService.createResponse({
              interview_id: interviewId,
              call_id: call.call_id,
              name: initialName,
              is_ended: false,
              is_analysed: false,
              details: call
            });
            
            logger.info(`Created response record for call ${call.call_id} with ID ${responseId}`);
          } catch (error: any) {
            logger.error(`Error creating response: ${error.message}`);
          }
        }
        break;
        
      case "call_ended":
        logger.info(`Call ended: ${call.call_id}`);
        
        // Update the call as ended and store final transcript
        try {
          // For phone calls, try to extract caller name from transcript
          if (isPhoneCall && call.transcript) {
            try {
              let callerName = "Phone Caller";
              
              // Analyze transcript to extract name (simple heuristic)
              for (let i = 0; i < call.transcript.length; i++) {
                const turn = call.transcript[i];
                if (turn.role === 'agent' && 
                    /what('s| is) your name/i.test(turn.content) && 
                    i+1 < call.transcript.length && 
                    call.transcript[i+1].role === 'user') {
                  // The next turn might contain the user's name
                  const userResponse = call.transcript[i+1].content.trim();
                  // Simple extraction - take first few words, avoiding "my name is" prefix
                  callerName = userResponse
                    .replace(/^(my name is|i('m| am)|this is)/i, '')
                    .trim()
                    .split(' ')
                    .slice(0, 2)
                    .join(' ');
                  
                  if (callerName) {
                    logger.info(`Extracted caller name: ${callerName}`);
                    break;
                  }
                }
              }
              
              // Save the name and mark as ended
              await ResponseService.saveResponse({
                name: callerName,
                is_ended: true,
                details: call
              }, call.call_id);
            } catch (nameError: any) {
              logger.error(`Error extracting name: ${nameError.message}`);
            }
          } else {
            // For web calls or if name extraction failed, just mark as ended
            await ResponseService.saveResponse({
              is_ended: true,
              details: call
            }, call.call_id);
          }
          
          logger.info(`Updated response as ended for call ${call.call_id}`);
        } catch (error: any) {
          logger.error(`Error updating response: ${error.message}`);
        }
        break;
        
      case "call_analyzed":
        logger.info(`Call analyzed: ${call.call_id}`);
        
        try {
          // Use the absolute URL for API calls
          const apiUrl = `${serverUrl}/api/get-call`;
          logger.info(`Calling get-call API at ${apiUrl}`);
          
          const result = await axios.post(apiUrl, {
            id: call.call_id,
          });
          
          logger.info(`Successfully processed call analysis for ${call.call_id}`);
        } catch (error: any) {
          logger.error(`Error processing call analysis: ${error.message}`);
          logger.error(`Call analysis error details: ${JSON.stringify(error.response?.data || {})}`);
          
          // Fallback: If API call fails, at least mark the call as analyzed
          try {
            await ResponseService.saveResponse({
              is_analysed: true,
              details: call
            }, call.call_id);
          } catch (fallbackError: any) {
            logger.error(`Fallback update also failed: ${fallbackError.message}`);
          }
        }
        break;
        
      default:
        logger.info(`Received unknown event type: ${event}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    logger.error(`Error processing webhook: ${error.message}`);
    
    return NextResponse.json({ 
      error: `Failed to process webhook: ${error.message}` 
    }, { status: 500 });
  }
}
