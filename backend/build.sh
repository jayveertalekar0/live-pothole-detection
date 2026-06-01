#!/bin/bash
echo "Downloading model weights..."
mkdir -p models
cd models
curl -L -o pothole_full_best.pt "https://huggingface.co/keremberke/yolov8n-pothole-segmentation/resolve/main/best.pt"
echo "Model downloaded."