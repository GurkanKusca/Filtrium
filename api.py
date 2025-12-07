from flask import Flask, request, jsonify
from transformers import CLIPModel, CLIPProcessor, XCLIPModel, XCLIPProcessor
import torch
from PIL import Image
import requests
from io import BytesIO
import decord
from decord import VideoReader, cpu
import numpy as np
import tempfile
import os
import json
import sys
import warnings
from flask_cors import CORS


warnings.filterwarnings("ignore", category=UserWarning)

def print_banner():
    YELLOW = '\033[93m'
    RESET = '\033[0m'
    WIDTH = 60 

    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        icons_dir = os.path.join(base_dir, "extension", "icons")
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            
        icons_dir = os.path.join(base_dir, "extension", "icons")
        possible_icons = ["icon128.png"]
        icon_path = None

        for icon_name in possible_icons:
            full_path = os.path.join(icons_dir, icon_name)
            if os.path.exists(full_path):
                icon_path = full_path
                break
        
        if not icon_path:
            print(YELLOW + "="*WIDTH)
            print("OSTIM TIGERS".center(WIDTH))
            print("="*WIDTH + RESET)
            return

        img = Image.open(icon_path)
        
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
            
        w = 60 
        aspect_ratio = img.height / img.width
        h = int(w * aspect_ratio * 0.5)
        img = img.resize((w, h))
        
        new_img = Image.new("RGBA", img.size, "WHITE")
        new_img.paste(img, (0, 0), img)
        img = new_img.convert('L')
        
        pixels = img.getdata()
        chars = ["@", "#", "S", "%", "?", "*", "+", ";", ":", ",", "."]
        new_pixels = ''.join([chars[pixel // 25] for pixel in pixels])
        
        print(YELLOW + "\n" + "="*WIDTH)
        print("OSTIM TIGERS".center(WIDTH))
        print("="*WIDTH + "\n")
        
        for i in range(0, len(new_pixels), w):
            print(new_pixels[i:i+w].center(WIDTH))
        
        print("\n" + "FILTRIUM v1.0 - Local AI Content Filter".center(WIDTH))
        print("="*WIDTH + RESET + "\n")

    except Exception as e:
        print(f"Error printing banner: {e}")
        print(YELLOW + "OSTIM TIGERS AI SERVER".center(WIDTH) + RESET)


app = Flask(__name__)
CORS(app)

print_banner()

print("=" * 70)
print("LOADING MODELS...")
print("=" * 70)

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f" [INFO] System detected: {device.upper()}")

print(" [1/2] Loading CLIP (Images)...", end="\r")
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32", use_safetensors=True).to(device)
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
clip_model.eval()
print(" [1/2] Loading CLIP (Images)... DONE     ")

print(" [2/2] Loading X-CLIP (Videos)...", end="\r")
xclip_model = XCLIPModel.from_pretrained("microsoft/xclip-base-patch32").to(device)
xclip_processor = XCLIPProcessor.from_pretrained("microsoft/xclip-base-patch32")
xclip_model.eval()
print(" [2/2] Loading X-CLIP (Videos)... DONE     ")

print(f"\n ALL MODELS READY! Listening on port 5000...\n")

SAFE_LABELS = [
    "safe appropriate content",
    "everyday life",
    "news anchor",
    "social media post",
    "landscape",
    "harmless interaction"
]

DEFAULT_IMAGE_THRESHOLD = 0.70
DEFAULT_VIDEO_THRESHOLD = 0.65

def get_dynamic_threshold(filter_name, settings, base_threshold):
    level = settings.get(filter_name, 'normal')
    if level == 'high':  
        return base_threshold - 0.15
    elif level == 'low': 
        return base_threshold + 0.15
    else: 
        return base_threshold

def download_video(video_url):
    print(f" Downloading video: {video_url[:40]}...")
    try:
        response = requests.get(video_url, timeout=15, stream=True)
        response.raise_for_status()
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
        for chunk in response.iter_content(chunk_size=8192):
            temp_file.write(chunk)
        temp_file.close()
        return temp_file.name
    except Exception as e:
        print(f"Error downloading video: {e}")
        raise

def extract_video_frames(video_path, num_frames=8):
    try:
        decord.bridge.set_bridge('torch')
        vr = VideoReader(video_path, ctx=cpu(0))
        total_frames = len(vr)
        if total_frames < num_frames:
            indices = list(range(total_frames))
        else:
            indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)
        frames = vr.get_batch(indices).asnumpy()
        return frames
    except Exception as e:
        print(f"Frame Error: {e}")
        raise


@app.route('/filter-image', methods=['POST'])
def filter_image():
    try:
        data = request.json
        print(f" > Checking Image...")
        
        image_url = data.get('image_url')
        raw_filters = data.get('user_filters', []) 
        filter_settings = data.get('filter_settings', {})
        
        user_filters = []
        for f in raw_filters:
            if isinstance(f, dict):
                val = f.get('term') or f.get('label')
                if val: user_filters.append(val)
            elif isinstance(f, str):
                user_filters.append(f)
        
        if not image_url: return jsonify({'error': 'No image_url provided'}), 400
        if not user_filters: return jsonify({'error': 'No user_filters provided'}), 400
        
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        image = Image.open(BytesIO(response.content))
        
        labels = user_filters + SAFE_LABELS
        inputs = clip_processor(text=labels, images=image, return_tensors="pt", padding=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = clip_model(**inputs)
            probs = outputs.logits_per_image.softmax(dim=1)[0]
        
        num_unsafe = len(user_filters)
        unsafe_score = sum(probs[i].item() for i in range(num_unsafe))
        safe_score = sum(probs[i].item() for i in range(num_unsafe, len(labels)))
        
        if safe_score > unsafe_score:
            print("    Safe (Dominant)")
            return jsonify({'should_block': False, 'reason': 'Safe content dominant'})

        for i, filter_name in enumerate(user_filters):
            conf = probs[i].item()
            threshold = get_dynamic_threshold(filter_name, filter_settings, DEFAULT_IMAGE_THRESHOLD)
            
            if conf > threshold:
                result = {
                    'should_block': True,
                    'reason': f'Contains {filter_name}',
                    'confidence': conf
                }
                print(f"    BLOCKED: {filter_name} ({conf:.0%})")
                return jsonify(result)
        
        print("    Safe (Threshold)")
        return jsonify({'should_block': False, 'reason': 'Image is safe'})
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return jsonify({'error': str(e), 'should_block': False}), 500


@app.route('/filter-video', methods=['POST'])
def filter_video():
    video_path = None
    try:
        print(f" > Checking Video...")
        user_filters = []
        filter_settings = {}
        
        if 'file' in request.files:
            video_file = request.files['file']
            raw_filters = json.loads(request.form.get('user_filters', '[]'))
            filter_settings = json.loads(request.form.get('filter_settings', '{}'))
            
            for f in raw_filters:
                if isinstance(f, dict):
                    val = f.get('term') or f.get('label')
                    if val: user_filters.append(val)
                elif isinstance(f, str):
                    user_filters.append(f)
            
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
            video_path = temp_file.name
            temp_file.close()
            video_file.save(video_path)

        elif request.json and 'video_url' in request.json:
            data = request.json
            video_url = data.get('video_url')
            raw_filters = data.get('user_filters', [])
            filter_settings = data.get('filter_settings', {})

            for f in raw_filters:
                if isinstance(f, dict):
                    val = f.get('term') or f.get('label')
                    if val: user_filters.append(val)
                elif isinstance(f, str):
                    user_filters.append(f)

            video_path = download_video(video_url)
            
        else:
            return jsonify({"error": "No file or video_url provided"}), 400

        frames = extract_video_frames(video_path, num_frames=5)
        
        processed_filters = [f"a video of {f}" for f in user_filters]
        processed_safe = [f"a video of {f}" for f in SAFE_LABELS]
        labels = processed_filters + processed_safe
        
        inputs = xclip_processor(text=labels, videos=list(frames), return_tensors="pt", padding=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = xclip_model(**inputs)
            probs = outputs.logits_per_video.softmax(dim=1)[0]
        
        num_unsafe = len(user_filters)
        unsafe_score = sum(probs[i].item() for i in range(num_unsafe))
        safe_score = sum(probs[i].item() for i in range(num_unsafe, len(labels)))
        
        if safe_score > unsafe_score:
            print("    Safe (Dominant)")
            result = {'should_block': False, 'reason': 'Video is safe', 'type': 'video'}
        else:
            result = {'should_block': False, 'reason': 'Video is safe', 'type': 'video'}
            for i, filter_name in enumerate(user_filters):
                confidence = probs[i].item()
                threshold = get_dynamic_threshold(filter_name, filter_settings, DEFAULT_VIDEO_THRESHOLD)
                
                if confidence > threshold:
                    print(f"    BLOCKED VIDEO: {filter_name} ({confidence:.0%})")
                    result = {
                        'should_block': True, 
                        'reason': f'Contains {filter_name}', 
                        'confidence': confidence,
                        'type': 'video'
                    }
                    break

        if video_path and os.path.exists(video_path):
            try: os.unlink(video_path)
            except: pass
            
        return jsonify(result)
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        if video_path and os.path.exists(video_path):
            try: os.unlink(video_path)
            except: pass
        return jsonify({'error': str(e), 'should_block': False, 'type': 'video'}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'running', 'device': device})

if __name__ == '__main__':
    app.run(port=5000)