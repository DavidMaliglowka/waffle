# Waffle

A React Native app for meaningful, asynchronous video conversations between close friends. Built with Expo and Firebase.

**Repository:** [https://github.com/DavidMaliglowka/waffle](https://github.com/DavidMaliglowka/waffle)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm
- Xcode (with iOS Simulator)
- CocoaPods (`sudo gem install cocoapods`)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/DavidMaliglowka/waffle
   cd waffle
   npm install
   ```

2. **Install iOS dependencies:**
   ```bash
   cd ios && pod install && cd ..
   ```

### Understanding Bare Workflow

**Important:** Waffle uses React Native Firebase and other native modules, requiring a **bare workflow**. This means:

- **Native code is included** in the repository (`ios/`)
- **Direct native builds** instead of managed Expo builds
- **Full access** to native iOS APIs and configurations

### Running the App

#### Option 1: iOS Simulator (Recommended)
```bash
npm run ios
# or directly: npx expo run:ios
```

#### Option 2: Physical iOS Device
```bash
npm run ios:device
# or directly: npx expo run:ios --device
```

#### Option 3: Web Development (Limited Features)
```bash
npm run web
# or directly: npx expo start --web
```

**Note:** Firebase features won't work on web - this is only for UI development.



### Development Workflow

1. **First time setup**: Run `npm install` and `npm run pods`
2. **Daily development**: Just run `npm run ios` or `npm start` then press 'i'
3. **When adding new native modules**: Run `npm run pods` to reinstall CocoaPods
4. **Clean builds**: Use `npm run clean` for full reset or `npm run clean:ios` for iOS only

### Troubleshooting Commands

```bash
# Full clean and reinstall
npm run clean

# iOS-only clean
npm run clean:ios

# Reinstall CocoaPods only
npm run pods

# Open in Xcode
npm run xcode
```

## 🏗️ Project Structure

```
waffle/
├── app/                    # Expo Router file-based routing
│   ├── (tabs)/            # Tab navigation
│   │   ├── chats/         # Chat-related screens
│   │   ├── invite.tsx     # Friend invitation
│   │   └── settings.tsx   # User settings
│   └── _layout.tsx        # Root layout
├── components/            # Reusable UI components
├── lib/                   # Firebase services & utilities
├── functions/             # Firebase Cloud Functions
└── assets/               # Images, fonts, etc.
```

## 🔧 Key Technologies

- **Frontend**: React Native + Expo (SDK 53)
- **Navigation**: Expo Router (file-based)
- **Backend**: Firebase (Auth, Firestore, Storage, Functions)
- **Styling**: NativeWind (Tailwind for React Native)
- **Authentication**: Apple Sign-In + SMS verification
- **Video**: Expo Camera + Firebase Storage

## 🔥 Firebase Backend

The app includes a complete Firebase backend with:

- **Authentication**: Apple Sign-In and SMS verification
- **Database**: Firestore with comprehensive data models
- **Storage**: Video file storage with security rules
- **Functions**: 5 Cloud Functions for automation and security
- **Security**: Enterprise-grade rules and monitoring

All Firebase services are configured and deployed. See `/functions` directory for backend code.

## 📱 Building for Production

### Using Xcode (Recommended)
```bash
# Open project in Xcode
npm run xcode

# Then use Xcode to:
# 1. Set build configuration to Release
# 2. Select "Any iOS Device" or your connected device
# 3. Product → Archive
# 4. Upload to App Store Connect
```

### Using EAS Build (Alternative)
```bash
# Install EAS CLI if needed
npm install -g eas-cli
eas login

# iOS App Store build
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

## 🛠️ Troubleshooting

### Build Issues
- **Pod installation fails**: Run `npm run clean:ios` or `npm run pods`
- **Build fails after adding native modules**: Run `npm run clean:ios` to reinstall pods
- **Firebase errors**: Ensure `GoogleService-Info.plist` is in the project root
- **Metro bundler issues**: Clear cache with `npx expo start --clear`
- **Xcode build failures**: Try cleaning in Xcode (⌘+Shift+K) or `npm run clean`

### Development Server
- **Can't connect to development server**: Make sure you're on the same WiFi network
- **Hot reload not working**: Press `r` in the terminal to reload manually
- **Developer menu not appearing**: Press `m` in the terminal or shake device
- **App crashes on launch**: Check console logs in Xcode or Metro terminal

### Native Module Issues
- **Module not found errors**: Run `npm run pods` to reinstall CocoaPods
- **React Native Firebase issues**: Verify Firebase configuration and rebuild
- **Camera permissions**: Check `Info.plist` and app permissions in device settings

### Firebase Configuration
- **Authentication errors**: Check that Firebase Auth is enabled for Apple and Phone providers
- **Storage upload fails**: Verify storage rules are deployed
- **Functions not working**: Check Functions logs in Firebase Console

## 📋 Available Scripts

```bash
npm start              # Start Expo development server
npm run ios            # Build and run on iOS simulator
npm run ios:device     # Build and run on physical iOS device
npm run web            # Start web development server (limited features)
npm test               # Run tests with Jest
npm run clean          # Full clean: remove build artifacts, node_modules, reinstall
npm run clean:ios      # iOS-only clean: remove build artifacts, reinstall pods
npm run pods           # Reinstall CocoaPods dependencies
npm run xcode          # Open project in Xcode
```

## 🔐 Environment Setup

### 1. Firebase Configuration

1. **Create your own Firebase project:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication (Apple Sign-In, Phone)
   - Enable Firestore Database
   - Enable Storage

2. **Download your Firebase configuration:**
   - In Firebase Console, go to Project Settings
   - Download `GoogleService-Info.plist` for iOS
   - Rename it to `GoogleService-Info.local.plist` and place in project root

3. **Update Firebase project ID:**
   - Edit `.firebaserc` and replace `your-firebase-project-id` with your actual project ID

### 2. Environment Variables

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Fill in your API keys in `.env`:
   ```
   ANTHROPIC_API_KEY=your_anthropic_key_here
   OPENAI_API_KEY=your_openai_key_here
   # ... other optional keys
   ```

For more details, see the Firebase configuration in `/lib` directory.

---

**Note**: This app uses a bare React Native workflow with native Firebase modules. iOS 15.1+ required. Web support is limited to UI development only.

## 📱 Features

- **1-to-1 Video Messaging** with 7-day expiration
- **Apple Sign-In** and SMS verification
- **Streak Tracking** for consistent communication
- **AI-Powered Features** (planned):
  - Reply assist
  - Conversation starters
  - Relationship insights

## 🔧 Troubleshooting

### Common Issues
- Run `npm run clean` for persistent build issues
- Use `npm run xcode` to debug in Xcode
- Check Metro logs and Xcode console for detailed errors

### iOS Simulator Tips
- Use `npm run ios` for quick simulator builds
- For device testing, use `npm run ios:device`
- Developer menu: Press `m` in terminal or shake device

### Firebase Issues
- Verify GoogleService-Info.plist is in project root
- Check Firebase project configuration in console
- Ensure security rules are properly deployed

## 📚 Documentation

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Firebase](https://rnfirebase.io/)
- [Firebase Console](https://console.firebase.google.com/)
- [CocoaPods Guide](https://cocoapods.org/)

## 🚀 Deployment

### Xcode (Recommended)
1. Open project: `npm run xcode`
2. Select "Any iOS Device" or connected device
3. Set build configuration to "Release"
4. Product → Archive → Upload to App Store Connect

### EAS Build (Alternative)
```bash
# Create production build
eas build --platform ios --profile production

# Submit to App Store (when ready)
eas submit --platform ios
``` 