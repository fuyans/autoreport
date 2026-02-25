# Deploy on AWS EC2 (Amazon Linux)

This guide deploys the Batch DOCX Generator on an EC2 instance running **Amazon Linux 2** or **Amazon Linux 2023**. The app runs as a single Node process: the backend serves the built frontend and the API.

## 1. Launch and connect to EC2

1. In **AWS Console** → EC2 → Launch Instance:
   - **AMI:** Amazon Linux 2023 (or Amazon Linux 2)
   - **Instance type:** e.g. t3.micro (free tier) or t3.small
   - **Key pair:** Create or select one; download the `.pem` file
   - **Security group:** Allow **SSH (22)** and **HTTP (80)** — and optionally **Custom TCP 3000** if you want to use the app port directly

2. Connect via SSH (replace with your key and instance host):
   ```bash
   ssh -i your-key.pem ec2-user@<instance-public-IP>
   ```

## 2. Install Node.js (Amazon Linux 2023)

```bash
sudo dnf install -y nodejs
node -v   # v18+ recommended
```

**Amazon Linux 2** (if you use AL2):
```bash
curl -sL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

## 3. Install LibreOffice (for PDF output)

If you need PDF generation, install LibreOffice:

```bash
# Amazon Linux 2023
sudo dnf install -y libreoffice-core libreoffice-writer

# Amazon Linux 2
sudo yum install -y libreoffice-core libreoffice-writer
```

Verify:
```bash
soffice --version
```

## 4. Clone the app and install dependencies

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/autoreport.git
cd autoreport
```

(If the repo is private, use SSH or a deploy key, or upload the code with `scp`.)

## 5. Build the frontend

```bash
cd ~/autoreport/frontend
npm install
npm run build
```

This creates `frontend/dist/`.

## 6. Install backend dependencies

```bash
cd ~/autoreport/backend
npm install --omit=dev
```

## 7. Run with PM2 (keeps the app running)

Install PM2 and start the app:

```bash
sudo npm install -g pm2
cd ~/autoreport/backend
pm2 start src/index.js --name autoreport
pm2 save
pm2 startup   # run the command it prints to start PM2 on boot
```

The backend serves the frontend from `../frontend/dist` by default. Set `PORT` if needed:

```bash
PORT=3000 pm2 start src/index.js --name autoreport
# or
pm2 start src/index.js --name autoreport --update-env --env production
```

Optional: use a `.env` or `ecosystem.config.js`:

```bash
# ecosystem.config.js (in backend folder)
# module.exports = {
#   apps: [{ name: 'autoreport', script: 'src/index.js', cwd: '/home/ec2-user/autoreport/backend', env: { PORT: 3000, NODE_ENV: 'production' } }]
# };
# pm2 start ecosystem.config.js
```

Useful PM2 commands:
```bash
pm2 status
pm2 logs autoreport
pm2 restart autoreport
```

## 8. Open the app in the browser

- **If you opened port 3000:**  
  `http://<instance-public-IP>:3000`

- **If you use port 80:** Either run the app on 80 (requires root or capabilities) or put Nginx in front (see below).

## 9. (Optional) Nginx on port 80

To serve on port 80 and proxy to Node on 3000:

```bash
sudo dnf install -y nginx   # AL2023
# sudo yum install -y nginx   # AL2
```

Create config:
```bash
sudo nano /etc/nginx/conf.d/autoreport.conf
```

Paste (replace `YOUR_DOMAIN_OR_IP` if you have a domain or use the EC2 IP):

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;
    client_max_body_size 25M;

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Then:
```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl start nginx
```

Open **http://&lt;instance-public-IP&gt;** in the browser.

## 10. Security group checklist

In EC2 → Security groups → your instance’s group, ensure:

- **Inbound:** SSH (22) from your IP, HTTP (80) from 0.0.0.0/0 (or your IP). If not using Nginx, add Custom TCP 3000 from 0.0.0.0/0 or your IP.

## 11. Updating the app

```bash
cd ~/autoreport
git pull
cd frontend && npm install && npm run build
cd ../backend && npm install --omit=dev
pm2 restart autoreport
```

## Troubleshooting

- **PDF fails:** Run `soffice --version` and ensure LibreOffice is installed and on PATH. Restart the app after installing.
- **502 Bad Gateway:** Backend not running or wrong port. Check `pm2 status` and `pm2 logs autoreport`; ensure Nginx `proxy_pass` port matches (e.g. 3000).
- **Cannot connect:** Check security group allows 80 and/or 3000 from your IP or 0.0.0.0/0.
- **Large uploads:** Default limit is 20MB. Adjust in `backend/src/index.js` (`limits: { fileSize: ... }`) and in Nginx (`client_max_body_size`).
