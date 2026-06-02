# UptimeRobot Setup - Keep Railway Backend Warm

Railway's free tier spins down your backend after 5 minutes of inactivity. This causes the first request to timeout (20-30 seconds cold start). To prevent this, set up a free uptime monitor.

## Setup Instructions

1. **Sign up for UptimeRobot**
   - Go to https://uptimerobot.com
   - Create a free account (no credit card required)

2. **Create a New Monitor**
   - Click "Add New Monitor"
   - Monitor Type: `HTTP(s)`
   - Friendly Name: `NimHub Railway Backend`
   - URL: `https://nserver-production.up.railway.app/api/health`
   - Monitoring Interval: `5 minutes` (free tier minimum)
   - Monitor Timeout: `30 seconds`

3. **Optional: Add Alert Contacts**
   - Set up email/SMS alerts if backend goes down
   - This helps you know if Railway has issues

4. **Verify It's Working**
   - Wait 5 minutes
   - Check the monitor dashboard - should show "Up"
   - Your NIM price ticker should load instantly now

## How It Works

UptimeRobot pings your Railway backend every 5 minutes, which:
- Keeps the server "warm" (no cold starts)
- Prevents 20-30 second timeouts on first load
- Makes your app feel instant for demo/judges

## Alternative: Railway Paid Plan

If you upgrade to Railway's paid plan ($5/month), your backend stays warm 24/7 automatically. No uptime monitor needed.

## Cost

- UptimeRobot: **FREE** (50 monitors, 5-minute intervals)
- Railway Cold Starts: **FREE** but slow first load
- Railway Pro: **$5/month** for always-warm backend
