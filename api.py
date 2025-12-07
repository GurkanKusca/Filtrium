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
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

print("=" * 70)
print("LOADING MODELS...")
print("=" * 70)


device = "cuda" if torch.cuda.is_available() else "cpu"

print(" Loading CLIP (Images)...")
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32", use_safetensors=True).to(device)
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
clip_model.eval()

print(" Loading X-CLIP (Videos)...")
xclip_model = XCLIPModel.from_pretrained("microsoft/xclip-base-patch32").to(device)
xclip_processor = XCLIPProcessor.from_pretrained("microsoft/xclip-base-patch32")
xclip_model.eval()

print(f"\n✅ ALL MODELS READY on {device}!")
print("=" * 70)


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
    print(f" Downloading video from: {video_url[:60]}...")
    try:
        response = requests.get(video_url, timeout=15, stream=True)
        response.raise_for_status()
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
        for chunk in response.iter_content(chunk_size=8192):
            temp_file.write(chunk)
        temp_file.close()
        print(f"Video downloaded to: {temp_file.name}")
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
        print(f"\n{'='*70}")
        print(f"IMAGE FILTER REQUEST")
        print(f"{'='*70}")
        
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
        
        print(f"Image URL: {image_url[:60]}...")
        print(f"User filters: {user_filters}")
        

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
        
        print(f"Score Analysis -> Unsafe: {unsafe_score:.2f} | Safe: {safe_score:.2f}")

        if safe_score > unsafe_score:
            print("✅ ALLOWED (Safe content dominant)")
            return jsonify({'should_block': False, 'reason': 'Safe content dominant'})


        for i, filter_name in enumerate(user_filters):
            conf = probs[i].item()
            

            threshold = get_dynamic_threshold(filter_name, filter_settings, DEFAULT_IMAGE_THRESHOLD)
            
            print(f"  Analysis: '{filter_name}' ({filter_settings.get(filter_name, 'normal')}) -> safety: {conf:.2%} / Limit: {threshold:.2f}")

            if conf > threshold:
                result = {
                    'should_block': True,
                    'reason': f'Contains {filter_name}',
                    'confidence': conf
                }
                print(f" BLOCKING IMAGE: {result['reason']}")
                return jsonify(result)
        
        print(" ALLOWED")
        return jsonify({'should_block': False, 'reason': 'Image is safe'})
        
    except Exception as e:
        print(f"\nERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'should_block': False}), 500


@app.route('/filter-video', methods=['POST'])
def filter_video():
    video_path = None
    try:
        user_filters = []
        filter_settings = {}
        

        if 'file' in request.files:
            video_file = request.files['file']
            user_filters = json.loads(request.form.get('user_filters', '[]'))
            filter_settings = json.loads(request.form.get('filter_settings', '{}'))
            
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
            video_path = temp_file.name
            temp_file.close()
            video_file.save(video_path)

        elif request.json and 'video_url' in request.json:
            data = request.json
            video_url = data.get('video_url')
            user_filters = data.get('user_filters', [])
            normalized_filters = []
            for f in user_filters:
                if isinstance(f, dict):
                    if 'label' in f:
                        normalized_filters.append(f['label'])
                elif isinstance(f, str):
                    normalized_filters.append(f)

            user_filters = normalized_filters

            filter_settings = data.get('filter_settings', {})
            if isinstance(user_filters, str): user_filters = [user_filters]
            
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
            print(f"VIDEO SAFE (Safe: {safe_score:.2f} > Unsafe: {unsafe_score:.2f})")
            result = {'should_block': False, 'reason': 'Video is safe', 'type': 'video'}
        else:
            result = {'should_block': False, 'reason': 'Video is safe', 'type': 'video'}
            
            for i, filter_name in enumerate(user_filters):
                confidence = probs[i].item()
                

                threshold = get_dynamic_threshold(filter_name, filter_settings, DEFAULT_VIDEO_THRESHOLD)
                
                print(f"  Analysis: '{filter_name}' ({filter_settings.get(filter_name, 'normal')}) -> safety: {confidence:.2%} / Limit: {threshold:.2f}")

                if confidence > threshold:
                    print(f"BLOCKED VIDEO: {filter_name}")
                    result = {
                        'should_block': True, 
                        'reason': f'Contains {filter_name}', 
                        'confidence': confidence,
                        'type': 'video'
                    }
                    break

        if video_path and os.path.exists(video_path):
            os.unlink(video_path)
            
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
    print("\n" + "=" * 70)
    print(" Starting Flask server on port 5000...")
    print("=" * 70)
    app.run(port=5000)