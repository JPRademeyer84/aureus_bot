-- Country Selection System Database Schema
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

-- 6. Insert supported countries data
INSERT INTO public.supported_countries (country_code, country_name, flag_emoji, is_primary, display_order) VALUES
-- Primary countries (shown first) - Updated with UAE, India, Pakistan
('ZAF', 'South Africa', '🇿🇦', TRUE, 1),
('USA', 'United States', '🇺🇸', TRUE, 2),
('GBR', 'United Kingdom', '🇬🇧', TRUE, 3),
('CAN', 'Canada', '🇨🇦', TRUE, 4),
('AUS', 'Australia', '🇦🇺', TRUE, 5),
('ARE', 'United Arab Emirates', '🇦🇪', TRUE, 6),
('IND', 'India', '🇮🇳', TRUE, 7),
('PAK', 'Pakistan', '🇵🇰', TRUE, 8),

-- Europe
('DEU', 'Germany', '🇩🇪', FALSE, 10),
('FRA', 'France', '🇫🇷', FALSE, 11),
('ITA', 'Italy', '🇮🇹', FALSE, 12),
('ESP', 'Spain', '🇪🇸', FALSE, 13),
('NLD', 'Netherlands', '🇳🇱', FALSE, 14),
('BEL', 'Belgium', '🇧🇪', FALSE, 15),
('CHE', 'Switzerland', '🇨🇭', FALSE, 16),
('AUT', 'Austria', '🇦🇹', FALSE, 17),
('SWE', 'Sweden', '🇸🇪', FALSE, 18),
('NOR', 'Norway', '🇳🇴', FALSE, 19),
('DNK', 'Denmark', '🇩🇰', FALSE, 20),
('FIN', 'Finland', '🇫🇮', FALSE, 21),
('IRL', 'Ireland', '🇮🇪', FALSE, 22),
('PRT', 'Portugal', '🇵🇹', FALSE, 23),
('GRC', 'Greece', '🇬🇷', FALSE, 24),
('POL', 'Poland', '🇵🇱', FALSE, 25),
('CZE', 'Czech Republic', '🇨🇿', FALSE, 26),
('HUN', 'Hungary', '🇭🇺', FALSE, 27),
('ROU', 'Romania', '🇷🇴', FALSE, 28),
('BGR', 'Bulgaria', '🇧🇬', FALSE, 29),

-- Asia-Pacific
('JPN', 'Japan', '🇯🇵', FALSE, 30),
('KOR', 'South Korea', '🇰🇷', FALSE, 31),
('CHN', 'China', '🇨🇳', FALSE, 32),
('SGP', 'Singapore', '🇸🇬', FALSE, 33),
('HKG', 'Hong Kong', '🇭🇰', FALSE, 34),
('NZL', 'New Zealand', '🇳🇿', FALSE, 35),
('THA', 'Thailand', '🇹🇭', FALSE, 36),
('MYS', 'Malaysia', '🇲🇾', FALSE, 37),
('IDN', 'Indonesia', '🇮�', FALSE, 38),
('PHL', 'Philippines', '��', FALSE, 39),
('VNM', 'Vietnam', '🇻🇳', FALSE, 40),
('BGD', 'Bangladesh', '🇧🇩', FALSE, 41),
('LKA', 'Sri Lanka', '�🇰', FALSE, 42),
('NPL', 'Nepal', '🇳🇵', FALSE, 43),
('AFG', 'Afghanistan', '��', FALSE, 44),

