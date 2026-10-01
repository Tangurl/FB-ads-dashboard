import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# Import data parsing logic
try:
    from data_parser import fetch_and_parse_sheet, get_demo_data
except ImportError:
    from backend.data_parser import fetch_and_parse_sheet, get_demo_data

app = FastAPI(
    title="Facebook Ads Performance API",
    description="Backend API to fetch, parse, and aggregate Facebook Ads spreadsheet performance data.",
    version="1.0.0"
)

# Configure CORS to allow frontend communication
# In production, we'd limit this to specific origins, but for developer-friendliness we allow wildcard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/fetch-data")
async def fetch_data(url: str = Query(None, description="The public Google Sheet sharing URL")):
    # If no URL is provided, return mock demo data for instant dashboard visualization
    if not url or url.strip() == "":
        try:
            demo_payload = get_demo_data()
            return {
                "success": True,
                "is_demo": True,
                "data": demo_payload
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate demo data: {str(e)}"
            )

    # Fetch and parse the provided spreadsheet
    try:
        payload = fetch_and_parse_sheet(url.strip())
        return {
            "success": True,
            "is_demo": False,
            "data": payload
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except ConnectionError as ce:
        raise HTTPException(status_code=502, detail=str(ce))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred while parsing the spreadsheet: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    # Allow port override through environment variables (standard for hosting)
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
