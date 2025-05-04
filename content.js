// Content script for detecting security features

// Security features to detect
const securityFeatures = [
  {
    name: 'HTTPS',
    detected: window.location.protocol === 'https:'
  },
  {
    name: 'SSL Certificate',
    detected: window.location.protocol === 'https:'
  },
  {
    name: 'Content Security Policy',
    detected: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]')
  },
  {
    name: 'Secure Cookie',
    detected: document.cookie.includes('secure')
  },
  {
    name: 'HSTS',
    detected: !!document.querySelector('meta[http-equiv="Strict-Transport-Security"]')
  },
  {
    name: 'X-Content-Type-Options',
    detected: document.querySelector('meta[http-equiv="X-Content-Type-Options"][content="nosniff"]') !== null
  },
  {
    name: 'X-Frame-Options',
    detected: document.querySelector('meta[http-equiv="X-Frame-Options"]') !== null
  }
];

// Cache for security features
let securityFeaturesCache = null;

// Function to detect security features
function detectSecurityFeatures() {
  // Detect security features
  const detectedFeatures = securityFeatures.filter(feature => feature.detected);
  
  // Map features to the format expected by the popup
  const formattedFeatures = detectedFeatures.map((feature, index) => ({
    name: feature.name,
    status: 'secure'
  }));

  // If no secure features are found, add a warning about missing security
  if (formattedFeatures.length === 0) {
    formattedFeatures.push({
      name: 'Basic Security Missing',
      status: 'warning'
    });
  }
  
  // Cache the result for later requests
  securityFeaturesCache = {
    features: formattedFeatures
  };
  
  // Send results to background script
  chrome.runtime.sendMessage({
    action: 'securityFeaturesDetected',
    security: detectedFeatures.map(feature => feature.name)
  });
  
  console.log('Detected security features:', formattedFeatures);
  
  return securityFeaturesCache;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.action === 'getSecurityFeatures') {
    // If we haven't detected features yet, do it now
    if (!securityFeaturesCache) {
      securityFeaturesCache = detectSecurityFeatures();
    }
    
    // Send the cached features back to the popup
    sendResponse(securityFeaturesCache);
    return true; // Required to indicate we will respond asynchronously
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getIPFromDOM") {
    // Try to find IP information in the page content
    try {
      // This is a very simple approach that looks for IP-like strings in the page
      const pageText = document.body.innerText;
      const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
      const ips = pageText.match(ipRegex);
      
      if (ips && ips.length > 0) {
        // Filter out invalid IPs (like 0.0.0.0 or 255.255.255.255)
        const validIps = ips.filter(ip => {
          const parts = ip.split('.');
          return !(parts[0] === '0' || 
                  (parts[0] === '255' && parts[1] === '255' && parts[2] === '255' && parts[3] === '255') ||
                  (parts[0] === '127' && parts[1] === '0' && parts[2] === '0' && parts[3] === '1'));
        });
        
        if (validIps.length > 0) {
          sendResponse({ip: validIps[0]});
          return true;
        }
      }
      
      // If no IP found in the DOM, try another approach
      sendResponse({ip: null});
    } catch (error) {
      console.error('Error extracting IP from DOM:', error);
      sendResponse({ip: null});
    }
    return true;
  }
});

// Run detection automatically when the page loads
detectSecurityFeatures(); 