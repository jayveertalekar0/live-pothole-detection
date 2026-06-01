# 🚧 AI-Powered Pothole Detection & Road Intelligence Platform

An end-to-end computer vision platform that detects, analyzes, and geolocates potholes from images, videos, dashcams, and live camera feeds. The system combines real-time AI detection, geospatial analytics, interactive mapping, and road-health monitoring to help citizens and authorities identify and manage road infrastructure issues efficiently.

## 🌟 Key Features

### 🔍 Intelligent Pothole Detection

* Real-time pothole detection using YOLOv11 Segmentation.
* Instance segmentation masks for precise pothole boundaries.
* Confidence scoring and severity classification.
* Relative depth estimation using MiDaS.

### 🎥 Multi-Source Processing

* Image upload and analysis.
* Dashcam video processing with tracking.
* Live camera monitoring through mobile devices.
* Continuous road surveillance support.

### 📍 Geospatial Intelligence

* GPS-based pothole reporting.
* Interactive map visualization.
* Marker clustering and heatmaps.
* Route risk analysis.
* Road health scoring and GeoJSON overlays.

### 📊 Analytics Dashboard

* Severity distribution analysis.
* Daily and monthly detection trends.
* Repair progress tracking.
* Road condition insights.
* Real-time reporting statistics.

### ⚡ Real-Time System

* WebSocket-powered live updates.
* Instant pothole synchronization across clients.
* Automatic duplicate report detection.
* Live road monitoring and alerts.

---

## 🏗 System Overview

The platform follows a modern microservice-inspired architecture:

Frontend (Next.js)
↓
REST API + WebSocket
↓
FastAPI Backend
↓
AI Inference Layer
(YOLOv11-Seg + MiDaS)
↓
MongoDB Atlas
(Geospatial Database)

---

## 🛠 Technology Stack

### Artificial Intelligence

* YOLOv11 Segmentation
* PyTorch
* OpenCV
* MiDaS Depth Estimation

### Backend

* FastAPI
* Uvicorn
* WebSockets
* Pydantic

### Frontend

* Next.js
* React
* Tailwind CSS
* Leaflet
* Chart.js

### Database

* MongoDB Atlas
* Geospatial Indexing (2dsphere)

### DevOps & Deployment

* Docker
* GitHub
* Render
* Vercel

---

## 🎯 Real-World Impact

Poor road conditions contribute to vehicle damage, traffic congestion, and safety risks. This platform enables:

* Faster pothole identification.
* Community-driven reporting.
* Data-driven road maintenance.
* Infrastructure monitoring.
* Smart-city integration.

---

## 🚀 Future Enhancements

* Mobile application (Android/iOS).
* Government dashboard integration.
* Automated repair recommendation system.
* Predictive road deterioration analytics.
* Drone-based road inspection.
* Edge AI deployment.
* Multi-class road defect detection (cracks, patches, potholes, debris).

---

## 📈 Project Highlights

✔ Full-Stack AI Application

✔ Computer Vision + Geospatial Analytics

✔ Real-Time Data Streaming

✔ Interactive Mapping System

✔ Dockerized Deployment

✔ Cloud-Ready Architecture

✔ Production-Oriented Design

---

Developed by **Jayveer Talekar**
