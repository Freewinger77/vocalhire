"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PhoneNumber } from "@/services/phone-numbers.service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";

interface LinkPhoneNumberModalProps {
  interviewId: string;
  agentId: string;
  interviewType: string;
  className?: string;
}

export default function LinkPhoneNumberModal({
  interviewId,
  agentId,
  interviewType,
  className
}: LinkPhoneNumberModalProps) {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>("");
  const [isLinking, setIsLinking] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      fetchAvailablePhoneNumbers();
    }
  }, [open]);

  const fetchAvailablePhoneNumbers = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/phone-numbers");
      const available = response.data.phoneNumbers.filter(
        (pn: PhoneNumber) => pn.is_available
      );
      setPhoneNumbers(available);
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      toast.error("Failed to load available phone numbers");
    } finally {
      setIsLoading(false);
    }
  };

  const linkPhoneNumber = async () => {
    if (!selectedPhoneNumberId) {
      toast.error("Please select a phone number");
      
      return;
    }

    if (!agentId) {
      console.error("Missing agent ID:", { agentId, interviewId });
      
      // Get interviewer details to find the agent_id
      try {
        const response = await axios.get(`/api/interviews/${interviewId}`);
        const interview = response.data.interview;
        
        if (interview && interview.interviewer_id) {
          // Get interviewer details to fetch agent_id
          const interviewerResponse = await axios.get(`/api/interviewers/${interview.interviewer_id}`);
          const interviewer = interviewerResponse.data.interviewer;
          
          if (interviewer && interviewer.agent_id) {
            // Use the interviewer's agent_id
            console.log("Retrieved agent_id from interviewer:", interviewer.agent_id);
            proceedWithLinking(interviewer.agent_id);
            
            return;
          }
        }
        
        toast.error("Missing agent ID for interview. Please check interview configuration.");
      } catch (error) {
        console.error("Error retrieving agent ID:", error);
        toast.error("Failed to retrieve agent ID. Please check interview configuration.");
      }
      
      return;
    }

    if (!interviewId) {
      console.error("Missing interview ID:", { interviewId });
      toast.error("Missing interview ID. Please check interview configuration.");
      
      return;
    }

    proceedWithLinking(agentId);
  };

  const proceedWithLinking = async (agentIdToUse: string) => {
    setIsLinking(true);
    try {
      const phoneNumId = parseInt(selectedPhoneNumberId);
      console.log("Attempting to link phone number with:", {
        phoneNumberId: phoneNumId,
        agentId: agentIdToUse,
        interviewId
      });
      
      const response = await axios.post("/api/phone-numbers/link", {
        phoneNumberId: phoneNumId,
        agentId: agentIdToUse,
        interviewId
      });
      
      console.log("Phone number linked successfully:", response.data);
      
      // Also update the interview record with the agent_id
      try {
        console.log("Updating interview with agent_id:", agentIdToUse);
        const updateResponse = await axios.post(`/api/interviews/${interviewId}/update`, {
          agent_id: agentIdToUse
        });
        console.log("Interview updated successfully:", updateResponse.data);
      } catch (updateError: any) {
        console.error("Error updating interview with agent_id:", updateError);
        // Continue even if this fails - the phone is linked
      }
      
      toast.success("Phone number linked successfully");
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      console.error("Error linking phone number:", error);
      console.error("Error details:", error.response?.data || error.message);
      toast.error(`Failed to link phone number: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsLinking(false);
    }
  };

  const checkCallLogs = async () => {
    try {
      const selectedPhone = phoneNumbers.find(p => p.id.toString() === selectedPhoneNumberId);
      if (selectedPhone) {
        const number = selectedPhone.number.replace('+', '');
        const response = await axios.get(`/api/phone-numbers/calls/${number}`);
        
        if (response.data.calls && response.data.calls.length > 0) {
          toast.success(`Found ${response.data.calls.length} calls for ${selectedPhone.number}`);
          console.log('Call logs:', response.data.calls);
        } else {
          toast.info(`No calls found for ${selectedPhone.number}`);
        }
      }
    } catch (error: any) {
      console.error('Error checking calls:', error);
      toast.error(`Error checking calls: ${error.response?.data?.error || error.message}`);
    }
  };

  // Only show for phone interviews
  if (interviewType !== "phone") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className={className}
        >
          <PhoneIcon className="h-4 w-4 mr-1" />
          Phone Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Link Phone Number</DialogTitle>
          <DialogDescription>
            Choose a phone number to connect to this interview.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <LoaderWithText />
          </div>
        ) : phoneNumbers.length === 0 ? (
          <div className="p-4 text-center">
            <p className="mb-4">No available phone numbers found.</p>
            <Button
              onClick={() => router.push('/dashboard/phone-numbers')}
              variant="outline"
            >
              Manage Phone Numbers
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone-number" className="text-right">
                  Phone Number
                </Label>
                <Select
                  value={selectedPhoneNumberId}
                  onValueChange={setSelectedPhoneNumberId}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map((phone) => (
                      <SelectItem key={phone.id} value={String(phone.id)}>
                        {phone.number} {phone.nickname ? `(${phone.nickname})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Add debugging option */}
            {selectedPhoneNumberId && (
              <div className="mt-2 mb-4">
                <Button onClick={checkCallLogs}
                  className="text-xs"
                  size="sm"
                  variant="outline">
                  Check Call Logs
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={isLinking || phoneNumbers.length === 0 || !selectedPhoneNumberId}
                onClick={linkPhoneNumber}
              >
                {isLinking ? "Linking..." : "Link Phone Number"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
} 