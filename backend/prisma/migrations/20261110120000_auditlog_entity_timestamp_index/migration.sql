-- Report file-version history filters AuditLog by (entityType, entityId) and orders by timestamp
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_timestamp_idx" ON "AuditLog"("entityType", "entityId", "timestamp");
