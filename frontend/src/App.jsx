import React, { useState, useEffect } from 'react';
import thaiPbsLogo from './assets/thai_pbs_logo.png';
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Percent, 
  BarChart2, 
  Settings, 
  RefreshCw, 
  Play, 
  AlertCircle, 
  X, 
  Layers, 
  ArrowRight,
  TrendingDown,
  Activity,
  Eye,
  MousePointerClick,
  Users
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  LineChart,
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  Cell,
  CartesianGrid,
  ReferenceLine,
  PieChart,
  Pie
} from 'recharts';

import KPICard from './components/KPICard';
import CampaignTable, { getCampaignRowId } from './components/CampaignTable';
import DemographicsTable from './components/DemographicsTable';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Colors for Recharts (Facebook Brand Palettes)
const COLOR_SPEND = '#1877f2';      // Facebook Blue
const COLOR_IMPRESSIONS = '#b1892b';  // Impressions Purple
const COLOR_CONVERSIONS = '#45bd62';  // Facebook Green
const COLOR_REVENUE = '#f7b928';      // Facebook Gold/Yellow
const COLOR_CPM = '#8b5cf6';          // CPM Purple

const COLORS_PLATFORM = {
  'Facebook': '#1877f2',
  'Instagram': '#e1306c',
  'Messenger': '#00b2ff',
  'Audience Network': '#31a24c',
  'Others': '#8d949e'
};

const COLORS_PLACEMENT = [
  '#0064e0', // Rich Blue
  '#00a400', // Rich Green
  '#f5a623', // Amber/Gold
  '#7f2eff', // Royal Purple
  '#fa3e3e', // Soft Red
  '#00b2ff'  // Light Blue
];

const COLORS_DEFAULT = [
  '#0064e0', '#00a400', '#f5a623', '#7f2eff', '#fa3e3e', '#00b2ff'
];

