#!/bin/bash

set -euxo pipefail

# Database connection parameters
DB_HOST="$1"
DB_NAME="myapp"
DB_USER="postgres"
DB_PASSWORD="postgres"

# Check if hostname is provided
if [ -z "$DB_HOST" ]; then
  echo "Error: Database hostname is required"
  echo "Usage: $0 <database-hostname>"
  exit 1
fi

# Install PostgreSQL client if not already installed
if ! command -v psql &> /dev/null; then
  echo "Installing PostgreSQL client..."
  sudo dnf install postgresql15 -y
fi

# Check if schema already exists
SCHEMA_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'myapp');")

if [ "$SCHEMA_EXISTS" = " t" ]; then
  echo "Schema 'myapp' already exists. Skipping initialization."
  exit 0
fi

echo "Schema 'myapp' does not exist. Proceeding with initialization..."

# Create schema and tables
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<EOF
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
  phone_number INTEGER(11) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
\$\$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some example data
INSERT INTO users (email, name, address, city, phone_number) VALUES
  ('john@example.com', 'John Doe', '123 Main St', 'Chicago', 1234567890),
  ('jane@example.com', 'Jane Smith', '456 Oak Ave', 'New York', 9876543210)
ON CONFLICT (email) DO NOTHING;

echo "Database initialization completed successfully!" 