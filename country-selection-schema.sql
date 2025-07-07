-- Country Selection System Database Schema - Updated with Complete African Coverage
-- For user onboarding and compliance tracking

-- 1. Add country columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS country_of_residence VARCHAR(3), -- ISO 3166-1 alpha-3 code
ADD COLUMN IF NOT EXISTS country_name VARCHAR(100), -- Full country name for display
ADD COLUMN IF NOT EXISTS country_selected_at TIMESTAMP WITH TIME ZONE, -- When country was selected
ADD COLUMN IF NOT EXISTS country_updated_at TIMESTAMP WITH TIME ZONE; -- Last country update

-- 2. Add country selection status column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS country_selection_completed BOOLEAN DEFAULT FALSE;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_country_of_residence ON public.users(country_of_residence);
CREATE INDEX IF NOT EXISTS idx_users_country_selection_completed ON public.users(country_selection_completed);
CREATE INDEX IF NOT EXISTS idx_users_country_selected_at ON public.users(country_selected_at);

-- 4. Add column comments
COMMENT ON COLUMN public.users.country_of_residence IS 'ISO 3166-1 alpha-3 country code (e.g., ZAF, USA, GBR)';
COMMENT ON COLUMN public.users.country_name IS 'Full country name for display purposes';
COMMENT ON COLUMN public.users.country_selected_at IS 'Timestamp when user first selected their country';
COMMENT ON COLUMN public.users.country_updated_at IS 'Timestamp when country was last updated';
COMMENT ON COLUMN public.users.country_selection_completed IS 'Whether user has completed country selection';

