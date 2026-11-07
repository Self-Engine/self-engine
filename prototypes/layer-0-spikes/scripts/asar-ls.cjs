// Lists app.asar entries (skips better-sqlite3 sources). Usage: node scripts/asar-ls.cjs <app.asar>
const asar = require("../node_modules/.pnpm/@electron+asar@3.4.1/node_modules/@electron/asar");
for (const f of asar.listPackage(process.argv[2], {}))
  if (!/better-sqlite3\/(deps|src)\//.test(f)) console.log(f);