export default function App() {
  const [rawPayload, setRawPayload] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateMetric, setDateMetric] = useState('campaign_start');
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDemo, setIsDemo] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [chartMetric, setChartMetric] = useState('spend_conv'); // 'spend_conv', 'clicks_impr'
  const [useMovingAverage, setUseMovingAverage] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedPage, setSelectedPage] = useState('all');
  const [compareMetric, setCompareMetric] = useState('spend');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  


  const loadData = async (urlToFetch = '') => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = urlToFetch 
        ? `${API_BASE}/api/fetch-data?url=${encodeURIComponent(urlToFetch)}`
        : `${API_BASE}/api/fetch-data`;
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (code ${response.status})`);
      }
      
      const resData = await response.json();
      if (resData.success) {
        setRawPayload(resData.data);
        setIsDemo(resData.is_demo);
        setStartDate('');
        setEndDate('');
        setDateMetric('campaign_start');
        setSelectedPlatform('all');
        setSelectedPage('all');
        setCampaignSearch('');
        setSelectedCampaign(null);
        if (!resData.is_demo) {
          // Save valid URL to localStorage
          localStorage.setItem('fb_ads_sheet_url', urlToFetch);
        }
      } else {
        throw new Error("Failed to parse response successfully.");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not connect to the API. Make sure the backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Attempt to load from localStorage url first
    const savedUrl = localStorage.getItem('fb_ads_sheet_url');
    if (savedUrl) {
      setSheetUrl(savedUrl);
      loadData(savedUrl);
    } else {
      loadData(); // Load demo data
    }
  }, []);

  // Auto-initialize selected dates to sheet bounds when loaded or dimension toggled
  useEffect(() => {
    if (!rawPayload || !rawPayload.records || rawPayload.records.length === 0) {
      setStartDate('');
      setEndDate('');
      return;
    }
    const dateField = dateMetric === 'campaign_start' ? 'campaign_start' : 'date';
    const dates = rawPayload.records
      .map(r => r[dateField])
      .filter(Boolean)
      .sort();
    
    if (dates.length > 0) {
      setStartDate(dates[0]);
      setEndDate(dates[dates.length - 1]);
    }
  }, [rawPayload, dateMetric]);

  const handleResetDates = () => {
    if (!rawPayload || !rawPayload.records || rawPayload.records.length === 0) return;
    const dateField = dateMetric === 'campaign_start' ? 'campaign_start' : 'date';
    const dates = rawPayload.records.map(r => r[dateField]).filter(Boolean).sort();
    if (dates.length > 0) {
      setStartDate(dates[0]);
      setEndDate(dates[dates.length - 1]);
    }
  };

  const handleConnectSheet = (e) => {
    e.preventDefault();
    const trimmedUrl = sheetUrl.trim();
    setSheetUrl(trimmedUrl);
    setShowSettings(false);
    loadData(trimmedUrl);
  };

  const handleLoadDemo = () => {
    setSheetUrl('');
    localStorage.removeItem('fb_ads_sheet_url');
    loadData('');
  };

  const formatCurrency = (val, decimals = 0) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: decimals }).format(val);
  };

  const formatNumber = (val) => {
    return new Intl.NumberFormat('en-US').format(Math.round(val));
  };

  // Calculate date range bounds from raw payload
  const dateBounds = React.useMemo(() => {
    if (!rawPayload || !rawPayload.records || rawPayload.records.length === 0) {
      return { min: '', max: '' };
    }
    const dateField = dateMetric === 'campaign_start' ? 'campaign_start' : 'date';
    const dates = rawPayload.records
      .map(r => r[dateField])
      .filter(Boolean)
      .sort();
    
    if (dates.length === 0) return { min: '', max: '' };
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [rawPayload, dateMetric]);

  // Dynamically compute filtered stats and trends
  const data = React.useMemo(() => {
    if (!rawPayload) return null;
    const records = rawPayload.records || [];
    if (records.length === 0) {
      return {
        summary: rawPayload.summary,
        daily_trends: rawPayload.daily_trends,
        campaigns: rawPayload.campaigns,
        campaignsCount: 0,
        platformBreakdown: [],
        placementBreakdown: [],
        platformComparisonData: [],
        hasPlatformData: false,
        hasPlacementData: false
      };
    }

    const dateField = dateMetric === 'campaign_start' ? 'campaign_start' : 'date';
 
    // 0. Filter records by campaign name search query first
    const searchFiltered = records.filter(r => {
      if (campaignSearch && campaignSearch.trim() !== '') {
        const query = campaignSearch.toLowerCase().trim();
        const campaignName = (r.campaign || '').toLowerCase();
        return campaignName.includes(query);
      }
      return true;
    });

    // 1. Filter records by date first (for platform/placement/page distributions)
    const dateFiltered = searchFiltered.filter(r => {
      const d = r[dateField];
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });

    if (dateFiltered.length === 0) {
      return {
        summary: { total_spend: 0, total_impressions: 0, total_clicks: 0, total_conversions: 0, total_revenue: 0, ctr: 0, cpc: 0, cpa: 0, cpm: 0 },
        daily_trends: [],
        campaigns: [],
        platformBreakdown: [],
        placementBreakdown: [],
        platformComparisonData: [],
        hasPlatformData: false,
        hasPlacementData: false,
        campaignsCount: 0
      };
    }

    // 2. Filter by selected platform & page name (base filters)
    const baseFiltered = dateFiltered.filter(r => {
      if (selectedPlatform && selectedPlatform !== 'all') {
        if (r.platform !== selectedPlatform) return false;
      }
      if (selectedPage && selectedPage !== 'all') {
        if (r.page_name !== selectedPage) return false;
      }
      return true;
    });
 
    // 3. Filter by selected campaign (applies to charts/KPIs, but NOT table rows)
    const filtered = baseFiltered.filter(r => {
      if (selectedCampaign) {
        return r.campaign === selectedCampaign;
      }
      return true;
    });

    // Table rows aggregate from baseFiltered to retain all rows
    const tableFiltered = baseFiltered;

    // Summary metrics
    const total_spend = filtered.reduce((sum, r) => sum + (r.spend || 0), 0);
    const total_impressions = filtered.reduce((sum, r) => sum + (r.impressions || 0), 0);
    const total_clicks = filtered.reduce((sum, r) => sum + (r.clicks || 0), 0);
    const total_conversions = filtered.reduce((sum, r) => sum + (r.conversions || 0), 0);
    const total_revenue = filtered.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const total_reach = filtered.reduce((sum, r) => sum + (r.reach || 0), 0);
 
    const summary = {
      total_spend,
      total_impressions,
      total_clicks,
      total_conversions,
      total_revenue,
      total_reach,
      ctr: total_impressions > 0 ? total_clicks / total_impressions : 0,
      cpc: total_clicks > 0 ? total_spend / total_clicks : 0,
      cpa: total_conversions > 0 ? total_spend / total_conversions : 0,
      cpm: total_impressions > 0 ? (total_spend / total_impressions) * 1000 : 0
    };

    // Aggregated Daily Trends
    const dailyMap = {};
    filtered.forEach(r => {
      const d = r[dateField];
      if (!dailyMap[d]) {
        dailyMap[d] = { date: d, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
      }
      dailyMap[d].spend += r.spend || 0;
      dailyMap[d].impressions += r.impressions || 0;
      dailyMap[d].clicks += r.clicks || 0;
      dailyMap[d].conversions += r.conversions || 0;
      dailyMap[d].revenue += r.revenue || 0;
    });

    const daily_trends = Object.values(dailyMap).map(d => {
      d.ctr = d.impressions > 0 ? d.clicks / d.impressions : 0;
      d.cpc = d.clicks > 0 ? d.spend / d.clicks : 0;
      d.cpa = d.conversions > 0 ? d.spend / d.conversions : 0;
      d.cpm = d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0;
      return d;
    }).sort((a, b) => a.date.localeCompare(b.date));

    // Aggregated Campaigns
    const campaignMap = {};
    tableFiltered.forEach(r => {
      const c = r.campaign || 'Unknown Campaign';
      if (!campaignMap[c]) {
        campaignMap[c] = { 
          campaign: c, 
          spend: 0, 
          impressions: 0, 
          clicks: 0, 
          conversions: 0, 
          revenue: 0,
          campaign_start: r.campaign_start || r.date,
          campaign_end: r.campaign_end || r.date,
          campaign_id: r.campaign_id || '-'
        };
      }
      campaignMap[c].spend += r.spend || 0;
      campaignMap[c].impressions += r.impressions || 0;
      campaignMap[c].clicks += r.clicks || 0;
      campaignMap[c].conversions += r.conversions || 0;
      campaignMap[c].revenue += r.revenue || 0;

      // Track the earliest start date and latest end date for the campaign
      if (r.campaign_start && r.campaign_start < campaignMap[c].campaign_start) {
        campaignMap[c].campaign_start = r.campaign_start;
      }
      if (r.campaign_end && r.campaign_end > campaignMap[c].campaign_end) {
        campaignMap[c].campaign_end = r.campaign_end;
      }
    });

    const campaigns = Object.values(campaignMap).map(c => {
      c.ctr = c.impressions > 0 ? c.clicks / c.impressions : 0;
      c.cpc = c.clicks > 0 ? c.spend / c.clicks : 0;
      c.cpa = c.conversions > 0 ? c.spend / c.conversions : 0;
      c.cpm = c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0;
      return c;
    }).sort((a, b) => b.spend - a.spend);

    // Aggregated Platforms (Date filtered only)
    const platformMap = {};
    dateFiltered.forEach(r => {
      if (r.platform && r.platform !== 'Unknown Platform') {
        const p = r.platform;
        if (!platformMap[p]) {
          platformMap[p] = { name: p, spend: 0, conversions: 0, clicks: 0, impressions: 0, revenue: 0 };
        }
        platformMap[p].spend += r.spend || 0;
        platformMap[p].conversions += r.conversions || 0;
        platformMap[p].clicks += r.clicks || 0;
        platformMap[p].impressions += r.impressions || 0;
        platformMap[p].revenue += r.revenue || 0;
      }
    });
    // Limit to Top 4 and group others
    const limitAndGroupOthers = (dataArray) => {
      if (dataArray.length <= 4) return dataArray;
      
      const top4 = dataArray.slice(0, 4);
      const remaining = dataArray.slice(4);
      
      const others = remaining.reduce((acc, curr) => {
        acc.spend += curr.spend || 0;
        acc.conversions += curr.conversions || 0;
        acc.clicks += curr.clicks || 0;
        acc.impressions += curr.impressions || 0;
        acc.revenue += curr.revenue || 0;
        return acc;
      }, { name: 'Others', spend: 0, conversions: 0, clicks: 0, impressions: 0, revenue: 0 });
      
      if (others.spend > 0) {
        return [...top4, others];
      }
      return top4;
    };

    const platformBreakdown = limitAndGroupOthers(Object.values(platformMap).sort((a, b) => b.spend - a.spend));

    const platformComparisonData = Object.values(platformMap).map(p => {
      return {
        ...p,
        ctr: p.impressions > 0 ? p.clicks / p.impressions : 0
      };
    }).sort((a, b) => b.spend - a.spend);

    // Aggregated Placements (Date filtered only)
    const placementMap = {};
    dateFiltered.forEach(r => {
      if (r.placement && r.placement !== 'Unknown Placement') {
        const pl = r.placement;
        if (!placementMap[pl]) {
          placementMap[pl] = { name: pl, spend: 0, conversions: 0, clicks: 0, impressions: 0, revenue: 0 };
        }
        placementMap[pl].spend += r.spend || 0;
        placementMap[pl].conversions += r.conversions || 0;
        placementMap[pl].clicks += r.clicks || 0;
        placementMap[pl].impressions += r.impressions || 0;
        placementMap[pl].revenue += r.revenue || 0;
      }
    });
    
    const placementBreakdown = limitAndGroupOthers(Object.values(placementMap).sort((a, b) => b.spend - a.spend));
    
    const hasPlatformData = platformBreakdown.length > 0;
    const hasPlacementData = placementBreakdown.length > 0;

    // Aggregated Page Names (Date filtered only)
    const pageMap = {};
    dateFiltered.forEach(r => {
      if (r.page_name && r.page_name.trim() !== '' && r.page_name !== 'Unknown Page') {
        const page = r.page_name;
        if (!pageMap[page]) {
          pageMap[page] = { name: page, spend: 0, conversions: 0, clicks: 0, impressions: 0, revenue: 0 };
        }
        pageMap[page].spend += r.spend || 0;
        pageMap[page].conversions += r.conversions || 0;
        pageMap[page].clicks += r.clicks || 0;
        pageMap[page].impressions += r.impressions || 0;
        pageMap[page].revenue += r.revenue || 0;
      }
    });

    const pageNameBreakdown = limitAndGroupOthers(Object.values(pageMap).sort((a, b) => b.spend - a.spend));
    const hasPageNameData = pageNameBreakdown.length > 0;

    // Aggregate demographics dynamically from filtered records
    const demoMap = {};
    let hasDemographicsData = false;

    filtered.forEach(r => {
      if (r.age && r.gender && r.age !== 'Unknown Age' && r.gender !== 'Unknown Gender') {
        const age = r.age;
        const gender = r.gender.charAt(0).toUpperCase() + r.gender.slice(1).toLowerCase();
        
        if (!demoMap[age]) {
          demoMap[age] = {};
        }
        if (!demoMap[age][gender]) {
          demoMap[age][gender] = 0;
        }
        demoMap[age][gender] += r.impressions || 0;
        hasDemographicsData = true;
      }
    });

    const demographics = [];
    Object.keys(demoMap).forEach(age => {
      Object.keys(demoMap[age]).forEach(gender => {
        demographics.push({
          age,
          gender,
          impressions: demoMap[age][gender]
        });
      });
    });

    return {
      summary,
      daily_trends,
      campaigns,
      platformBreakdown,
      placementBreakdown,
      pageNameBreakdown,
      platformComparisonData,
      hasPlatformData,
      hasPlacementData,
      hasPageNameData,
      hasClicksData: filtered.some(r => (r.clicks || 0) > 0),
      hasReachData: filtered.some(r => (r.reach || 0) > 0),
      campaignsCount: filtered.length,
      filteredRecords: filtered,
      demographics,
      hasDemographicsData
    };
  }, [rawPayload, startDate, endDate, dateMetric, selectedPlatform, selectedPage, campaignSearch, selectedCampaign]);

  // Check if active trend dates span more than 1 year to conditionally show the year
  const spansMoreThanOneYear = React.useMemo(() => {
    if (!data || !data.daily_trends || data.daily_trends.length < 2) return false;
    const dates = data.daily_trends.map(d => new Date(d.date).getTime()).filter(t => !isNaN(t));
    if (dates.length < 2) return false;
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const msInYear = 365.25 * 24 * 60 * 60 * 1000;
    return (maxDate - minDate) > msInYear;
  }, [data]);

  // Format date to th-TH locale (e.g. 10 มิ.ย., or 10 มิ.ย. 2025 if spans > 1 year)
  const formatChartDate = React.useCallback((dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      const options = {
        day: 'numeric',
        month: 'short',
        calendar: 'gregory',
        timeZone: 'UTC'
      };
      if (spansMoreThanOneYear) {
        options.year = 'numeric';
      }
      return new Intl.DateTimeFormat('th-TH', options).format(date);
    } catch (e) {
      return dateStr;
    }
  }, [spansMoreThanOneYear]);

  // Custom styled Tooltip matching glassmorphic design
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const title = formatChartDate(label || payload[0].name);
      return (
        <div className="glass-panel" style={{ padding: '0.75rem', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
          <p style={{ fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>{title}</p>
          {payload.map((item, idx) => {
            let val = item.value;
            const displayMetricName = label ? item.name : 'Spend';
            if (item.name.toLowerCase().includes('spend') || item.name.toLowerCase().includes('revenue') || item.name.toLowerCase().includes('cpa') || item.name.toLowerCase().includes('cpr') || item.name.toLowerCase().includes('cpc') || item.name.toLowerCase().includes('cpm') || !label) {
              val = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
            } else if (item.name.toLowerCase().includes('ctr')) {
              val = `${(val * 100).toFixed(2)}%`;
            } else {
              val = new Intl.NumberFormat('en-US').format(val);
            }
            return (
              <p key={idx} style={{ color: item.color || 'var(--primary)', display: 'flex', gap: '1rem', justifyContent: 'space-between', margin: '0.2rem 0' }}>
                <span>{displayMetricName}:</span>
                <span style={{ fontWeight: '600' }}>{val}</span>
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Extract all available platforms dynamically from raw records
  const availablePlatforms = React.useMemo(() => {
    if (!rawPayload || !rawPayload.records) return [];
    const platformsSet = new Set();
    rawPayload.records.forEach(r => {
      if (r.platform && r.platform !== 'Unknown Platform' && r.platform.trim() !== '') {
        platformsSet.add(r.platform);
      }
    });
    return Array.from(platformsSet).sort();
  }, [rawPayload]);

  // Extract all available pages dynamically from raw records
  const availablePages = React.useMemo(() => {
    if (!rawPayload || !rawPayload.records) return [];
    const pagesSet = new Set();
    rawPayload.records.forEach(r => {
      if (r.page_name && r.page_name !== 'Unknown Page' && r.page_name.trim() !== '') {
        pagesSet.add(r.page_name);
      }
    });
    return Array.from(pagesSet).sort();
  }, [rawPayload]);

  const chartData = React.useMemo(() => {
    if (!data || !data.daily_trends) return [];
    if (!useMovingAverage) return data.daily_trends;

    const trends = data.daily_trends;
    return trends.map((item, idx) => {
      const start = Math.max(0, idx - 6);
      const windowItems = trends.slice(start, idx + 1);
      const count = windowItems.length;

      const sumSpend = windowItems.reduce((s, x) => s + (x.spend || 0), 0);
      const sumImpressions = windowItems.reduce((s, x) => s + (x.impressions || 0), 0);
      const sumClicks = windowItems.reduce((s, x) => s + (x.clicks || 0), 0);
      const sumConversions = windowItems.reduce((s, x) => s + (x.conversions || 0), 0);
      const sumRevenue = windowItems.reduce((s, x) => s + (x.revenue || 0), 0);

      const avgSpend = sumSpend / count;
      const avgConversions = sumConversions / count;
      const avgImpressions = sumImpressions / count;
      const avgClicks = sumClicks / count;
      const avgRevenue = sumRevenue / count;

      return {
        date: item.date,
        spend: avgSpend,
        conversions: avgConversions,
        impressions: avgImpressions,
        clicks: avgClicks,
        revenue: avgRevenue,
        ctr: avgImpressions > 0 ? avgClicks / avgImpressions : 0,
        cpc: avgClicks > 0 ? avgSpend / avgClicks : 0,
        cpa: avgConversions > 0 ? avgSpend / avgConversions : 0,
        cpm: avgImpressions > 0 ? (avgSpend / avgImpressions) * 1000 : 0
      };
    });
  }, [data, useMovingAverage]);

  const averages = React.useMemo(() => {
    if (!data || !data.daily_trends || data.daily_trends.length === 0) {
      return { spend: 0, conversions: 0, clicks: 0, ctr: 0, impressions: 0, cpm: 0 };
    }
    const len = data.daily_trends.length;
    const totalSpend = data.daily_trends.reduce((sum, d) => sum + d.spend, 0);
    const totalConversions = data.daily_trends.reduce((sum, d) => sum + d.conversions, 0);
    const totalClicks = data.daily_trends.reduce((sum, d) => sum + d.clicks, 0);
    const totalCtr = data.daily_trends.reduce((sum, d) => sum + d.ctr, 0);
    const totalImpressions = data.daily_trends.reduce((sum, d) => sum + (d.impressions || 0), 0);
    const totalCpm = data.daily_trends.reduce((sum, d) => sum + (d.cpm || 0), 0);

    return {
      spend: totalSpend / len,
      conversions: totalConversions / len,
      clicks: totalClicks / len,
      ctr: totalCtr / len,
      impressions: totalImpressions / len,
      cpm: totalCpm / len
    };
  }, [data]);

  // Prepare horizontal bar chart data for top campaigns spend
  const topCampaignsData = data ? data.campaigns.slice(0, 5).map(c => ({
    name: c.campaign.length > 25 ? c.campaign.substring(0, 25) + '...' : c.campaign,
    fullName: c.campaign,
    spend: c.spend,
    conversions: c.conversions
  })) : [];

  return (
    <>
      <div className="app-container fade-in">
      <header>
        <div className="logo-section">
          <h1>
            <img src={thaiPbsLogo} alt="Thai PBS Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
            <span>Thai PBS Ads</span>
          </h1>
          <p>Meta Ads Performance Dashboard</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isDemo ? (
            <div className="status-banner demo">
              <AlertCircle size={16} />
              <span>Demo Mode (Using synthetic data)</span>
            </div>
          ) : (
            <div className="status-banner live">
              <Activity size={16} className="animate-pulse" />
              <span>Live Spreadsheet Connected</span>
            </div>
          )}
          
          <button 
            className="btn-secondary" 
            onClick={() => loadData(sheetUrl)}
            disabled={loading}
            title="Sync Data"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
          
          <button 
            className="btn-primary" 
            onClick={() => setShowSettings(true)}
            style={{ padding: '0.75rem 1.25rem' }}
          >
            <Settings size={14} />
            <span>{isDemo ? 'Connect Sheet' : 'Change Sheet'}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="status-banner error" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span><strong>Error:</strong> {error}</span>
          </div>
          <button 
            onClick={() => setError(null)} 
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {loading && (
        <div className="spinner-container">
          <div className="spinner"></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Fetching ads performance metrics...</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Date range and timeline controls panel */}
          {rawPayload && rawPayload.records && rawPayload.records.length > 0 && (
            <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Filter Date:</span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    onKeyDown={(e) => e.preventDefault()}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    min={dateBounds.min}
                    max={dateBounds.max}
                    style={{
                      background: 'rgba(0, 0, 0, 0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.4rem 0.6rem',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>to</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    onKeyDown={(e) => e.preventDefault()}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    min={dateBounds.min}
                    max={dateBounds.max}
                    style={{
                      background: 'rgba(0, 0, 0, 0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.4rem 0.6rem',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  />
                </div>
                
                {rawPayload && rawPayload.records && (startDate !== dateBounds.min || endDate !== dateBounds.max) && (
                  <button 
                    className="btn-secondary" 
                    onClick={handleResetDates}
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Campaign Search Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 200px', minWidth: '180px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Search:</span>
                <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                    placeholder="Search campaign name..."
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.4rem 2rem 0.4rem 0.6rem',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  />
                  {campaignSearch && (
                    <button
                      type="button"
                      onClick={() => setCampaignSearch('')}
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Platform Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Platform:</span>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  style={{
                    background: 'rgba(0, 0, 0, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.4rem 1.75rem 0.4rem 0.6rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    outline: 'none',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='none' stroke='%234b5563' stroke-width='2' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.45rem center',
                    backgroundSize: '0.8rem'
                  }}
                >
                  <option value="all">All Platforms</option>
                  {availablePlatforms.map(plat => (
                    <option key={plat} value={plat}>{plat}</option>
                  ))}
                </select>
              </div>

              {/* Page Filter */}
              {availablePages.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Page:</span>
                  <select
                    value={selectedPage}
                    onChange={(e) => setSelectedPage(e.target.value)}
                    style={{
                      background: 'rgba(0, 0, 0, 0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.4rem 1.75rem 0.4rem 0.6rem',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      outline: 'none',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='none' stroke='%234b5563' stroke-width='2' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.45rem center',
                      backgroundSize: '0.8rem',
                      maxWidth: '180px',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden'
                    }}
                  >
                    <option value="all">All Pages</option>
                    {availablePages.map(page => (
                      <option key={page} value={page}>{page}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Timeline Dimension:</span>
                <div className="tab-group">
                  <button 
                    className={`tab-btn ${dateMetric === 'date' ? 'active' : ''}`}
                    onClick={() => setDateMetric('date')}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    Reporting Date
                  </button>
                  <button 
                    className={`tab-btn ${dateMetric === 'campaign_start' ? 'active' : ''}`}
                    onClick={() => setDateMetric('campaign_start')}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    Campaign Launch Date (Starts)
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {selectedCampaign && (
            <div className="status-banner live" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', marginBottom: '1rem', borderLeft: '4px solid var(--primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={16} />
                <span>Filtering Dashboard by Campaign: <strong>{selectedCampaign}</strong></span>
              </div>
              <button 
                onClick={() => setSelectedCampaign(null)} 
                className="btn-secondary" 
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: 'none', background: 'rgba(24, 119, 242, 0.15)', color: 'var(--primary)' }}
              >
                Clear Filter
              </button>
            </div>
          )}
          {/* KPI Dashboard */}
          {(() => {
            const kpis = [
              {
                title: "Total Spend",
                value: formatCurrency(data.summary.total_spend),
                icon: DollarSign,
                variant: "kpi-spend",
                change: isDemo ? 12.4 : null
              },
              {
                title: "Impressions",
                value: formatNumber(data.summary.total_impressions),
                icon: Eye,
                variant: "kpi-impressions",
                change: isDemo ? 5.8 : null
              },
              {
                title: "Reach",
                value: formatNumber(data.summary.total_reach),
                icon: Users,
                variant: "kpi-reach",
                change: isDemo ? 5.2 : null,
                show: data.hasReachData
              },
              {
                title: "Conversions",
                value: formatNumber(data.summary.total_conversions),
                icon: Target,
                variant: "kpi-conversions",
                change: isDemo ? 8.7 : null
              },
              {
                title: "Average CPR",
                value: formatCurrency(data.summary.cpa, 2),
                icon: AlertCircle,
                variant: "kpi-cpa",
                isInverse: true,
                change: isDemo ? -4.2 : null
              },
              {
                title: "CPM",
                value: formatCurrency(data.summary.cpm, 2),
                icon: Layers,
                variant: "kpi-cpm",
                isInverse: true,
                change: isDemo ? -2.3 : null
              },

              {
                title: "CTR",
                value: `${(data.summary.ctr * 100).toFixed(2)}%`,
                icon: Percent,
                variant: "kpi-ctr",
                change: isDemo ? 1.5 : null,
                show: data.hasClicksData
              },
              {
                title: "CPC",
                value: formatCurrency(data.summary.cpc, 2),
                icon: MousePointerClick,
                variant: "kpi-cpc",
                isInverse: true,
                change: isDemo ? -3.1 : null,
                show: data.hasClicksData
              }
            ];

            const activeKpis = kpis.filter(k => k.show !== false);
            const colsClass = `cols-${activeKpis.length}`;

            return (
              <div className={`kpi-grid ${colsClass}`}>
                {activeKpis.map((kpi, idx) => (
                  <KPICard 
                    key={idx}
                    title={kpi.title}
                    value={kpi.value}
                    icon={kpi.icon}
                    variant={kpi.variant}
                    change={kpi.change}
                    isInverse={kpi.isInverse}
                  />
                ))}
              </div>
            );
          })()}

          {/* Trend Chart */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
              <div className="panel-header" style={{ marginBottom: 0 }}>
                <h2>Performance Trends Over Time</h2>
                <div className="tab-group">
                  <button 
                    className={`tab-btn ${chartMetric === 'spend_conv' ? 'active' : ''}`}
                    onClick={() => setChartMetric('spend_conv')}
                  >
                    Spend & Conversions
                  </button>
                  <button 
                    className={`tab-btn ${chartMetric === 'spend_impr' ? 'active' : ''}`}
                    onClick={() => setChartMetric('spend_impr')}
                  >
                    Impression & Spend
                  </button>
                  <button 
                    className={`tab-btn ${chartMetric === 'impr_cpm' ? 'active' : ''}`}
                    onClick={() => setChartMetric('impr_cpm')}
                  >
                    Impression & CPM
                  </button>

                  {data.hasClicksData && (
                    <button 
                      className={`tab-btn ${chartMetric === 'clicks_impr' ? 'active' : ''}`}
                      onClick={() => setChartMetric('clicks_impr')}
                    >
                      Engagement
                    </button>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '-0.75rem', marginBottom: '-0.25rem', flexWrap: 'wrap' }}>
                <div className="tab-group" style={{ padding: '0.15rem' }}>
                  <button 
                    className={`tab-btn ${!useMovingAverage ? 'active' : ''}`}
                    onClick={() => setUseMovingAverage(false)}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                  >
                    Daily
                  </button>
                  <button 
                    className={`tab-btn ${useMovingAverage ? 'active' : ''}`}
                    onClick={() => setUseMovingAverage(true)}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                  >
                    7-Day Moving Avg
                  </button>
                </div>
              </div>
              
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {chartMetric === 'spend_conv' ? (
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLOR_SPEND} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={COLOR_SPEND} stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLOR_CONVERSIONS} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={COLOR_CONVERSIONS} stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} tickFormatter={formatChartDate} />
                      <YAxis yAxisId="left" stroke={COLOR_SPEND} fontSize={11} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke={COLOR_CONVERSIONS} fontSize={11} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area yAxisId="left" type="monotone" dataKey="spend" name="Spend (฿)" stroke={COLOR_SPEND} strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
                      <Area yAxisId="right" type="monotone" dataKey="conversions" name="Conversions" stroke={COLOR_CONVERSIONS} strokeWidth={2} fillOpacity={1} fill="url(#colorConv)" />
                      <ReferenceLine 
                        yAxisId="left" 
                        y={averages.spend} 
                        stroke={COLOR_SPEND} 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5}
                        opacity={0.65}
                        label={{ 
                          value: `Avg Spend: ${formatCurrency(averages.spend)}`, 
                          fill: 'var(--text-primary)', 
                          position: 'insideTopLeft', 
                          fontSize: 10,
                          fontWeight: '600',
                          offset: 10
                        }} 
                      />
                      <ReferenceLine 
                        yAxisId="right" 
                        y={averages.conversions} 
                        stroke={COLOR_CONVERSIONS} 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5}
                        opacity={0.65}
                        label={{ 
                          value: `Avg Conv: ${formatNumber(averages.conversions)}`, 
                          fill: 'var(--text-primary)', 
                          position: 'insideTopRight', 
                          fontSize: 10,
                          fontWeight: '600',
                          offset: 10
                        }} 
                      />
                    </AreaChart>
                  ) : chartMetric === 'spend_impr' ? (
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSpendImpr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLOR_SPEND} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={COLOR_SPEND} stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="colorImpr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLOR_IMPRESSIONS} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={COLOR_IMPRESSIONS} stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} tickFormatter={formatChartDate} />
                      <YAxis yAxisId="left" stroke={COLOR_SPEND} fontSize={11} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke={COLOR_IMPRESSIONS} fontSize={11} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area yAxisId="left" type="monotone" dataKey="spend" name="Spend (฿)" stroke={COLOR_SPEND} strokeWidth={2} fillOpacity={1} fill="url(#colorSpendImpr)" />
                      <Area yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke={COLOR_IMPRESSIONS} strokeWidth={2} fillOpacity={1} fill="url(#colorImpr)" />
                      <ReferenceLine 
                        yAxisId="left" 
                        y={averages.spend} 
                        stroke={COLOR_SPEND} 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5}
                        opacity={0.65}
                        label={{ 
                          value: `Avg Spend: ${formatCurrency(averages.spend)}`, 
                          fill: 'var(--text-primary)', 
                          position: 'insideTopLeft', 
                          fontSize: 10,
                          fontWeight: '600',
                          offset: 10
                        }} 
                      />
                      <ReferenceLine 
                        yAxisId="right" 
                        y={averages.impressions} 
                        stroke={COLOR_IMPRESSIONS} 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5}
                        opacity={0.65}
                        label={{ 
                          value: `Avg Impr: ${formatNumber(averages.impressions)}`, 
                          fill: 'var(--text-primary)', 
                          position: 'insideTopRight', 
                          fontSize: 10,
                          fontWeight: '600',
                          offset: 10
                        }} 
                      />
                    </AreaChart>
                  ) : chartMetric === 'impr_cpm' ? (
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} tickFormatter={formatChartDate} />
                      <YAxis yAxisId="left" stroke={COLOR_IMPRESSIONS} fontSize={11} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke={COLOR_CPM} fontSize={11} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Line yAxisId="left" type="monotone" dataKey="impressions" name="Impressions" stroke={COLOR_IMPRESSIONS} strokeWidth={2} activeDot={{ r: 8 }} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="cpm" name="CPM" stroke={COLOR_CPM} strokeWidth={2} activeDot={{ r: 8 }} dot={false} />
                      <ReferenceLine 
                        yAxisId="left" 
                        y={averages.impressions} 
                        stroke={COLOR_IMPRESSIONS} 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5}
                        opacity={0.65}
                        label={{ 
                          value: `Avg Impr: ${formatNumber(averages.impressions)}`, 
                          fill: 'var(--text-primary)', 
                          position: 'insideTopLeft', 
                          fontSize: 10,
                          fontWeight: '600',
                          offset: 10
                        }} 
                      />
                      <ReferenceLine 
                        yAxisId="right" 
                        y={averages.cpm} 
                        stroke={COLOR_CPM} 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5}
                        opacity={0.65}
                        label={{ 
                          value: `Avg CPM: ${formatCurrency(averages.cpm)}`, 
                          fill: 'var(--text-primary)', 
                          position: 'insideTopRight', 
                          fontSize: 10,
                          fontWeight: '600',
                          offset: 10
                        }} 
                      />
                    </LineChart>
                  ) : (
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLOR_REVENUE} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={COLOR_REVENUE} stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} tickFormatter={formatChartDate} />
                      <YAxis yAxisId="left" stroke={COLOR_REVENUE} fontSize={11} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke={COLOR_REVENUE} strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" />
                      <Area yAxisId="right" type="monotone" dataKey="ctr" name="CTR (Ratio)" stroke="var(--text-secondary)" strokeWidth={1.5} fill="transparent" />
                      <ReferenceLine 
                        yAxisId="left" 
                        y={averages.clicks} 
                        stroke={COLOR_REVENUE} 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5}
                        opacity={0.65}
                        label={{ 
                          value: `Avg Clicks: ${formatNumber(averages.clicks)}`, 
                          fill: 'var(--text-primary)', 
                          position: 'insideTopLeft', 
                          fontSize: 10,
                          fontWeight: '600',
                          offset: 10
                        }} 
                      />
                      <ReferenceLine 
                        yAxisId="right" 
                        y={averages.ctr} 
                        stroke="var(--text-secondary)" 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5}
                        opacity={0.65}
                        label={{ 
                          value: `Avg CTR: ${(averages.ctr * 100).toFixed(2)}%`, 
                          fill: 'var(--text-primary)', 
                          position: 'insideTopRight', 
                          fontSize: 10,
                          fontWeight: '600',
                          offset: 10
                        }} 
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>


          {/* Spend Trend and Page Spend Distribution Row */}
          <div 
            className="platform-placement-grid" 
            style={{ 
              marginTop: '1.5rem',
              gridTemplateColumns: data.hasPageNameData ? undefined : '1fr'
            }}
          >
            {/* Spend Over Time Dedicated Panel */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="panel-header" style={{ marginBottom: 0 }}>
                <h2>Spend Trend Over Time</h2>
                <DollarSign size={16} style={{ color: 'var(--text-secondary)' }} />
              </div>
              
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} tickFormatter={formatChartDate} />
                    <YAxis stroke={COLOR_SPEND} fontSize={11} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Line type="monotone" dataKey="spend" name="Spend" stroke={COLOR_SPEND} strokeWidth={2.5} activeDot={{ r: 8 }} dot={false} />
                    <ReferenceLine 
                      y={averages.spend} 
                      stroke={COLOR_SPEND} 
                      strokeDasharray="4 4" 
                      strokeWidth={1.5}
                      opacity={0.65}
                      label={{ 
                        value: `Avg Spend: ${formatCurrency(averages.spend)}`, 
                        fill: 'var(--text-primary)', 
                        position: 'insideTopLeft', 
                        fontSize: 10,
                        fontWeight: '600',
                        offset: 10
                      }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Page Spend Distribution */}
            {data.hasPageNameData && (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="panel-header" style={{ marginBottom: 0 }}>
                  <h2>Page Spend Distribution</h2>
                </div>
                <div style={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.pageNameBreakdown}
                        dataKey="spend"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                      >
                        {data.pageNameBreakdown.map((entry, index) => {
                          const color = entry.name === 'Others' 
                            ? '#8d949e' 
                            : COLORS_PLACEMENT[index % COLORS_PLACEMENT.length];
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Campaign Table */}
          <CampaignTable 
            campaigns={data.campaigns} 
            hasClicksData={data.hasClicksData} 
            selectedCampaign={selectedCampaign}
            onSelectCampaign={setSelectedCampaign}
          />

          {/* Demographic & Top Spend Row */}
          {(data.hasDemographicsData || (topCampaignsData && topCampaignsData.length > 0)) && (
            <div 
              className="platform-placement-grid" 
              style={{ 
                marginTop: '1.5rem',
                marginBottom: '1.5rem',
                gridTemplateColumns: (data.hasDemographicsData && topCampaignsData && topCampaignsData.length > 0) ? undefined : '1fr'
              }}
            >
              {/* Demographic Impressions Distribution */}
              {data.hasDemographicsData && (
                <DemographicsTable demographics={data.demographics} />
              )}

              {/* Top Campaigns Breakdown */}
              {topCampaignsData && topCampaignsData.length > 0 && (
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="panel-header" style={{ marginBottom: 0 }}>
                    <h2>Top Spend Distribution</h2>
                    <BarChart2 size={16} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  
                  <div style={{ width: '100%', height: 480 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topCampaignsData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                        <XAxis type="number" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                        <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={9} width={100} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar 
                          dataKey="spend" 
                          name="Spend (฿)" 
                          radius={[0, 4, 4, 0]}
                          style={{ cursor: 'pointer' }}
                          onClick={(data) => {
                            if (data && data.fullName) {
                              const campaignName = data.fullName;
                              const rowId = getCampaignRowId(campaignName);
                              const element = document.getElementById(rowId);
                              if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                element.classList.add('highlight-flash');
                                setTimeout(() => {
                                  element.classList.remove('highlight-flash');
                                }, 3000);
                              }
                            }
                          }}
                        >
                          {topCampaignsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLOR_SPEND} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Placement & Platform Breakdown (Only shown if data exists) */}
          {(data.hasPlatformData || data.hasPlacementData) && (
            <div className="platform-placement-grid" style={{ marginTop: '0.5rem' }}>
              {data.hasPlatformData && (
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="panel-header" style={{ marginBottom: 0 }}>
                    <h2>Platform Spend Distribution</h2>
                  </div>
                  <div style={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.platformBreakdown}
                          dataKey="spend"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
                        >
                          {data.platformBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_PLATFORM[entry.name] || COLORS_DEFAULT[index % COLORS_DEFAULT.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {data.platformComparisonData && data.platformComparisonData.length > 0 && (
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="panel-header" style={{ marginBottom: 0, flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <h2 style={{ margin: 0 }}>Platform Performance</h2>
                    <div className="tab-group" style={{ padding: '0.15rem' }}>
                      <button 
                        type="button"
                        className={`tab-btn ${compareMetric === 'spend' ? 'active' : ''}`}
                        onClick={() => setCompareMetric('spend')}
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      >
                        Spend
                      </button>
                      <button 
                        type="button"
                        className={`tab-btn ${compareMetric === 'conversions' ? 'active' : ''}`}
                        onClick={() => setCompareMetric('conversions')}
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      >
                        Conversions
                      </button>
                      <button 
                        type="button"
                        className={`tab-btn ${compareMetric === 'ctr' ? 'active' : ''}`}
                        onClick={() => setCompareMetric('ctr')}
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      >
                        CTR
                      </button>

                    </div>
                  </div>
                  
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.platformComparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                        <YAxis 
                          stroke="var(--text-secondary)" 
                          fontSize={9} 
                          tickLine={false} 
                          tickFormatter={(val) => {
                            if (compareMetric === 'spend') {
                              if (val >= 1000) return `฿${(val / 1000).toFixed(1)}k`;
                              return `฿${val}`;
                            }
                            if (compareMetric === 'ctr') return `${(val * 100).toFixed(1)}%`;
                            if (compareMetric === 'roas') return `${val.toFixed(1)}x`;
                            return formatNumber(val);
                          }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar 
                          dataKey={compareMetric} 
                          name={
                            compareMetric === 'spend' ? 'Spend' : 
                            compareMetric === 'conversions' ? 'Conversions' :
                            compareMetric === 'ctr' ? 'CTR' : 'ROAS'
                          } 
                          radius={[4, 4, 0, 0]}
                        >
                          {data.platformComparisonData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_PLATFORM[entry.name] || COLORS_DEFAULT[index % COLORS_DEFAULT.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {data.hasPlacementData && (
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="panel-header" style={{ marginBottom: 0 }}>
                    <h2>Placement Spend Distribution</h2>
                  </div>
                  <div style={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.placementBreakdown}
                          dataKey="spend"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
                        >
                          {data.placementBreakdown.map((entry, index) => {
                            const color = entry.name === 'Others' 
                              ? '#8d949e' 
                              : COLORS_PLACEMENT[index % COLORS_PLACEMENT.length];
                            return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

            </div>
          )}

        </>
      )}
      </div>

      {/* Settings Modal Drawer */}
      {showSettings && (
        <>
          <div className="drawer-backdrop" onClick={() => setShowSettings(false)}></div>
          <div className="drawer">
            <div className="drawer-header">
              <h3>Connect Spreadsheet</h3>
              <button className="close-btn" onClick={() => setShowSettings(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleConnectSheet} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
                  Google Sheets Sharing URL
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="url" 
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                    required
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '0.75rem 2.25rem 0.75rem 0.75rem',
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                      fontSize: '0.875rem'
                    }}
                  />
                  {sheetUrl && (
                    <button
                      type="button"
                      onClick={() => setSheetUrl('')}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderStyle: 'dashed' }}>
                <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Share settings instructions:</p>
                <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li>Open your Google Sheet containing Facebook Ads data.</li>
                  <li>Click the blue <strong>"Share"</strong> button in the top right.</li>
                  <li>Under General Access, change status to <strong>"Anyone with the link can view"</strong>.</li>
                  <li>Copy the link and paste it above!</li>
                </ol>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                {!isDemo && (
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={handleLoadDemo}
                    style={{ border: 'none', background: 'transparent', color: 'var(--danger)' }}
                  >
                    Disconnect Sheet
                  </button>
                )}
                
                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>Load Data</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
