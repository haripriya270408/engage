#!/bin/bash
set -e

# Configuration
AWS_REGION="us-east-1"
# Replace with your actual 12-digit AWS Account ID
AWS_ACCOUNT_ID="YOUR_AWS_ACCOUNT_ID"
PROJECT_NAME="engage"

echo "===================================================="
echo " Starting Deployment to AWS ECR and ECS"
echo "===================================================="

# 1. Login to Amazon ECR
echo "[1/4] Logging into AWS ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# 2. Build Docker Images
echo "[2/4] Building Docker images..."
# Backend
docker build -t ${PROJECT_NAME}-backend ./backend
docker tag ${PROJECT_NAME}-backend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${PROJECT_NAME}-backend:latest

# Frontend
docker build -t ${PROJECT_NAME}-frontend ./frontend
docker tag ${PROJECT_NAME}-frontend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${PROJECT_NAME}-frontend:latest

# 3. Push to ECR
echo "[3/4] Pushing images to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${PROJECT_NAME}-backend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${PROJECT_NAME}-frontend:latest

# 4. Force ECS to pull new images
echo "[4/4] Restarting ECS Services to deploy new images..."
aws ecs update-service --cluster ${PROJECT_NAME}-cluster --service ${PROJECT_NAME}-backend-svc --force-new-deployment --region $AWS_REGION
aws ecs update-service --cluster ${PROJECT_NAME}-cluster --service ${PROJECT_NAME}-frontend-svc --force-new-deployment --region $AWS_REGION

echo "===================================================="
echo " Deployment Triggered Successfully!"
echo " It may take 1-3 minutes for new containers to start."
echo "===================================================="
