from ultralytics import YOLO

model = YOLO("yolo11n-seg.pt")

results = model.train(
    data="datasets/pothole_tiny/data.yaml",
    epochs=5,
    imgsz=320,
    batch=2,
    device="cpu",
    workers=1,
    project="training_results",
    name="pothole_proto",
    exist_ok=True,
    pretrained=True,
    optimizer="auto",
    patience=3,
    lr0=0.01,
    augment=False
)