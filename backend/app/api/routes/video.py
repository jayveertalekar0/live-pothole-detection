from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import tempfile
import os
from app.services.video_processor import process_video
from app.core.config import settings

router = APIRouter(prefix="/api/v1/detect", tags=["Detection"])

@router.post("/video")
async def detect_video(file: UploadFile = File(...)):
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    # Save uploaded video to a temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp_in:
        tmp_in.write(await file.read())
        input_path = tmp_in.name

    # Output path base (without extension)
    output_path_base = tempfile.mktemp()

    try:
        frames_total, frames_with_potholes, final_output_path, media_type = process_video(
            input_path, output_path_base,
            conf=settings.CONFIDENCE_THRESHOLD,
            iou=settings.IOU_THRESHOLD,
            imgsz=settings.IMAGE_SIZE
        )
        os.unlink(input_path)

        filename = f"pothole_detected.{media_type.split('/')[-1]}"
        return FileResponse(
            final_output_path,
            media_type=media_type,
            filename=filename
        )
    except Exception as e:
        # Clean up input temporary file
        if os.path.exists(input_path):
            try:
                os.unlink(input_path)
            except Exception:
                pass
        # Clean up any output files generated with fallback codecs extensions
        for ext in ['webm', 'mp4']:
            p = f"{output_path_base}.{ext}"
            if os.path.exists(p):
                try:
                    os.unlink(p)
                except Exception:
                    pass
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")