# Thai PBS Facebook Ads Performance Dashboard

An interactive full-stack analytics dashboard for ingesting, parsing, and visualizing Facebook Ads campaign performance data. Designed to load data directly from Google Sheets (or use built-in demo datasets) to generate real-time KPIs, campaign breakdowns, demographic distributions, and trend analysis.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup (FastAPI)](#backend-setup-fastapi)
  - [Frontend Setup (React + Vite)](#frontend-setup-react--vite)
- [Running with Docker](#running-with-docker)
- [Running Tests](#running-tests)
- [API Reference](#api-reference)
- [Configuration & Environment Variables](#configuration--environment-variables)
- [Deployment](#deployment)

---

## Overview

Managing and auditing Facebook Ads exports often requires handling inconsistent column naming, currency formatting, and disparate tracking metrics. 

This project bridges that gap by providing:
1. A **FastAPI** backend that fetches raw spreadsheet exports, automatically maps flexible column headers, standardizes numeric values across locales, and aggregates performance metrics.
2. A **React 19** frontend that renders high-impact KPI summaries, demographic charts, interactive time-series plots, and filterable campaign tables.

---

## Key Features

- **Direct Google Sheet Import**: Simply paste a public or viewable Google Sheet URL (supports `gid` targeting). The backend parses and streams CSV data on the fly.
- **Built-in Demo Mode**: If no sheet URL is supplied, the system immediately loads a rich, multi-campaign demo dataset for instant previews.
- **Executive KPIs**: Real-time aggregation of Total Spend, Impressions, Reach, Link Clicks, Average CTR, CPC, CPM, and Conversions.
- **Time-Series Trend Visualizations**: Responsive Area and Line charts powered by Recharts to inspect performance trajectories over custom date intervals.
- **Audience & Placement Insights**: Demographic breakdowns (age, gender, platforms, placements) to pinpoint high-performing segments.
- **Sortable & Filterable Campaign Table**: Deep dive into individual campaign metrics with status indicators and search capabilities.

---

## Architecture & Tech Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+)
- **Server**: [Uvicorn](https://www.uvicorn.org/) (ASGI)
- **Data Manipulation**: [Pandas](https://pandas.pydata.org/), NumPy
- **Validation & Networking**: Pydantic, Requests

### Frontend
- **Framework**: [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Styling**: Vanilla CSS with modern custom design system tokens (responsive & dark-mode ready)

---

## Project Structure

```text
fbads/
├── backend/
│   ├── Dockerfile            # Container configuration for backend
│   ├── data_parser.py        # Sheet URL parser, cleaning, and aggregation logic
│   ├── main.py               # FastAPI application endpoints and CORS setup
│   ├── requirements.txt      # Python dependencies
│   └── test_backend.py       # Unit tests for data ingestion & parsing
├── frontend/
│   ├── index.html            # Vite HTML entry point
│   ├── package.json          # Node dependencies and scripts
│   ├── vite.config.js        # Vite build & bundler configuration
│   └── src/
│       ├── App.jsx           # Main dashboard layout, state, and controls
│       ├── index.css         # Design system, variables, and global styles
│       ├── components/
│       │   ├── CampaignTable.jsx       # Detailed campaign data grid
│       │   ├── DemographicsTable.jsx   # Age/gender & platform distributions
│       │   └── KPICard.jsx             # Top-level performance metric cards
│       └── assets/           # Logos, icons, and static assets
├── netlify.toml              # Netlify build configuration & SPA redirects
├── .gitignore                # Global git ignore configuration
└── README.md                 # Project documentation
```

---

## Getting Started

### Prerequisites

- **Python**: 3.10 or higher
- **Node.js**: 18.x or higher
- **npm** or **yarn** / **pnpm**

---

### Backend Setup (FastAPI)

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   ```bash
   # On macOS/Linux:
   python3 -m venv venv
   source venv/bin/activate

   # On Windows (cmd):
   venv\Scripts\activate.bat
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the backend development server**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend API will be accessible at: `http://localhost:8000`  
   Interactive Swagger docs are available at: `http://localhost:8000/docs`

---

### Frontend Setup (React + Vite)

1. **Open a new terminal and navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install node dependencies**:
   ```bash
   npm install
   ```

3. **Start the Vite development server**:
   ```bash
   npm run dev
   ```
   The frontend application will open at: `http://localhost:5173` (or the port indicated in your terminal).

---

## Running with Docker

You can containerize and run the backend using Docker:

1. **Build the Docker image**:
   ```bash
   docker build -t fbads-backend ./backend
   ```

2. **Run the container**:
   ```bash
   docker run -p 8000:8000 -e PORT=8000 fbads-backend
   ```

---

## Running Tests

Unit tests verify Google Sheet URL transformations, numeric string sanitation, column mapping, and demo generation:

```bash
# From the repository root (with virtualenv activated):
python -m unittest backend/test_backend.py

# Or from within the backend directory:
cd backend
python -m unittest test_backend.py
```

---

## API Reference

### Health Check
- **Endpoint**: `GET /api/health`
- **Response**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-01T12:00:00.000000"
  }
  ```

### Fetch & Parse Performance Data
- **Endpoint**: `GET /api/fetch-data`
- **Query Parameters**:
  - `url` *(optional, string)*: Public Google Sheets URL. If omitted or empty, returns simulated demo data.
- **Example Requests**:
  - Demo data: `GET /api/fetch-data`
  - Real Sheet: `GET /api/fetch-data?url=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit#gid=0`
- **Response Structure**:
  ```json
  {
    "success": true,
    "is_demo": false,
    "data": {
      "kpi": {
        "total_spend": 125000.50,
        "total_impressions": 1850000,
        "total_reach": 940000,
        "total_clicks": 35200,
        "avg_ctr": 1.9,
        "avg_cpc": 3.55,
        "avg_cpm": 67.56,
        "total_conversions": 1420
      },
      "campaigns": [...],
      "timeline": [...],
      "demographics": [...]
    }
  }
  ```

---

## Configuration & Environment Variables

| Variable | Scope | Description | Default |
| :--- | :--- | :--- | :--- |
| `PORT` | Backend | Port number for Uvicorn / Docker container | `8000` |
| `VITE_API_URL` | Frontend | Target backend base URL for API queries | `http://localhost:8000` |

To override `VITE_API_URL` for local development or production, create a `.env.local` inside `frontend/`:
```bash
VITE_API_URL=https://your-deployed-backend-api.com
```

---

## Deployment

### Frontend (Netlify)
`netlify.toml` is pre-configured for automated Netlify builds:
- **Build command**: `cd frontend && npm install && npm run build`
- **Publish directory**: `frontend/dist`
- **Redirects**: Single-page application fallback to `/index.html`
- Set `VITE_API_URL` in the Netlify site settings to point to your live backend.
