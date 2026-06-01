# 🚧 AI-Powered Pothole Detection & Road Intelligence Platform

An end-to-end AI-powered road intelligence system that detects, segments, geolocates, and analyzes potholes from images, videos, dashcams, and live camera feeds. The platform combines computer vision, geospatial analytics, and real-time data streaming to support smarter road maintenance and safer transportation.

<p align="center">
  <a href="https://live-pothole-detection.vercel.app">
    <img src="https://img.shields.io/badge/🚀_Live_Demo-Visit_Dashboard-success?style=for-the-badge" />
  </a>
  <a href="https://pothole-backend-b213.onrender.com/docs">
    <img src="https://img.shields.io/badge/📚_Swagger_API-Documentation-blue?style=for-the-badge" />
  </a>
  <a href="https://github.com/jayveertalekar0/live-pothole-detection">
    <img src="https://img.shields.io/badge/💻_Source_Code-GitHub-black?style=for-the-badge" />
  </a>
</p>

---

## 🌐 Live Deployment

| Service                 | Link                                                      |
| ----------------------- | --------------------------------------------------------- |
| 🚀 Frontend Dashboard   | https://live-pothole-detection.vercel.app                 |
| 📚 Swagger API Docs     | https://pothole-backend-b213.onrender.com/docs            |
| ❤️ Backend Health Check | https://pothole-backend-b213.onrender.com/health          |
| 💻 GitHub Repository    | https://github.com/jayveertalekar0/live-pothole-detection |

---

## 🏆 Highlights

* 🤖 AI-Powered Pothole Detection (YOLOv11-Seg)
* 📍 GPS-Based Geolocation & Mapping
* 🗺️ Interactive Map with Clustering & Heatmaps
* 📊 Real-Time Analytics Dashboard
* ⚡ WebSocket Live Updates
* 🎥 Image, Video & Live Camera Processing
* 🛣️ Route Risk Analysis
* 🔄 Duplicate Report Detection
* 🐳 Dockerized Deployment
* ☁️ Hosted on Render & Vercel

---

## 🛠️ Tech Stack

### Artificial Intelligence

* YOLOv11 Segmentation
* MiDaS Depth Estimation
* OpenCV
* PyTorch

### Backend

* FastAPI
* Uvicorn
* WebSockets
* Pydantic

### Frontend

* Next.js 16
* React
* Tailwind CSS
* Leaflet
* Chart.js

### Database

* MongoDB Atlas
* Geospatial Indexing (`2dsphere`)

### DevOps

* Docker
* Git
* GitHub
* Render
* Vercel

---

## 📸 Features

### 🔍 Intelligent Pothole Detection

* Detect potholes from images and videos
* Instance segmentation masks
* Confidence scoring
* Severity estimation
* Relative depth estimation

### 🎥 Multi-Source Processing

* Image Upload Detection
* Dashcam Video Analysis
* Live Camera Monitoring
* Real-Time Inference

### 📍 Geospatial Intelligence

* GPS-enabled pothole reporting
* Interactive road map
* Marker clustering
* Heatmaps
* Route risk analysis
* Road health visualization

### 📊 Analytics Dashboard

* Severity distribution
* Daily detection trends
* Repair progress monitoring
* Road condition insights

### ⚡ Real-Time System

* WebSocket-powered updates
* Live map synchronization
* Instant analytics refresh
* Duplicate report prevention

---

## 🏗️ System Architecture

```text
┌──────────────────────┐
│      Next.js UI      │
└──────────┬───────────┘
           │
     REST API + WS
           │
┌──────────▼───────────┐
│      FastAPI         │
├──────────────────────┤
│ Detection Service    │
│ Video Processing     │
│ Analytics Service    │
│ Map Service          │
│ WebSocket Service    │
└──────────┬───────────┘
           │
 ┌─────────▼─────────┐
 │ YOLOv11 + MiDaS   │
 └─────────┬─────────┘
           │
 ┌─────────▼─────────┐
 │ MongoDB Atlas     │
 └───────────────────┘
```

---

## 📊 Model Information

| Component        | Details              |
| ---------------- | -------------------- |
| Detection Model  | YOLOv11-Seg Nano     |
| Framework        | PyTorch              |
| Dataset Size     | ~2000 Images         |
| Task             | Pothole Segmentation |
| Depth Estimation | MiDaS Small          |
| Deployment       | CPU Optimized        |

---

## 🔮 Future Enhancements

* Android & iOS Application
* Drone-Based Road Inspection
* Government Dashboard Integration
* Predictive Road Damage Analytics
* Edge AI Deployment
* Multi-Class Road Defect Detection
* Smart City Infrastructure Integration
* Repair Recommendation System

---

## 👨‍💻 Developer

**Jayveer Talekar**

Full Stack Developer • Backend Engineer • AI Engineer

⭐ If you found this project useful, consider giving it a star on GitHub.
