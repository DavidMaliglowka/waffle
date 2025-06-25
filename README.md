# Waffle

A React Native app for meaningful, asynchronous video conversations between close friends. Built with Expo and Firebase.

**Repository:** [https://github.com/DavidMaliglowka/waffle](https://github.com/DavidMaliglowka/waffle)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm
- iOS Simulator (for iOS development)
- EAS CLI for building native apps

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/DavidMaliglowka/waffle
   cd waffle
   npm install
   ```

2. **Install EAS CLI globally:**
   ```bash
   npm install -g eas-cli
   eas login
   ```

### Understanding Builds vs Development Server

**Important:** Waffle uses React Native Firebase, which requires **native code**. This means you need to understand the difference between:

- **Development Server (`npx expo start`)**: Runs JavaScript only, works for web and basic testing
- **Development Build**: Compiles native iOS/Android app with all native modules included

### Running the App

#### Option 1: Web Development (Limited Features)
```bash
npx expo start --web
```
Opens in your browser at `http://localhost:8081`

**Note:** Firebase features won't work on web - this is only for UI development.

#### Option 2: iOS Simulator (Full Features) - **Recommended**
```bash
# Build and install development build (first time only - takes ~5-10 minutes)
eas build --platform ios --profile development

# Start the development server
npx expo start

# Press 'i' to open iOS Simulator, or scan QR code on physical device
```
#### Can't tap anywhere? 
**Developer Menu:** To toggle the developer menu in the iOS Simulator or on devices with reduced motion settings, press `m` in the terminal where the Expo development server is running.

#### Option 3: Physical iOS Device
1. Build the development build (same command as above)
2. Install via the QR code or Expo dashboard link
3. Start development server: `npx expo start`
4. Scan QR code with your device

### Development Workflow

1. **First time setup**: Run the development build command above
2. **Daily development**: Just run `npx expo start` - the build is cached
3. **When adding new native modules**: Rebuild with `eas build --platform ios --profile development`

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

```bash
# iOS App Store build
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

## 🛠️ Troubleshooting

### Build Issues
- **Pod installation fails**: Make sure you have the `expo-build-properties` plugin configured in `app.json`
- **Firebase errors**: Ensure `GoogleService-Info.plist` is in the project root
- **Metro bundler issues**: Clear cache with `npx expo start --clear`

### Development Server
- **Can't connect to development server**: Make sure you're on the same WiFi network
- **Hot reload not working**: Press `r` in the terminal to reload manually
- **Developer menu not appearing**: Press `m` in the terminal

### Firebase Configuration
- **Authentication errors**: Check that Firebase Auth is enabled for Apple and Phone providers
- **Storage upload fails**: Verify storage rules are deployed
- **Functions not working**: Check Functions logs in Firebase Console

## 📋 Available Scripts

```bash
npm start              # Start Expo development server
npm run web           # Start web development server
npm run ios           # Start iOS development (requires build)
npm run android       # Start Android development (requires build)
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

**Note**: This app requires iOS 15.1+ and uses native Firebase modules. Web support is limited to UI development only.

## 📱 Features

- **1-to-1 Video Messaging** with 7-day expiration
- **Apple Sign-In** and SMS verification
- **Streak Tracking** for consistent communication
- **AI-Powered Features** (planned):
  - Reply assist
  - Conversation starters
  - Relationship insights

## 🔧 Troubleshooting

### Build Issues
- Ensure `expo-build-properties` is configured for React Native Firebase
- Clear cache with `--clear-cache` flag
- Check Firebase configuration files are present

### Development Server
- Use `npx expo start --clear` to clear Metro cache
- For iOS simulator, ensure development build is installed first

### Firebase Issues
- Verify GoogleService-Info.plist is in project root
- Check Firebase project configuration in console
- Ensure security rules are properly deployed

## 📚 Documentation

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Firebase](https://rnfirebase.io/)
- [Firebase Console](https://console.firebase.google.com/)

## 🚀 Deployment

Production builds are created with EAS Build and can be submitted to the App Store using EAS Submit.

```bash
# Create production build
eas build --platform ios --profile production

# Submit to App Store (when ready)
eas submit --platform ios
``` 