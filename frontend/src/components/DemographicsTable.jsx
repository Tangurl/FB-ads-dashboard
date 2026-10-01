import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const GENDER_COLORS = {
  Female: '#ec4899',   // Pink
  Male: '#1877f2',     // Blue
  Unknown: '#8d949e',  // Gray
  All: '#8b5cf6'       // Purple
};

const DEFAULT_COLORS = ['#3b82f6', '#ec4899', '#8b5cf6', '#10b981', '#f5a623'];

const ageSort = (a, b) => {
  const getNum = (str) => {
    const clean = str.replace('+', '').split('-')[0];
    return parseInt(clean, 10) || 0;
  };
  return getNum(a) - getNum(b);
};

export default function DemographicsTable({ demographics }) {
  // Extract unique age groups and genders
  const ages = React.useMemo(() => {
    const uniqueAges = Array.from(new Set(demographics.map((d) => d.age)));
    return uniqueAges.sort(ageSort);
  }, [demographics]);

  const genders = React.useMemo(() => {
    const uniqueGenders = Array.from(new Set(demographics.map((d) => d.gender)));
    // Sort genders for consistency: e.g. Female, Male, Unknown
    return uniqueGenders.sort((a, b) => a.localeCompare(b));
  }, [demographics]);

  // Pivot demographics data into matrix: matrix[age][gender] = impressions
  const { matrix, ageTotals, genderTotals, grandTotal, maxVal } = React.useMemo(() => {
    const mat = {};
    const aTotals = {};
    const gTotals = {};
    let gTotal = 0;
    let maximum = 0;

    // Initialize matrix and totals
    ages.forEach((age) => {
      mat[age] = {};
      aTotals[age] = 0;
      genders.forEach((gender) => {
        mat[age][gender] = 0;
        gTotals[gender] = 0;
      });
    });

    // Populate matrix and totals
    demographics.forEach((item) => {
      const { age, gender, impressions } = item;
      if (mat[age] && mat[age][gender] !== undefined) {
        mat[age][gender] += impressions;
        aTotals[age] += impressions;
        gTotals[gender] += impressions;
        gTotal += impressions;
        if (impressions > maximum) {
          maximum = impressions;
        }
      }
    });

    return {
      matrix: mat,
      ageTotals: aTotals,
      genderTotals: gTotals,
      grandTotal: gTotal,
      maxVal: maximum,
    };
  }, [demographics, ages, genders]);

  const chartData = React.useMemo(() => {
    return ages.map((age) => {
      const row = { age };
      genders.forEach((gender) => {
        row[gender] = matrix[age][gender] || 0;
      });
      return row;
    });
  }, [ages, genders, matrix]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum, item) => sum + (item.value || 0), 0);
      return (
        <div className="glass-panel" style={{ padding: '0.75rem', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
          <p style={{ fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>Age Group: {label}</p>
          {payload.map((item, idx) => (
            <p key={idx} style={{ color: item.color || 'var(--primary)', display: 'flex', gap: '1rem', justifyContent: 'space-between', margin: '0.2rem 0' }}>
              <span>{item.name}:</span>
              <span style={{ fontWeight: '600' }}>{new Intl.NumberFormat('en-US').format(item.value)}</span>
            </p>
          ))}
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.4rem', paddingTop: '0.4rem', fontWeight: '700', display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
            <span>Total:</span>
            <span>{new Intl.NumberFormat('en-US').format(total)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (demographics.length === 0) return null;

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="panel-header" style={{ marginBottom: 0 }}>
        <h2>Demographic Impressions Distribution</h2>
      </div>
      
      <div style={{ width: '100%', height: 480 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
            <XAxis 
              type="number" 
              stroke="var(--text-muted)" 
              fontSize={10} 
              tickLine={false} 
              tickFormatter={(val) => {
                if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                return val;
              }}
            />
            <YAxis dataKey="age" type="category" stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            {genders.map((gender, idx) => {
              const color = GENDER_COLORS[gender] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
              return (
                <Bar 
                  key={gender} 
                  dataKey={gender} 
                  name={gender} 
                  fill={color}
                />
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
