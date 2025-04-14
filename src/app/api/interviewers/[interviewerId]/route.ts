import { NextRequest, NextResponse } from "next/server";
import { InterviewerService } from "@/services/interviewers.service";
import { logger } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { interviewerId: string } }
) {
  const { userId, orgId } = auth();

  if (!userId || !orgId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const interviewerId = params.interviewerId;
    logger.info(`Fetching interviewer with ID: ${interviewerId}`);

    if (!interviewerId) {
      logger.error("Missing interviewer ID");
      
      return NextResponse.json(
        { error: "Missing interviewer ID" },
        { status: 400 }
      );
    }

    const interviewer = await InterviewerService.getInterviewer(BigInt(interviewerId));

    if (!interviewer) {
      logger.error(`Interviewer with ID ${interviewerId} not found`);
      
      return NextResponse.json(
        { error: "Interviewer not found" },
        { status: 404 }
      );
    }

    logger.info(`Successfully retrieved interviewer: ${interviewer.name}`);
    
    return NextResponse.json(
      { interviewer },
      { status: 200 }
    );
  } catch (error: any) {
    logger.error(`Error fetching interviewer: ${error.message}`);
    
    return NextResponse.json(
      { error: `Failed to fetch interviewer: ${error.message}` },
      { status: 500 }
    );
  }
} 