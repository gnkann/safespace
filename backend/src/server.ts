import { createApp } from './app';
import { loadConfig } from './config/env';
import { createContainer } from './container';

async function main(): Promise<void> {
  const config = loadConfig();
  const container = createContainer(config);
  await container.bootstrap();

  // Фонові задачі: прострочені бронювання (15 хв) та email-нагадування (FR-05).
  setInterval(() => {
    container.booking.expireOverdue().catch((e) => console.error('[job:expire]', e));
    container.notifications.processDue().catch((e) => console.error('[job:notify]', e));
  }, 60_000).unref();

  createApp(container).listen(config.port, () => {
    console.log(`SafeSpace API слухає порт ${config.port} (${config.nodeEnv})`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
