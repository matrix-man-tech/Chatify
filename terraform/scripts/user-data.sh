#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# EC2 User Data — Bootstrap Script for Chatify
# Runs once on first boot to set up Docker and deploy the application.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PROJECT="${project_name}"
ENV="${environment}"

echo "🚀 Bootstrapping $PROJECT ($ENV)..."

# ── System Updates ──────────────────────────────────────────────────────────

yum update -y

# ── Install Docker ──────────────────────────────────────────────────────────

yum install -y docker git
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# ── Install Docker Compose ──────────────────────────────────────────────────

COMPOSE_VERSION="v2.29.1"
curl -fsSL "https://github.com/docker/compose/releases/download/$${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# ── Mount MongoDB EBS Volume ───────────────────────────────────────────────

# Wait for the EBS volume to attach
while [ ! -b /dev/xvdf ]; do
  echo "Waiting for EBS volume..."
  sleep 5
done

# Format only if not already formatted
if ! blkid /dev/xvdf; then
  mkfs.ext4 /dev/xvdf
fi

mkdir -p /data/mongodb
mount /dev/xvdf /data/mongodb
echo "/dev/xvdf /data/mongodb ext4 defaults,nofail 0 2" >> /etc/fstab

# ── Clone & Deploy ─────────────────────────────────────────────────────────

APP_DIR="/opt/$PROJECT"
mkdir -p "$APP_DIR"

# Clone the repository (replace with your repo URL)
git clone https://github.com/matrix-man-tech/Chatify.git "$APP_DIR" || true
cd "$APP_DIR/chatify"

# Create .env file from environment variables / SSM parameters
# In production, you would pull secrets from AWS Secrets Manager or SSM:
#   aws ssm get-parameter --name "/chatify/MONGO_URI" --with-decryption --query "Parameter.Value" --output text

cat > backend/.env <<'ENVFILE'
PORT=3000
NODE_ENV=production
# ⚠️ Replace these with real values or pull from AWS Secrets Manager
MONGO_URI=mongodb://chatify:chatify_secret@mongo:27017/chatify?authSource=admin
JWT_SECRET=CHANGE_ME_TO_A_REAL_SECRET
CLIENT_URL=http://localhost
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@chatify.app
EMAIL_FROM_NAME=Chatify
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
ARCJET_KEY=your_arcjet_key
ARCJET_ENV=production
ENVFILE

# ── Start the Application ─────────────────────────────────────────────────

docker-compose up --build -d

echo "✅ $PROJECT ($ENV) deployed successfully!"
