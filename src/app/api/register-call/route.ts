import { logger } from "@/lib/logger";
import { InterviewerService } from "@/services/interviewers.service";
import { NextResponse } from "next/server";
import Retell from "retell-sdk";
import { ResponseService } from "@/services/responses.service";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

export async function POST(req: Request, res: Response) {
  logger.info("register-call request received");

  const body = await req.json();
  const { interviewer_id, interview_id, name, email, dynamic_data } = body;

  if (!interview_id) {
    logger.error("Interview ID missing in register-call request");
    return NextResponse.json({ error: "Missing interview ID" }, { status: 400 });
  }

  const interviewer = await InterviewerService.getInterviewer(interviewer_id);
  if (!interviewer || !interviewer.agent_id) {
    logger.error("Interviewer or agent ID not found for ID:", interviewer_id);
    return NextResponse.json({ error: "Interviewer agent not found" }, { status: 404 });
  }

  try {
    const registerCallResponse = await retellClient.call.createWebCall({
      agent_id: interviewer.agent_id,
      retell_llm_dynamic_variables: dynamic_data,
    });

    if (!registerCallResponse || !registerCallResponse.call?.call_id) {
      logger.error("Failed to register call with Retell");
      return NextResponse.json({ error: "Failed to register call" }, { status: 500 });
    }

    logger.info("Call registered successfully with Retell:", registerCallResponse.call.call_id);

    const initialResponseData = {
      call_id: registerCallResponse.call.call_id,
      interview_id: interview_id,
      name: name || null,
      email: email || null,
      details: registerCallResponse.call,
      is_analysed: false,
      is_ended: false,
      is_viewed: false,
      candidate_status: "NO_STATUS",
      duration: 0,
      tab_switch_count: 0,
    };

    const dbResponse = await ResponseService.createResponse(initialResponseData);
    logger.info("Initial response record created in DB:", dbResponse);

    return NextResponse.json(
      {
        registerCallResponse,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Error during call registration or DB creation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
