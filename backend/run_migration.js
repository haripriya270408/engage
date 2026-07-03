const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

const pwd = encodeURIComponent('-Lc?fFBd!9yi+/j');
const projectRef = 'dsvoksxvftgbcxodnvhe';

async function resolveHost(hostname) {
  return new Promise((resolve, reject) => {
    dns.resolve4(hostname, (err, addresses) => {
      if (err) {
        dns.resolve6(hostname, (err6, addrs6) => {
          if (err6) reject(err);
          else resolve(addrs6);
        });
      } else {
        resolve(addresses);
      }
    });
  });
}

async function main() {
  let pool = null;
  let hosts;
  try {
    const dbIps = await resolveHost(`db.${projectRef}.supabase.co`);
    console.log('DB host resolved to:', dbIps);
    hosts = dbIps.map(ip => `postgresql://postgres:${pwd}@${ip}:5432/postgres?host=${projectRef}`);
  } catch (e) {
    console.log('Could not resolve db host via dns module, trying alternatives...');
    hosts = [
      `postgresql://postgres:${pwd}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`,
      `postgresql://postgres:${pwd}@${projectRef}.supabase.co:5432/postgres?sslmode=require`,
    ];
  }

  for (const connStr of hosts) {
    const opts = { connectionString: connStr, connectionTimeoutMillis: 10000, ssl: { rejectUnauthorized: false } };
    console.log(`Trying connection... (host: ${new URL(connStr).hostname})`);
    const p = new Pool(opts);
    try {
      const res = await p.query('SELECT 1 AS test');
      console.log('Connected successfully!');
      pool = p;
      break;
    } catch (err) {
      console.log(`Failed: ${err.message}`);
      await p.end().catch(() => {});
    }
  }

  if (!pool) {
    console.error('Could not connect to any database host.');
    process.exit(1);
  }

  const sql = fs.readFileSync(path.join(__dirname, 'per_user_salesforce.sql'), 'utf8');
  console.log('Executing per_user_salesforce.sql...');
  await pool.query(sql);
  console.log('Migration executed successfully!');
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
