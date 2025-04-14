import { NextRequest, NextResponse } from "next/server";
import { InterviewService } from "@/services/interviews.service";
import { logger } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { interviewId: string } }
) {
  const { userId, orgId } = auth();

  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const interviewId = params.interviewId;
    const body = await req.json();
    
    logger.info(`Updating interview ${interviewId} with data:`, body);

    if (!interviewId) {
      logger.error("Missing interview ID");
      
      return NextResponse.json(
        { error: "Missing interview ID" },
        { status: 400 }
      );
    }

    // Ensure the agent_id is present
    if (!body.agent_id) {
      logger.error("Missing agent_id in update request");
      
      return NextResponse.json(
        { error: "Missing agent_id in request body" },
        { status: 400 }
      );
    }

    // Update the interview with the agent_id
    await InterviewService.updateInterview(
      { agent_id: body.agent_id },
      interviewId
    );

    logger.info(`Successfully updated interview ${interviewId} with agent_id ${body.agent_id}`);
    
    return NextResponse.json(
      { success: true, interviewId, agent_id: body.agent_id },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error(`Error updating interview: ${error.message}`);
    
    return NextResponse.json(
      { error: `Failed to update interview: ${error.message}` },
      { status: 500 }
    );
  }
} 