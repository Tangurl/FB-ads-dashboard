import unittest
import pandas as pd
try:
    from data_parser import parse_google_sheet_url, clean_numeric, map_and_clean_columns, get_demo_data
except ImportError:
    from backend.data_parser import parse_google_sheet_url, clean_numeric, map_and_clean_columns, get_demo_data

class TestDataParser(unittest.TestCase):
    
    def test_parse_google_sheet_url(self):
        # Test basic link (no gid)
        url1 = "https://docs.google.com/spreadsheets/d/1t87s-g-7z6R5L8X2gW1r3vNn4b0vB1D7G3C2q3D4/edit?usp=sharing"
        expected1 = "https://docs.google.com/spreadsheets/d/1t87s-g-7z6R5L8X2gW1r3vNn4b0vB1D7G3C2q3D4/export?format=csv"
        self.assertEqual(parse_google_sheet_url(url1), expected1)
        
        # Test link with custom gid
        url2 = "https://docs.google.com/spreadsheets/d/1t87s-g-7z6R5L8X2gW1r3vNn4b0vB1D7G3C2q3D4/edit#gid=87263524"
        expected2 = "https://docs.google.com/spreadsheets/d/1t87s-g-7z6R5L8X2gW1r3vNn4b0vB1D7G3C2q3D4/export?format=csv&gid=87263524"
        self.assertEqual(parse_google_sheet_url(url2), expected2)
        
        # Test invalid url
        with self.assertRaises(ValueError):
            parse_google_sheet_url("https://google.com")

    def test_clean_numeric(self):
        self.assertEqual(clean_numeric("$1,234.56"), 1234.56)
        self.assertEqual(clean_numeric("2.4%"), 2.4)
        self.assertEqual(clean_numeric(" -50.5 "), -50.5)
        self.assertEqual(clean_numeric(""), 0.0)
        self.assertEqual(clean_numeric(None), 0.0)
        self.assertEqual(clean_numeric(123.45), 123.45)
        # European formatting with dots/spaces
        self.assertEqual(clean_numeric("1.234,56 €"), 1234.56)

    def test_map_and_clean_columns(self):
        # Create a mock dataframe with non-standard names
        mock_raw_data = {
            "Campaign Name": ["Campaign A", "Campaign B"],
            "Day": ["2026-06-01", "2026-06-02"],
            "Amount Spent (USD)": ["$100.50", "200.00"],
            "Impressions count": ["10,000", "20000"],
            "Link Clicks": ["150", "300"],
            "Results": ["5", "15"],
            "Purchase Value": ["$250.00", "800.00"],
            "Starts": ["2026-05-25", "2026-05-28"],
            "Ends": ["2026-05-30", "2026-06-05"],
            "Age group": ["18-24", "25-34"],
            "Sex": ["female", "male"]
        }
        df = pd.DataFrame(mock_raw_data)
        
        cleaned_df = map_and_clean_columns(df)
        
        # Check standard columns mapping
        self.assertIn("campaign", cleaned_df.columns)
        self.assertIn("date", cleaned_df.columns)
        self.assertIn("spend", cleaned_df.columns)
        self.assertIn("impressions", cleaned_df.columns)
        self.assertIn("clicks", cleaned_df.columns)
        self.assertIn("conversions", cleaned_df.columns)
        self.assertIn("revenue", cleaned_df.columns)
        self.assertIn("campaign_start", cleaned_df.columns)
        self.assertIn("campaign_end", cleaned_df.columns)
        self.assertIn("age", cleaned_df.columns)
        self.assertIn("gender", cleaned_df.columns)
        
        # Check values are cleaned and type casted correctly
        self.assertEqual(cleaned_df.loc[0, "spend"], 100.50)
        self.assertEqual(cleaned_df.loc[0, "impressions"], 10000.0)
        self.assertEqual(cleaned_df.loc[0, "clicks"], 150.0)
        self.assertEqual(cleaned_df.loc[0, "conversions"], 5.0)
        self.assertEqual(cleaned_df.loc[0, "revenue"], 250.00)
        self.assertEqual(cleaned_df.loc[0, "campaign_start"], "2026-05-25")
        self.assertEqual(cleaned_df.loc[0, "campaign_end"], "2026-05-30")
        self.assertEqual(cleaned_df.loc[0, "age"], "18-24")
        self.assertEqual(cleaned_df.loc[0, "gender"], "female")
        
        # Check row derived metrics
        self.assertAlmostEqual(cleaned_df.loc[0, "ctr"], 150 / 10000)
        self.assertAlmostEqual(cleaned_df.loc[0, "cpc"], 100.50 / 150)
        self.assertAlmostEqual(cleaned_df.loc[0, "cpa"], 100.50 / 5)
        self.assertAlmostEqual(cleaned_df.loc[0, "roas"], 250.00 / 100.50)
        self.assertAlmostEqual(cleaned_df.loc[0, "cpm"], (100.50 / 10000.0) * 1000)
        
        # Check fallback when Starts/Ends are missing
        df_missing = df.drop(columns=["Starts", "Ends"])
        cleaned_missing = map_and_clean_columns(df_missing)
        self.assertEqual(cleaned_missing.loc[0, "campaign_start"], "2026-06-01")
        self.assertEqual(cleaned_missing.loc[0, "campaign_end"], "2026-06-01")

    def test_get_demo_data(self):
        demo_payload = get_demo_data()
        self.assertIn("summary", demo_payload)
        self.assertIn("daily_trends", demo_payload)
        self.assertIn("campaigns", demo_payload)
        self.assertIn("platform_breakdown", demo_payload)
        self.assertIn("placement_breakdown", demo_payload)
        self.assertIn("demographics", demo_payload)
        
        # Validate demographics aggregation
        demographics = demo_payload["demographics"]
        self.assertTrue(len(demographics) > 0)
        self.assertIn("age", demographics[0])
        self.assertIn("gender", demographics[0])
        self.assertIn("impressions", demographics[0])
        
        # Validate summary figures are reasonable
        summary = demo_payload["summary"]
        self.assertTrue(summary["total_spend"] > 0)
        self.assertTrue(summary["total_impressions"] > 0)
        self.assertTrue(summary["total_clicks"] > 0)
        self.assertTrue(summary["total_conversions"] > 0)
        self.assertTrue(summary["total_revenue"] > 0)
        self.assertTrue(summary["ctr"] > 0)
        self.assertTrue(summary["cpc"] > 0)
        self.assertTrue(summary["cpa"] > 0)
        self.assertTrue(summary["roas"] > 0)
        self.assertIn("cpm", summary)
        self.assertTrue(summary["cpm"] > 0)

    def test_new_spreadsheet_structure(self):
        # Construct raw data matching the user's new spreadsheet columns
        mock_raw_data = {
            "Campaign name": ["IG_Promo_Reels_Summer", "FB_Brand_Awareness_Feed"],
            "Ad set name": ["Instagram_Reels_18-34", "Facebook_Feed_All_Genders"],
            "Page name": ["ThaiPBS Instagram Profile", "ThaiPBS Facebook Page"],
            "Age": ["18-34", "18+"],
            "Gender": ["All", "All"],
            "Delivery status": ["active", "active"],
            "Delivery level": ["campaign", "campaign"],
            "Reach": [5000, 10000],
            "Impressions": [8000, 15000],
            "Frequency": [1.6, 1.5],
            "Attribution setting": ["7-day click", "7-day click"],
            "Result type": ["conversions", "conversions"],
            "Results": [120, 250],
            "Amount spent (THB)": ["5,000.00", "12,500.50"],
            "Cost per result": [41.67, 50.0],
            "Starts": ["2026-06-01", "2026-06-05"],
            "Ends": ["2026-06-10", "2026-06-15"],
            "Reporting starts": ["2026-06-02", "2026-06-06"],
            "Reporting ends": ["2026-06-03", "2026-06-07"]
        }
        df = pd.DataFrame(mock_raw_data)
        
        cleaned_df = map_and_clean_columns(df)
        
        # Verify columns are correctly mapped
        self.assertEqual(cleaned_df.loc[0, "campaign"], "IG_Promo_Reels_Summer")
        self.assertEqual(cleaned_df.loc[0, "spend"], 5000.00)
        self.assertEqual(cleaned_df.loc[1, "spend"], 12500.50)
        self.assertEqual(cleaned_df.loc[0, "impressions"], 8000.0)
        self.assertEqual(cleaned_df.loc[0, "conversions"], 120.0)
        
        # Verify CPM calculations are correct
        self.assertAlmostEqual(cleaned_df.loc[0, "cpm"], (5000.00 / 8000.0) * 1000)
        
        # Verify clicks are 0 when no clicks column is present (no fallback)
        self.assertEqual(cleaned_df.loc[0, "clicks"], 0.0)
        self.assertEqual(cleaned_df.loc[1, "clicks"], 0.0)
        
        # Verify date mapping (Reporting starts -> date, Starts -> campaign_start, Ends -> campaign_end)
        self.assertEqual(cleaned_df.loc[0, "date"], "2026-06-02")
        self.assertEqual(cleaned_df.loc[0, "campaign_start"], "2026-06-01")
        self.assertEqual(cleaned_df.loc[0, "campaign_end"], "2026-06-10")
        
        # Verify platform and placement inference
        # Record 0 should infer Instagram & Stories & Reels
        self.assertEqual(cleaned_df.loc[0, "platform"], "Instagram")
        self.assertEqual(cleaned_df.loc[0, "placement"], "Stories & Reels")
        
        # Record 1 should infer Facebook & Feeds
        self.assertEqual(cleaned_df.loc[1, "platform"], "Facebook")
        self.assertEqual(cleaned_df.loc[1, "placement"], "Feeds")

        # Verify page name mapping
        self.assertEqual(cleaned_df.loc[0, "page_name"], "ThaiPBS Instagram Profile")
        self.assertEqual(cleaned_df.loc[1, "page_name"], "ThaiPBS Facebook Page")

        # Verify demographics mapping
        self.assertEqual(cleaned_df.loc[0, "age"], "18-34")
        self.assertEqual(cleaned_df.loc[0, "gender"], "All")

if __name__ == "__main__":
    unittest.main()
