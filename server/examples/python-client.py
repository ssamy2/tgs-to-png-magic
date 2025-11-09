#!/usr/bin/env python3
"""
Python client example for TGS Converter API
"""

import requests
import base64
import json
from pathlib import Path

API_URL = "http://localhost:3000"

def test_health():
    """Test health check endpoint"""
    print("\n1️⃣ Testing health check...")
    response = requests.get(f"{API_URL}/health")
    print(json.dumps(response.json(), indent=2))

def convert_file(file_path, frame=0):
    """Convert single TGS file to PNG"""
    print(f"\n2️⃣ Converting {file_path}...")
    
    with open(file_path, 'rb') as f:
        files = {'file': f}
        params = {'frame': frame}
        response = requests.post(
            f"{API_URL}/convert",
            files=files,
            params=params
        )
    
    if response.status_code == 200:
        output_path = Path(file_path).stem + ".png"
        with open(output_path, 'wb') as f:
            f.write(response.content)
        
        print(f"✅ Saved to {output_path}")
        print(f"Total frames: {response.headers.get('X-Total-Frames')}")
        print(f"Processing time: {response.headers.get('X-Processing-Time')}")
        return output_path
    else:
        print(f"❌ Conversion failed: {response.text}")
        return None

def get_file_info(file_path):
    """Get animation info from TGS file"""
    print(f"\n3️⃣ Getting info for {file_path}...")
    
    with open(file_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(f"{API_URL}/info", files=files)
    
    if response.status_code == 200:
        info = response.json()
        print(json.dumps(info, indent=2))
        return info
    else:
        print(f"❌ Failed: {response.text}")
        return None

def batch_convert(file_paths):
    """Convert multiple TGS files in batch"""
    print(f"\n4️⃣ Batch converting {len(file_paths)} files...")
    
    files = [('files', open(path, 'rb')) for path in file_paths]
    
    try:
        response = requests.post(f"{API_URL}/convert/batch", files=files)
        
        if response.status_code == 200:
            data = response.json()
            print(f"Total: {data['total']}")
            print(f"Successful: {data['successful']}")
            print(f"Failed: {data['failed']}")
            print(f"Processing time: {data['processingTime']}")
            
            # Save images
            for img_data in data['images']:
                if img_data['status'] == 'fulfilled':
                    filename = Path(img_data['filename']).stem + '.png'
                    image_bytes = base64.b64decode(img_data['data'])
                    with open(filename, 'wb') as f:
                        f.write(image_bytes)
                    print(f"✅ Saved {filename}")
            
            return data
        else:
            print(f"❌ Batch conversion failed: {response.text}")
            return None
    finally:
        for _, file in files:
            file.close()

def convert_base64(file_path, frame=0):
    """Convert using base64 encoding"""
    print(f"\n5️⃣ Converting {file_path} using base64...")
    
    with open(file_path, 'rb') as f:
        file_data = f.read()
    
    base64_data = base64.b64encode(file_data).decode('utf-8')
    
    payload = {
        'data': base64_data,
        'frame': frame
    }
    
    response = requests.post(
        f"{API_URL}/convert/base64",
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"Width: {data['width']}, Height: {data['height']}")
        print(f"Total frames: {data['totalFrames']}")
        print(f"Processing time: {data['processingTime']}")
        
        # Save image
        output_path = Path(file_path).stem + "_base64.png"
        image_bytes = base64.b64decode(data['image'])
        with open(output_path, 'wb') as f:
            f.write(image_bytes)
        print(f"✅ Saved to {output_path}")
        return output_path
    else:
        print(f"❌ Conversion failed: {response.text}")
        return None

def main():
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python python-client.py <path-to-tgs-file>")
        sys.exit(1)
    
    test_file = sys.argv[1]
    
    if not Path(test_file).exists():
        print(f"❌ File not found: {test_file}")
        sys.exit(1)
    
    print("🧪 Testing TGS Converter API")
    print("================================")
    
    try:
        test_health()
        convert_file(test_file)
        get_file_info(test_file)
        batch_convert([test_file, test_file])
        convert_base64(test_file)
        
        print("\n✅ All tests completed!")
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")

if __name__ == "__main__":
    main()
