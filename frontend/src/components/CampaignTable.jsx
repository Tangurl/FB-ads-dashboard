import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
};

const formatNumber = (val) => {
  return new Intl.NumberFormat('en-US').format(Math.round(val));
};

const formatPercent = (val) => {
  return `${(val * 100).toFixed(2)}%`;
};

const formatDateReadable = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('th-TH', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      calendar: 'gregory',
      timeZone: 'UTC'
    }).format(date);
  } catch (e) {
    return dateStr;
  }
};

const formatSchedule = (start, end) => {
  if (!start) return '-';
  if (!end || start === end) return formatDateReadable(start);
  return `${formatDateReadable(start)} to ${formatDateReadable(end)}`;
};

export const getCampaignRowId = (name) => {
  return `campaign-row-${name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
};

export default function CampaignTable({ campaigns, hasClicksData = true, selectedCampaign, onSelectCampaign }) {
  const [sortConfig, setSortConfig] = useState({ key: 'spend', direction: 'desc' });
  const [showHeatmap, setShowHeatmap] = useState(true);
 
  const handleRowClick = (campaignName) => {
    if (onSelectCampaign) {
      onSelectCampaign(campaignName);
    }
  };

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    // Handle string columns (like campaign name or dates)
    if (typeof aVal === 'string') {
      return sortConfig.direction === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    
    // Handle numeric columns
    return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const displayCampaigns = sortedCampaigns.slice(0, 20);

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} style={{ marginLeft: '4px', opacity: 0.5 }} />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} style={{ marginLeft: '4px', color: 'var(--primary)' }} /> 
      : <ArrowDown size={14} style={{ marginLeft: '4px', color: 'var(--primary)' }} />;
  };

  // Compute column min/max metrics to derive heat map background values
  const stats = React.useMemo(() => {
    const keys = ['spend', 'impressions', 'clicks', 'conversions', 'ctr', 'cpc', 'cpm', 'cpa'];
    const result = {};
    keys.forEach(k => {
      const vals = campaigns.map(c => c[k] || 0);
      if (vals.length === 0) {
        result[k] = { min: 0, max: 0 };
      } else {
        result[k] = {
          min: Math.min(...vals),
          max: Math.max(...vals)
        };
      }
    });
    return result;
  }, [campaigns]);

  // Generates cell background heat-map styles based on relative metric values
  const getHeatmapStyle = (value, key, isInverse = false) => {
    if (!showHeatmap) return {};
    const range = stats[key];
    if (!range || range.max === range.min) return {};
    
    const ratio = (value - range.min) / (range.max - range.min);
    const maxOpacity = 0.12; // 12% max opacity for high-legibility overlays
    const opacity = ratio * maxOpacity;
    
    if (isInverse) {
      // cost metrics: CPC, CPA, CPM. Lower cost is better (green), higher cost is warning (red)
      if (ratio > 0.5) {
        const redOpacity = (ratio - 0.5) * 2 * maxOpacity;
        return { backgroundColor: `rgba(250, 62, 62, ${redOpacity.toFixed(3)})` };
      } else {
        const greenOpacity = (0.5 - ratio) * 2 * maxOpacity;
        return { backgroundColor: `rgba(49, 162, 76, ${greenOpacity.toFixed(3)})` };
      }
    }
    
    // Positive ratio metrics (ROAS, CTR, Conversions, Clicks) -> Green scale
    if (key === 'roas' || key === 'ctr' || key === 'conversions' || key === 'clicks') {
      return { backgroundColor: `rgba(49, 162, 76, ${opacity.toFixed(3)})` };
    }
    
    // Spend, Impressions (Volume) -> Blue scale
    return { backgroundColor: `rgba(24, 119, 242, ${opacity.toFixed(3)})` };
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="panel-header" style={{ marginBottom: 0, alignItems: 'center' }}>
        <h2>Campaign Performance Breakdown (Top 20)</h2>
        <div className="tab-group" style={{ marginLeft: 'auto' }}>
          <button 
            type="button"
            className={`tab-btn ${showHeatmap ? 'active' : ''}`}
            onClick={() => setShowHeatmap(true)}
          >
            Heatmap
          </button>
          <button 
            type="button"
            className={`tab-btn ${!showHeatmap ? 'active' : ''}`}
            onClick={() => setShowHeatmap(false)}
          >
            Classic
          </button>
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px', color: 'var(--text-muted)' }}>#</th>
              <th onClick={() => handleSort('campaign')}>Campaign Name {getSortIcon('campaign')}</th>
              <th onClick={() => handleSort('campaign_id')}>Campaign ID {getSortIcon('campaign_id')}</th>
              <th onClick={() => handleSort('campaign_start')}>Schedule {getSortIcon('campaign_start')}</th>
              <th style={{ textAlign: 'right' }} onClick={() => handleSort('spend')}>Spend {getSortIcon('spend')}</th>
              <th style={{ textAlign: 'right' }} onClick={() => handleSort('impressions')}>Impressions {getSortIcon('impressions')}</th>
              {hasClicksData && <th style={{ textAlign: 'right' }} onClick={() => handleSort('clicks')}>Clicks {getSortIcon('clicks')}</th>}
              <th style={{ textAlign: 'right' }} onClick={() => handleSort('conversions')}>Conversions {getSortIcon('conversions')}</th>
              {hasClicksData && <th style={{ textAlign: 'right' }} onClick={() => handleSort('ctr')}>CTR {getSortIcon('ctr')}</th>}
              {hasClicksData && <th style={{ textAlign: 'right' }} onClick={() => handleSort('cpc')}>CPC {getSortIcon('cpc')}</th>}
              <th style={{ textAlign: 'right' }} onClick={() => handleSort('cpm')}>CPM {getSortIcon('cpm')}</th>
              <th style={{ textAlign: 'right' }} onClick={() => handleSort('cpa')}>CPR {getSortIcon('cpa')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedCampaigns.length === 0 ? (
              <tr>
                <td colSpan={hasClicksData ? 12 : 9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No campaigns found. Load data to view breakdown.
                </td>
              </tr>
            ) : (
              displayCampaigns.map((c, i) => {
                const isSelected = selectedCampaign === c.campaign;
                return (
                  <tr 
                    key={i} 
                    id={getCampaignRowId(c.campaign)}
                    onClick={() => handleRowClick(c.campaign)}
                    className={isSelected ? 'selected-campaign-row' : ''}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', width: '40px' }}>
                      {i + 1}
                    </td>
                    <td style={{ fontWeight: '500', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.campaign}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {c.campaign_id}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {formatSchedule(c.campaign_start, c.campaign_end)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600', ...getHeatmapStyle(c.spend, 'spend') }}>{formatCurrency(c.spend)}</td>
                    <td style={{ textAlign: 'right', color: showHeatmap ? 'var(--text-primary)' : 'var(--text-secondary)', ...getHeatmapStyle(c.impressions, 'impressions') }}>{formatNumber(c.impressions)}</td>
                    {hasClicksData && <td style={{ textAlign: 'right', color: showHeatmap ? 'var(--text-primary)' : 'var(--text-secondary)', ...getHeatmapStyle(c.clicks, 'clicks') }}>{formatNumber(c.clicks)}</td>}
                    <td style={{ textAlign: 'right', fontWeight: '600', ...getHeatmapStyle(c.conversions, 'conversions') }}>{formatNumber(c.conversions)}</td>
                    {hasClicksData && <td style={{ textAlign: 'right', color: showHeatmap ? 'var(--text-primary)' : 'var(--text-secondary)', ...getHeatmapStyle(c.ctr, 'ctr') }}>{formatPercent(c.ctr)}</td>}
                    {hasClicksData && <td style={{ textAlign: 'right', color: showHeatmap ? 'var(--text-primary)' : 'var(--text-secondary)', ...getHeatmapStyle(c.cpc, 'cpc', true) }}>{formatCurrency(c.cpc)}</td>}
                    <td style={{ textAlign: 'right', color: showHeatmap ? 'var(--text-primary)' : 'var(--text-secondary)', ...getHeatmapStyle(c.cpm, 'cpm', true) }}>{formatCurrency(c.cpm)}</td>
                    <td style={{ textAlign: 'right', color: showHeatmap ? 'var(--text-primary)' : 'var(--text-secondary)', ...getHeatmapStyle(c.cpa, 'cpa', true) }}>{formatCurrency(c.cpa)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
