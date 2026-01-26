/**
 * Shared configuration for PR Router
 */
import sql from "mssql";

// SQL Server configuration (SAP B1)
export const sqlConfig: sql.config = {
  server: '10.1.1.199',
  database: 'TMK_PRD',
  user: 'powerquery_hq',
  password: '@Tmk963*',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};
