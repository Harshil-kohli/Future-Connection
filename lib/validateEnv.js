// Validate required environment variables on startup
const requiredEnvVars = [
  'MONGODB_URI',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
];

const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach((envVar) => {
    console.error(`   - ${envVar}`);
  });
  throw new Error('Missing required environment variables. Check .env.local file.');
}

// Warn about optional OAuth providers
const optionalVars = [
  { name: 'GOOGLE_ID', pair: 'GOOGLE_SECRET' },
  { name: 'GITHUB_ID', pair: 'GITHUB_SECRET' },
];

optionalVars.forEach(({ name, pair }) => {
  const hasOne = process.env[name] || process.env[pair];
  const hasBoth = process.env[name] && process.env[pair];
  
  if (hasOne && !hasBoth) {
    console.warn(`⚠️  Warning: ${name} or ${pair} is missing. OAuth provider will not work.`);
  }
});

console.log('✅ Environment variables validated');
