import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";
import Retell from "retell-sdk";

const supabase = createClientComponentClient();

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

export interface PhoneNumber {
  id: number;
  number: string;
  is_available: boolean;
  agent_linked: string | null;
  interview_id: string | null;
  organization_id: string | null;
  nickname: string | null;
  created_at: string;
}

export class PhoneNumberService {
  // Get all phone numbers for an organization
  static async getPhoneNumbers(organizationId: string): Promise<PhoneNumber[]> {
    try {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select("*")
        .eq("organization_id", organizationId);

      if (error) {
        logger.error(`Error fetching phone numbers: ${error.message}`);
        throw new Error(`Error fetching phone numbers: ${error.message}`);
      }

      return data as PhoneNumber[];
    } catch (error) {
      logger.error(`Failed to get phone numbers: ${error}`);
      throw error;
    }
  }

  // Get a phone number by ID
  static async getPhoneNumberById(phoneNumberId: number): Promise<PhoneNumber | null> {
    try {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select("*")
        .eq("id", phoneNumberId)
        .single();

      if (error) {
        logger.error(`Error fetching phone number by ID: ${error.message}`);
        throw new Error(`Error fetching phone number by ID: ${error.message}`);
      }

      return data as PhoneNumber;
    } catch (error) {
      logger.error(`Failed to get phone number by ID: ${error}`);
      throw error;
    }
  }

  // Get available phone numbers for an organization
  static async getAvailablePhoneNumbers(
    organizationId: string,
  ): Promise<PhoneNumber[]> {
    try {
      const { data, error } = await supabase
        .from("phone_numbers")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_available", true);

      if (error) {
        logger.error(`Error fetching available phone numbers: ${error.message}`);
        throw new Error(
          `Error fetching available phone numbers: ${error.message}`,
        );
      }

      return data as PhoneNumber[];
    } catch (error) {
      logger.error(`Failed to get available phone numbers: ${error}`);
      throw error;
    }
  }

  // Add a new phone number
  static async addPhoneNumber(
    phoneNumber: string,
    organizationId: string,
    nickname?: string,
  ): Promise<PhoneNumber> {
    try {
      // Check if phone number already exists
      const { data: existingNumber } = await supabase
        .from("phone_numbers")
        .select("*")
        .eq("number", phoneNumber)
        .single();

      if (existingNumber) {
        throw new Error("Phone number already exists");
      }

      const { data, error } = await supabase
        .from("phone_numbers")
        .insert([
          {
            number: phoneNumber,
            organization_id: organizationId,
            nickname: nickname || null,
            is_available: true,
          },
        ])
        .select()
        .single();

      if (error) {
        logger.error(`Error adding phone number: ${error.message}`);
        throw new Error(`Error adding phone number: ${error.message}`);
      }

      return data as PhoneNumber;
    } catch (error) {
      logger.error(`Failed to add phone number: ${error}`);
      throw error;
    }
  }

  // Link a phone number to an interview agent
  static async linkPhoneNumber(
    phoneNumberId: number,
    agentId: string,
    interviewId: string,
  ): Promise<PhoneNumber> {
    try {
      // Get the phone number
      const { data: phoneNumber, error: fetchError } = await supabase
        .from("phone_numbers")
        .select("*")
        .eq("id", phoneNumberId)
        .single();

      if (fetchError || !phoneNumber) {
        logger.error(`Error fetching phone number: ${fetchError?.message}`);
        throw new Error(`Phone number not found`);
      }

      // Link the number in Retell
      logger.info(`Linking phone number ${phoneNumber.number} to agent ${agentId}`);
      
      // Construct a proper webhook URL with the correct protocol
      const baseUrl = process.env.NEXT_PUBLIC_LIVE_URL || "localhost:3000";
      const webhookUrl = baseUrl.includes("localhost") 
        ? `http://localhost:3000/api/response-webhook` 
        : `https://${baseUrl}/api/response-webhook`;
        
      logger.info(`Using webhook URL: ${webhookUrl}`);
      
      const phoneNumberResponse = await retellClient.phoneNumber.update(
        phoneNumber.number,
        {
          inbound_agent_id: agentId,
          nickname: phoneNumber.nickname || "Interview Phone",
          // Include a webhook URL to receive call events
          webhook_url: webhookUrl,
          metadata: {
            interview_id: interviewId,
            phone_number: phoneNumber.number
          }
        } as any,
      );
      
      logger.info(`Successfully updated phone number in Retell: ${JSON.stringify(phoneNumberResponse).substring(0, 200)}`);

      // Update in our database
      const { data: updatedNumber, error: updateError } = await supabase
        .from("phone_numbers")
        .update({
          is_available: false,
          agent_linked: agentId,
          interview_id: interviewId,
        })
        .eq("id", phoneNumberId)
        .select()
        .single();

      if (updateError) {
        logger.error(`Error updating phone number: ${updateError.message}`);
        throw new Error(`Error linking phone number: ${updateError.message}`);
      }

      return updatedNumber as PhoneNumber;
    } catch (error) {
      logger.error(`Failed to link phone number: ${error}`);
      throw error;
    }
  }

  // Unlink a phone number from an agent
  static async unlinkPhoneNumber(phoneNumberId: number): Promise<PhoneNumber> {
    try {
      // Get the phone number
      const { data: phoneNumber, error: fetchError } = await supabase
        .from("phone_numbers")
        .select("*")
        .eq("id", phoneNumberId)
        .single();

      if (fetchError || !phoneNumber) {
        logger.error(`Error fetching phone number: ${fetchError?.message}`);
        throw new Error(`Phone number not found`);
      }

      // Unlink the number in Retell - use string literal to avoid type issues
      const phoneNumberResponse = await retellClient.phoneNumber.update(
        phoneNumber.number,
        {
          // Pass an empty string or omit the field completely
          inbound_agent_id: "" as any,
        },
      );

      // Update in our database
      const { data: updatedNumber, error: updateError } = await supabase
        .from("phone_numbers")
        .update({
          is_available: true,
          agent_linked: null,
          interview_id: null,
        })
        .eq("id", phoneNumberId)
        .select()
        .single();

      if (updateError) {
        logger.error(`Error updating phone number: ${updateError.message}`);
        throw new Error(`Error unlinking phone number: ${updateError.message}`);
      }

      return updatedNumber as PhoneNumber;
    } catch (error) {
      logger.error(`Failed to unlink phone number: ${error}`);
      throw error;
    }
  }

  // Acquire a phone number from Retell
  static async acquirePhoneNumber(
    organizationId: string,
    areaCode: string | number = "415",
    nickname?: string,
  ): Promise<PhoneNumber> {
    try {
      // Create a phone number in Retell - convert area code to number
      const retellPhoneNumber = await retellClient.phoneNumber.create({
        area_code: parseInt(areaCode.toString(), 10),
      });

      // Add the phone number to our database
      const { data, error } = await supabase
        .from("phone_numbers")
        .insert([
          {
            number: retellPhoneNumber.phone_number,
            organization_id: organizationId,
            nickname: nickname || null,
            is_available: true,
          },
        ])
        .select()
        .single();

      if (error) {
        logger.error(`Error adding acquired phone number: ${error.message}`);
        throw new Error(`Error adding acquired phone number: ${error.message}`);
      }

      return data as PhoneNumber;
    } catch (error) {
      logger.error(`Failed to acquire phone number: ${error}`);
      throw error;
    }
  }
} 