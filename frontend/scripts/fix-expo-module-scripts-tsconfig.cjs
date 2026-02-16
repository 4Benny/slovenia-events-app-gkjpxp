const fs = require('fs');
const path = require('path');

function ensureExpoModuleScriptsTsconfigBase() {
  const packageDir = path.join(process.cwd(), 'node_modules', 'expo-module-scripts');
  const source = path.join(packageDir, 'tsconfig.base.json');
  const target = path.join(packageDir, 'tsconfig.base');

  if (!fs.existsSync(packageDir)) {
    return;
  }

  if (fs.existsSync(target)) {
    return;
  }

  if (!fs.existsSync(source)) {
    return;
  }

  fs.copyFileSync(source, target);
}

try {
  ensureExpoModuleScriptsTsconfigBase();
} catch (err) {
  // Best-effort; don't fail install.
  console.warn('[postinstall] Failed to create expo-module-scripts/tsconfig.base:', err?.message || err);
}