-- Middle East & Africa
('SAU', 'Saudi Arabia', '🇸🇦', FALSE, 50),
('QAT', 'Qatar', '🇶🇦', FALSE, 51),
('KWT', 'Kuwait', '🇰🇼', FALSE, 52),
('BHR', 'Bahrain', '🇧🇭', FALSE, 53),
('OMN', 'Oman', '��', FALSE, 54),
('JOR', 'Jordan', '🇯🇴', FALSE, 55),
('LBN', 'Lebanon', '🇱🇧', FALSE, 56),
('ISR', 'Israel', '🇮🇱', FALSE, 57),
('TUR', 'Turkey', '🇹🇷', FALSE, 58),
('IRN', 'Iran', '🇮🇷', FALSE, 59),
('IRQ', 'Iraq', '🇮🇶', FALSE, 60),
('EGY', 'Egypt', '🇪🇬', FALSE, 61),
('MAR', 'Morocco', '🇲🇦', FALSE, 62),
('DZA', 'Algeria', '🇩🇿', FALSE, 63),
('TUN', 'Tunisia', '🇹🇳', FALSE, 64),
('LBY', 'Libya', '🇱🇾', FALSE, 65),
('SDN', 'Sudan', '🇸🇩', FALSE, 66),
('ETH', 'Ethiopia', '🇪🇹', FALSE, 67),
('KEN', 'Kenya', '🇰🇪', FALSE, 68),
('UGA', 'Uganda', '🇺🇬', FALSE, 69),
('TZA', 'Tanzania', '🇹🇿', FALSE, 70),
('RWA', 'Rwanda', '🇷🇼', FALSE, 71),
('GHA', 'Ghana', '🇬🇭', FALSE, 72),
('NGA', 'Nigeria', '🇳🇬', FALSE, 73),
('SEN', 'Senegal', '🇸🇳', FALSE, 74),
('CIV', 'Ivory Coast', '🇨�', FALSE, 75),
('MLI', 'Mali', '�🇱', FALSE, 76),
('BFA', 'Burkina Faso', '🇧🇫', FALSE, 77),
('NER', 'Niger', '🇳�🇪', FALSE, 78),
('TCD', 'Chad', '🇹🇩', FALSE, 79),
('CMR', 'Cameroon', '🇨🇲', FALSE, 80),
('AGO', 'Angola', '🇦🇴', FALSE, 81),
('ZMB', 'Zambia', '🇿🇲', FALSE, 82),
('ZWE', 'Zimbabwe', '🇿🇼', FALSE, 83),
('BWA', 'Botswana', '🇧🇼', FALSE, 84),
('NAM', 'Namibia', '🇳🇦', FALSE, 85),
('MOZ', 'Mozambique', '🇲🇿', FALSE, 86),
('MDG', 'Madagascar', '🇲🇬', FALSE, 87),
('MUS', 'Mauritius', '🇲🇺', FALSE, 88),

-- Americas
('BRA', 'Brazil', '🇧🇷', FALSE, 90),
('MEX', 'Mexico', '🇲🇽', FALSE, 91),
('ARG', 'Argentina', '🇦🇷', FALSE, 92),
('CHL', 'Chile', '🇨🇱', FALSE, 93),
('COL', 'Colombia', '🇨🇴', FALSE, 94),
('PER', 'Peru', '🇵🇪', FALSE, 95),
('VEN', 'Venezuela', '🇻🇪', FALSE, 96),
('ECU', 'Ecuador', '🇪🇨', FALSE, 97),
('BOL', 'Bolivia', '🇧🇴', FALSE, 98),
('PRY', 'Paraguay', '🇵🇾', FALSE, 99),
('URY', 'Uruguay', '🇺🇾', FALSE, 100),
('GUY', 'Guyana', '🇬🇾', FALSE, 101),
('SUR', 'Suriname', '🇸🇷', FALSE, 102),
('GTM', 'Guatemala', '🇬🇹', FALSE, 103),
('BLZ', 'Belize', '🇧🇿', FALSE, 104),
('HND', 'Honduras', '🇭🇳', FALSE, 105),
('SLV', 'El Salvador', '🇸🇻', FALSE, 106),
('NIC', 'Nicaragua', '🇳🇮', FALSE, 107),
('CRI', 'Costa Rica', '🇨🇷', FALSE, 108),
('PAN', 'Panama', '🇵🇦', FALSE, 109),
('CUB', 'Cuba', '🇨🇺', FALSE, 110),
('DOM', 'Dominican Republic', '🇩🇴', FALSE, 111),
('HTI', 'Haiti', '🇭🇹', FALSE, 112),
('JAM', 'Jamaica', '🇯🇲', FALSE, 113),
('TTO', 'Trinidad and Tobago', '🇹🇹', FALSE, 114),
('BRB', 'Barbados', '🇧🇧', FALSE, 115),

-- Oceania
('FJI', 'Fiji', '🇫🇯', FALSE, 120),
('PNG', 'Papua New Guinea', '🇵🇬', FALSE, 121),
('VUT', 'Vanuatu', '🇻🇺', FALSE, 122),
('SLB', 'Solomon Islands', '🇸🇧', FALSE, 123),
('NCL', 'New Caledonia', '🇳🇨', FALSE, 124),
('PYF', 'French Polynesia', '🇵🇫', FALSE, 125),

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

-- 8. Add foreign key constraint (optional - can be added later)
-- ALTER TABLE public.users 
-- ADD CONSTRAINT fk_users_country_code 
-- FOREIGN KEY (country_of_residence) REFERENCES public.supported_countries(country_code);

-- 9. Create helper functions

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

-- 10. Create trigger to update updated_at timestamp
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

-- 11. Grant necessary permissions
GRANT SELECT ON public.supported_countries TO authenticated;
GRANT SELECT, UPDATE ON public.users TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.check_country_selection(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_primary_countries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_countries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_country(INTEGER, VARCHAR(3), VARCHAR(100)) TO authenticated;

-- 12. Create view for country statistics
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

-- 13. Add table comments
COMMENT ON TABLE public.supported_countries IS 'Reference table for supported countries with display information';
COMMENT ON VIEW public.country_statistics IS 'Statistics view showing user distribution by country';

-- 14. Create audit log for country changes (optional)
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
