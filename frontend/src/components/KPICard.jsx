import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export default function KPICard({ title, value, change, icon: Icon, variant, isInverse = false }) {
  const hasChange = change !== undefined && change !== null;
  
  // For standard metrics, positive change is good. For inverse (CPA/CPC), negative change is good.
  const isPositive = change > 0;
  const isNeutral = change === 0;
  const isGood = isInverse ? !isPositive : isPositive;
  
  let changeClass = 'neutral';
  let ChangeIcon = Minus;
  
  if (hasChange && !isNeutral) {
    changeClass = isGood ? 'positive' : 'negative';
    ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight;
  }

  return (
    <div className={`glass-panel kpi-card ${variant}`}>
      <div className="kpi-header">
        <span>{title}</span>
        <div className="kpi-icon-container">
          {Icon && <Icon className="w-5 h-5 text-slate-400" size={18} />}
        </div>
      </div>
      
      <div className="kpi-value">{value}</div>
      
      {hasChange && (
        <div className={`kpi-change ${changeClass}`}>
          <ChangeIcon size={14} />
          <span>{Math.abs(change).toFixed(1)}% vs prev period</span>
        </div>
      )}
    </div>
  );
}
