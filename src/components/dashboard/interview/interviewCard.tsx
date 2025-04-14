import { useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy, Phone, Globe, CopyCheck } from "lucide-react";
import { ResponseService } from "@/services/responses.service";
import axios from "axios";
import MiniLoader from "@/components/loaders/mini-loader/miniLoader";
import { InterviewerService } from "@/services/interviewers.service";
import Link from "next/link";
import LinkPhoneNumberModal from "@/components/interview/LinkPhoneNumberModal";

interface Props {
  name: string | null;
  interviewerId: bigint;
  id: string;
  url: string;
  readableSlug: string;
  interviewType: 'web' | 'phone';
}

interface LinkedPhoneNumber {
  id: number;
  number: string;
  is_available: boolean;
  agent_linked: string;
  interview_id: string;
  nickname: string | null;
}

function InterviewCard({ name, interviewerId, id, url, readableSlug, interviewType }: Props) {
  const [copied, setCopied] = useState(false);
  const [linkedPhoneNumber, setLinkedPhoneNumber] = useState<LinkedPhoneNumber | null>(null);
  const [interviewerDetails, setInterviewerDetails] = useState<any>(null);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [img, setImg] = useState<string>("");
  
  useEffect(() => {
    async function fetchInterviewerDetails() {
      setIsFetching(true);
      try {
        const interviewerDetails = await InterviewerService.getInterviewer(
          interviewerId,
        );
        setInterviewerDetails(interviewerDetails);
        setImg(interviewerDetails?.image);
      } catch (error) {
        console.error("Failed to fetch interviewer:", error);
      } finally {
        setIsFetching(false);
      }
    }

    async function fetchResponseCount() {
      try {
        const responses = await ResponseService.getAllResponses(id);
        setResponseCount(responses.length);
      } catch (error) {
        console.error("Failed to fetch response count:", error);
      }
    }

    // If it's a phone interview, try to fetch the linked phone number
    async function fetchLinkedPhoneNumber() {
      if (interviewType === 'phone') {
        try {
          const response = await axios.get("/api/phone-numbers");
          const phoneNumbers = response.data.phoneNumbers;
          const linked = phoneNumbers.find((pn: LinkedPhoneNumber) => 
            pn.interview_id === id && !pn.is_available
          );
          setLinkedPhoneNumber(linked || null);
        } catch (error) {
          console.error("Failed to fetch linked phone number:", error);
        }
      }
    }

    fetchInterviewerDetails();
    fetchResponseCount();
    fetchLinkedPhoneNumber();
  }, [id, interviewerId, interviewType]);

  function copyToClipboard() {
    if (interviewType === 'phone' && linkedPhoneNumber) {
      navigator.clipboard.writeText(linkedPhoneNumber.number);
    } else {
      navigator.clipboard.writeText(url);
    }
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <Link href={`/interviews/${id}`}>
      <Card className="relative p-0 mt-4 inline-block cursor-pointer h-60 w-56 ml-1 mr-3 rounded-xl shrink-0 overflow-hidden shadow-md">
        <CardContent className={`p-0 ${isFetching ? "opacity-60" : ""}`}>
          <div className={`w-full h-40 overflow-hidden flex items-center text-center ${
            interviewType === 'phone' ? 'bg-pink-400' : 'bg-indigo-600'
          }`}>
            <div className="w-full mt-3 mx-2">
              <div className="flex justify-center items-center mb-2">
                {interviewType === 'phone' ? (
                  <Phone className="text-white" size={24} />
                ) : (
                  <Globe className="text-white" size={24} />
                )}
              </div>
              <CardTitle className="text-white text-lg">
                {name}
                {isFetching && (
                  <div className="z-100 mt-[-5px]">
                    <MiniLoader />
                  </div>
                )}
              </CardTitle>
              
              {interviewType === 'phone' && linkedPhoneNumber && (
                <div className="mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {linkedPhoneNumber.number}
                </div>
              )}
              
              {interviewType === 'phone' && !linkedPhoneNumber && (
                <div className="mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  No phone number linked
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-row items-center mx-4 justify-between">
            <div className="overflow-hidden">
              <Image
                src={img}
                alt="Picture of the interviewer"
                width={70}
                height={70}
                className="object-cover object-center"
              />
            </div>
            <div className="text-black text-sm font-semibold mt-2 whitespace-nowrap">
              Responses:{" "}
              <span className="font-normal">
                {responseCount?.toString() || 0}
              </span>
            </div>
            
            <Button
              variant="secondary"
              className={`text-xs text-indigo-600 px-1 h-6 ${
                copied ? "bg-indigo-300 text-white" : ""
              }`}
              aria-label={copied ? "Link copied" : interviewType === 'phone' ? "Copy phone number" : "Copy interview link"}
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                copyToClipboard();
              }}
            >
              {copied ? <CopyCheck size={16} /> : <Copy size={16} />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default InterviewCard;
