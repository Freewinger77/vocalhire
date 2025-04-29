"use client";

import {
  ArrowUpRightSquareIcon,
  AlarmClockIcon,
  XCircleIcon,
  CheckCircleIcon,
  MicIcon,
  MicOffIcon,
  ClockIcon,
  InfoIcon,
  CheckIcon,
  MicOff,
  Mic,
  PhoneOff,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { useResponses } from "@/contexts/responses.context";
import Image from "next/image";
import axios from "axios";
import { RetellWebClient } from "retell-client-js-sdk";
import MiniLoader from "../loaders/mini-loader/miniLoader";
import { toast } from "sonner";
import { isLightColor, testEmail } from "@/lib/utils";
import { ResponseService } from "@/services/responses.service";
import { Interview } from "@/types/interview";
import { FeedbackData } from "@/types/response";
import { FeedbackService } from "@/services/feedback.service";
import { FeedbackForm } from "@/components/call/feedbackForm";
import {
  TabSwitchWarning,
  useTabSwitchPrevention,
} from "./tabSwitchPrevention";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { InterviewerService } from "@/services/interviewers.service";
import { cn } from "@/lib/utils";

const webClient = new RetellWebClient();

type InterviewProps = {
  interview: Interview;
};

type registerCallResponseType = {
  data: {
    registerCallResponse: {
      call_id: string;
      access_token: string;
    };
  };
};

type transcriptType = {
  role: string;
  content: string;
};

function Call({ interview }: InterviewProps) {
  const { createResponse } = useResponses();
  const [lastInterviewerResponse, setLastInterviewerResponse] =
    useState<string>("");
  const [lastUserResponse, setLastUserResponse] = useState<string>("");
  const [activeTurn, setActiveTurn] = useState<string>("");
  const [isLoadingPractice, setIsLoadingPractice] = useState(false);
  const [isLoadingInterview, setIsLoadingInterview] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [isValidEmail, setIsValidEmail] = useState<boolean>(false);
  const [isOldUser, setIsOldUser] = useState<boolean>(false);
  const [callId, setCallId] = useState<string>("");
  const { tabSwitchCount } = useTabSwitchPrevention();
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [interviewerImg, setInterviewerImg] = useState("");
  const [interviewTimeDuration, setInterviewTimeDuration] =
    useState<string>("1");
  const [time, setTime] = useState(0);
  const [currentTimeDuration, setCurrentTimeDuration] = useState<string>("0");
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState<boolean>(false);

  // --- Practice State ---
  const [isPracticing, setIsPracticing] = useState<boolean>(false);
  const [practiceTimeLeft, setPracticeTimeLeft] = useState<number>(120); // 2 minutes in seconds
  const practiceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // --- End Practice State ---

  const lastUserResponseRef = useRef<HTMLDivElement | null>(null);

  // --- Mic Permission State ---
  const [micPermissionStatus, setMicPermissionStatus] = useState<
    'idle' | 'checking' | 'granted' | 'denied' | 'prompt'
  >('idle');
  // --- End Mic Permission State ---

  // --- Unmute Instruction State ---
  const [showUnmuteInstruction, setShowUnmuteInstruction] = useState(false);
  // --- End Unmute Instruction State ---

  // --- State to hold args for delayed start ---
  const [startFunctionArgs, setStartFunctionArgs] = useState<{ practiceMode: boolean } | null>(null);
  // --- End State ---

  const handleFeedbackSubmit = async (
    formData: Omit<FeedbackData, "interview_id">,
  ) => {
    try {
      const result = await FeedbackService.submitFeedback({
        ...formData,
        interview_id: interview.id,
      });

      if (result) {
        toast.success("Thank you for your feedback!");
        setIsFeedbackSubmitted(true);
        setIsDialogOpen(false);
      } else {
        toast.error("Failed to submit feedback. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("An error occurred. Please try again later.");
    }
  };

  useEffect(() => {
    if (lastUserResponseRef.current) {
      const { current } = lastUserResponseRef;
      current.scrollTop = current.scrollHeight;
    }
  }, [lastUserResponse]);

  // --- Actual Interview Timer ---
  useEffect(() => {
    let intervalId: any;
    // Only run this timer if NOT practicing
    if (isCalling && !isPracticing) {
      intervalId = setInterval(() => setTime(time + 1), 10);
    }
    // Only update duration display if NOT practicing
    if (!isPracticing) {
      setCurrentTimeDuration(String(Math.floor(time / 100)));
    }
    // Only auto-end based on interview duration if NOT practicing
    if (
      !isPracticing &&
      Number(currentTimeDuration) == Number(interviewTimeDuration) * 60
    ) {
      webClient.stopCall();
      setIsEnded(true);
    }

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCalling, time, currentTimeDuration, isPracticing, interviewTimeDuration]); // Added isPracticing and interviewTimeDuration

  // --- Practice Timer Logic ---
  useEffect(() => {
    // Only run this timer if practicing
    if (isPracticing && isStarted && practiceTimeLeft > 0) {
      practiceIntervalRef.current = setInterval(() => {
        setPracticeTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (isPracticing && isStarted && practiceTimeLeft === 0) {
      console.log("Practice time ended. Stopping call.");
      webClient.stopCall(); // Stop call when practice timer ends
      // `isEnded` will be set by the 'call_ended' event listener
      // endPractice(); // Don't call endPractice here, let call_ended handle state
    }

    // Cleanup interval
    return () => {
      if (practiceIntervalRef.current) {
        clearInterval(practiceIntervalRef.current);
      }
    };
    // Added isStarted dependency
  }, [isPracticing, practiceTimeLeft, isStarted]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    // Add newline before return
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  // --- End Practice Timer Logic ---

  useEffect(() => {
    if (testEmail(email)) {
      setIsValidEmail(true);
    }
  }, [email]);

  // --- Retell Event Listeners ---
  useEffect(() => {
    webClient.on("call_started", () => {
      console.log("Call started (practice:", isPracticing, ")");
      setIsCalling(true);
      // Explicitly mute mic on call start
      webClient.mute();
    });

    webClient.on("call_ended", () => {
      console.log("Call ended (practice:", isPracticing, ")");
      setIsCalling(false);
      setIsEnded(true);
      // Clear practice timer if it's still running
      if (practiceIntervalRef.current) {
        clearInterval(practiceIntervalRef.current);
      }
    });

    webClient.on("agent_start_talking", () => {
      setActiveTurn("agent");
    });

    webClient.on("agent_stop_talking", () => {
      setActiveTurn("user");
    });

    webClient.on("error", (error) => {
      console.error("An error occurred:", error);
      webClient.stopCall(); // Ensure call stops on error
      setIsEnded(true);
      setIsCalling(false);
    });

    webClient.on("update", (update) => {
      if (update.transcript) {
        const transcripts: transcriptType[] = update.transcript;
        const roleContents: { [key: string]: string } = {};

        transcripts.forEach((transcript) => {
          roleContents[transcript?.role] = transcript?.content;
        });

        setLastInterviewerResponse(roleContents["agent"]);
        setLastUserResponse(roleContents["user"]);
      }
    });

    return () => {
      webClient.removeAllListeners();
    };
    // isPracticing dependency added to ensure listeners have correct state context if needed, although current listeners don't use it directly.
  }, [isPracticing]);

  // --- End Call / End Practice Handler ---
  const handleEndCall = async () => {
    console.log("handleEndCall triggered (practice:", isPracticing, ")");
    webClient.stopCall();
    // isEnded will be set by the 'call_ended' listener
  };

  // --- Quick Microphone Access Check ---
  const checkMicrophoneAccess = async (): Promise<boolean> => {
    console.log("Attempting quick microphone access check...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately
      console.log("Microphone access successful.");

      return true; // Added newline before return
    } catch (error) {
      console.error("Quick microphone access check failed:", error);
      toast.error("Could not access microphone. Please check connection and system settings.");

      return false; // Added newline before return
    }
  };
  // --- End Quick Check ---

  // --- Part 2: Execute the actual start logic (called after popup) ---
  const executeStartConversation = async () => {
    if (!startFunctionArgs) {
      console.error("executeStartConversation called without args");

      return; // Added newline before return
    }
    const { practiceMode } = startFunctionArgs;
    setStartFunctionArgs(null); // Clear args immediately

    console.log(`Executing start conversation (practice: ${practiceMode})`);

    // --- Start of original startConversation logic ---
    const userEmail = practiceMode && interview?.is_anonymous ? "practice@example.com" : email;
    const userName = practiceMode && interview?.is_anonymous ? "Practice User" : name;

    if (!practiceMode) {
      console.log("[startConversation] Checking for existing responses...");
      const oldUserEmails: string[] = (
        await ResponseService.getAllEmails(interview.id)
      ).map((item) => item.email);
      const isActuallyOldUser =
        oldUserEmails.includes(userEmail) ||
        (interview?.respondents && !interview?.respondents.includes(userEmail));

      if (isActuallyOldUser) {
        console.log("[startConversation] User already responded or not permitted.");
        setIsOldUser(true);

        return; // Added newline before return
      }
      console.log("[startConversation] No existing response found.");
    }

    const data = {
      mins: practiceMode ? "2" : interview?.time_duration,
      objective: interview?.objective,
      questions: interview?.questions.map((q) => q.question).join(", "),
      name: userName || "not provided",
      job_context: interview?.job_context || "No specific job context provided.",
    };

    // Set loading state
    if (practiceMode) { setIsLoadingPractice(true); } else { setIsLoadingInterview(true); }
    setIsPracticing(practiceMode);

    try {
      console.log("[startConversation] Calling /api/register-call...");
      const registerCallResponse: registerCallResponseType = await axios.post(
        "/api/register-call",
        {
          dynamic_data: data,
          interviewer_id: interview?.interviewer_id,
          is_practice: practiceMode,
        },
      );
      console.log("[startConversation] API response received:", registerCallResponse.data);

      if (registerCallResponse.data.registerCallResponse.access_token) {
        const currentCallId = registerCallResponse?.data?.registerCallResponse?.call_id;
        console.log(`[startConversation] Got access token. Call ID: ${currentCallId}`);
        setCallId(currentCallId);

        if (!practiceMode) {
          console.log("[startConversation] Creating DB record...");
          await createResponse({
            interview_id: interview.id,
            call_id: currentCallId,
            email: userEmail,
            name: userName,
          });
           console.log("[startConversation] DB record created.");
        } else {
           console.log("[startConversation] Practice mode: Skipping DB record creation.");
           setPracticeTimeLeft(120);
        }

        console.log("[startConversation] Starting Retell web client call...");
        await webClient.startCall({
          accessToken: registerCallResponse.data.registerCallResponse.access_token,
        });
        console.log("[startConversation] Retell call initiated. Setting isStarted = true");
        setIsStarted(true);
        // NOTE: Do NOT set setShowUnmuteInstruction(true) here anymore
      } else {
        console.error("[startConversation] Failed to register call - API response missing access token.");
        toast.error("Could not initiate the call. Please try again.");
        setIsPracticing(false); // Reset practice state
      }
    } catch (error) {
        console.error("[startConversation] Error caught:", error);
        toast.error("An error occurred while starting the call.");
        setIsPracticing(false); // Reset practice state
    } finally {
        // Reset loading state
        if (practiceMode) { setIsLoadingPractice(false); } else { setIsLoadingInterview(false); }
    }
    // --- End of original startConversation logic ---
  };

  // --- Part 1: Prepare to start (called by buttons) ---
  const prepareToStartConversation = async (practiceMode: boolean) => {
    if (micPermissionStatus !== 'granted') {
      toast.error("Please grant microphone permission first.");
      requestMicPermission();

      return; // Added newline before return
    }

    // 1.5 Perform quick access check
    const canAccessMic = await checkMicrophoneAccess();
    if (!canAccessMic) {
        // Error toast is shown within checkMicrophoneAccess
        return; // Don't proceed if access failed
    }

    // 2. Check email/name validation if required for the specific mode
     if (!practiceMode && !interview?.is_anonymous && (!isValidEmail || !name)) {
        toast.error("Please enter a valid email and your first name to start the interview.");

        return; // Added newline before return
     }
     // 3. Check if already started/loading (shouldn't happen if buttons disabled, but belt-and-suspenders)
     if (isStarted || isLoadingInterview || isLoadingPractice) {
        console.warn("Attempted to start conversation while already started or loading.");

        return; // Added newline before return
     }

    console.log(`Preparing to start conversation (practice: ${practiceMode})`);
    // Set args and show instruction popup
    setStartFunctionArgs({ practiceMode });
    setShowUnmuteInstruction(true);
  };

  useEffect(() => {
    if (interview?.time_duration) {
      setInterviewTimeDuration(interview?.time_duration);
    }
  }, [interview]);

  useEffect(() => {
    const fetchInterviewer = async () => {
      const interviewer = await InterviewerService.getInterviewer(
        interview.interviewer_id,
      );
      setInterviewerImg(interviewer.image);
    };
    fetchInterviewer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview.interviewer_id]);

  // --- Save Response Effect ---
  useEffect(() => {
    // Only save response if the call has ended AND it was NOT a practice session
    if (isEnded && callId && !isPracticing) {
      console.log("Real interview ended. Saving response.");
      const updateResponse = async () => {
        try {
          await ResponseService.saveResponse(
            { is_ended: true, tab_switch_count: tabSwitchCount },
            callId,
          );
          console.log("Response saved successfully for callId:", callId);
        } catch (error) {
           console.error("Failed to save response:", error);
        }
      };
      updateResponse();
    } else if (isEnded && isPracticing) {
        console.log("Practice interview ended. Not saving response.");
        // Optionally reset isPracticing here if needed, depends on desired flow after practice ends
        // setIsPracticing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnded, callId, isPracticing, tabSwitchCount]); // Added isPracticing and callId

  // Handle mute toggle
  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (newMutedState) {
      webClient.mute();
    } else {
      webClient.unmute();
    }
  };

  // --- Mic Permission Logic ---
  const requestMicPermission = async () => {
    console.log("Requesting microphone permission...");
    setMicPermissionStatus('checking');
    try {
      // Request access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // Got permission, stop the tracks immediately as we only needed the prompt
      stream.getTracks().forEach(track => track.stop());
      setMicPermissionStatus('granted');
      console.log("Microphone permission granted by user.");

      return true; // Added newline before return
    } catch (error) {
      console.error("Error requesting microphone permission:", error);
      setMicPermissionStatus('denied');
      toast.error("Microphone access denied. Please grant permission in browser settings.");

      // Add newline before return
      return false;
    }
  };

  useEffect(() => {
    // Check initial permission status on mount
    if (typeof navigator !== 'undefined' && navigator.permissions) {
        navigator.permissions.query({ name: 'microphone' as PermissionName }).then((permissionStatus) => {
        setMicPermissionStatus(permissionStatus.state);
        console.log("Initial microphone permission state:", permissionStatus.state);

        permissionStatus.onchange = () => {
          setMicPermissionStatus(permissionStatus.state);
           console.log("Microphone permission state changed to:", permissionStatus.state);
           if (permissionStatus.state === 'denied' && micPermissionStatus !== 'denied') {
              // Show toast only if changing to denied
              toast.error("Microphone access denied. Please grant permission in browser settings.");
           }
        };
      }).catch(error => {
         console.error("Error querying microphone permission:", error);
         setMicPermissionStatus('denied'); // Assume denied if query fails
      });
    } else {
        console.warn("Permissions API not supported, proceeding without pre-check.");
        // Fallback: Assume 'prompt' or handle differently if needed
        setMicPermissionStatus('prompt'); // Or maybe 'granted' optimistically? Let's assume prompt.
    }
  }, []); // Empty dependency array ensures this runs only once on mount
  // --- End Mic Permission Logic ---

  // --- Renamed: Original startConversation removed/refactored --- 

  // ... other handlers and useEffects ...

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      {isStarted && !isPracticing && !isEnded && <TabSwitchWarning />}
      <div className="bg-white rounded-md md:w-[80%] w-[90%]">
        <Card className="shadow rounded-lg border-2 border-b-4 border-r-4 border-black text-xl font-bold transition-all md:block dark:border-white">
          {/* --- Progress Bar (Real Interview Only) --- */}
          {isStarted && !isEnded && !isPracticing && (
             <div className="m-4 h-[15px] rounded-lg border-[1px]  border-black">
              <div
                className=" bg-indigo-600 h-[15px] rounded-lg"
                style={{
                  width: `${
                        (Number(currentTimeDuration) /
                          (Number(interviewTimeDuration) * 60)) *
                        100
                      }%`,
                  backgroundColor: interview.theme_color ?? "#4F46E5",
                }}
              />
            </div>
          )}
           {/* --- Practice Timer Display --- */}
           {isPracticing && isStarted && !isEnded && ( // Show only during active practice
            <div className="flex justify-center items-center my-2 p-2 bg-yellow-100 border-b border-yellow-300">
               <ClockIcon className="h-5 w-5 mr-2 text-yellow-700" />
               <span className="text-lg font-mono text-yellow-800 mr-4">
                 Practice Time: {formatTime(practiceTimeLeft)}
               </span>
               <span className="text-sm font-semibold text-yellow-900">(Practice Session - Not Recorded)</span>
             </div>
           )}
          {/* --- End Practice Timer Display --- */}
          <div>
            <CardHeader className="items-center p-1 pt-3"> {/* Added pt-3 */}
              {/* Show title when not ended */}
              {!isEnded && (
                <CardTitle className="flex flex-row items-center text-lg md:text-xl font-bold mb-2">
                  {interview?.name} {isPracticing && <span className="text-sm font-normal text-gray-500 ml-2">(Practice)</span>}
                </CardTitle>
              )}
              {/* Show duration when not practicing and not ended */}
              {!isEnded && !isPracticing && (
                <div className="flex mt-2 flex-row">
                  <AlarmClockIcon
                    className="text-indigo-600 h-[1rem] w-[1rem] rotate-0 scale-100  dark:-rotate-90 dark:scale-0 mr-2 font-bold"
                    style={{ color: interview.theme_color }}
                  />
                  <div className="text-sm font-normal">
                    Expected duration:{" "}
                    <span
                      className="font-bold"
                      style={{ color: interview.theme_color }}
                    >
                      {interviewTimeDuration} mins{" "}
                    </span>
                    or less
                  </div>
                </div>
              )}
            </CardHeader>

            {/* --- Practice Mode Instructions (Only shown before practice starts) --- */}
            {/* This view is removed as practice now uses the main UI */}

            {/* --- Initial View (Before Start) --- */}
            {!isStarted && !isEnded && !isOldUser && (
              <div className="w-fit min-w-[400px] max-w-[400px] mx-auto mt-2 border border-indigo-200 rounded-md p-2 m-2 bg-slate-50">
                {/* Logo and Description */}
                <div>
                  {interview?.logo_url && (
                    <div className="p-1 flex justify-center mb-3"> {/* Kept mb-3 */}
                      <Image
                        src={interview?.logo_url}
                        alt="Logo"
                        className="h-10 w-auto" // Reverted logo height
                        width={100} // Reverted logo width
                        height={100}
                      />
                    </div>
                  )}
                  {/* Revert text size */}
                  <div className="p-2 font-normal mb-4"> {/* Reverted p, mb */}
                     {interview?.description && <p className="mb-3 text-sm">{interview?.description}</p>} {/* Reverted text-sm */}
                    <p className="text-sm"> {/* Reverted text-sm */}
                       Ensure your volume is up and <span className="font-semibold">grant microphone access</span> on this page.
                       <br />
                       Additionally, please make sure you are in a quiet environment.
                       <br />
                       <br />
                       <strong>Audio Controls:</strong> Your microphone will be muted by default. You can click the &quot;Unmute&quot; button to speak freely.
                       <br />
                       <br />
                       <strong>Note:</strong> Tab switching during the actual interview will be recorded.
                    </p>
                    {/* --- Mic Permission Status & Button --- */}
                    <div className="mt-3 p-2 border border-gray-200 rounded-md flex items-center justify-between bg-gray-50">
                      <div className="flex items-center space-x-2">
                        {micPermissionStatus === 'granted' && <CheckIcon className="h-4 w-4 text-green-600" />}
                        {micPermissionStatus === 'denied' && <XCircleIcon className="h-4 w-4 text-red-600" />}
                        {(micPermissionStatus === 'prompt' || micPermissionStatus === 'checking' || micPermissionStatus === 'idle') && <InfoIcon className="h-4 w-4 text-yellow-600" />}
                        <span className={`text-xs font-medium ${
                          micPermissionStatus === 'granted' ? 'text-green-700' :
                          micPermissionStatus === 'denied' ? 'text-red-700' :
                          micPermissionStatus === 'prompt' ? 'text-yellow-700' :
                          'text-gray-600'
                        }`}>
                          {micPermissionStatus === 'granted' ? 'Microphone Ready'
                           : micPermissionStatus === 'denied' ? 'Mic Access Denied'
                           : micPermissionStatus === 'prompt' ? 'Mic Access Required'
                           : micPermissionStatus === 'checking' ? 'Checking Mic...'
                           : 'Mic Status Idle'}
                        </span>
                      </div>
                      {(micPermissionStatus === 'prompt' || micPermissionStatus === 'denied') && (
                         <Button
                           size="sm"
                           variant="outline"
                           className="text-xs h-7 px-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                           onClick={requestMicPermission}
                         >
                           {micPermissionStatus === 'denied' ? 'Request Again' : 'Allow Mic'}
                         </Button>
                      )}
                    </div>
                    {/* --- End Mic Permission --- */}
                  </div>
                  {/* Email/Name Inputs - Swapped Order */}
                  {!interview?.is_anonymous && (
                     <div className="flex flex-col gap-2 justify-center mb-4">
                      {/* Name Input First */}
                      <div className="flex justify-center">
                        <input
                          value={name}
                          type="text"
                          className="h-fit mx-auto py-2 border-2 rounded-md w-[75%] self-center px-2 border-gray-400 text-sm font-normal"
                          placeholder="Enter your first name"
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                       {/* Email Input Second */}
                      <div className="flex justify-center">
                        <input
                          value={email}
                          type="email"
                          className="h-fit mx-auto py-2 border-2 rounded-md w-[75%] self-center px-2 border-gray-400 text-sm font-normal"
                          placeholder="Enter your email address"
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
                 {/* --- Action Buttons (Vertical, Interview Prominent) --- */}
                 <div className="w-[90%] max-w-[400px] flex flex-col mx-auto justify-center items-center align-middle space-y-3 mt-4 pb-4">
                  {/* Start Interview Button (Primary) with Confirmation */}
                   <AlertDialog>
                     <AlertDialogTrigger asChild>
                       {/* Primary Button Style */}
                       <Button
                         className="w-full h-10 rounded-lg flex flex-row justify-center"
                         style={{
                           backgroundColor: interview.theme_color ?? "#4F46E5",
                           color: isLightColor(interview.theme_color ?? "#4F46E5")
                             ? "black"
                             : "white",
                         }}
                         disabled={
                           micPermissionStatus !== 'granted' ||
                           isLoadingPractice || isLoadingInterview ||
                           (!interview?.is_anonymous && (!isValidEmail || !name))
                         }
                       >
                         Start Interview
                       </Button>
                     </AlertDialogTrigger>
                     <AlertDialogContent>
                       <AlertDialogHeader>
                         <AlertDialogTitle>Start Interview Directly?</AlertDialogTitle>
                         <AlertDialogDescription>
                           Are you sure you want to start the interview without practicing? We recommend taking the short practice session first.
                         </AlertDialogDescription>
                       </AlertDialogHeader>
                       <AlertDialogFooter>
                         <AlertDialogCancel>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                           className="bg-indigo-600 hover:bg-indigo-800 text-white"
                           onClick={() => prepareToStartConversation(false)}
                         >
                           {isLoadingInterview ? <MiniLoader /> : null}
                           Continue to Interview
                         </AlertDialogAction>
                       </AlertDialogFooter>
                     </AlertDialogContent>
                   </AlertDialog>

                  {/* Separator */}
                  <p className="text-xs text-gray-500 py-0.5">or</p>

                  {/* Start Practice Button (Secondary) */}
                  <Button
                    variant="outline"
                    className="w-full h-10 rounded-lg flex flex-row justify-center border-gray-400 text-gray-700 hover:bg-gray-100"
                    disabled={
                      micPermissionStatus !== 'granted' ||
                      isLoadingPractice || isLoadingInterview ||
                      (!interview?.is_anonymous && (!isValidEmail || !name))
                    }
                    onClick={() => prepareToStartConversation(true)}
                  >
                    {isLoadingPractice ? <MiniLoader /> : "Start Practice"}
                  </Button>
                </div>
              </div>
            )}

            {/* --- Interview Active View (Real or Practice) --- */}
            {isStarted && !isEnded && !isOldUser && ( // Show if started, not ended, not old user
              <div className="flex flex-col h-[calc(88vh-120px)]"> {/* Main container for active call UI */}
                {/* Transcript Area */}
                <div className="flex flex-row p-2 grow overflow-hidden"> {/* Transcript row */}
                  {/* Interviewer Section */}
                  <div className="border-r-2 border-gray-200 w-[50%] flex flex-col justify-between p-4 overflow-y-auto">
                    {/* Transcript */}
                    <div className="flex-grow mb-4">
                      <div
                        className={`text-lg md:text-xl min-h-[150px]`}
                      >
                        {lastInterviewerResponse}
                      </div>
                    </div>
                    {/* Image & Label */}
                    <div className="flex flex-col items-center mt-auto sticky bottom-0 bg-white pb-2"> {/* Make sticky? */}
                      <Image
                        src={interviewerImg || "/default-avatar.png"} // Added fallback
                        alt="Image of the interviewer"
                        width={100}
                        height={100}
                        className={`object-cover object-center rounded-full mb-2 ${
                          activeTurn === "agent"
                            ? `border-4 border-[${interview.theme_color}]`
                            : "border-4 border-transparent"
                        }`}
                      />
                      <div className="font-semibold text-sm">Interviewer</div>
                    </div>
                  </div>

                  {/* User Section */}
                  <div className="w-[50%] flex flex-col justify-between p-4 overflow-y-auto">
                    {/* Transcript */}
                    <div
                      ref={lastUserResponseRef}
                      className={`flex-grow mb-4 text-lg md:text-xl min-h-[150px]`}
                    >
                      {lastUserResponse}
                    </div>
                    {/* User Avatar & Mic Toggle */}
                    <div className="flex flex-col items-center mt-auto sticky bottom-0 bg-white pb-2">
                      <button
                        className={cn(
                          "rounded-full w-[100px] h-[100px] flex items-center justify-center transition-colors duration-200 ease-in-out",
                          {
                            "border-4 border-transparent": activeTurn !== "user",
                            [`border-4 border-[${interview.theme_color}]`]: activeTurn === "user",
                            "bg-red-500 hover:bg-red-600": isMuted,
                            "bg-gray-600 hover:bg-gray-700": !isMuted && !(isStarted && !isEnded),
                          }
                        )}
                        style={!isMuted && isStarted && !isEnded
                          ? { backgroundColor: interview.theme_color ?? "#4F46E5" }
                          : {}
                        }
                        onClick={toggleMute}
                      >
                        {isMuted ? (
                          <MicOff
                            size={48}
                            className="text-white"
                          />
                        ) : (
                          <Mic
                            size={48}
                            className={isLightColor(interview.theme_color ?? "#4F46E5") ? "text-black" : "text-white"}
                          />
                        )}
                      </button>
                      <div className="font-semibold text-sm mt-2">You</div>
                    </div>
                  </div>
                </div> {/* End Transcript Area */}

                 {/* --- Interview Controls (End Button) --- */}
                 <div className="flex flex-row justify-center items-center gap-4 mt-auto pb-4 border-t border-gray-200 pt-4 px-4"> {/* Added px-4 */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button
                           className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-base" // Adjusted padding/text size
                           disabled={isLoadingPractice || isLoadingInterview} // Disable while ending
                         >
                           {isPracticing ? "End Practice" : "End Interview"}
                         </Button>
                      </AlertDialogTrigger>
                       <AlertDialogContent>
                         <AlertDialogHeader>
                           <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                           <AlertDialogDescription>
                             {isPracticing
                               ? "This will end the practice session."
                               : "This action cannot be undone. This will end the interview."}
                           </AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogCancel>Cancel</AlertDialogCancel>
                           <AlertDialogAction
                             className="bg-red-600 hover:bg-red-800"
                             onClick={handleEndCall} // Use unified handler
                           >
                              {isPracticing ? "End Practice" : "End Interview"}
                           </AlertDialogAction>
                         </AlertDialogFooter>
                       </AlertDialogContent>
                     </AlertDialog>
                   </div> {/* End Controls Area */}
               </div> // End Main container for active call UI
            )}

            {/* --- Old User View --- */}
            {isOldUser && (
               <div className="flex flex-col items-center justify-center h-[60vh]">
                 <XCircleIcon className="h-16 w-16 text-red-500 mb-4" />
                 <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                 <p className="text-center text-gray-600 mb-4 max-w-md">
                   {interview?.is_anonymous
                     ? "This interview has already been completed from this browser session."
                     : "You have already responded to this interview, or the email provided is not permitted to respond."}
                 </p>
                 <p className="text-center text-gray-600">
                   Please contact the sender if you believe this is an error.
                 </p>
               </div>
            )}

            {/* --- End View (After Real Call) --- */}
            {isEnded && !isOldUser && !isPracticing && (
              <div className="flex flex-col items-center justify-center h-[60vh]">
                <CheckCircleIcon className="h-16 w-16 text-green-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Thank you!</h1>
                <p className="text-center text-gray-600 mb-6 max-w-md">
                  Your response has been submitted. You may now close this window.
                </p>
                {/* Temporarily remove interview.show_feedback_form check for debugging */}
                {!isFeedbackSubmitted /* && interview.show_feedback_form */ && (
                  <>
                    <p className="text-center text-gray-600 mb-4 max-w-md">
                      We&apos;d love to hear your feedback on the interview
                      experience.
                    </p>
                    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                          style={{
                            backgroundColor: interview.theme_color ?? "#4F46E5",
                            color: isLightColor(interview.theme_color ?? "#4F46E5")
                              ? "black"
                              : "white",
                          }}
                        >
                          Provide Feedback
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Feedback</AlertDialogTitle>
                        </AlertDialogHeader>
                        {/* Pass email only if it exists (was collected) */}
                        <FeedbackForm email={!interview?.is_anonymous ? email : undefined} onSubmit={handleFeedbackSubmit} />
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            )}

             {/* --- End View (After Practice Call) --- */}
            {isEnded && isPracticing && (
              <div className="flex flex-col items-center justify-center h-[auto] min-h-[60vh] py-8"> {/* Adjusted height for inputs */}
                <CheckCircleIcon className="h-16 w-16 text-blue-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Practice Ended</h1>
                <p className="text-center text-gray-600 mb-6 max-w-md">
                   You have completed the practice session. Please enter your details below if required, then start the actual interview or exit.
                 </p>

                 {/* --- Conditionally Show Email/Name Inputs --- */}
                 {!interview?.is_anonymous && (
                   <div className="w-full max-w-sm flex flex-col gap-3 mb-6 px-4"> {/* Container for inputs */}
                     {/* Name Input First */}
                     <input
                       value={name}
                       type="text"
                       className="h-fit py-2 border-2 rounded-md w-full self-center px-2 border-gray-400 text-sm font-normal"
                       placeholder="Enter your first name"
                       onChange={(e) => setName(e.target.value)}
                     />
                     {/* Email Input Second */}
                     <input
                       value={email}
                       type="email"
                       className="h-fit py-2 border-2 rounded-md w-full self-center px-2 border-gray-400 text-sm font-normal"
                       placeholder="Enter your email address"
                       onChange={(e) => setEmail(e.target.value)}
                     />
                   </div>
                 )}
                 {/* --- End Email/Name Inputs --- */}

                 {/* Action Buttons After Practice */}
                 <div className="flex space-x-4">
                    <Button
                       className="flex-1 h-10 rounded-lg"
                       style={{
                         backgroundColor: interview.theme_color ?? "#4F46E5",
                         color: isLightColor(interview.theme_color ?? "#4F46E5")
                           ? "black"
                           : "white",
                       }}
                       disabled={isLoadingInterview || (!interview?.is_anonymous && (!isValidEmail || !name))}
                       onClick={() => {
                           console.log("[Practice Ended Button Click] Attempting to start real interview...");
                           setIsEnded(false);
                           setIsPracticing(false);
                           setIsStarted(false);
                           setLastInterviewerResponse("");
                           setLastUserResponse("");
                           setCallId("");
                           prepareToStartConversation(false);
                       }}
                     >
                       {isLoadingInterview ? <MiniLoader/> : "Start Interview"}
                    </Button>
                 </div>
               </div>
             )}

          </div>
        </Card>
         {/* Footer - Ensure correct syntax */}
         <a
          className="flex flex-row justify-center align-middle mt-3"
          href="https://Vocal-up.co/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="text-center text-md font-semibold mr-2">
            Powered by{" "}
            <span className="font-bold">
              Vocal<span className="text-indigo-600">Hire</span>
            </span>
          </div>
          <ArrowUpRightSquareIcon className="h-[1.5rem] w-[1.5rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-indigo-500" />
        </a>

        {/* --- Unmute Instruction Popup --- */}
        <AlertDialog open={showUnmuteInstruction} onOpenChange={setShowUnmuteInstruction}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Microphone Muted</AlertDialogTitle>
              <AlertDialogDescription>
                Your microphone starts muted. Click the
                <span className="inline-flex items-center mx-1 p-0.5 rounded bg-gray-200">
                  <MicOffIcon className="h-3 w-3 mr-0.5"/> Unmute
                </span>
                button
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {/* Call execute function on dismiss */}
              <AlertDialogAction onClick={() => {
                setShowUnmuteInstruction(false);
                // Use a short delay to allow state update before execution?
                // Or trust React batching? Let's try without delay first.
                executeStartConversation();
              }}>
                Got it!
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* --- End Unmute Instruction Popup --- */}
      </div>
    </div>
  );
}

export default Call;
