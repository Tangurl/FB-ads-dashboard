import re
import io
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def parse_google_sheet_url(url: str) -> str:
    """
    Extracts the spreadsheet ID and gid from a Google Sheets URL and formats it
    as a direct CSV export URL.
    """
    # Look for spreadsheet ID: /d/[SPREADSHEET_ID]/
    match_id = re.search(r'/d/([a-zA-Z0-9-_]+)', url)
    if not match_id:
        raise ValueError("Invalid Google Sheets URL format. Could not extract spreadsheet ID.")
    
    spreadsheet_id = match_id.group(1)
    
    # Look for gid parameter (sheet index)
    match_gid = re.search(r'gid=(\d+)', url)
    
    if match_gid:
        gid = match_gid.group(1)
        return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid={gid}"
    else:
        return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv"

def clean_numeric(val):
    """Cleans currency, percentage, and formatting symbols from a value and returns a float."""
    if pd.isna(val) or val == "" or val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    
    # Clean non-numeric characters but keep digits, periods, commas, and minus signs
    val_str = str(val).strip()
    val_str = re.sub(r'[^\d\.,\-]', '', val_str)
    
    if not val_str:
        return 0.0
        
    # Standardize thousands and decimal separators
    if ',' in val_str and '.' in val_str:
        comma_idx = val_str.find(',')
        dot_idx = val_str.find('.')
        if comma_idx < dot_idx:
            # Comma is thousands, dot is decimal (US style: 1,234.56)
            val_str = val_str.replace(',', '')
        else:
            # Dot is thousands, comma is decimal (European style: 1.234,56)
            val_str = val_str.replace('.', '').replace(',', '.')
    elif ',' in val_str:
        # If there's a single comma followed by exactly 2 digits, treat as decimal (e.g. 123,45)
        # Otherwise, treat as thousands separator (e.g. 10,000)
        parts = val_str.split(',')
        if len(parts) == 2 and len(parts[1]) == 2:
            val_str = val_str.replace(',', '.')
        else:
            val_str = val_str.replace(',', '')
    elif '.' in val_str:
        # If there are multiple dots, treat them as thousands separators (e.g. 1.000.000)
        if val_str.count('.') > 1:
            val_str = val_str.replace('.', '')
            
    try:
        return float(val_str)
    except ValueError:
        return 0.0

def infer_platform_and_placement(df: pd.DataFrame, col_mapping: dict) -> tuple:
    """
    Infers platform and placement from text columns (Campaign Name, Ad Set Name, Page Name)
    if they are not explicitly present.
    """
    inferred_platforms = []
    inferred_placements = []
    
    # Identify text columns if they exist
    adset_col = None
    page_col = None
    for col in df.columns:
        col_lower = col.lower().strip()
        if col_lower in ['ad set name', 'adset name', 'adset']:
            adset_col = col
        elif col_lower in ['page name', 'pagename', 'page']:
            page_col = col
            
    campaign_col = col_mapping.get('campaign')
    
    for idx, row in df.iterrows():
        campaign_val = str(row[campaign_col]).lower() if campaign_col else ''
        adset_val = str(row[adset_col]).lower() if adset_col is not None else ''
        page_val = str(row[page_col]).lower() if page_col is not None else ''
        
        combined = f"{campaign_val} {adset_val} {page_val}"
        
        # 1. Platform Inference
        if 'instagram' in combined or 'ig' in combined.split() or any(k in combined for k in ['_ig_', 'ig-', '-ig', '/ig']):
            platform = 'Instagram'
        elif 'messenger' in combined or 'messenger' in combined.split() or 'msg' in combined:
            platform = 'Messenger'
        elif 'audience network' in combined or 'audience_network' in combined:
            platform = 'Audience Network'
        elif 'facebook' in combined or 'fb' in combined.split() or any(k in combined for k in ['_fb_', 'fb-', '-fb', '/fb']):
            platform = 'Facebook'
        else:
            platform = 'Facebook'
        inferred_platforms.append(platform)
        
        # 2. Placement Inference
        if 'reel' in combined:
            placement = 'Stories & Reels'
        elif 'story' in combined or 'stories' in combined:
            placement = 'Stories & Reels'
        elif 'feed' in combined:
            placement = 'Feeds'
        elif 'inbox' in combined:
            placement = 'Inbox / Chats'
        elif 'banner' in combined or 'native' in combined:
            placement = 'Native & Banner'
        else:
            placement = 'Feeds'
        inferred_placements.append(placement)
        
    return inferred_platforms, inferred_placements

