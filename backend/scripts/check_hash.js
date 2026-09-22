const bcrypt = require('bcrypt');
const password = process.argv[2];
const hash = process.argv[3];
if (!password || !hash) {
  console.error('Usage: node scripts/check_hash.js <password> <hash>');
  process.exit(1);
}
(async () => {
  try {
    const ok = await bcrypt.compare(password, hash);
    console.log('match', ok);
    process.exit(0);
  } catch (e) {
    console.error('error', e && e.message);
    process.exit(1);
  }
})();
