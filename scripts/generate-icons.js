// Simple script to create placeholder icons
// You should replace these with actual icons later

const fs = require('fs');
const path = require('path');

// Create SVG icons
const createIcon = (size) => {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#2563eb" rx="${size * 0.15}"/>
  <text x="50%" y="50%" font-size="${size * 0.5}" fill="white" text-anchor="middle" dy=".35em" font-family="Arial, sans-serif" font-weight="bold">P</text>
</svg>`;
};

// Save icons
const publicDir = path.join(__dirname, '..', 'public');

fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), createIcon(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), createIcon(512));

console.log('✅ Icons generated successfully!');
console.log('📝 Note: Replace these with actual PNG icons for better quality');
