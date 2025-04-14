"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import React, { useState, useEffect } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useInterviews } from "@/contexts/interviews.context";
import { Share2, Filter, Pencil, UserIcon, Eye, Palette, Phone } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";
import { ResponseService } from "@/services/responses.service";
import { ClientService } from "@/services/clients.service";
import { Interview } from "@/types/interview";
import { Response } from "@/types/response";
import { formatTimestampToDateHHMM } from "@/lib/utils";
import CallInfo from "@/components/call/callInfo";
import SummaryInfo from "@/components/dashboard/interview/summaryInfo";
import { InterviewService } from "@/services/interviews.service";
import EditInterview from "@/components/dashboard/interview/editInterview";
import Modal from "@/components/dashboard/Modal";
import { toast } from "sonner";
import { ChromePicker } from "react-color";
import SharePopup from "@/components/dashboard/interview/sharePopup";
import LinkPhoneNumberModal from "@/components/interview/LinkPhoneNumberModal";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CandidateStatus } from "@/lib/enum";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";
import axios from "axios";

interface Props {
  params: {
    interviewId: string;
  };
  searchParams: {
    call: string;
    edit: boolean;
  };
}

const base_url = process.env.NEXT_PUBLIC_LIVE_URL;

function InterviewHome({ params, searchParams }: Props) {
  const [interview, setInterview] = useState<Interview>();
  const [responses, setResponses] = useState<Response[]>();
  const { getInterviewById } = useInterviews();
  const [isSharePopupOpen, setIsSharePopupOpen] = useState(false);
  const router = useRouter();
  const [isActive, setIsActive] = useState<boolean>(true);
  const [currentPlan, setCurrentPlan] = useState<string>("");
  const [isGeneratingInsights, setIsGeneratingInsights] =
    useState<boolean>(false);
  const [isViewed, setIsViewed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [themeColor, setThemeColor] = useState<string>("#4F46E5");
  const [iconColor, seticonColor] = useState<string>("#4F46E5");
  const { organization } = useOrganization();
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const seeInterviewPreviewPage = () => {
    const protocol = base_url?.includes("localhost") ? "http" : "https";
    if (interview?.url) {
      const url = interview?.readable_slug
        ? `${protocol}://${base_url}/call/${interview?.readable_slug}`
        : interview.url.startsWith("http")
          ? interview.url
          : `https://${interview.url}`;
      window.open(url, "_blank");
    } else {
      console.error("Interview URL is null or undefined.");
    }
  };

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const response = await getInterviewById(params.interviewId);
        setInterview(response);
        setIsActive(response.is_active);
        setIsViewed(response.is_viewed);
        setThemeColor(response.theme_color ?? "#4F46E5");
        seticonColor(response.theme_color ?? "#4F46E5");
        setLoading(true);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (!interview || !isGeneratingInsights) {
      fetchInterview();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getInterviewById, params.interviewId, isGeneratingInsights]);

  useEffect(() => {
    const fetchOrganizationData = async () => {
      try {
        if (organization?.id) {
          const data = await ClientService.getOrganizationById(organization.id);
          if (data?.plan) {
            setCurrentPlan(data.plan);
          }
        }
      } catch (error) {
        console.error("Error fetching organization data:", error);
      }
    };

    fetchOrganizationData();
  }, [organization]);
  useEffect(() => {
    const fetchResponses = async () => {
      try {
        const response = await ResponseService.getAllResponses(
          params.interviewId,
        );
        setResponses(response);
        setLoading(true);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchResponses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteResponse = (deletedCallId: string) => {
    if (responses) {
      setResponses(
        responses.filter((response) => response.call_id !== deletedCallId),
      );
      if (searchParams.call === deletedCallId) {
        router.push(`/interviews/${params.interviewId}`);
      }
    }
  };

  const handleResponseClick = async (response: Response) => {
    try {
      await ResponseService.saveResponse({ is_viewed: true }, response.call_id);
      if (responses) {
        const updatedResponses = responses.map((r) =>
          r.call_id === response.call_id ? { ...r, is_viewed: true } : r,
        );
        setResponses(updatedResponses);
      }
      setIsViewed(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggle = async () => {
    try {
      const updatedIsActive = !isActive;
      setIsActive(updatedIsActive);

      await InterviewService.updateInterview(
        { is_active: updatedIsActive },
        params.interviewId,
      );

      toast.success("Interview status updated", {
        description: `The interview is now ${
          updatedIsActive ? "active" : "inactive"
        }.`,
        position: "bottom-right",
        duration: 3000,
      });
    } catch (error) {
      console.error(error);
      toast.error("Error", {
        description: "Failed to update the interview status.",
        duration: 3000,
      });
    }
  };

  const handleThemeColorChange = async (newColor: string) => {
    try {
      await InterviewService.updateInterview(
        { theme_color: newColor },
        params.interviewId,
      );

      toast.success("Theme color updated", {
        position: "bottom-right",
        duration: 3000,
      });
    } catch (error) {
      console.error(error);
      toast.error("Error", {
        description: "Failed to update the theme color.",
        duration: 3000,
      });
    }
  };

  const handleCandidateStatusChange = (callId: string, newStatus: string) => {
    setResponses((prevResponses) => {
      return prevResponses?.map((response) =>
        response.call_id === callId
          ? { ...response, candidate_status: newStatus }
          : response,
      );
    });
  };

  const openSharePopup = () => {
    setIsSharePopupOpen(true);
  };

  const closeSharePopup = () => {
    setIsSharePopupOpen(false);
  };

  const handleColorChange = (color: any) => {
    setThemeColor(color.hex);
  };

  const applyColorChange = () => {
    if (themeColor !== iconColor) {
      seticonColor(themeColor);
      handleThemeColorChange(themeColor);
    }
    setShowColorPicker(false);
  };

  const filterResponses = () => {
    if (!responses) {
      return [];
    }
    if (filterStatus == "ALL") {
      return responses;
    }

    return responses?.filter(
      (response) => response?.candidate_status == filterStatus,
    );
  };

  return (
    <div className="flex flex-col w-full h-full m-2 bg-white">
      {loading ? (
        <div className="flex flex-col items-center justify-center h-[80%] w-full">
          <LoaderWithText />
        </div>
      ) : (
        <>
          <div className="flex flex-row p-3 pt-4 justify-center gap-6 items-center sticky top-2 bg-white">
            <div className="font-bold text-md">{interview?.name}</div>

            <div
              className="w-5 h-5 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: iconColor }}
            />

            <div className="flex flex-row gap-3 my-auto">
              <UserIcon className="my-auto" size={16} />:{" "}
              {String(responses?.length)}
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className={
                      "bg-transparent shadow-none relative text-xs text-indigo-600 px-1 h-7 hover:scale-110 hover:bg-transparent"
                    }
                    variant={"secondary"}
                    onClick={(event) => {
                      event.stopPropagation();
                      openSharePopup();
                    }}
                  >
                    <Share2 size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  className="bg-zinc-300"
                  side="bottom"
                  sideOffset={4}
                >
                  <span className="text-black flex flex-row gap-4">Share</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="bg-transparent shadow-none text-xs text-indigo-600 px-0 h-7 hover:scale-110 relative"
                    onClick={(event) => {
                      event.stopPropagation();
                      seeInterviewPreviewPage();
                    }}
                  >
                    <Eye />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  className="bg-zinc-300"
                  side="bottom"
                  sideOffset={4}
                >
                  <span className="text-black flex flex-row gap-4">
                    Preview
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {interview?.interview_type === 'phone' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <LinkPhoneNumberModal 
                      interviewId={params.interviewId}
                      agentId={interview?.agent_id || ''}
                      interviewType={interview?.interview_type || 'web'}
                      className="bg-transparent shadow-none text-xs text-pink-500 px-0 h-7 hover:scale-110 relative"
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    className="bg-zinc-300"
                    side="bottom"
                    sideOffset={4}
                  >
                    <span className="text-black flex flex-row gap-4">
                      Phone Number
                    </span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {interview?.interview_type === 'phone' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="bg-transparent shadow-none text-xs text-green-500 px-0 h-7 hover:scale-110 relative"
                      onClick={async () => {
                        toast.info("Fetching phone call data...", {
                          description: "This may take a moment to connect to Retell API"
                        });
                        
                        // Track loading state
                        const buttonEl = document.activeElement as HTMLButtonElement;
                        if (buttonEl) {
                          buttonEl.disabled = true;
                          buttonEl.innerHTML = '<span class="animate-pulse">Fetching...</span>';
                        }
                        
                        try {
                          let agentId = interview?.agent_id;
                          
                          // If no agent_id in interview, try to find it from a linked phone number
                          if (!agentId) {
                            console.log("No agent_id in interview, checking linked phone...");
                            
                            try {
                              // Find the phone number for this interview
                              const phoneResponse = await axios.get("/api/phone-numbers");
                              console.log("Phone numbers response:", phoneResponse.data);
                              
                              const linkedPhone = phoneResponse.data.phoneNumbers.find(
                                (phone: any) => phone.interview_id === params.interviewId
                              );
                              
                              if (linkedPhone && linkedPhone.agent_linked) {
                                console.log("Found agent_id from linked phone:", linkedPhone.agent_linked);
                                agentId = linkedPhone.agent_linked;
                                
                                // Update the interview with this agent_id for future use
                                try {
                                  const updateResponse = await axios.post(`/api/interviews/${params.interviewId}/update`, {
                                    agent_id: agentId
                                  });
                                  console.log("Interview updated with agent_id:", updateResponse.data);
                                } catch (updateError) {
                                  console.error("Failed to update interview with agent_id:", updateError);
                                }
                              } else {
                                toast.warning("No phone number linked with an agent ID");
                                
                                return;
                              }
                            } catch (phoneError) {
                              console.error("Error finding linked phone:", phoneError);
                              toast.error("Could not find a linked phone with agent ID");
                              
                              return;
                            }
                          }
                          
                          // Now proceed with the agent ID we have
                          console.log("Fetching calls for agent ID:", agentId);
                          
                          toast.info("Querying Retell API for calls...");
                          const agentCallsResponse = await axios.post("/api/phone-numbers/list-agent-calls", {
                            agentId: agentId,
                            interviewId: params.interviewId
                          });
                          
                          console.log("Agent calls response:", agentCallsResponse.data);
                          
                          if (agentCallsResponse.data.success) {
                            if (agentCallsResponse.data.newCalls > 0) {
                              toast.success(
                                `Found ${agentCallsResponse.data.newCalls} new call${agentCallsResponse.data.newCalls !== 1 ? 's' : ''}!`, 
                                { description: `IDs: ${agentCallsResponse.data.callIds.join(', ')}` }
                              );
                              
                              // Update responses with the new data
                              setResponses(agentCallsResponse.data.responses);
                            } else if (agentCallsResponse.data.totalCalls > 0) {
                              toast.info(
                                `No new calls found`, 
                                { description: `Found ${agentCallsResponse.data.totalCalls} call(s) but they're already in the system.` }
                              );
                            } else {
                              toast.info("No calls found for this agent", {
                                description: "Try making a phone call to this number first"
                              });
                            }
                            
                            // Return early - no need to try the fallback method
                            return;
                          }
                        } catch (error: any) {
                          console.error("Error fetching calls:", error);
                          // Log more detailed error information
                          if (error.response) {
                            console.error("Error response data:", error.response.data);
                            console.error("Error response status:", error.response.status);
                            console.error("Error response headers:", error.response.headers);
                          }
                          toast.error(`Error fetching calls: ${error.response?.data?.error || error.message}`);
                        } finally {
                          // Restore the button
                          if (buttonEl) {
                            buttonEl.disabled = false;
                            buttonEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
                          }
                        }
                      }}
                    >
                      <Phone size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    className="bg-zinc-300"
                    side="bottom"
                    sideOffset={4}
                  >
                    <span className="text-black flex flex-row gap-4">
                      Refresh Phone Calls
                    </span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="bg-transparent shadow-none text-xs text-indigo-600 px-0 h-7 hover:scale-110 relative"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowColorPicker(!showColorPicker);
                    }}
                  >
                    <Palette size={19} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  className="bg-zinc-300"
                  side="bottom"
                  sideOffset={4}
                >
                  <span className="text-black flex flex-row gap-4">
                    Theme Color
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="bg-transparent shadow-none text-xs text-indigo-600 px-0 h-7 hover:scale-110 relative"
                    onClick={(event) => {
                      router.push(
                        `/interviews/${params.interviewId}?edit=true`,
                      );
                    }}
                  >
                    <Pencil size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  className="bg-zinc-300"
                  side="bottom"
                  sideOffset={4}
                >
                  <span className="text-black flex flex-row gap-4">Edit</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <label className="inline-flex cursor-pointer">
              {currentPlan == "free_trial_over" ? (
                <>
                  <span className="ms-3 my-auto text-sm">Inactive</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipContent
                        className="bg-zinc-300"
                        side="bottom"
                        sideOffset={4}
                      >
                        Upgrade your plan to reactivate
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              ) : (
                <>
                  <span className="ms-3 my-auto text-sm">Active</span>
                  <Switch
                    checked={isActive}
                    className={`ms-3 my-auto ${
                      isActive ? "bg-indigo-600" : "bg-[#E6E7EB]"
                    }`}
                    onCheckedChange={handleToggle}
                  />
                </>
              )}
            </label>
          </div>
          <div className="flex flex-row w-full p-2 h-[85%] gap-1 ">
            <div className="w-[20%] flex flex-col p-2 divide-y-2 rounded-sm border-2 border-slate-100">
              <div className="flex w-full justify-center py-2">
                <Select
                  onValueChange={async (newValue: string) => {
                    setFilterStatus(newValue);
                  }}
                >
                  <SelectTrigger className="w-[95%] bg-slate-100 rounded-lg">
                    <Filter size={18} className=" text-slate-400" />
                    <SelectValue placeholder="Filter By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CandidateStatus.NO_STATUS}>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-gray-400 rounded-full mr-2" />
                        No Status
                      </div>
                    </SelectItem>
                    <SelectItem value={CandidateStatus.NOT_SELECTED}>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2" />
                        Not Selected
                      </div>
                    </SelectItem>
                    <SelectItem value={CandidateStatus.POTENTIAL}>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2" />
                        Potential
                      </div>
                    </SelectItem>
                    <SelectItem value={CandidateStatus.SELECTED}>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-2" />
                        Selected
                      </div>
                    </SelectItem>
                    <SelectItem value="ALL">
                      <div className="flex items-center">
                        <div className="w-3 h-3 border-2 border-gray-300 rounded-full mr-2" />
                        All
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-full p-1 rounded-md border-none">
                {filterResponses().length > 0 ? (
                  filterResponses().map((response) => (
                    <div
                      className={`p-2 rounded-md hover:bg-indigo-100 border-2 my-1 text-left text-xs ${
                        searchParams.call == response.call_id
                          ? "bg-indigo-200"
                          : "border-indigo-100"
                      } flex flex-row justify-between cursor-pointer w-full`}
                      key={response?.id}
                      onClick={() => {
                        router.push(
                          `/interviews/${params.interviewId}?call=${response.call_id}`,
                        );
                        handleResponseClick(response);
                      }}
                    >
                      <div className="flex flex-row gap-1 items-center w-full">
                        {response.candidate_status === "NOT_SELECTED" ? (
                          <div className="w-[5%] h-full bg-red-500 rounded-sm" />
                        ) : response.candidate_status === "POTENTIAL" ? (
                          <div className="w-[5%] h-full bg-yellow-500 rounded-sm" />
                        ) : response.candidate_status === "SELECTED" ? (
                          <div className="w-[5%] h-full bg-green-500 rounded-sm" />
                        ) : (
                          <div className="w-[5%] h-full bg-gray-400 rounded-sm" />
                        )}
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col my-auto">
                            <p className="font-medium mb-[2px]">
                              {response?.name
                                ? `${response?.name}'s Response`
                                : "Anonymous"}
                            </p>
                            <p className="">
                              {formatTimestampToDateHHMM(
                                String(response?.created_at),
                              )}
                            </p>
                          </div>
                          <div className="flex flex-col items-center justify-center ml-auto flex-shrink-0">
                            {!response.is_viewed && (
                              <div className="w-4 h-4 flex items-center justify-center mb-1">
                                <div className="text-indigo-500 text-xl leading-none">
                                  ●
                                </div>
                              </div>
                            )}
                            <div
                              className={`w-6 h-6 flex items-center justify-center ${
                                response.is_viewed ? "h-full" : ""
                              }`}
                            >
                              {response.analytics &&
                                response.analytics.overallScore !==
                                  undefined && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="w-6 h-6 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center">
                                          <span className="text-indigo-500 text-xs font-semibold">
                                            {response?.analytics?.overallScore}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        className="bg-gray-500"
                                        side="bottom"
                                        sideOffset={4}
                                      >
                                        <span className="text-white font-normal flex flex-row gap-4">
                                          Overall Score
                                        </span>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500">
                    No responses to display
                  </p>
                )}
              </ScrollArea>
            </div>
            {responses && (
              <div className="w-[85%] rounded-md ">
                {searchParams.call ? (
                  <CallInfo
                    call_id={searchParams.call}
                    onDeleteResponse={handleDeleteResponse}
                    onCandidateStatusChange={handleCandidateStatusChange}
                  />
                ) : searchParams.edit ? (
                  <EditInterview interview={interview} />
                ) : (
                  <SummaryInfo responses={responses} interview={interview} />
                )}
              </div>
            )}
          </div>
        </>
      )}
      <Modal
        open={showColorPicker}
        closeOnOutsideClick={false}
        onClose={applyColorChange}
      >
        <div className="w-[250px] p-3">
          <h3 className="text-lg font-semibold mb-4 text-center">
            Choose a Theme Color
          </h3>
          <ChromePicker
            disableAlpha={true}
            color={themeColor}
            styles={{
              default: {
                picker: { width: "100%" },
              },
            }}
            onChange={handleColorChange}
          />
        </div>
      </Modal>
      {isSharePopupOpen && (
        <SharePopup
          open={isSharePopupOpen}
          shareContent={
            interview?.readable_slug
              ? `${base_url}/call/${interview?.readable_slug}`
              : (interview?.url as string)
          }
          onClose={closeSharePopup}
        />
      )}
    </div>
  );
}

export default InterviewHome;
