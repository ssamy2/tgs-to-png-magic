// JavaScript client example for TGS Converter API

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

const API_URL = 'http://localhost:3000';

// Test 1: Health Check
async function testHealth() {
  console.log('\n1️⃣ Testing health check...');
  const response = await fetch(`${API_URL}/health`);
  const data = await response.json();
  console.log(data);
}

// Test 2: Convert single file
async function testConvert(filePath) {
  console.log('\n2️⃣ Testing single file conversion...');
  
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  
  const response = await fetch(`${API_URL}/convert`, {
    method: 'POST',
    body: formData,
  });
  
  if (response.ok) {
    const buffer = await response.arrayBuffer();
    fs.writeFileSync('output.png', Buffer.from(buffer));
    console.log('✅ Saved to output.png');
    console.log(`Total frames: ${response.headers.get('X-Total-Frames')}`);
    console.log(`Processing time: ${response.headers.get('X-Processing-Time')}`);
  } else {
    console.error('❌ Conversion failed:', await response.text());
  }
}

// Test 3: Get file info
async function testInfo(filePath) {
  console.log('\n3️⃣ Testing file info...');
  
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  
  const response = await fetch(`${API_URL}/info`, {
    method: 'POST',
    body: formData,
  });
  
  const data = await response.json();
  console.log(data);
}

// Test 4: Batch conversion
async function testBatch(filePaths) {
  console.log('\n4️⃣ Testing batch conversion...');
  
  const formData = new FormData();
  filePaths.forEach(path => {
    formData.append('files', fs.createReadStream(path));
  });
  
  const response = await fetch(`${API_URL}/convert/batch`, {
    method: 'POST',
    body: formData,
  });
  
  const data = await response.json();
  console.log(`Total: ${data.total}`);
  console.log(`Successful: ${data.successful}`);
  console.log(`Failed: ${data.failed}`);
  console.log(`Processing time: ${data.processingTime}`);
}

// Test 5: Base64 conversion
async function testBase64(filePath) {
  console.log('\n5️⃣ Testing base64 conversion...');
  
  const fileData = fs.readFileSync(filePath);
  const base64Data = fileData.toString('base64');
  
  const response = await fetch(`${API_URL}/convert/base64`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: base64Data,
      frame: 0,
    }),
  });
  
  const data = await response.json();
  console.log(`Width: ${data.width}, Height: ${data.height}`);
  console.log(`Total frames: ${data.totalFrames}`);
  console.log(`Processing time: ${data.processingTime}`);
  
  // Save the result
  const imageBuffer = Buffer.from(data.image, 'base64');
  fs.writeFileSync('output-base64.png', imageBuffer);
  console.log('✅ Saved to output-base64.png');
}

// Run all tests
async function runTests() {
  const testFile = process.argv[2] || 'test.tgs';
  
  if (!fs.existsSync(testFile)) {
    console.error('❌ Test file not found:', testFile);
    console.log('Usage: node test-api.js <path-to-tgs-file>');
    process.exit(1);
  }
  
  console.log('🧪 Testing TGS Converter API');
  console.log('================================');
  
  try {
    await testHealth();
    await testConvert(testFile);
    await testInfo(testFile);
    await testBatch([testFile, testFile]);
    await testBase64(testFile);
    
    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();
