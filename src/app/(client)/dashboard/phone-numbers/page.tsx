"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Phone, Plus, LinkIcon, UnlinkIcon } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PhoneNumber } from "@/services/phone-numbers.service";
import { PrivatePageContainer } from "@/components/privatePageContainer";

export default function PhoneNumbersPage() {
  const { orgId } = useAuth();
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [areaCode, setAreaCode] = useState<string>("415");
  const [nickname, setNickname] = useState("");
  const [isAcquiring, setIsAcquiring] = useState(false);

  useEffect(() => {
    fetchPhoneNumbers();
  }, []);

  const fetchPhoneNumbers = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/phone-numbers");
      setPhoneNumbers(response.data.phoneNumbers);
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      toast.error("Failed to load phone numbers");
    } finally {
      setIsLoading(false);
    }
  };

  const acquirePhoneNumber = async () => {
    if (!/^\d{3}$/.test(areaCode)) {
      toast.error("Area code must be a 3-digit number");
      return;
    }

    setIsAcquiring(true);
    try {
      console.log("Attempting to acquire phone number with area code:", parseInt(areaCode, 10), "Type:", typeof parseInt(areaCode, 10));
      
      const response = await axios.post("/api/phone-numbers/acquire", {
        areaCode: parseInt(areaCode, 10),
        nickname: nickname || undefined,
      });
      
      toast.success("Successfully acquired new phone number");
      setPhoneNumbers([...phoneNumbers, response.data.phoneNumber]);
      setAreaCode("415");
      setNickname("");
    } catch (error: any) {
      console.error("Error acquiring phone number:", error);
      console.error("Error details:", error.response?.data || error.message);
      toast.error(`Failed to acquire phone number: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsAcquiring(false);
    }
  };

  const copyPhoneNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    toast.success("Phone number copied to clipboard");
  };

  return (
    <PrivatePageContainer>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Phone Numbers</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="mr-2 h-4 w-4" />
                Acquire New Number
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Acquire New Phone Number</DialogTitle>
                <DialogDescription>
                  Get a new phone number from Retell to use with your interviews.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="areaCode" className="text-right">
                    Area Code
                  </Label>
                  <Input
                    id="areaCode"
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value)}
                    className="col-span-3"
                    placeholder="415"
                    type="number"
                    min="100"
                    max="999"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="nickname" className="text-right">
                    Nickname
                  </Label>
                  <Input
                    id="nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="col-span-3"
                    placeholder="Interview Number 1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={acquirePhoneNumber} 
                  disabled={isAcquiring}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {isAcquiring ? "Acquiring..." : "Acquire Number"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <p>Loading phone numbers...</p>
          ) : phoneNumbers.length === 0 ? (
            <p>No phone numbers available. Acquire your first number.</p>
          ) : (
            phoneNumbers.map((phoneNumber) => (
              <Card key={phoneNumber.id} className="overflow-hidden">
                <CardHeader className="bg-slate-50 pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Phone className="mr-2 h-5 w-5" />
                      {phoneNumber.nickname || "Phone Number"}
                    </span>
                    {!phoneNumber.is_available && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Linked
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-xl font-mono tracking-wider mb-2">
                    {phoneNumber.number}
                  </div>
                  {!phoneNumber.is_available && (
                    <div className="text-sm text-gray-500">
                      Linked to: {phoneNumber.agent_linked}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-slate-50 justify-between">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyPhoneNumber(phoneNumber.number)}
                    disabled={phoneNumber.is_available}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  {phoneNumber.is_available ? (
                    <div className="text-xs text-gray-500">
                      Available for linking
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={async () => {
                        try {
                          await axios.post("/api/phone-numbers/unlink", {
                            phoneNumberId: phoneNumber.id
                          });
                          toast.success("Phone number unlinked successfully");
                          fetchPhoneNumbers();
                        } catch (error) {
                          console.error("Error unlinking phone number:", error);
                          toast.error("Failed to unlink phone number");
                        }
                      }}
                    >
                      <UnlinkIcon className="mr-2 h-4 w-4" />
                      Unlink
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
    </PrivatePageContainer>
  );
} 