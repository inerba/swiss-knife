const sharp = require(process.env.SWISS_NODE_MODULES + '/sharp');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { PocketKnife } = require('lucide-react');

const knife = renderToStaticMarkup(React.createElement(PocketKnife, {
  color: 'white', size: 82, strokeWidth: 1.8, absoluteStrokeWidth: true,
}));
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="4" y="4" width="120" height="120" rx="28" fill="#a93728"/><g transform="translate(23 23)">${knife}</g></svg>`);
Promise.all([16,32,48,96,128].map(size => sharp(svg).resize(size,size).png().toFile(`public/icon/${size}.png`))).catch(error => { console.error(error); process.exitCode=1; });
