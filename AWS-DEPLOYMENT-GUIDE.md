# Engage Platform: AWS Deployment Guide

This guide provides step-by-step instructions to deploy the Engage Platform (Frontend + Backend) to Amazon Web Services (AWS) using a modern Serverless Container architecture (ECS Fargate + Application Load Balancer).

## ⚠️ Free Tier Notice
While AWS provides a generous free tier, this deployment uses **ECS Fargate** and an **Application Load Balancer (ALB)**. 
- **ALB**: 750 hours per month are free for the first 12 months (covers 1 ALB running 24/7).
- **ECS Fargate**: Does not have a perpetual free tier (charges per vCPU and GB memory per hour). We have configured the containers to use the absolute minimum resources (0.25 vCPU for frontend, 0.5 vCPU for backend) to keep costs extremely low (around $10-$15/month). 
- **Secrets Manager**: Costs ~$0.40 per secret per month. We bundled all environment variables into a single secret to minimize this cost.
- **NAT Gateway (Avoided)**: We specifically avoided using a NAT Gateway (which costs ~$32/month) by assigning public IPs to the Fargate tasks so they can pull images directly from ECR for free.

---

## Step 1: Prerequisites

1. **AWS CLI v2**: Installed and configured (`aws configure`) with an IAM user that has `AdministratorAccess`.
2. **Terraform**: Installed (version >= 1.2.0).
3. **Docker Desktop**: Installed and running locally.
4. **AWS Account ID**: Find your 12-digit account ID in the top right of the AWS Console.

---

## Step 2: Configure Environment Secrets

We use AWS Secrets Manager to inject environment variables securely into the containers.

1. Go to **AWS Secrets Manager** in the AWS Console.
2. Click **Store a new secret** -> Choose **Other type of secret**.
3. Under "Key/value pairs", select the **Plaintext** tab.
4. Paste the JSON representation of your `.env` files. Ensure you replace the dummy values with your actual API keys:

```json
{
  "SUPABASE_URL": "your_supabase_url",
  "SUPABASE_SERVICE_ROLE_KEY": "your_supabase_key",
  "JWT_SECRET": "your_jwt_secret",
  "GROQ_API_KEY": "your_groq_api_key",
  "OUTLOOK_CLIENT_ID": "your_outlook_client_id",
  "OUTLOOK_CLIENT_SECRET": "your_outlook_client_secret",
  "OUTLOOK_TENANT_ID": "your_outlook_tenant_id",
  "SALESFORCE_CLIENT_ID": "your_salesforce_client_id",
  "SALESFORCE_CLIENT_SECRET": "your_salesforce_client_secret",
  "SALESFORCE_USERNAME": "your_salesforce_username",
  "SALESFORCE_PASSWORD": "your_salesforce_password",
  "SALESFORCE_SECURITY_TOKEN": "your_salesforce_security_token",
  "SALESFORCE_LOGIN_URL": "https://login.salesforce.com"
}
```

5. Click **Next**.
6. Name the secret **EXACTLY**: `engage-secrets`
7. Save the secret.

---

## Step 3: Provision Infrastructure (Terraform)

1. Open your terminal and navigate to the terraform directory:
   ```bash
   cd infra/terraform
   ```
2. Initialize Terraform:
   ```bash
   terraform init
   ```
3. Plan the deployment (this will prompt you for variables, or you can create a `terraform.tfvars` file):
   ```bash
   terraform plan
   ```
   *Note: Terraform will ask for all your secret variables because it needs to grant the ECS task permissions to read them. You can just enter dummy values during `terraform plan/apply` for the variables, because the actual values are securely pulled from Secrets Manager at runtime.*
4. Apply the infrastructure:
   ```bash
   terraform apply
   ```
5. Once complete, copy the `alb_dns_name` from the output. This is your public website URL!

---

## Step 4: Build and Push Docker Images

1. Navigate back to the root of the project:
   ```bash
   cd ../../
   ```
2. Open `infra/scripts/deploy.sh` and replace `AWS_ACCOUNT_ID="YOUR_AWS_ACCOUNT_ID"` with your actual 12-digit AWS account ID.
3. Run the deployment script:
   - On Mac/Linux/WSL: `bash infra/scripts/deploy.sh`
   - On Windows (PowerShell), you can run the commands inside the `.sh` file manually, or use Git Bash.

**What this script does:**
- Logs into your AWS ECR.
- Builds the Backend and Frontend Docker images.
- Pushes them to AWS.
- Restarts the ECS Fargate cluster so it picks up the latest code.

---

## Step 5: Access Your Application

1. Open a browser and navigate to the `alb_dns_name` you copied in Step 3 (e.g., `engage-alb-12345.us-east-1.elb.amazonaws.com`).
2. The frontend will be served at the root `/`.
3. The backend APIs will be served under `/api/*` and `/salesforce/*`.

*(If you see a 502 Bad Gateway error, wait 1-2 minutes for the Fargate containers to finish booting and pass health checks).*

---

## Step 6: Tearing Down (To Save Money)

When you are done testing and want to ensure you are not charged by AWS, you MUST destroy the infrastructure.

1. Navigate to `infra/terraform`.
2. Run:
   ```bash
   terraform destroy
   ```
   *(Confirm with `yes`)*
3. Go to AWS ECR and delete the Docker images manually if Terraform fails to delete the repositories because they are not empty.
