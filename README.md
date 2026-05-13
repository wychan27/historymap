# History Map — Vercel Deployment

## Folder structure
```
historymap-vercel/
├── api/
│   └── events.js       Serverless function (the backend)
├── public/
│   └── index.html      Frontend
├── vercel.json         Routing config
├── package.json        Dependencies
└── README.md
```

## How to deploy

### 1. Create a GitHub account
Go to github.com and sign up for free.

### 2. Create a new GitHub repository
- Click the "+" icon top right → "New repository"
- Name it "historymap"
- Keep it Public
- Click "Create repository"

### 3. Upload these files to GitHub
- Click "uploading an existing file" on the repo page
- Drag ALL files and folders from this zip into the upload area
  (api folder, public folder, vercel.json, package.json)
- Click "Commit changes"

### 4. Deploy to Vercel
- Go to vercel.com and click "Sign up with GitHub"
- Click "Add New Project"
- Select your "historymap" repository
- Click "Deploy" (no settings need changing)

### 5. Add your API key
- In Vercel dashboard, go to your project → Settings → Environment Variables
- Add: ANTHROPIC_API_KEY = sk-ant-your-key-here
- Click Save, then go to Deployments and click "Redeploy"

### 6. Add your custom domain (optional)
- In Vercel dashboard → Settings → Domains
- Add: bumblebeeindustries.co or history.bumblebeeindustries.co
- Follow Vercel's instructions to update your DNS settings

Your app will be live at your-project.vercel.app (or your custom domain)!
