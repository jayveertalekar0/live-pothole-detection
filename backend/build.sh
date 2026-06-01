#!/bin/bash
echo "Downloading model weights..."
mkdir -p models
cd models

# Replace the URL with YOUR own hosted model file.
# If you upload your model to GitHub Releases or a public S3 bucket, use that link.
# For testing, you can use the pre‑trained model from HuggingFace (it's smaller):
curl -L -o pothole_full_best.pt "https://huggingface.co/keremberke/yolov8n-pothole-segmentation/resolve/main/best.pt"

echo "Model downloaded."