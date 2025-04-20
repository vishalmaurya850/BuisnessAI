# Business Competitor AI

Business Competitor AI is an AI-powered platform designed to help businesses monitor and analyze their competitors' marketing activities. The system leverages automated scraping, AI-based media analysis, and real-time alerts to provide actionable insights about competitors' ads, campaigns, and strategies.

## Objective

The goal of this platform is to allow users to input their business details and automatically scrape and analyze public data of competitor businesses. The system focuses on gathering insights about:

- Running ads (image/video/text)
- Marketing campaigns
- Publicly available strategic information
- Real-time alerts for new ad activity
- Media (image/video) understanding through AI analysis
- An AI chatbot interface to interact with insights and receive live alerts

## Core Features

### 1. User Input Module

Users can input their business information to guide the system in identifying relevant competitors to monitor.

**Fields Expected:**

- Business Name
- Industry/Niche
- Location (optional)
- Keywords / Services / Products
- Known Competitors (optional)

### 2. Competitor Identification & Scraping Engine

The system identifies competitors and scrapes data from public sources like:

- Google Ads Transparency Center
- Facebook Ad Library
- LinkedIn (Public Info)
- Websites
- Instagram / Meta Pages

**Extracted Details:**

- Active ads (text/image/video)
- Landing pages
- Ad captions, calls-to-action
- Duration, frequency, and platform of each ad

### 3. Ad Media Analysis (AI-Based)

The system uses AI to analyze media content in competitor ads.

**Images:**

- Summarize what’s being shown
- Detect emotion/theme
- Guess target audience
- Identify product/service being promoted

**Videos:**

- Extract key frames
- Transcribe audio
- Detect objects
- Analyze tone and branding
- Identify offers/calls-to-action

### 4. Live Ad Alerts System

The platform monitors competitor ads in near real-time (e.g., polling every 6–12 hours). Alerts are triggered for:

- New ad launches
- Paused or removed ads

**Alert Delivery:**

- Web notifications
- Optional email notifications
- A log of ad activity changes (new, paused, removed) is maintained.

### 5. AI Chatbot Integration

The platform includes an AI chatbot interface that allows users to ask questions like:

- "What are my competitors doing this week?"
- "Any new video ads from \[competitor name\]?"
- "Compare my campaigns to theirs."

The chatbot provides insights based on the latest scraped and analyzed data and delivers live alerts.

## User Flow

1. **User Authentication**: Users log in to the platform via Clerk.
2. **Business Information Input**: Users enter their business details (name, industry, keywords, competitors).
3. **Competitor Identification**: The system identifies relevant competitors and begins data scraping.
4. **Dashboard Display**: Scraped data (ads, media, campaigns) is displayed on a dashboard.
5. **AI Media Analysis**: AI processes and analyzes images/videos in the ads.
6. **Real-Time Alerts**: Alerts are generated for sudden ad launches or major changes.
7. **AI Chatbot Interaction**: Users interact with the chatbot for insights and live alerts.
8. **Continuous Monitoring**: Background monitoring and alerting continue.

## Tech Stack

### Frontend

- **Framework**: Next.js
- **Styling**: Tailwind CSS + ShadCN
- **Chatbot UI**: Custom implementation

### Backend

- **Framework**: Node.js
- **Scraping**: Puppeteer / Playwright
- **Queue Management**: Bull
- **Background Jobs**: CRON jobs or workers for polling

### AI & ML

- **Media Analysis**: Gemini Vision
- **Vision and Video Insights**: CLIP, BLIP, Whisper

### Database

- **Primary Database**: PostgreSQL (via Drizzle ORM)
- **Caching and Queues**: Redis

### Authentication

- **Auth Provider**: Clerk

## Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/vishalmaurya850/BuisnessAI.git
   cd BuisnessAI
   ```

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

3. **Set up the** `.env` **file**:

   - Copy the provided `.env.example` file to `.env`:

     ```bash
     cp .env.example .env
     ```

   - Fill in the required values (see Environment Variables below).

4. **Run database migrations**:

   ```bash
   npx drizzle-kit generate
   npx drizzle-kit migrate
   ```

5. **Start the development server**:

   ```bash
   pnpm run dev
   ```

6. **Open the app in your browser**:

   - Navigate to `http://localhost:3000`.

## Environment Variables

The following environment variables are required to run the application. Add them to a `.env` file in the root of your project:

```
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=smtp
EMAIL_USER=<your-email>
EMAIL_PASSWORD=<your-email-password>
EMAIL_FROM=<your-email>

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron Job Secret
CRON_SECRET=<your-cron-secret>

# AI API Keys
GEMINI_API_KEY=<your-google-generative-ai-key>

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>

# Database Configuration
DATABASE_URL=postgresql://<username>:<password>@<host>/<database>?sslmode=require

# Redis Configuration
REDIS_URL=redis://<username>:<password>@<host>:<port>
```

**Note**: Replace placeholder values (e.g., `<your-email>`, `<your-google-generative-ai-key>`) with actual credentials from your service providers. For production, update `NEXT_PUBLIC_APP_URL` to your deployed application URL.

## Deployment

1. **Build the application**:

   ```bash
   npm run build
   ```

2. **Start the production server**:

   ```bash
   npm run start
   ```

3. **Deploy to a hosting platform**:

   - Recommended platforms: Vercel, AWS, or DigitalOcean.
   - Follow the platform-specific deployment instructions (e.g., `vercel --prod` for Vercel).

## API Endpoints

### Competitors API

- **GET** `/api/competitors`:
  - Fetch all competitors for the authenticated user.
  - Response: `{ competitors: [{ id, name, industry, ... }] }`
- **POST** `/api/competitors/discover`:
  - Discover competitors using AI based on business details.
  - Body: `{ industry, keywords, location }`
  - Response: `{ competitors: [{ name, industry, ... }] }`
- **POST** `/api/competitors/:id/scrape`:
  - Trigger scraping for a specific competitor.
  - Response: `{ success: true, data: { ads: [], campaigns: [] } }`
- **DELETE** `/api/competitors/:id`:
  - Delete a competitor from monitoring.
  - Response: `{ success: true }`

### Business API

- **POST** `/api/business`:
  - Create a new business profile.
  - Body: `{ name, industry, location, keywords, competitors }`
  - Response: `{ success: true, business: { id, name, ... } }`
- **GET** `/api/business`:
  - Check if a business profile exists for the authenticated user.
  - Response: `{ exists: true, business: { id, name, ... } }`

## Contributing

We welcome contributions to improve Business Competitor AI! To contribute:

1. **Fork the repository**:

   ```bash
   git clone https://github.com/vishalmaurya850/BuisnessAI.git
   ```

2. **Create a new branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Commit your changes**:

   ```bash
   git commit -m "Add your feature description"
   ```

4. **Push to the branch**:

   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a pull request**:

   - Go to the repository on GitHub and create a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments

- **Google Generative AI**: For powering media analysis capabilities.
- **Clerk Authentication**: For secure and seamless user authentication.
- **Neon.tech PostgreSQL**: For reliable database hosting.
- **Redis Cloud**: For efficient caching and queue management.

---

*Built with ❤️ by the Business Competitor AI team.*