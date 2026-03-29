# ─────────────────────────────────────────────────────────────────────────────
# Terraform Variable Values — Development Environment
# ─────────────────────────────────────────────────────────────────────────────
# Copy this file and modify for staging/production:
#   cp terraform.tfvars terraform.production.tfvars
#   terraform plan -var-file="terraform.production.tfvars"
# ─────────────────────────────────────────────────────────────────────────────

aws_region   = "us-east-1"
environment  = "dev"
project_name = "chatify"

# ── Networking ──────────────────────────────────────────────────────────────

vpc_cidr             = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.20.0/24"]
availability_zones   = ["us-east-1a", "us-east-1b"]

# ── Compute ─────────────────────────────────────────────────────────────────

instance_type  = "t3.small"
key_pair_name  = "chatify-key"
allowed_ssh_cidrs = ["0.0.0.0/0"] # ⚠️ Restrict to your IP in production!

# ── Storage ─────────────────────────────────────────────────────────────────

mongo_volume_size     = 20
backup_retention_days = 30
