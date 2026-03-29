# ─────────────────────────────────────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────────────────────────────────────

# ── Networking ──────────────────────────────────────────────────────────────

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

# ── Compute ─────────────────────────────────────────────────────────────────

output "app_server_public_ip" {
  description = "Elastic IP of the application server"
  value       = aws_eip.app_server.public_ip
}

output "app_server_instance_id" {
  description = "Instance ID of the application server"
  value       = aws_instance.app_server.id
}

output "ssh_command" {
  description = "SSH command to connect to the app server"
  value       = "ssh -i ${var.key_pair_name}.pem ec2-user@${aws_eip.app_server.public_ip}"
}

output "app_url" {
  description = "URL to access the Chatify application"
  value       = "http://${aws_eip.app_server.public_ip}"
}

# ── Storage ─────────────────────────────────────────────────────────────────

output "backup_bucket_name" {
  description = "Name of the S3 backup bucket"
  value       = aws_s3_bucket.backups.id
}

output "mongo_volume_id" {
  description = "ID of the EBS volume for MongoDB data"
  value       = aws_ebs_volume.mongo_data.id
}
