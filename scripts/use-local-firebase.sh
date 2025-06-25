#!/bin/bash
# Switch to local Firebase configuration for development

echo "🔄 Switching to local Firebase configuration..."

# Use local Firebase config
if [ -f .firebaserc.local ]; then
    cp .firebaserc.local .firebaserc
    echo "✅ Using local Firebase project: snapconnect-30043"
else
    echo "❌ .firebaserc.local not found. Create it with your Firebase project ID."
fi

echo "🎉 Ready for local development!" 