-- 5. Create country reference table for validation and consistency
CREATE TABLE IF NOT EXISTS public.supported_countries (
  id SERIAL PRIMARY KEY,
  country_code VARCHAR(3) NOT NULL UNIQUE, -- ISO 3166-1 alpha-3
  country_name VARCHAR(100) NOT NULL,
  flag_emoji VARCHAR(10) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE, -- Primary countries shown first
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 999,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Insert supported countries data with complete African coverage and alphabetical ordering
INSERT INTO public.supported_countries (country_code, country_name, flag_emoji, is_primary, display_order) VALUES
-- Primary countries (shown first) - Keep current order for UX
('ZAF', 'South Africa', '🇿🇦', TRUE, 1),
('USA', 'United States', '🇺🇸', TRUE, 2),
('GBR', 'United Kingdom', '🇬🇧', TRUE, 3),
('CAN', 'Canada', '🇨🇦', TRUE, 4),
('AUS', 'Australia', '🇦🇺', TRUE, 5),
('ARE', 'United Arab Emirates', '🇦🇪', TRUE, 6),
('IND', 'India', '🇮🇳', TRUE, 7),
('PAK', 'Pakistan', '🇵🇰', TRUE, 8),

-- Europe (alphabetical)
('AUT', 'Austria', '🇦🇹', FALSE, 10),
('BEL', 'Belgium', '🇧🇪', FALSE, 11),
('BGR', 'Bulgaria', '🇧🇬', FALSE, 12),
('CZE', 'Czech Republic', '🇨🇿', FALSE, 13),
('DNK', 'Denmark', '🇩🇰', FALSE, 14),
('FIN', 'Finland', '🇫🇮', FALSE, 15),
('FRA', 'France', '🇫🇷', FALSE, 16),
('DEU', 'Germany', '🇩🇪', FALSE, 17),
('GRC', 'Greece', '🇬🇷', FALSE, 18),
('HUN', 'Hungary', '🇭🇺', FALSE, 19),
('IRL', 'Ireland', '🇮🇪', FALSE, 20),
('ITA', 'Italy', '🇮🇹', FALSE, 21),
('NLD', 'Netherlands', '🇳🇱', FALSE, 22),
('NOR', 'Norway', '🇳🇴', FALSE, 23),
('POL', 'Poland', '🇵🇱', FALSE, 24),
('PRT', 'Portugal', '🇵🇹', FALSE, 25),
('ROU', 'Romania', '🇷🇴', FALSE, 26),
('ESP', 'Spain', '🇪🇸', FALSE, 27),
('SWE', 'Sweden', '🇸🇪', FALSE, 28),
('CHE', 'Switzerland', '🇨🇭', FALSE, 29),

-- Asia-Pacific (alphabetical)
('AFG', 'Afghanistan', '🇦🇫', FALSE, 30),
('BGD', 'Bangladesh', '🇧🇩', FALSE, 31),
('CHN', 'China', '🇨🇳', FALSE, 32),
('HKG', 'Hong Kong', '🇭🇰', FALSE, 33),
('IDN', 'Indonesia', '🇮🇩', FALSE, 34),
('JPN', 'Japan', '🇯🇵', FALSE, 35),
('MYS', 'Malaysia', '🇲🇾', FALSE, 36),
('NPL', 'Nepal', '🇳🇵', FALSE, 37),
('NZL', 'New Zealand', '🇳🇿', FALSE, 38),
('PHL', 'Philippines', '🇵🇭', FALSE, 39),
('SGP', 'Singapore', '🇸🇬', FALSE, 40),
('KOR', 'South Korea', '🇰🇷', FALSE, 41),
('LKA', 'Sri Lanka', '🇱🇰', FALSE, 42),
('THA', 'Thailand', '🇹🇭', FALSE, 43),
('VNM', 'Vietnam', '🇻🇳', FALSE, 44),

-- Middle East (alphabetical)
('BHR', 'Bahrain', '🇧🇭', FALSE, 50),
('IRN', 'Iran', '🇮🇷', FALSE, 51),
('IRQ', 'Iraq', '🇮🇶', FALSE, 52),
('ISR', 'Israel', '🇮🇱', FALSE, 53),
('JOR', 'Jordan', '🇯🇴', FALSE, 54),
('KWT', 'Kuwait', '🇰🇼', FALSE, 55),
('LBN', 'Lebanon', '🇱🇧', FALSE, 56),
('OMN', 'Oman', '🇴🇲', FALSE, 57),
('QAT', 'Qatar', '🇶🇦', FALSE, 58),
('SAU', 'Saudi Arabia', '🇸🇦', FALSE, 59),
('TUR', 'Turkey', '🇹🇷', FALSE, 60),

-- Africa (alphabetical - Complete coverage of all African nations)
('DZA', 'Algeria', '🇩🇿', FALSE, 70),
('AGO', 'Angola', '🇦🇴', FALSE, 71),
('BEN', 'Benin', '🇧🇯', FALSE, 72),
('BWA', 'Botswana', '🇧🇼', FALSE, 73),
('BFA', 'Burkina Faso', '🇧🇫', FALSE, 74),
('BDI', 'Burundi', '🇧🇮', FALSE, 75),
('CMR', 'Cameroon', '🇨🇲', FALSE, 76),
('CPV', 'Cape Verde', '🇨🇻', FALSE, 77),
('CAF', 'Central African Republic', '🇨🇫', FALSE, 78),
('TCD', 'Chad', '🇹🇩', FALSE, 79),
('COM', 'Comoros', '🇰🇲', FALSE, 80),
('COG', 'Congo', '🇨🇬', FALSE, 81),
('COD', 'Democratic Republic of Congo', '🇨🇩', FALSE, 82),
('DJI', 'Djibouti', '🇩🇯', FALSE, 83),
('EGY', 'Egypt', '🇪🇬', FALSE, 84),
('GNQ', 'Equatorial Guinea', '🇬🇶', FALSE, 85),
('ERI', 'Eritrea', '🇪🇷', FALSE, 86),
('SWZ', 'Eswatini', '🇸🇿', FALSE, 87),
('ETH', 'Ethiopia', '🇪🇹', FALSE, 88),
('GAB', 'Gabon', '🇬🇦', FALSE, 89),
('GMB', 'Gambia', '🇬🇲', FALSE, 90),
('GHA', 'Ghana', '🇬🇭', FALSE, 91),
('GIN', 'Guinea', '🇬🇳', FALSE, 92),
('GNB', 'Guinea-Bissau', '🇬🇼', FALSE, 93),
('CIV', 'Ivory Coast', '🇨🇮', FALSE, 94),
('KEN', 'Kenya', '🇰🇪', FALSE, 95),
('LSO', 'Lesotho', '🇱🇸', FALSE, 96),
('LBR', 'Liberia', '🇱🇷', FALSE, 97),
('LBY', 'Libya', '🇱🇾', FALSE, 98),
('MDG', 'Madagascar', '🇲🇬', FALSE, 99),
('MWI', 'Malawi', '🇲🇼', FALSE, 100),
('MLI', 'Mali', '🇲🇱', FALSE, 101),
('MRT', 'Mauritania', '🇲🇷', FALSE, 102),
('MUS', 'Mauritius', '🇲🇺', FALSE, 103),
('MAR', 'Morocco', '🇲🇦', FALSE, 104),
('MOZ', 'Mozambique', '🇲🇿', FALSE, 105),
('NAM', 'Namibia', '🇳🇦', FALSE, 106),
('NER', 'Niger', '🇳🇪', FALSE, 107),
('NGA', 'Nigeria', '🇳🇬', FALSE, 108),
('RWA', 'Rwanda', '🇷🇼', FALSE, 109),
('STP', 'Sao Tome and Principe', '🇸🇹', FALSE, 110),
('SEN', 'Senegal', '🇸🇳', FALSE, 111),
('SYC', 'Seychelles', '🇸🇨', FALSE, 112),
('SLE', 'Sierra Leone', '🇸🇱', FALSE, 113),
('SOM', 'Somalia', '🇸🇴', FALSE, 114),
('SDN', 'Sudan', '🇸🇩', FALSE, 115),
('SSD', 'South Sudan', '🇸🇸', FALSE, 116),
('TZA', 'Tanzania', '🇹🇿', FALSE, 117),
('TGO', 'Togo', '🇹🇬', FALSE, 118),
('TUN', 'Tunisia', '🇹🇳', FALSE, 119),
('UGA', 'Uganda', '🇺🇬', FALSE, 120),
('ZMB', 'Zambia', '🇿🇲', FALSE, 121),
('ZWE', 'Zimbabwe', '🇿🇼', FALSE, 122),

-- Americas (alphabetical)
('ARG', 'Argentina', '🇦🇷', FALSE, 130),
('BRB', 'Barbados', '🇧🇧', FALSE, 131),
('BLZ', 'Belize', '🇧🇿', FALSE, 132),
('BOL', 'Bolivia', '🇧🇴', FALSE, 133),
('BRA', 'Brazil', '🇧🇷', FALSE, 134),
('CHL', 'Chile', '🇨🇱', FALSE, 135),
('COL', 'Colombia', '🇨🇴', FALSE, 136),
('CRI', 'Costa Rica', '🇨🇷', FALSE, 137),
('CUB', 'Cuba', '🇨🇺', FALSE, 138),
('DOM', 'Dominican Republic', '🇩🇴', FALSE, 139),
('ECU', 'Ecuador', '🇪🇨', FALSE, 140),
('SLV', 'El Salvador', '🇸🇻', FALSE, 141),
('GTM', 'Guatemala', '🇬🇹', FALSE, 142),
('GUY', 'Guyana', '🇬🇾', FALSE, 143),
('HTI', 'Haiti', '🇭🇹', FALSE, 144),
('HND', 'Honduras', '🇭🇳', FALSE, 145),
('JAM', 'Jamaica', '🇯🇲', FALSE, 146),
('MEX', 'Mexico', '🇲🇽', FALSE, 147),
('NIC', 'Nicaragua', '🇳🇮', FALSE, 148),
('PAN', 'Panama', '🇵🇦', FALSE, 149),
('PRY', 'Paraguay', '🇵🇾', FALSE, 150),
('PER', 'Peru', '🇵🇪', FALSE, 151),
('SUR', 'Suriname', '🇸🇷', FALSE, 152),
('TTO', 'Trinidad and Tobago', '🇹🇹', FALSE, 153),
('URY', 'Uruguay', '🇺🇾', FALSE, 154),
('VEN', 'Venezuela', '🇻🇪', FALSE, 155),

-- Oceania (alphabetical)
('FJI', 'Fiji', '🇫🇯', FALSE, 160),
('NCL', 'New Caledonia', '🇳🇨', FALSE, 161),
('PNG', 'Papua New Guinea', '🇵🇬', FALSE, 162),
('PYF', 'French Polynesia', '🇵🇫', FALSE, 163),
('SLB', 'Solomon Islands', '🇸🇧', FALSE, 164),
('VUT', 'Vanuatu', '🇻🇺', FALSE, 165),

-- Special entry for "Other" (user can type custom country)
('OTH', 'Other Country', '🌍', FALSE, 999)

ON CONFLICT (country_code) DO UPDATE SET
  country_name = EXCLUDED.country_name,
  flag_emoji = EXCLUDED.flag_emoji,
  is_primary = EXCLUDED.is_primary,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 7. Create indexes for supported_countries table
CREATE INDEX IF NOT EXISTS idx_supported_countries_is_primary ON public.supported_countries(is_primary);
CREATE INDEX IF NOT EXISTS idx_supported_countries_is_active ON public.supported_countries(is_active);
CREATE INDEX IF NOT EXISTS idx_supported_countries_display_order ON public.supported_countries(display_order);

-- 8. Create helper functions

-- Function to check if user has selected country
CREATE OR REPLACE FUNCTION public.check_country_selection(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
    AND country_selection_completed = TRUE
    AND country_of_residence IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get primary countries for display
CREATE OR REPLACE FUNCTION public.get_primary_countries()
RETURNS TABLE(
  country_code VARCHAR(3),
  country_name VARCHAR(100),
  flag_emoji VARCHAR(10)
) AS $$
BEGIN
  RETURN QUERY
  SELECT sc.country_code, sc.country_name, sc.flag_emoji
  FROM public.supported_countries sc
  WHERE sc.is_primary = TRUE AND sc.is_active = TRUE
  ORDER BY sc.display_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all countries for extended selection
CREATE OR REPLACE FUNCTION public.get_all_countries()
RETURNS TABLE(
  country_code VARCHAR(3),
  country_name VARCHAR(100),
  flag_emoji VARCHAR(10),
  is_primary BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT sc.country_code, sc.country_name, sc.flag_emoji, sc.is_primary
  FROM public.supported_countries sc
  WHERE sc.is_active = TRUE
  ORDER BY sc.is_primary DESC, sc.display_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user country
CREATE OR REPLACE FUNCTION public.update_user_country(
  p_user_id INTEGER,
  p_country_code VARCHAR(3),
  p_country_name VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE public.users
  SET
    country_of_residence = p_country_code,
    country_name = p_country_name,
    country_selection_completed = TRUE,
    country_selected_at = COALESCE(country_selected_at, NOW()),
    country_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_update_users_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.update_users_updated_at();
  END IF;
END $$;

-- 10. Grant necessary permissions
GRANT SELECT ON public.supported_countries TO authenticated;
GRANT SELECT, UPDATE ON public.users TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.check_country_selection(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_primary_countries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_countries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_country(INTEGER, VARCHAR(3), VARCHAR(100)) TO authenticated;

-- 11. Create view for country statistics
CREATE OR REPLACE VIEW public.country_statistics AS
SELECT
  u.country_of_residence,
  u.country_name,
  sc.flag_emoji,
  COUNT(*) as user_count,
  COUNT(CASE WHEN u.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30d,
  MIN(u.country_selected_at) as first_selection_date,
  MAX(u.country_selected_at) as latest_selection_date
FROM public.users u
LEFT JOIN public.supported_countries sc ON u.country_of_residence = sc.country_code
WHERE u.country_of_residence IS NOT NULL
GROUP BY u.country_of_residence, u.country_name, sc.flag_emoji
ORDER BY user_count DESC;

-- Grant access to the view
GRANT SELECT ON public.country_statistics TO authenticated;

-- 12. Add table comments
COMMENT ON TABLE public.supported_countries IS 'Reference table for supported countries with display information';
COMMENT ON VIEW public.country_statistics IS 'Statistics view showing user distribution by country';

-- 13. Create audit log for country changes
CREATE TABLE IF NOT EXISTS public.country_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  old_country_code VARCHAR(3),
  old_country_name VARCHAR(100),
  new_country_code VARCHAR(3),
  new_country_name VARCHAR(100),
  changed_by_telegram_id BIGINT,
  changed_by_username VARCHAR(255),
  change_reason VARCHAR(255),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for country change log
CREATE INDEX IF NOT EXISTS idx_country_change_log_user_id ON public.country_change_log(user_id);
CREATE INDEX IF NOT EXISTS idx_country_change_log_changed_at ON public.country_change_log(changed_at);

-- Grant permissions for audit log
GRANT SELECT, INSERT ON public.country_change_log TO authenticated;

COMMENT ON TABLE public.country_change_log IS 'Audit trail for country selection changes';
