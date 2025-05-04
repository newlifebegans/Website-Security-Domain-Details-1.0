
let visitedDomains = {};
let ipCache = {};
let faviconCache = {};


const tabStatus = {};
const tabSecurityFeatures = {};
const API_TIMEOUT = 1500;

// Set current URL for context
let currentUrl = '';
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (tab && tab.url) {
      currentUrl = tab.url;
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Website Security & Server Information extension installed');

  chrome.storage.local.get(['ipCache'], (result) => {
    if (result.ipCache) {
      ipCache = result.ipCache;
    }
  });
});


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname;
      const isSecure = url.protocol === 'https:';

      tabStatus[tabId] = {
        domain: domain,
        isSecure: isSecure
      };
      
      updateSecurityIcon(tabId, isSecure);
      if (tab.favIconUrl) {
        tabStatus[tabId].favIconUrl = tab.favIconUrl;
      }
    } catch (e) {
      console.error('Error processing URL:', e);
      updateSecurityIcon(tabId, false);
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabStatus[tabId];
  delete tabSecurityFeatures[tabId];
});

function updateIconColor(tabId, isSecure) {
  const color = isSecure ? 'green' : 'red';
  
  chrome.action.setIcon({
    tabId: tabId,
    path: {
      16: `icons/icon16${color === 'green' ? '' : '_red'}.png`,
      48: `icons/icon48${color === 'green' ? '' : '_red'}.png`,
      128: `icons/icon128${color === 'green' ? '' : '_red'}.png`
    }
  });
}

function updateSecurityIcon(tabId, isSecure) {
  try {

    const canvas = new OffscreenCanvas(48, 48);
    const ctx = canvas.getContext('2d');
    

    ctx.clearRect(0, 0, 48, 48);
    ctx.beginPath();
    ctx.arc(24, 24, 24, 0, 2 * Math.PI);
    ctx.fillStyle = isSecure ? '#10B981' : '#6B7280'; // Green for secure, gray for insecure
    ctx.fill();
    
    if (isSecure) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(14, 24);
      ctx.lineTo(22, 32);
      ctx.lineTo(34, 16);
      ctx.stroke();
    } else {

      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      

      ctx.beginPath();
      ctx.moveTo(12, 24);
      ctx.lineTo(36, 24);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(24, 12);
      ctx.lineTo(24, 36);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(24, 24, 12, 0, 2 * Math.PI);
      ctx.stroke();
    }
    
    canvas.convertToBlob().then(blob => {
      const reader = new FileReader();
      reader.onloadend = function() {
        const dataUrl = reader.result;
        chrome.action.setIcon({
          tabId: tabId,
          path: dataUrl
        });
      };
      reader.readAsDataURL(blob);
    }).catch(error => {
      console.error('Error creating icon:', error);
      updateIconColor(tabId, isSecure);
    });
  } catch (error) {
    console.error('Error with canvas icon creation:', error);
    updateIconColor(tabId, isSecure);
  }
}

function updateExtensionIcon(tabId, faviconUrl, domain) {
  if (faviconCache[domain]) {
    chrome.action.setIcon({
      tabId: tabId,
      path: faviconCache[domain]
    });
    return;
  }

  updateIconColor(tabId, false);
  fetch(faviconUrl)
    .then(response => response.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onloadend = function() {
        const dataUrl = reader.result;
        faviconCache[domain] = dataUrl;
        
        chrome.action.setIcon({
          tabId: tabId,
          path: dataUrl
        });
      };
      reader.readAsDataURL(blob);
    })
    .catch(error => {
      console.error('Error loading favicon:', error);
    });
}

function isSecureDomain(domain) {
  if (domain.endsWith('.gov') || 
      domain.endsWith('.edu') || 
      domain.endsWith('.mil') || 
      domain === 'github.com' ||
      domain.endsWith('.github.io')) {
    return true;
  }
  
  try {
    if (currentUrl && new URL(currentUrl).protocol === 'https:') {
      return true;
    }
  } catch (e) {
  }
  
  return false;
}

function timeoutPromise(ms, message = 'Request timed out') {
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error(message)), ms)
  );
}

async function resolveIPManually(domain) {
  try {
    const ipifyPromise = fetch('https://api.ipify.org?format=json')
      .then(response => response.json())
      .then(ipData => {
        return {
          ip: ipData.ip || domain,
          country: "Information Unavailable",
          countryCode: "UN",
          city: "Information Unavailable",
          region: "Information Unavailable",
          org: domain,
          source: "Direct Connection"
        };
      });
    
    return await Promise.race([
      ipifyPromise,
      timeoutPromise(API_TIMEOUT/2, `IP lookup timed out for ${domain}`)
    ]);
  } catch (error) {
    console.error("IP resolution failed:", error);
    
    return {
      ip: domain,
      country: "Information Unavailable",
      countryCode: "UN",
      city: "Information Unavailable",
      region: "Information Unavailable",
      org: domain,
      source: "Domain Name"
    };
  }
}

