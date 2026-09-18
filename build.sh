#!/bin/bash
# Unified Build Script for Render

# 1. Build the Next.js frontend
echo "Building Next.js frontend..."
cd frontend
npm install
npm run build
cd ..

# 2. Install Python backend requirements
echo "Installing Python backend requirements..."
pip install -r backend/requirements.txt
