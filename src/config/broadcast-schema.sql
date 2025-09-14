-- SQL schema for broadcast system
-- Tables for managing mass messaging campaigns

-- Table to store broadcast campaigns
CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  message_text TEXT,
  image_url TEXT,
  image_caption TEXT,
  campaign_type VARCHAR(50) NOT NULL CHECK (campaign_type IN ('text_only', 'image_only', 'text_and_image')),
  status VARCHAR(50) DEFAULT 'created' CHECK (status IN ('created', 'in_progress', 'completed', 'failed', 'cancelled')),
  total_recipients INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  blocked_users INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(100), -- admin user who created the campaign
  notes TEXT
);

-- Table to track individual message deliveries
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL, -- Telegram user ID (64-bit integer)
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'blocked')),
  delivery_attempt INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  telegram_message_id INTEGER, -- Telegram's message ID if sent successfully
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status ON broadcast_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_created_at ON broadcast_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign_id ON broadcast_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_user_id ON broadcast_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_status ON broadcast_recipients(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign_status ON broadcast_recipients(campaign_id, status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on broadcast_recipients
CREATE TRIGGER update_broadcast_recipients_updated_at 
    BEFORE UPDATE ON broadcast_recipients 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- View for campaign statistics
CREATE OR REPLACE VIEW broadcast_campaign_stats AS
SELECT 
  c.id,
  c.name,
  c.campaign_type,
  c.status,
  c.created_at,
  c.started_at,
  c.completed_at,
  c.total_recipients,
  COUNT(r.id) as actual_recipients,
  COUNT(CASE WHEN r.status = 'sent' THEN 1 END) as successful_deliveries,
  COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed_deliveries,
  COUNT(CASE WHEN r.status = 'blocked' THEN 1 END) as blocked_users,
  COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_deliveries,
  CASE 
    WHEN COUNT(r.id) > 0 THEN 
      ROUND((COUNT(CASE WHEN r.status = 'sent' THEN 1 END)::decimal / COUNT(r.id) * 100), 2)
    ELSE 0 
  END as success_rate_percent
FROM broadcast_campaigns c
LEFT JOIN broadcast_recipients r ON c.id = r.campaign_id
GROUP BY c.id, c.name, c.campaign_type, c.status, c.created_at, c.started_at, c.completed_at, c.total_recipients;

-- Comment on tables and columns
COMMENT ON TABLE broadcast_campaigns IS 'Stores broadcast campaign information';
COMMENT ON TABLE broadcast_recipients IS 'Tracks delivery status for each recipient in broadcast campaigns';
COMMENT ON COLUMN broadcast_campaigns.campaign_type IS 'Type of campaign: text_only, image_only, or text_and_image';
COMMENT ON COLUMN broadcast_campaigns.status IS 'Campaign status: created, in_progress, completed, failed, cancelled';
COMMENT ON COLUMN broadcast_recipients.user_id IS 'Telegram user ID (64-bit integer)';
COMMENT ON COLUMN broadcast_recipients.status IS 'Delivery status: pending, sent, failed, blocked';
COMMENT ON VIEW broadcast_campaign_stats IS 'Aggregated statistics for broadcast campaigns';