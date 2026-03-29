<h1 align="center">✨ Chatify — DevOps Engineering Assessment ✨</h1>

<div align="center">
  <img src="https://img.shields.io/badge/Docker-Tested-blue" alt="Docker">
  <img src="https://img.shields.io/badge/Terraform-1.5%2B-purple" alt="Terraform">
  <img src="https://img.shields.io/badge/GitHub%20Actions-Passing-brightgreen" alt="CI/CD">
  <img src="https://img.shields.io/badge/Monitoring-Prometheus%20%7C%20Grafana-orange" alt="Monitoring">
  <img src="https://img.shields.io/badge/Testing-62%20Tests%20Passing-success" alt="Vitest">
</div>

---

This repository serves as a fully functional submission for a **DevOps Engineering Assessment**. The goal of this project was to take a raw web application (Chatify) built with Node.js/React and orchestrate a complete, production-ready DevOps lifecycle from the ground up, moving it away from manual deployments.

## 🎯 Assessment Fulfillment Overview

Whoever is reviewing this code, welcome! Here is a roadmap to where each requirement of the assessment was fulfilled within this repository:

### 1. CI/CD Setup 🔄 
Automated pipelines are enforced using **GitHub Actions**.
- **Where to look:** `.github/workflows/ci-cd.yml`
- **What it does:** Triggers on pushes/PRs to `main`. It runs three parallel/sequential jobs:
  1. **test-backend**: Configures MongoDB memory servers, runs 62 integration tests via Vitest, and uploads coverage artifacts.
  2. **build-frontend**: Installs dependencies, runs linters, and compiles the React production bundle, caching the artifact.
  3. **docker-build**: Uses Docker Buildx with layer caching to verify both the frontend and backend images compile successfully. *(Contains a commented-out deployment job ready for SSH/DockerHub deployment).*

### 2. Docker Setup 🐳
The entire application has been containerized and orchestrated.
- **Where to look:** 
  - `backend/Dockerfile` — Multi-stage Alpine container running as a non-root user.
  - `frontend/Dockerfile` — 3-stage build (deps -> build -> inject into Nginx).
  - `frontend/nginx.conf` — Nginx proxy routing to solve cross-origin constraints and proxy API/WebSockets.
  - `docker-compose.yml` — The orchestrator tying together MongoDB, the Express Backend, and the Nginx Frontend into an isolated `chatify-network`.

### 3. Infrastructure as Code (IaC) 🏗️
AWS Cloud Infrastructure provisioned automatically using **Terraform**.
- **Where to look:** `terraform/` directory.
- **What it does:** It establishes a complete, secure VPC architecture.
  - `networking.tf`: VPC, public/private subnets across 2 AZs, Route Tables, and restrictive Security Groups.
  - `compute.tf`: Provides an Amazon Linux 2023 EC2 instance, Elastic IP, and strict IAM roles. Crucially, it uses `user-data.sh` to self-bootstrap Docker and pull this repository upon boot.
  - `storage.tf`: Provisions an independent GP3 EBS volume for persistent MongoDB storage (survives instances terminations) and an AES256 encrypted S3 bucket for backups using a 30-day lifecycle expiration policy.
  - *Note: To allow offline evaluation without AWS credentials, the provider is currently set to a localized `Mock Mode` which passes `terraform plan` successfully.*

### 4. Monitoring (Bonus) 📊
A complete observability stack leveraging **Prometheus**, **cAdvisor**, and **Grafana**.
- **Where to look:** `docker-compose.yml` (bottom half) & `monitoring/prometheus/`.
- **What it does:** cAdvisor links directly to the Docker engine daemon to analyze real-time container health (CPU, Memory, Network). Prometheus wakes up every 15 seconds to scrape this data, and Grafana (`http://localhost:3001` / `admin:admin`) exposes it into visual dashboards.

---

## 🚀 Running the Stack Locally

No manual `npm` commands are required anymore. The entire stack comes up with one line.

Ensure you have Docker Desktop installed, then run:

```bash
# Start the Backend, Frontend, MongoDB, Prometheus, Grafana, and cAdvisor:
docker-compose up --build -d
```

### Accessing the Services
- **Full Chatify App:** [http://localhost](http://localhost)
- **Backend API Layer:** [http://localhost:3000](http://localhost:3000) *(Internal Docker network)*
- **Grafana Dashboards:** [http://localhost:3001](http://localhost:3001) *(Login: `admin` / `admin`)*
- **Prometheus Targets:** [http://localhost:9090/targets](http://localhost:9090/targets)

---

## 🧪 Testing

The backend includes a comprehensive, isolated integration testing suite covering Auth, Messages, specific Routes, and Middlewares.

```bash
cd backend
npm install
npm test
```

*Total tests: 62 passing*

---

<p align="center">
  <i>Built as part of a DevOps Engineering Technical Assessment.</i>
</p>
