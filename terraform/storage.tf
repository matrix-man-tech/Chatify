# ─────────────────────────────────────────────────────────────────────────────
# Storage — EBS Volume for MongoDB, S3 Bucket for Backups
# ─────────────────────────────────────────────────────────────────────────────

# ── EBS Volume: MongoDB Data ───────────────────────────────────────────────
# Separate volume from root so data persists across instance replacements.

resource "aws_ebs_volume" "mongo_data" {
  availability_zone = var.availability_zones[0]
  size              = var.mongo_volume_size
  type              = "gp3"
  encrypted         = true
  iops              = 3000
  throughput        = 125

  tags = {
    Name    = "${var.project_name}-${var.environment}-mongo-data"
    Purpose = "MongoDB persistent storage"
  }
}

resource "aws_volume_attachment" "mongo_data" {
  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.mongo_data.id
  instance_id = aws_instance.app_server.id
}

# ── S3 Bucket: Backups ─────────────────────────────────────────────────────

resource "aws_s3_bucket" "backups" {
  bucket = "${var.project_name}-${var.environment}-backups"

  tags = {
    Name    = "${var.project_name}-${var.environment}-backups"
    Purpose = "Database backups and application artifacts"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire-old-backups"
    status = "Enabled"

    filter {
      prefix = "" # Apply to all objects
    }

    # Move to cheaper storage after 7 days
    transition {
      days          = 7
      storage_class = "STANDARD_IA"
    }

    # Move to Glacier after 30 days
    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    # Delete after retention period
    expiration {
      days = var.backup_retention_days + 60
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
