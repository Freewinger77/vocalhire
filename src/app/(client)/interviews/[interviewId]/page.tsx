"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import React, { useState, useEffect, useMemo } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useInterviews } from "@/contexts/interviews.context";
import { Share2, Filter, Pencil, UserIcon, Eye, Palette } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { DataTable } from "@/components/dashboard/interview/dataTable";
import SharePopup from "@/components/dashboard/interview/sharePopup";

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
  const [metricWeights, setMetricWeights] = useState<{ [key: string]: number }>({});
  const [isSavingWeights, setIsSavingWeights] = useState<boolean>(false);

  const calculateWeightedScore = (response: Response, weights: { [key: string]: number }): number => {
    if (!response.analytics || Object.keys(weights).length === 0) {
      return response.analytics?.overallScore || 0;
    }

    let totalWeightedScore = 0;
    const analytics = response.analytics as any;

    const communicationScore = analytics.communication?.score ?? 0;
    const communicationWeight = weights["Communication"] ?? 0;
    totalWeightedScore += (communicationScore * communicationWeight) / 10;

    interview?.custom_metrics?.forEach((metricName: string) => {
      const metricKey = metricName.toLowerCase().replace(/\s+/g, '_');
      const metricScore = analytics[metricKey]?.score ?? 0;
      const metricWeight = weights[metricName] ?? 0;
      totalWeightedScore += (metricScore * metricWeight) / 10;
    });

    return Math.max(0, Math.min(100, Math.round(totalWeightedScore)));
  };

  const initializeWeights = (currentInterview: Interview) => {
    const initialWeights: { [key: string]: number } = {};
    let totalWeight = 0;

    initialWeights["Communication"] = 100;

    if (currentInterview.custom_metrics) {
      (currentInterview.custom_metrics as string[]).forEach(metric => {
        initialWeights[metric] = 0;
      });
    }

    if (currentInterview.metric_weights) {
       try {
         const savedWeights = currentInterview.metric_weights as { [key: string]: number };
         Object.keys(initialWeights).forEach(metric => {
            if (savedWeights.hasOwnProperty(metric)) {
                 initialWeights[metric] = savedWeights[metric];
            }
         });
         totalWeight = Object.values(initialWeights).reduce((sum, w) => sum + w, 0);
         if (totalWeight !== 100 && totalWeight > 0) {
            const factor = 100 / totalWeight;
            Object.keys(initialWeights).forEach(metric => {
                initialWeights[metric] = Math.round(initialWeights[metric] * factor);
            });
            totalWeight = Object.values(initialWeights).reduce((sum, w) => sum + w, 0);
             if (totalWeight !== 100) {
                 const diff = 100 - totalWeight;
                 const firstMetric = Object.keys(initialWeights)[0];
                 initialWeights[firstMetric] += diff;
             }
         } else if (totalWeight === 0) {
             initialWeights["Communication"] = 100;
         }

       } catch (e) {
          console.error("Failed to parse saved metric weights", e);
          initialWeights["Communication"] = 100;
          if (currentInterview.custom_metrics) {
            (currentInterview.custom_metrics as string[]).forEach(metric => {
              initialWeights[metric] = 0;
            });
          }
       }
    }

    setMetricWeights(initialWeights);
  };

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        setLoading(true);
        const response = await getInterviewById(params.interviewId);
        setInterview(response);
        setIsActive(response.is_active);
        setThemeColor(response.theme_color ?? "#4F46E5");
        seticonColor(response.theme_color ?? "#4F46E5");
        if (response) {
            initializeWeights(response);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (!interview || isGeneratingInsights) {
      fetchInterview();
    } else if (interview && Object.keys(metricWeights).length === 0) {
        initializeWeights(interview);
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

  useEffect(() => {
    if (interview) {
        initializeWeights(interview);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [interview?.custom_metrics, interview?.metric_weights]);

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
    const filtered = filterStatus === "ALL"
        ? responses
        : responses.filter(response => response.candidate_status === filterStatus);

    return filtered;
  };

  const handleWeightChange = (metricName: string, value: number) => {
    const newWeights = { ...metricWeights, [metricName]: value };

    // Normalize weights to sum to 100
    let currentTotal = Object.values(newWeights).reduce((sum, w) => sum + w, 0);

    if (currentTotal > 100) {
      // Reduce other weights proportionally
      const overflow = currentTotal - 100;
      const otherMetricsTotal = currentTotal - value;

      if (otherMetricsTotal > 0) {
           // Distribute the reduction among other metrics
            Object.keys(newWeights).forEach(key => {
                if (key !== metricName) {
                     const proportion = newWeights[key] / otherMetricsTotal;
                     newWeights[key] = Math.max(0, Math.round(newWeights[key] - overflow * proportion));
                }
            });
            // Recalculate total after rounding and adjust if necessary
            currentTotal = Object.values(newWeights).reduce((sum, w) => sum + w, 0);
             const adjustment = 100 - currentTotal;
             if (adjustment !== 0) {
                 // Add/subtract adjustment to the changed metric if possible, else distribute
                 if (newWeights[metricName] + adjustment >= 0) {
                    newWeights[metricName] += adjustment;
                 } else {
                    // Fallback: apply adjustment to the first available metric
                    const firstKey = Object.keys(newWeights).find(k => newWeights[k] > 0 && k !== metricName) || Object.keys(newWeights)[0];
                    if (newWeights[firstKey] !== undefined) { // Check if key exists
                       newWeights[firstKey] += adjustment;
                    }
                 }
             }

      } else {
          // If only one metric has weight, cap it at 100
          newWeights[metricName] = 100;
      }

    }
     // Ensure the final sum is exactly 100 after all adjustments
    currentTotal = Object.values(newWeights).reduce((sum, w) => sum + w, 0);
    if (currentTotal !== 100 && Object.keys(newWeights).length > 0) {
         const diff = 100 - currentTotal;
         // Apply difference to the metric that was just changed if possible
         if (newWeights[metricName] !== undefined) {
            newWeights[metricName] = Math.max(0, newWeights[metricName] + diff);
         } else {
            // Fallback: apply to the first metric
             const firstKey = Object.keys(newWeights)[0];
             if (newWeights[firstKey] !== undefined) {
                 newWeights[firstKey] = Math.max(0, newWeights[firstKey] + diff); // Ensure not negative
             }
         }
    }


    setMetricWeights(newWeights);
  };

  const saveWeights = async () => {
    if (!interview) {
        return;
    }
    setIsSavingWeights(true);
    try {
      await InterviewService.updateInterview(
        { metric_weights: metricWeights }, 
        interview.id,
      );
      toast.success("Metric weights saved successfully!", {
         position: "bottom-right",
         duration: 3000,
      });
    } catch (error) {
      console.error("Failed to save metric weights:", error);
      toast.error("Error saving weights", {
        description: "Failed to update metric weights.",
        duration: 3000,
      });
    } finally {
      setIsSavingWeights(false);
    }
  };

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

  // Prepare data for DataTable
  const tableData = useMemo(() => {
     const filtered = filterResponses();
     if (!Array.isArray(filtered)) {
         return [];
     }
     
     return filtered.map(response => ({
         ...response,
         weightedScore: calculateWeightedScore(response, metricWeights),
     }));
  }, [responses, metricWeights, filterStatus]);

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
          <div className="flex flex-1 overflow-hidden gap-4">
            <div className="w-2/5 flex flex-col border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b bg-muted/40">
                <h2 className="text-lg font-semibold">Responses ({responses?.length || 0})</h2>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                   <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by Status" />
                   </SelectTrigger>
                   <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value={CandidateStatus.NO_STATUS}>No Status</SelectItem>
                      <SelectItem value={CandidateStatus.NOT_SELECTED}>Rejected</SelectItem>
                      <SelectItem value={CandidateStatus.POTENTIAL}>Potential</SelectItem>
                      <SelectItem value={CandidateStatus.SELECTED}>Approved</SelectItem>
                   </SelectContent>
                </Select>
              </div>
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <LoaderWithText />
                  </div>
                ) : tableData.length > 0 ? (
                  <DataTable
                    data={tableData}
                    interviewId={params.interviewId}
                    selectedCallId={searchParams.call}
                    handleCandidateStatusChange={handleCandidateStatusChange}
                    onRowClick={handleResponseClick}
                  />
                ) : (
                  <p className="p-4 text-center text-muted-foreground">
                    No responses yet.
                  </p>
                )}
              </ScrollArea>
            </div>
            {responses && (
              <div className="w-3/5 border rounded-lg overflow-hidden flex flex-col">
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
      {interview && (interview.custom_metrics?.length ?? 0) > 0 && Object.keys(metricWeights).length > 0 && (
          <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm mt-4">
              <h3 className="text-lg font-semibold mb-3">Adjust Metric Weights</h3>
              <p className="text-sm text-muted-foreground mb-4">
                  Adjust the weightage of each metric to calculate the overall candidate score. Weights must sum to 100.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {Object.keys(metricWeights).map((metricName) => (
                      <div key={metricName}>
                          <label className="block text-sm font-medium mb-1">{metricName} ({metricWeights[metricName]}%)</label>
                          <Slider
                              max={100}
                              step={1}
                              className="w-full"
                              value={[metricWeights[metricName]]}
                              onValueChange={(value) => handleWeightChange(metricName, value[0])}
                          />
                      </div>
                  ))}
              </div>
               <Button disabled={isSavingWeights} onClick={saveWeights}>
                  {isSavingWeights ? <LoaderWithText /> : "Save Weights"}
               </Button>
               <p className="text-xs text-muted-foreground mt-2">
                   Total Weight: {Object.values(metricWeights).reduce((sum, w) => sum + w, 0)}%
               </p>
          </div>
      )}
    </div>
  );
}

export default InterviewHome;
