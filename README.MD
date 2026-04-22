<h1 align="center">✨ Chatify — Real-Time Chat Application ✨</h1>

<div align="center">
  <img src="https://img.shields.io/badge/Docker-Containerized-blue" alt="Docker">
  <img src="https://img.shields.io/badge/Terraform-1.5%2B-purple" alt="Terraform">
  <img src="https://img.shields.io/badge/GitHub%20Actions-CI%2FCD-brightgreen" alt="CI/CD">
  <img src="https://img.shields.io/badge/Monitoring-Prometheus%20%7C%20Grafana-orange" alt="Monitoring">
  <img src="https://img.shields.io/badge/Tests-62%20Passing-success" alt="Vitest">
</div>

---

A full-stack real-time chat application built with **Node.js**, **React**, and **MongoDB**, featuring a complete DevOps pipeline with containerization, infrastructure as code, CI/CD automation, and production-grade monitoring.

## 📦 Tech Stack

- **Frontend:** React + Vite, served via Nginx
- **Backend:** Node.js / Express with WebSocket support
- **Database:** MongoDB
- **Containerization:** Docker & Docker Compose
- **IaC:** Terraform (AWS)
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus, Grafana, cAdvisor

---

## 🔄 CI/CD Pipeline

Automated pipelines powered by **GitHub Actions** (`.github/workflows/ci-cd.yml`).

Triggers on pushes and PRs to `main`, running the following jobs:
1. **test-backend** — Spins up MongoDB memory servers, runs 62 integration tests via Vitest, and uploads coverage artifacts.
2. **build-frontend** — Installs dependencies, runs linters, and compiles the React production bundle.
3. **docker-build** — Uses Docker Buildx with layer caching to verify both images compile successfully.

---

## 🐳 Docker Setup

The entire application is containerized and orchestrated with Docker Compose.

| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Multi-stage Alpine container running as a non-root user |
| `frontend/Dockerfile` | 3-stage build (deps → build → Nginx) |
| `frontend/nginx.conf` | Nginx proxy routing for API and WebSocket traffic |
| `docker-compose.yml` | Orchestrates MongoDB, Express backend, and Nginx frontend on an isolated `chatify-network` |

---

## 🏗️ Infrastructure as Code (Terraform)

AWS infrastructure provisioned automatically using **Terraform** (`terraform/` directory).

- **`networking.tf`** — VPC, public/private subnets across 2 AZs, route tables, and security groups.
- **`compute.tf`** — Amazon Linux 2023 EC2 instance, Elastic IP, and IAM roles. Uses `user-data.sh` to bootstrap Docker and pull the repository on boot.
- **`storage.tf`** — GP3 EBS volume for persistent MongoDB storage and an AES-256 encrypted S3 bucket for backups with a 30-day lifecycle policy.

> **Note:** The provider is configured in mock mode to allow `terraform plan` to run without AWS credentials.

---

## 📊 Monitoring

A full observability stack using **Prometheus**, **cAdvisor**, and **Grafana**.

- **cAdvisor** connects to the Docker daemon for real-time container metrics (CPU, memory, network).
- **Prometheus** scrapes metrics every 15 seconds.
- **Grafana** provides visual dashboards at `http://localhost:3001`.

---

## 🚀 Getting Started

### Prerequisites
- Docker Desktop installed and running

### 1. Set Up Environment Variables

```bash
cd backend
cp .env.example .env
# Optional: Add your Cloudinary/Resend API keys in backend/.env
cd ..
```

### 2. Start the Stack

```bash
docker-compose up --build -d
```

### Accessing Services

| Service | URL |
|---------|-----|
| Chatify App | [http://localhost](http://localhost) |
| Backend API | [http://localhost:3000](http://localhost:3000) |
| Grafana | [http://localhost:3001](http://localhost:3001) (Login: `admin` / `admin`) |
| Prometheus | [http://localhost:9090/targets](http://localhost:9090/targets) |

---

## 🧪 Testing

The backend includes a comprehensive integration testing suite covering Auth, Messages, Routes, and Middlewares.

```bash
cd backend
npm install
npm test
```

*62 tests passing*

---

<p align="center">
  <i>Built with ❤️ by the Chatify team.</i>
</p>
