
-- Drop existing foreign keys and recreate with ON DELETE CASCADE

-- campaign_tls
ALTER TABLE campaign_tls DROP CONSTRAINT campaign_tls_campaign_id_fkey;
ALTER TABLE campaign_tls ADD CONSTRAINT campaign_tls_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- campaign_agent_roles
ALTER TABLE campaign_agent_roles DROP CONSTRAINT campaign_agent_roles_campaign_id_fkey;
ALTER TABLE campaign_agent_roles ADD CONSTRAINT campaign_agent_roles_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- campaign_data_operations
ALTER TABLE campaign_data_operations DROP CONSTRAINT campaign_data_operations_campaign_id_fkey;
ALTER TABLE campaign_data_operations ADD CONSTRAINT campaign_data_operations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- campaign_websites
ALTER TABLE campaign_websites DROP CONSTRAINT campaign_websites_campaign_id_fkey;
ALTER TABLE campaign_websites ADD CONSTRAINT campaign_websites_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- leads
ALTER TABLE leads DROP CONSTRAINT leads_campaign_id_fkey;
ALTER TABLE leads ADD CONSTRAINT leads_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- lead_import_logs
ALTER TABLE lead_import_logs DROP CONSTRAINT lead_import_logs_campaign_id_fkey;
ALTER TABLE lead_import_logs ADD CONSTRAINT lead_import_logs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- data_requests
ALTER TABLE data_requests DROP CONSTRAINT data_requests_campaign_id_fkey;
ALTER TABLE data_requests ADD CONSTRAINT data_requests_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
