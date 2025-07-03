-- Fix audit logs table column sizes
ALTER TABLE admin_audit_logs 
ALTER COLUMN action TYPE VARCHAR(255),
ALTER COLUMN target_id TYPE VARCHAR(500);

-- Also fix any other potential size issues
ALTER TABLE payment_admin_notes
ALTER COLUMN payment_id TYPE VARCHAR(500);
