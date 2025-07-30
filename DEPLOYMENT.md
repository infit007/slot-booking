# Deployment Guide

## Frontend Deployment (Vercel)

The frontend is configured to deploy to Vercel automatically.

### Files:
- `vercel.json` - Vercel configuration
- `.vercelignore` - Files to exclude from deployment

### Deployment:
1. Push to GitHub
2. Connect repository to Vercel
3. Deploy automatically

## Backend Deployment (Render)

The backend is configured to deploy to Render.

### Files:
- `render.yaml` - Render configuration
- `server/package.json` - Server dependencies and scripts

### Manual Render Setup:

1. **Go to Render Dashboard**
   - Visit [render.com](https://render.com)
   - Create a new Web Service

2. **Connect Repository**
   - Connect your GitHub repository
   - Select the repository

3. **Configure Service:**
   - **Name**: `slot-booking-backend`
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && node index.js`
   - **Port**: `10000`

4. **Environment Variables:**
   - `NODE_ENV`: `production`
   - `PORT`: `10000`

5. **Deploy**

### Alternative: Use render.yaml

If you have the `render.yaml` file, you can use Render's Blueprint feature:

1. Go to Render Dashboard
2. Click "New" → "Blueprint"
3. Connect your repository
4. Render will automatically detect and deploy using the `render.yaml` configuration

## Database Considerations

### Development:
- SQLite (local file)

### Production:
- Consider using PostgreSQL or MongoDB
- Update database connection in `server/index.js`

## Environment Variables

### Frontend (Vercel):
- `REACT_APP_API_URL`: Your backend URL (e.g., `https://your-backend.onrender.com`)

### Backend (Render):
- `NODE_ENV`: `production`
- `PORT`: `10000`

## CORS Configuration

The backend is configured to accept requests from any origin in development. For production, update the CORS configuration in `server/index.js`:

```javascript
app.use(cors({
  origin: ['https://your-frontend-domain.vercel.app'],
  credentials: true
}));
```

## Troubleshooting

### Common Issues:

1. **Module not found**: Check file paths in build/start commands
2. **Port issues**: Ensure PORT environment variable is set
3. **CORS errors**: Update CORS configuration for production domains
4. **Database errors**: Ensure database file permissions or use cloud database

### Logs:
- Check Render logs for backend issues
- Check Vercel logs for frontend issues 