/**
 * Express 4.19+ throws when NestJS reads app.router. Restore lazy router access.
 * Run on postinstall so npm ci doesn't break the API.
 */
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'express', 'lib', 'application.js');
if (!fs.existsSync(target)) {
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');
const broken = `Object.defineProperty(this, 'router', {
    get: function() {
      throw new Error('\\'app.router\\' is deprecated!\\nPlease see the 3.x to 4.x migration guide for details on how to update your app.');
    }
  });`;

const fixed = `Object.defineProperty(this, 'router', {
    get: function() {
      return this._router;
    },
    configurable: true
  });`;

if (source.includes(broken)) {
  fs.writeFileSync(target, source.replace(broken, fixed), 'utf8');
  console.log('patch-express-router: applied NestJS compatibility fix');
} else if (source.includes('return this._router')) {
  console.log('patch-express-router: already patched');
} else {
  console.warn('patch-express-router: express application.js format changed — review manually');
}
