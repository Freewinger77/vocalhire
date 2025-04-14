import { NextRequest, NextResponse } from "next/server";
import { InterviewService } from "@/services/interviews.service";
import { logger } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";

export async function GET(
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
    logger.info(`Fetching interview with ID: ${interviewId}`);

    if (!interviewId) {
      logger.error("Missing interview ID");
      
      return NextResponse.json(
        { error: "Missing interview ID" },
        { status: 400 }
      );
    }

    const interview = await InterviewService.getInterviewById(interviewId);

    if (!interview) {
      logger.error(`Interview with ID ${interviewId} not found`);
      
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    logger.info(`Successfully retrieved interview: ${interview.name}`);
    
    return NextResponse.json(
      { interview },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error(`Error fetching interview: ${error.message}`);
    
    return NextResponse.json(
      { error: `Failed to fetch interview: ${error.message}` },
      { status: 500 }
    );
  }
} 