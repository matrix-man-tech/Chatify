# ─────────────────────────────────────────────────────────────────────────────
# Input Variables
# ─────────────────────────────────────────────────────────────────────────────

# ── General ─────────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "chatify"
}

# ── Networking ──────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

variable "availability_zones" {
  description = "Availability zones for subnet distribution"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

# ── Compute ─────────────────────────────────────────────────────────────────

variable "instance_type" {
  description = "EC2 instance type for the application server"
  type        = string
  default     = "t3.small"
}

variable "key_pair_name" {
  description = "Name of the SSH key pair for EC2 access"
  type        = string
  default     = "chatify-key"
}

variable "ami_id" {
  description = "AMI ID for the EC2 instance (Amazon Linux 2023)"
  type        = string
  # us-east-1 Amazon Linux 2023 — update when launching in a different region
  # Find latest: aws ec2 describe-images --owners amazon \
  #   --filters "Name=name,Values=al2023-ami-*-x86_64" \
  #   --query 'sort_by(Images,&CreationDate)[-1].ImageId' --output text
  default = "ami-0c02fb55956c7d316"
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed to SSH into the instance"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Restrict in production!
}

# ── Storage ─────────────────────────────────────────────────────────────────

variable "mongo_volume_size" {
  description = "Size of the EBS volume for MongoDB data (GB)"
  type        = number
  default     = 20
}

variable "backup_retention_days" {
  description = "Number of days to retain S3 backup objects"
  type        = number
  default     = 30
}
