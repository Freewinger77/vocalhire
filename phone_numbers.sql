-- Create phone numbers table
CREATE TABLE phone_numbers (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    number TEXT NOT NULL UNIQUE,
    is_available BOOLEAN DEFAULT true,
    agent_linked TEXT,
    interview_id TEXT REFERENCES interview(id),
    organization_id TEXT REFERENCES organization(id),
    nickname TEXT
);

-- Function to check if a number exists
CREATE OR REPLACE FUNCTION check_phone_number_exists(phone_number TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM phone_numbers WHERE number = phone_number
    );
END;
$$ LANGUAGE plpgsql; 