def map_and_clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Identifies column names using typical aliases and maps them to normalized names.
    Also cleans the data values.
    """
    aliases = {
        'date': ['date', 'day', 'reporting starts', 'reporting date', 'time'],
        'campaign': ['campaign', 'campaign name', 'campaign_name', 'campaigns'],
        'spend': ['spend', 'amount spent', 'amount spent (usd)', 'amount spent (thb)', 'cost', 'spend (usd)', 'spent'],
        'impressions': ['impressions', 'impr', 'impr.', 'views'],
        'clicks': ['clicks', 'link clicks', 'clicks (all)', 'link clicks count', 'total clicks'],
        'conversions': ['conversions', 'results', 'purchases', 'leads', 'conversions count', 'purchases count', 'transactions'],
        'revenue': ['revenue', 'purchase value', 'value', 'conversion value', 'sales', 'sales value'],
        'campaign_start': ['starts', 'start date', 'start_date', 'start'],
        'campaign_end': ['ends', 'end date', 'end_date', 'end'],
        'campaign_id': ['campaign id', 'campaign_id', 'id'],
        'platform': ['platform', 'publisher platform', 'publisher_platform', 'platforms', 'platform device'],
        'placement': ['placement', 'placement & device', 'placements', 'device', 'placement name'],
        'age': ['age', 'age group', 'age_range', 'ages'],
        'gender': ['gender', 'sex', 'genders'],
        'reach': ['reach', 'unique impressions', 'unique views', 'unique_impressions', 'total reach']
    }
    
    mapped_df = pd.DataFrame()
    col_mapping = {}
    
    # Normalize original columns for matching
    orig_cols = {col.lower().replace('_', '').replace(' ', '').replace('-', ''): col for col in df.columns}
    
    for standard_name, alias_list in aliases.items():
        found = False
        for alias in alias_list:
            alias_norm = alias.lower().replace('_', '').replace(' ', '').replace('-', '')
            if alias_norm in orig_cols:
                original_col_name = orig_cols[alias_norm]
                col_mapping[standard_name] = original_col_name
                found = True
                break
        
        # If not found, check if any column contains the alias word
        if not found:
            for col in df.columns:
                col_lower = col.lower()
                for alias in alias_list:
                    if alias in col_lower and standard_name not in col_mapping:
                        col_mapping[standard_name] = col
                        found = True
                        break
                if found:
                    break
                    
    # Build the cleaned dataframe
    # 1. Campaign column
    if 'campaign' in col_mapping:
        mapped_df['campaign'] = df[col_mapping['campaign']].astype(str).fillna('Unknown Campaign')
    else:
        mapped_df['campaign'] = 'All Campaigns'
        
    # 1.1 Campaign ID column
    if 'campaign_id' in col_mapping:
        mapped_df['campaign_id'] = df[col_mapping['campaign_id']].astype(str).fillna('-')
    else:
        mapped_df['campaign_id'] = '-'
        
    # 2. Date column
    if 'date' in col_mapping:
        # Convert date to standard string format
        mapped_df['date'] = pd.to_datetime(df[col_mapping['date']], errors='coerce').dt.strftime('%Y-%m-%d')
        # Fill missing dates with current date
        mapped_df['date'] = mapped_df['date'].fillna(datetime.now().strftime('%Y-%m-%d'))
    else:
        mapped_df['date'] = datetime.now().strftime('%Y-%m-%d')
        
    # 3. Campaign scheduling dates
    if 'campaign_start' in col_mapping:
        mapped_df['campaign_start'] = pd.to_datetime(df[col_mapping['campaign_start']], errors='coerce').dt.strftime('%Y-%m-%d')
        mapped_df['campaign_start'] = mapped_df['campaign_start'].fillna(mapped_df['date'])
    else:
        mapped_df['campaign_start'] = mapped_df['date']
        
    if 'campaign_end' in col_mapping:
        mapped_df['campaign_end'] = pd.to_datetime(df[col_mapping['campaign_end']], errors='coerce').dt.strftime('%Y-%m-%d')
        mapped_df['campaign_end'] = mapped_df['campaign_end'].fillna(mapped_df['date'])
    else:
        mapped_df['campaign_end'] = mapped_df['date']

    # 4. Numeric columns
    numeric_cols = ['spend', 'impressions', 'clicks', 'conversions', 'revenue', 'reach']
    for col in numeric_cols:
        if col in col_mapping:
            mapped_df[col] = df[col_mapping[col]].apply(clean_numeric)
        else:
            mapped_df[col] = 0.0

    # 5. Platform and Placement columns
    if 'platform' in col_mapping:
        mapped_df['platform'] = df[col_mapping['platform']].astype(str).fillna('Unknown Platform')
    else:
        inferred_platforms, _ = infer_platform_and_placement(df, col_mapping)
        mapped_df['platform'] = inferred_platforms
        
    if 'placement' in col_mapping:
        mapped_df['placement'] = df[col_mapping['placement']].astype(str).fillna('Unknown Placement')
    else:
        _, inferred_placements = infer_platform_and_placement(df, col_mapping)
        mapped_df['placement'] = inferred_placements

    # 6. Page Name column
    page_col = None
    for col in df.columns:
        col_lower = col.lower().strip()
        if col_lower in ['page name', 'pagename', 'page', 'page_name']:
            page_col = col
            break
            
    if page_col:
        mapped_df['page_name'] = df[page_col].astype(str).fillna('Unknown Page')
    else:
        mapped_df['page_name'] = 'Unknown Page'
            
    # 7. Age column
    if 'age' in col_mapping:
        mapped_df['age'] = df[col_mapping['age']].astype(str).fillna('Unknown Age')
    else:
        age_col = None
        for col in df.columns:
            col_lower = col.lower().strip()
            if col_lower in ['age', 'age group', 'age_range', 'ages']:
                age_col = col
                break
        if age_col:
            mapped_df['age'] = df[age_col].astype(str).fillna('Unknown Age')
        else:
            mapped_df['age'] = 'Unknown Age'

    # 8. Gender column
    if 'gender' in col_mapping:
        mapped_df['gender'] = df[col_mapping['gender']].astype(str).fillna('Unknown Gender')
    else:
        gender_col = None
        for col in df.columns:
            col_lower = col.lower().strip()
            if col_lower in ['gender', 'sex', 'genders']:
                gender_col = col
                break
        if gender_col:
            mapped_df['gender'] = df[gender_col].astype(str).fillna('Unknown Gender')
        else:
            mapped_df['gender'] = 'Unknown Gender'
            
    # Calculate derived metrics row-by-row where needed
    mapped_df['ctr'] = np.where(mapped_df['impressions'] > 0, mapped_df['clicks'] / mapped_df['impressions'], 0.0)
    mapped_df['cpc'] = np.where(mapped_df['clicks'] > 0, mapped_df['spend'] / mapped_df['clicks'], 0.0)
    mapped_df['cpa'] = np.where(mapped_df['conversions'] > 0, mapped_df['spend'] / mapped_df['conversions'], 0.0)
    mapped_df['roas'] = np.where(mapped_df['spend'] > 0, mapped_df['revenue'] / mapped_df['spend'], 0.0)
    mapped_df['cpm'] = np.where(mapped_df['impressions'] > 0, (mapped_df['spend'] / mapped_df['impressions']) * 1000, 0.0)
    
    return mapped_df

def aggregate_dashboard_data(df: pd.DataFrame) -> dict:
    """
    Takes a cleaned DataFrame and generates aggregated dashboard metrics,
    including summary KPIs, daily trends, and campaign-level breakdowns.
    """
    # Ensure scheduling columns and ID exist in df (fallback for synthetic/get_demo_data)
    if 'campaign_start' not in df.columns:
        df['campaign_start'] = df['date']
    if 'campaign_end' not in df.columns:
        df['campaign_end'] = df['date']
    if 'campaign_id' not in df.columns:
        df['campaign_id'] = '-'

    # 1. Overall Summary
    total_spend = float(df['spend'].sum())
    total_impressions = int(df['impressions'].sum())
    total_clicks = int(df['clicks'].sum())
    total_conversions = int(df['conversions'].sum())
    total_revenue = float(df['revenue'].sum())
    total_reach = int(df['reach'].sum())
    
    overall_ctr = float(total_clicks / total_impressions) if total_impressions > 0 else 0.0
    overall_cpc = float(total_spend / total_clicks) if total_clicks > 0 else 0.0
    overall_cpa = float(total_spend / total_conversions) if total_conversions > 0 else 0.0
    overall_roas = float(total_revenue / total_spend) if total_spend > 0 else 0.0
    overall_cpm = float(total_spend / total_impressions) * 1000 if total_impressions > 0 else 0.0
    
    summary = {
        'total_spend': total_spend,
        'total_impressions': total_impressions,
        'total_clicks': total_clicks,
        'total_conversions': total_conversions,
        'total_revenue': total_revenue,
        'total_reach': total_reach,
        'ctr': overall_ctr,
        'cpc': overall_cpc,
        'cpa': overall_cpa,
        'roas': overall_roas,
        'cpm': overall_cpm
    }
    
    # 2. Daily Trends (Time Series)
    daily_grouped = df.groupby('date').agg({
        'spend': 'sum',
        'impressions': 'sum',
        'clicks': 'sum',
        'conversions': 'sum',
        'revenue': 'sum',
        'reach': 'sum'
    }).reset_index()
    
    # Fill in derived daily metrics
    daily_grouped['ctr'] = np.where(daily_grouped['impressions'] > 0, daily_grouped['clicks'] / daily_grouped['impressions'], 0.0)
    daily_grouped['cpc'] = np.where(daily_grouped['clicks'] > 0, daily_grouped['spend'] / daily_grouped['clicks'], 0.0)
    daily_grouped['cpa'] = np.where(daily_grouped['conversions'] > 0, daily_grouped['spend'] / daily_grouped['conversions'], 0.0)
    daily_grouped['roas'] = np.where(daily_grouped['spend'] > 0, daily_grouped['revenue'] / daily_grouped['spend'], 0.0)
    daily_grouped['cpm'] = np.where(daily_grouped['impressions'] > 0, (daily_grouped['spend'] / daily_grouped['impressions']) * 1000, 0.0)
    
    # Sort dates chronologically
    daily_grouped = daily_grouped.sort_values('date')
    daily_trends = daily_grouped.to_dict(orient='records')
    
    # 3. Campaign Performance
    campaign_grouped = df.groupby('campaign').agg({
        'spend': 'sum',
        'impressions': 'sum',
        'clicks': 'sum',
        'conversions': 'sum',
        'revenue': 'sum',
        'reach': 'sum',
        'campaign_start': 'min',
        'campaign_end': 'max',
        'campaign_id': 'first'
    }).reset_index()
    
    campaign_grouped['ctr'] = np.where(campaign_grouped['impressions'] > 0, campaign_grouped['clicks'] / campaign_grouped['impressions'], 0.0)
    campaign_grouped['cpc'] = np.where(campaign_grouped['clicks'] > 0, campaign_grouped['spend'] / campaign_grouped['clicks'], 0.0)
    campaign_grouped['cpa'] = np.where(campaign_grouped['conversions'] > 0, campaign_grouped['spend'] / campaign_grouped['conversions'], 0.0)
    campaign_grouped['roas'] = np.where(campaign_grouped['spend'] > 0, campaign_grouped['revenue'] / campaign_grouped['spend'], 0.0)
    campaign_grouped['cpm'] = np.where(campaign_grouped['impressions'] > 0, (campaign_grouped['spend'] / campaign_grouped['impressions']) * 1000, 0.0)
    
    # Sort campaigns by spend descending
    campaign_grouped = campaign_grouped.sort_values('spend', ascending=False)
    campaigns = campaign_grouped.to_dict(orient='records')
    
    # 4. Raw Cleaned Records
    records = df.to_dict(orient='records')
    
    # 5. Platform Breakdown
    platform_breakdown = []
    if 'platform' in df.columns:
        real_platforms = df[df['platform'] != 'Unknown Platform']
        if not real_platforms.empty:
            platform_grouped = df.groupby('platform').agg({
                'spend': 'sum',
                'impressions': 'sum',
                'clicks': 'sum',
                'conversions': 'sum',
                'revenue': 'sum'
            }).reset_index()
            # Calculate CTR, ROAS, and CPM for platforms
            platform_grouped['ctr'] = np.where(platform_grouped['impressions'] > 0, platform_grouped['clicks'] / platform_grouped['impressions'], 0.0)
            platform_grouped['roas'] = np.where(platform_grouped['spend'] > 0, platform_grouped['revenue'] / platform_grouped['spend'], 0.0)
            platform_grouped['cpm'] = np.where(platform_grouped['impressions'] > 0, (platform_grouped['spend'] / platform_grouped['impressions']) * 1000, 0.0)
            platform_grouped = platform_grouped.sort_values('spend', ascending=False)
            platform_breakdown = platform_grouped.to_dict(orient='records')
            
    # 6. Placement Breakdown
    placement_breakdown = []
    if 'placement' in df.columns:
        real_placements = df[df['placement'] != 'Unknown Placement']
        if not real_placements.empty:
            placement_grouped = df.groupby('placement').agg({
                'spend': 'sum',
                'impressions': 'sum',
                'clicks': 'sum',
                'conversions': 'sum',
                'revenue': 'sum'
            }).reset_index()
            # Calculate CTR, ROAS, and CPM for placements
            placement_grouped['ctr'] = np.where(placement_grouped['impressions'] > 0, placement_grouped['clicks'] / placement_grouped['impressions'], 0.0)
            placement_grouped['roas'] = np.where(placement_grouped['spend'] > 0, placement_grouped['revenue'] / placement_grouped['spend'], 0.0)
            placement_grouped['cpm'] = np.where(placement_grouped['impressions'] > 0, (placement_grouped['spend'] / placement_grouped['impressions']) * 1000, 0.0)
            placement_grouped = placement_grouped.sort_values('spend', ascending=False)
            placement_breakdown = placement_grouped.to_dict(orient='records')
            
    # 7. Demographics Breakdown
    demographics = []
    if 'age' in df.columns and 'gender' in df.columns:
        # Group by age and gender
        demo_grouped = df.groupby(['age', 'gender']).agg({
            'impressions': 'sum'
        }).reset_index()
        demo_grouped['gender'] = demo_grouped['gender'].astype(str).str.title()
        demo_grouped['age'] = demo_grouped['age'].astype(str)
        demographics = demo_grouped.to_dict(orient='records')
        
    return {
        'summary': summary,
        'daily_trends': daily_trends,
        'campaigns': campaigns,
        'platform_breakdown': platform_breakdown,
        'placement_breakdown': placement_breakdown,
        'records': records,
        'demographics': demographics
    }

def get_demo_data() -> dict:
    """Generates a realistic mock dataset for Facebook Ads."""
    np.random.seed(42)
    end_date = datetime.now()
    dates = [(end_date - timedelta(days=i)).strftime('%Y-%m-%d') for i in range(30)]
    dates.reverse()
    
    campaign_profiles = [
        {'name': 'Prospecting - Lookalike 1-5% - US', 'base_spend': 120, 'cpc': 1.10, 'conv_rate': 0.022, 'margin': 1.8},
        {'name': 'Prospecting - Broad Targeting - US/CA', 'base_spend': 80, 'cpc': 0.90, 'conv_rate': 0.015, 'margin': 1.2},
        {'name': 'Retargeting - Dynamic Product Ads', 'base_spend': 50, 'cpc': 1.40, 'conv_rate': 0.065, 'margin': 4.2},
        {'name': 'Prospecting - Interests - US Only', 'base_spend': 65, 'cpc': 1.05, 'conv_rate': 0.018, 'margin': 1.4},
        {'name': 'Retargeting - Add to Cart Abandoners', 'base_spend': 30, 'cpc': 1.60, 'conv_rate': 0.080, 'margin': 5.5},
        {'name': 'Brand Awareness - Video Views - Global', 'base_spend': 25, 'cpc': 0.45, 'conv_rate': 0.003, 'margin': 0.3},
    ]
    
    rows = []
    
    # Generate data day by day for each campaign
    for dt in dates:
        # Add some day-of-week seasonality (higher spend/conversions on weekends)
        day_of_week = datetime.strptime(dt, '%Y-%m-%d').weekday()
        seasonality = 1.25 if day_of_week in [4, 5, 6] else 0.9  # Fri-Sun are higher
        
        for profile in campaign_profiles:
            # Add some randomness to daily spend
            spend = float(np.random.normal(profile['base_spend'] * seasonality, profile['base_spend'] * 0.15))
            spend = max(spend, 5.0)  # Spend can't be negative
            
            # Clicks depend on spend and cpc
            cpc_variation = np.random.normal(profile['cpc'], profile['cpc'] * 0.08)
            clicks = int(spend / max(cpc_variation, 0.10))
            
            # Impressions depend on clicks and a standard CTR range (e.g. 1.0% to 2.5%)
            ctr = np.random.uniform(0.010, 0.028) if 'Video' not in profile['name'] else np.random.uniform(0.040, 0.080)
            impressions = int(clicks / ctr) if ctr > 0 else clicks * 50
            
            # Conversions depend on clicks and conversion rate
            conv_rate_var = np.random.normal(profile['conv_rate'], profile['conv_rate'] * 0.12)
            conversions = int(clicks * max(conv_rate_var, 0.001))
            
            # Revenue is conversions * average order value (e.g. $65) * margin multiplier
            aov = 65.0
            revenue = conversions * aov * profile['margin']
            # Add some noise to revenue
            if conversions > 0:
                revenue += float(np.random.normal(0, conversions * 10))
                revenue = max(revenue, 0.0)
            else:
                revenue = 0.0
                
            # Split this day's metrics among platforms/placements to create realistic breakdowns
            allocations = [
                {'platform': 'Facebook', 'placement': 'Feeds', 'pct': 0.40},
                {'platform': 'Facebook', 'placement': 'Stories & Reels', 'pct': 0.15},
                {'platform': 'Instagram', 'placement': 'Feeds', 'pct': 0.12},
                {'platform': 'Instagram', 'placement': 'Stories & Reels', 'pct': 0.28},
                {'platform': 'Messenger', 'placement': 'Inbox / Chats', 'pct': 0.03},
                {'platform': 'Audience Network', 'placement': 'Native & Banner', 'pct': 0.02},
            ]
            
            for alloc in allocations:
                alloc_spend = spend * alloc['pct']
                alloc_clicks = int(clicks * alloc['pct'])
                alloc_impressions = int(impressions * alloc['pct'])
                alloc_conversions = int(conversions * alloc['pct'])
                alloc_revenue = revenue * alloc['pct']
                
                # Mock page names based on platform
                page_name = "ThaiPBS Main Page"
                if alloc['platform'] == 'Instagram':
                    page_name = "ThaiPBS Instagram Profile"
                elif alloc['platform'] == 'Messenger':
                    page_name = "ThaiPBS Messenger Page"
                
                # realistic demographic distribution
                age_groups = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+']
                genders = ['Female', 'Male', 'Unknown']
                age_val = np.random.choice(age_groups, p=[0.15, 0.35, 0.25, 0.15, 0.07, 0.03])
                gender_val = np.random.choice(genders, p=[0.52, 0.45, 0.03])

                rows.append({
                    'date': dt,
                    'campaign': profile['name'],
                    'spend': round(alloc_spend, 2),
                    'impressions': alloc_impressions,
                    'clicks': alloc_clicks,
                    'conversions': alloc_conversions,
                    'revenue': round(alloc_revenue, 2),
                    'reach': int(alloc_impressions / np.random.uniform(1.2, 1.5)) if alloc_impressions > 0 else 0,
                    'platform': alloc['platform'],
                    'placement': alloc['placement'],
                    'page_name': page_name,
                    'age': age_val,
                    'gender': gender_val
                })
            
    df = pd.DataFrame(rows)
    return aggregate_dashboard_data(df)

def fetch_and_parse_sheet(url: str) -> dict:
    """
    Downloads spreadsheet data from a Google Sheets URL,
    cleans, standardizes it, and returns the dashboard payload.
    """
    try:
        csv_url = parse_google_sheet_url(url)
    except Exception as e:
        raise ValueError(f"Failed to parse URL: {str(e)}")
        
    try:
        # Set user agent to avoid bot blocking
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'}
        response = requests.get(csv_url, headers=headers, timeout=15)
        response.raise_for_status()
    except Exception as e:
        raise ConnectionError(f"Failed to download spreadsheet data: {str(e)}. Please check your sharing permissions. Make sure the Google Sheet's General Access is set to 'Anyone with the link' (Viewer mode) so the dashboard can download it.")
        
    try:
        # Load string content into Pandas DataFrame
        csv_data = response.content.decode('utf-8')
        df = pd.read_csv(io.StringIO(csv_data))
    except Exception as e:
        raise ValueError(f"Failed to decode CSV data: {str(e)}")
        
    if df.empty:
        raise ValueError("The provided spreadsheet contains no data.")
        
    cleaned_df = map_and_clean_columns(df)
    return aggregate_dashboard_data(cleaned_df)