async function fetchIpInfo(domain) {
  if (ipCache[domain] && ipCache[domain].timestamp) {
    const cacheAge = Date.now() - ipCache[domain].timestamp;
    if (cacheAge < 3600000) { // 1 hour in milliseconds
      console.log(`Using cached IP info for ${domain}`);
      return ipCache[domain].data;
    }
  }
  
  try {
    const data = await resolveIPManually(domain);
    
    if (data) {
      ipCache[domain] = {
        data: data,
        timestamp: Date.now()
      };

      chrome.storage.local.set({ ipCache: ipCache });
      return data;
    }
  } catch (error) {
    console.error(`IP lookup failed for ${domain}: ${error.message}`);
  }
  
  return {
    ip: domain,
    country: "Information Unavailable",
    countryCode: "UN",
    city: "Information Unavailable",
    region: "Information Unavailable",
    org: domain,
    source: "No Information Available",
    error: true
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "securityFeaturesDetected") {
    console.log('Security features detected:', message.security);
    if (sender.tab && sender.tab.id) {
      const tabId = sender.tab.id;
      
      tabSecurityFeatures[tabId] = message.security;
      chrome.storage.session.set({ 
        [`tab-${tabId}-security`]: message.security
      });
      const hasSecurityFeatures = message.security && 
        (message.security.includes('HTTPS') || message.security.includes('SSL Certificate'));
      updateSecurityIcon(tabId, hasSecurityFeatures);
    }
    
    return true;
  }
  

  if (message.action === "getIpInfo") {
    try {
      const url = new URL(message.url);
      const domain = url.hostname;
      sendResponse({ status: "fetching" });
      const timeoutId = setTimeout(() => {
        chrome.runtime.sendMessage({
          action: "ipInfoResult",
          domain: domain,
          ipInfo: {
            ip: domain,
            country: "Information Unavailable",
            countryCode: "UN",
            city: "Information Unavailable",
            region: "Information Unavailable",
            org: domain,
            source: "Timeout",
            error: true
          }
        }).catch(error => {
          console.log("Could not send fallback IP data to popup:", error);
        });
      }, API_TIMEOUT * 1.5);
      
      // Fetch IP info
      fetchIpInfo(domain).then((ipInfo) => {
        clearTimeout(timeoutId);
        
        if (!ipInfo) {
          ipInfo = {
            ip: domain,
            country: "Information Unavailable",
            countryCode: "UN",
            city: "Information Unavailable",
            region: "Information Unavailable",
            org: domain,
            source: "Error",
            error: true
          };
        }
        
        chrome.runtime.sendMessage({
          action: "ipInfoResult",
          domain: domain,
          ipInfo: ipInfo
        }).catch(error => {
          console.log("Could not send IP data to popup:", error);
        });
      }).catch(error => {
        clearTimeout(timeoutId);
        console.error(`Error fetching IP data: ${error.message}`);
        chrome.runtime.sendMessage({
          action: "ipInfoResult",
          domain: domain,
          ipInfo: {
            ip: domain,
            country: "Information Unavailable",
            countryCode: "UN",
            city: "Information Unavailable", 
            region: "Information Unavailable",
            org: domain,
            source: "Error",
            error: true
          }
        }).catch(sendError => {
          console.log("Could not send error IP data to popup:", sendError);
        });
      });
    } catch (error) {
      sendResponse({ 
        status: "error", 
        error: "Invalid URL provided" 
      });
    }
    return true;
  }
  
  if (message.action === "getSecurityFeatures") {
    const tabId = message.tabId || (sender.tab && sender.tab.id);
    
    if (!tabId) {
      sendResponse({ error: "No tab ID provided" });
      return true;
    }
    
    if (tabSecurityFeatures[tabId]) {
      sendResponse({ 
        features: tabSecurityFeatures[tabId].map(name => ({
          name,
          status: 'secure'
        }))
      });
      return true;
    }
    

    chrome.storage.session.get([`tab-${tabId}-security`], (result) => {
      const storedFeatures = result[`tab-${tabId}-security`];
      if (storedFeatures && storedFeatures.length > 0) {
        const formattedFeatures = storedFeatures.map(name => ({
          name,
          status: 'secure'
        }));
        
        sendResponse({ features: formattedFeatures });
      } else {
        sendResponse({ features: [] });
      }
    });
    return true;
  }
});

function getWebsiteInfo() {
  const info = {
    title: document.title,
    url: window.location.href,
    protocol: window.location.protocol,
    isSecure: window.location.protocol === 'https:',
    hasSslElements: document.querySelectorAll('link[rel="canonical"][href^="https://"], meta[content^="https://"]').length > 0,
    favicon: ""
  };
  
  // Try to get favicon
  const faviconEl = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
  if (faviconEl) {
    info.favicon = faviconEl.href;
  } else {
    const potentialFavicons = [
      `${window.location.origin}/favicon.ico`,
      `${window.location.origin}/favicon.png`,
      `${window.location.origin}/apple-touch-icon.png`,
      `${window.location.origin}/apple-touch-icon-precomposed.png`
    ];
    info.favicon = potentialFavicons[0];
  }
  
  return info;
}


chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => {
    if (tab.url) {
      try {
        const url = new URL(tab.url);
        const domain = url.hostname;
        const isSecure = url.protocol === 'https:';
        tabStatus[tab.id] = {
          domain: domain,
          isSecure: isSecure
        };
        
        // Update icon based on security status
        updateSecurityIcon(tab.id, isSecure);
        if (tab.favIconUrl) {
          tabStatus[tab.id].favIconUrl = tab.favIconUrl;
        }
      } catch (e) {
        // Invalid URL
        console.error('Error processing URL during initialization:', e);
        updateSecurityIcon(tab.id, false);
      }
    }
  });
});

// Function to set a fixed extension icon that won't change between sites
function setFixedExtensionIcon() {
  // Try to set PNG icons (simplest approach)
  try {
    chrome.action.setIcon({
      path: "icons/icon48.png"
    });
  } catch (error) {
    console.error('Error setting icon:', error);
  }
} 