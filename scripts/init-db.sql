-- Create schema
CREATE SCHEMA IF NOT EXISTS myapp;

-- Set search path
SET search_path TO myapp;

-- Create example table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    phone_number BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert some example data
INSERT INTO users (email, name, address, city, phone_number) VALUES
  ('john@example.com', 'John Doe', '123 Main St', 'Chicago', 1234567890),
  ('jane@example.com', 'Jane Smith', '456 Oak Ave', 'New York', 9876543210)
ON CONFLICT (email) DO NOTHING; 