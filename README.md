# Employee Information and Payroll Automation System

A multi-role HR & Payroll Web Application utilizing a modern cloud-native approach.

## 🚀 Teck Stack Breakdown
- **Frontend** - React.js (Vite) + Tailwind CSS (Hosted on Vercel)
- **Backend** - Express.js REST API (Hosted on Render)
- **Database + Auth** - Supabase (PostgreSQL)
- **File Storage** - Cloudflare R2
- **Caching** - Upstash Redis
- **CI/CD** - GitHub Actions

---

## 💻 Local Setup Instructions

### Pre-requisites
- Node.js (v18+)
- Git
- Create accounts on: Supabase, Vercel, Render, Upstash Redis, Cloudflare (for R2)

### 1. Database (Supabase) Setup
1. Create a new Organization & Project in your Supabase dashboard.
2. Go to SQL Editor -> New query -> Copy and paste the contents of `schema.sql` located at the root of this project. Run it.
3. Keep your Supabase URL, Anon Key, and Service Role Key handy.

### 2. Backend Setup
1. Open terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   npm install
   ```
2. Duplicate `.env.example` to `.env` and fill in the details:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (Supabase API Dashboard)
   - `JWT_SECRET` (Supabase API Dashboard -> JWT Secret)
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (Cloudflare Dashboard -> R2 -> Create Bucket -> Manage API Tokens)
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (Upstash Database console)
   - `PORT=4000`
3. Run the development server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. Keep the backend running and open a new terminal tab in the `frontend/` directory:
   ```bash
   cd frontend
   npm install
   ```
2. Duplicate `.env.example` to `.env` and configure:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_BASE_URL=http://localhost:4000`
3. Run the client:
   ```bash
   npm run dev
   ```

---

## 🌩️ Deployment Instructions

### 1. Backend (Render)
1. Go to [Render.com](https://render.com) > New > Web Service.
2. Connect your GitHub repository.
3. Configure the settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add all Backend Environment Variables corresponding to your local `.env`.
5. Deploy.
6. Once deployed, verify your service URL (e.g. `https://my-hr-app.onrender.com`).
7. **Important:** Retrieve the `Deploy Hook` from Info -> Deployhook.

### 2. Frontend (Vercel)
1. Ensure your Code is pushed to GitHub.
2. The deployed `e:\Honor\.github\workflows\deploy.yml` takes care of CI/CD automations using the Vercel CLI.
3. Make sure to define `VITE_API_BASE_URL` with your exact Render URL in Vercel\'s environment configuration section if you skip CI and deploy directly via Vercel GUI.
4. Also update your R2 Bucket CORS to only allow your `https://your-app.vercel.app` domain.

### 3. GitHub Actions configuration (CI/CD)
To enable the deployed pipeline:
1. Navigate to your Repo in GitHub > Settings > Secrets and variables > Actions.
2. Populate the following repository secrets:
   - `VERCEL_TOKEN`: Vercel Account token (Go to Vercel profile -> Tokens)
   - `RENDER_DEPLOY_HOOK_URL`: Acquired from Render\'s deployment page
3. Push to `main` branch to trigger builds automatically!
