import { execSync } from 'child_process';

process.env.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION = "yes";

try {
  console.log('Resetting database...');
  execSync('npx prisma migrate reset --force', {
    stdio: 'inherit',
    env: {
      ...process.env,
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes"
    }
  });
  console.log('Database reset complete!');
} catch (error) {
  console.error('Error resetting database:', error.message);
  process.exit(1);
}
