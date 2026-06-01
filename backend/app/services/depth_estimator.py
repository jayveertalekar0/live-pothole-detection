import torch
import cv2
import numpy as np
from app.core.config import settings
from app.core.logging import logger

class DepthEstimator:
    def __init__(self):
        self.device = settings.DEVICE
        self.model = None
        self.transform = None
        self.load_model()

    def load_model(self):
        logger.info("Loading MiDaS depth model…")
        model_type = "MiDaS_small"
        self.model = torch.hub.load("intel-isl/MiDaS", model_type)
        self.model.to(self.device)
        self.model.eval()

        # Transform
        self.transform = torch.hub.load("intel-isl/MiDaS", "transforms")
        # MiDaS_small uses small_transform (fallback to dpt_transform for others)
        if hasattr(self.transform, "small_transform"):
            self.transform = self.transform.small_transform
        else:
            self.transform = self.transform.dpt_transform

    def estimate_depth(self, image: np.ndarray) -> np.ndarray:
        """Return depth map (in metres) for a BGR image."""
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        input_batch = self.transform(img_rgb).to(self.device)

        with torch.no_grad():
            prediction = self.model(input_batch)
            prediction = torch.nn.functional.interpolate(
                prediction.unsqueeze(1),
                size=img_rgb.shape[:2],
                mode="bicubic",
                align_corners=False,
            ).squeeze()

        return prediction.cpu().numpy()

# Singleton
depth_estimator = DepthEstimator()