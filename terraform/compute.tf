# ─────────────────────────────────────────────────────────────────────────────
# Compute — EC2 Instance for Chatify (Docker Host)
# ─────────────────────────────────────────────────────────────────────────────

# ── AMI ID ─────────────────────────────────────────────────────────────────
# Mock AMI ID for offline plan validation.
# For real deployments, replace with a real AMI or use a data source.
# Find current Amazon Linux 2023 AMI:
#   aws ec2 describe-images --owners amazon --filters "Name=name,Values=al2023-ami-*-x86_64" \
#     --query 'sort_by(Images,&CreationDate)[-1].ImageId' --output text

# ── IAM Role for EC2 (access S3 backups, CloudWatch logs) ──────────────────

resource "aws_iam_role" "app_server" {
  name = "${var.project_name}-${var.environment}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-ec2-role"
  }
}

resource "aws_iam_role_policy" "app_server_s3" {
  name = "${var.project_name}-${var.environment}-s3-policy"
  role = aws_iam_role.app_server.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "app_server" {
  name = "${var.project_name}-${var.environment}-ec2-profile"
  role = aws_iam_role.app_server.name
}

# ── EC2 Instance ───────────────────────────────────────────────────────────

resource "aws_instance" "app_server" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = var.key_pair_name
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.app_server.id]
  iam_instance_profile   = aws_iam_instance_profile.app_server.name

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    encrypted             = true
    delete_on_termination = true
  }

  # Bootstrap script — installs Docker and starts the app
  user_data = base64encode(templatefile("${path.module}/scripts/user-data.sh", {
    project_name = var.project_name
    environment  = var.environment
  }))

  metadata_options {
    http_tokens = "required" # IMDSv2 — prevent SSRF attacks
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-app-server"
    Role = "application"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ── Elastic IP (stable public address) ─────────────────────────────────────

resource "aws_eip" "app_server" {
  instance = aws_instance.app_server.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-${var.environment}-eip"
  }
}
