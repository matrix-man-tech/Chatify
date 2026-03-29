# ─────────────────────────────────────────────────────────────────────────────
# Terraform Provider Configuration
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # ── Remote State (uncomment for team use) ─────────────────────────────────
  # backend "s3" {
  #   bucket         = "chatify-terraform-state"
  #   key            = "infrastructure/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "chatify-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  # ── Mock Mode ─────────────────────────────────────────────────────────────
  # These settings allow terraform plan/validate without real AWS credentials.
  # Remove this block when deploying to a real AWS account.
  access_key = "mock-access-key"
  secret_key = "mock-secret-key"

  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  # ── End Mock Mode ────────────────────────────────────────────────────────

  default_tags {
    tags = {
      Project     = "Chatify"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
