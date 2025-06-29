#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Configuring Firebase for current environment...');

// Check if this is an EAS build environment
const isEAS = process.env.EAS_BUILD === 'true';
const googleServicesBase64 = process.env.GOOGLE_SERVICES_PLIST;

if (isEAS && googleServicesBase64) {
  console.log('📱 EAS Build detected - configuring for production');
  
  try {
    // 1. Generate Firebase config from environment variable
    const plistContent = Buffer.from(googleServicesBase64, 'base64').toString('utf8');
    const outputPath = path.join(__dirname, '..', 'GoogleService-Info.plist');
    fs.writeFileSync(outputPath, plistContent);
    console.log('✅ Production Firebase config generated from environment variable');
    
    // 2. Update app.json to use production config
    const appJsonPath = path.join(__dirname, '..', 'app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    
    if (appJson.expo.ios.googleServicesFile !== './GoogleService-Info.plist') {
      appJson.expo.ios.googleServicesFile = './GoogleService-Info.plist';
      fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
      console.log('✅ Updated app.json to use production Firebase config');
    }
    
  } catch (error) {
    console.error('❌ Error configuring production Firebase:', error.message);
    process.exit(1);
  }
  
} else {
  console.log('🏠 Local development environment detected');
  
  // 1. Ensure app.json uses local config
  const appJsonPath = path.join(__dirname, '..', 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  
  if (appJson.expo.ios.googleServicesFile !== './GoogleService-Info.local.plist') {
    appJson.expo.ios.googleServicesFile = './GoogleService-Info.local.plist';
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
    console.log('✅ Updated app.json to use local Firebase config');
  }
  
  // 2. Handle local Firebase config
  if (googleServicesBase64) {
    // If env var exists, use it (useful for local testing with prod config)
    try {
      const plistContent = Buffer.from(googleServicesBase64, 'base64').toString('utf8');
      const outputPath = path.join(__dirname, '..', 'GoogleService-Info.plist');
      fs.writeFileSync(outputPath, plistContent);
      console.log('✅ Firebase config generated from environment variable');
    } catch (error) {
      console.error('❌ Error generating Firebase config:', error.message);
      process.exit(1);
    }
  } else {
    // Check if local file exists
    const localFile = path.join(__dirname, '..', 'GoogleService-Info.local.plist');
    
    if (!fs.existsSync(localFile)) {
      console.error('❌ No Firebase configuration found!');
      console.error('   Either set GOOGLE_SERVICES_PLIST environment variable or ensure GoogleService-Info.local.plist exists');
      process.exit(1);
    }
    console.log('✅ Using existing local Firebase config');
  }
} 