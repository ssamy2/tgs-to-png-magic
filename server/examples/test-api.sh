#!/bin/bash

# TGS Converter API Test Script

API_URL="http://localhost:3000"

echo "🧪 Testing TGS Converter API"
echo "================================"

# Test 1: Health Check
echo -e "\n1️⃣ Testing health check..."
curl -s "${API_URL}/health" | jq .

# Test 2: Single file conversion
echo -e "\n2️⃣ Testing single file conversion..."
if [ -f "test.tgs" ]; then
  curl -X POST \
    -F "file=@test.tgs" \
    "${API_URL}/convert" \
    --output test-output.png
  echo "✅ Output saved to test-output.png"
else
  echo "⚠️  No test.tgs file found. Skipping..."
fi

# Test 3: Get file info
echo -e "\n3️⃣ Testing file info..."
if [ -f "test.tgs" ]; then
  curl -s -X POST \
    -F "file=@test.tgs" \
    "${API_URL}/info" | jq .
else
  echo "⚠️  No test.tgs file found. Skipping..."
fi

# Test 4: Batch conversion
echo -e "\n4️⃣ Testing batch conversion..."
if [ -f "test.tgs" ]; then
  curl -s -X POST \
    -F "files=@test.tgs" \
    -F "files=@test.tgs" \
    "${API_URL}/convert/batch" | jq '.total, .successful, .processingTime'
else
  echo "⚠️  No test.tgs file found. Skipping..."
fi

echo -e "\n✅ Tests complete!"
