/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Waffle Brand Colors from PRD
        'waffle': {
          'cream': '#FAF7F2',     // Creamy White
          'yellow': '#FDB833',    // Waffle Yellow  
          'orange': '#E57345',    // Burnt Orange
          'charcoal': '#3A3A3A',  // Dark Charcoal
        },
        // Additional semantic colors
        'primary': '#FDB833',     // Waffle Yellow as primary
        'secondary': '#E57345',   // Burnt Orange as secondary
        'background': '#FAF7F2',  // Creamy White as background
        'surface': '#FFFFFF',     // Pure white for surfaces
        'text': '#3A3A3A',        // Dark Charcoal for text
      },
      fontFamily: {
        // Using SpaceMono as fallback for all fonts until Poppins and Inter are added
        'header': ['SpaceMono'],
        'header-medium': ['SpaceMono'],
        'header-bold': ['SpaceMono'],
        'header-extrabold': ['SpaceMono'],
        
        'body': ['SpaceMono'],
        'body-medium': ['SpaceMono'],
        'body-semibold': ['SpaceMono'],
        'body-bold': ['SpaceMono'],
      },
      spacing: {
        // Custom spacing scale
        'xs': '4px',
        'sm': '8px', 
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        'xxl': '48px',
      },
      borderRadius: {
        'waffle': '12px',  // Signature Waffle border radius
      }
    },
  },
  plugins: [],
}

