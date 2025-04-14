import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  logger.info("Test webhook endpoint called");
  
  // Log request details for debugging
  const url = req.url;
  const method = req.method;
  const headers = Object.fromEntries(req.headers.entries());
  
  // Log relevant information
  logger.info(`Request URL: ${url}`);
  logger.info(`Request Method: ${method}`);
  logger.info(`Request Headers: ${JSON.stringify(headers)}`);
  
  return NextResponse.json({
    success: true,
    message: "Webhook test endpoint is working properly",
    timestamp: new Date().toISOString()
  });
}

export async function POST(req: NextRequest) {
  logger.info("Test webhook endpoint called with POST");
  
  try {
    // Get the raw body for debugging
    const rawBody = await req.text();
    let parsedBody;
    
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (e) {
      parsedBody = { error: "Could not parse JSON body", raw: rawBody };
    }
    
    // Log relevant information
    logger.info(`Request URL: ${req.url}`);
    logger.info(`Request Method: ${req.method}`);
    logger.info(`Request Headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`);
    logger.info(`Request Body: ${JSON.stringify(parsedBody)}`);
    
    return NextResponse.json({
      success: true,
      message: "Webhook POST test endpoint is working properly",
      receivedData: parsedBody,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error(`Error processing test webhook: ${error.message}`);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 