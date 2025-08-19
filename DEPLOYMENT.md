# New People Stickers Bot - Deployment Guide

Railway deployment configuration and instructions for New People Stickers Bot.

## 🚀 Quick Deploy to Railway

### Prerequisites
- Railway account (sign up at [railway.app](https://railway.app))
- GitHub account with access to this repository
- Telegram Bot Token (get from @BotFather)
- Piapi AI API Key (get from Piapi AI platform)
- Supabase project (optional, for user limits tracking)

### 1. Deploy to Railway

#### Option A: Deploy from GitHub (Recommended)
1. Fork this repository to your GitHub account
2. Go to [Railway](https://railway.app) and sign in
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your forked repository
5. Railway will automatically detect and deploy using `railway.toml`

#### Option B: Deploy using Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

### 2. Configure Environment Variables

In Railway dashboard, go to your project → Variables tab and add:

#### Required Variables
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
BOT_TOKEN=your_bot_token_from_botfather  # Alternative name
WEBHOOK_URL=https://your-app.up.railway.app/webhook

# Piapi AI Configuration  
PIAPI_API_KEY=your_piapi_api_key
PIAPI_BASE_URL=https://api.piapi.ai/api/v1

# Production Environment
NODE_ENV=production
```

#### Optional Variables (Supabase)
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Optional Security Variables
```env
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
API_KEY=your_admin_api_key
```

### 3. Setup Telegram Webhook

After deployment, set your bot webhook:

```bash
# Replace YOUR_BOT_TOKEN and YOUR_RAILWAY_URL
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR_RAILWAY_URL/webhook"}'
```

Or visit this URL in your browser:
```
https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://YOUR_RAILWAY_URL/webhook
```

### 4. Verify Deployment

Check these endpoints:
- `https://your-app.up.railway.app/` - Basic info
- `https://your-app.up.railway.app/health` - Health check
- `https://your-app.up.railway.app/ready` - Readiness check

## 🔧 Configuration Files

### `railway.toml`
Railway deployment configuration with health checks and environment settings.

### `.env.example`
Template for all required environment variables. Copy to `.env` for local development.

### `Dockerfile` (Optional)
Multi-stage Docker build if you prefer containerized deployment.

## 📊 Monitoring

### Health Check Endpoints

#### `/health` - Comprehensive Health Check
Returns detailed status of all services:
```json
{
  "status": "healthy",
  "checks": {
    "server": "ok",
    "database": "ok", 
    "telegram": "ok",
    "piapi": "ok",
    "memory": { "status": "ok", "heapUsed": 45 },
    "system": { "status": "ok", "uptime": 3600 }
  },
  "responseTime": "150ms",
  "environment": "production"
}
```

#### `/ready` - Simple Readiness Check
Quick check that server is running:
```json
{
  "status": "ready",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "memory": "45MB"
}
```

#### `/metrics` - Detailed Metrics
System performance metrics for monitoring:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "memory": { "heapUsed": 47185920, "heapTotal": 67108864 },
  "cpu": { "user": 123456, "system": 78901 },
  "database": "ok",
  "telegram": "ok",
  "piapi": "ok"
}
```

### Logging

Structured JSON logging in production:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "message": "User 12345 - sticker_generation_started",
  "category": "generation",
  "userId": 12345,
  "stage": "started"
}
```

## 🛠️ Testing

Run tests before deployment:
```bash
# Test all systems
npm test

# Test specific components
npm run test:error-handling
npm run test:security
npm run test:apis

# Validate environment
npm run validate-env

# Local health check
npm run health
```

## 🔐 Security Features

- **Rate Limiting**: 30 requests/minute per IP, 10 messages/minute per user
- **Input Validation**: All Telegram data validated and sanitized
- **Authentication**: Webhook signature verification
- **CORS Protection**: Strict origin policies in production
- **Security Headers**: Comprehensive HTTP security via Helmet
- **Anti-Spam**: Duplicate message detection
- **Memory Protection**: Adaptive limiting based on system load

## 📈 Scaling

Railway automatically scales based on traffic. For higher loads:

1. **Upgrade Railway Plan**: More CPU/memory resources
2. **Database Optimization**: Add indexes, connection pooling
3. **Caching**: Implement Redis for session storage
4. **Load Balancing**: Deploy multiple instances

## 🐛 Troubleshooting

### Common Issues

#### 1. Bot Not Responding
```bash
# Check webhook status
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"

# Check health endpoint
curl "https://your-app.up.railway.app/health"
```

#### 2. Health Check Failing
- Verify environment variables are set
- Check database connectivity
- Ensure external API keys are valid

#### 3. Memory Issues
- Check `/metrics` endpoint for memory usage
- Review Railway logs for memory errors
- Consider upgrading Railway plan

#### 4. Rate Limiting Issues
- Check rate limit headers in responses
- Use `/admin/stats` to monitor limits
- Adjust rate limiting configuration if needed

### Logs Access

View logs in Railway dashboard:
1. Go to your project
2. Click on "Deployments" tab
3. Click on latest deployment
4. View real-time logs

### Environment Validation

```bash
# Validate all environment variables
npm run validate-env

# Check specific configurations
node -e "console.log('Bot Token:', !!process.env.TELEGRAM_BOT_TOKEN)"
node -e "console.log('Piapi Key:', !!process.env.PIAPI_API_KEY)"
```

## 🔄 Updates and Maintenance

### Automatic Deployments
Railway automatically redeploys when you push to your main branch.

### Manual Deployment
```bash
railway up
```

### Environment Updates
Update variables in Railway dashboard → Variables tab. The app will automatically restart.

### Health Monitoring
Set up monitoring alerts using Railway's webhook notifications or external services like UptimeRobot.

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Piapi AI Documentation](https://piapi.ai/docs)
- [Supabase Documentation](https://supabase.com/docs)

## 🆘 Support

For issues with:
- **Railway Deployment**: Check Railway docs or Railway Discord
- **Telegram Bot**: Check Telegram Bot API documentation
- **This Application**: Create an issue in the GitHub repository

---

**Railway Badge**: Add this to your README to show deployment status:
```markdown
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/your-template-id)
```