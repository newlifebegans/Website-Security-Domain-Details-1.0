// JavaScript for popup UI

document.addEventListener('DOMContentLoaded', () => {
  const loadingContainer = document.getElementById('loading-container');
  const contentContainer = document.getElementById('content-container');
  const websiteTitle = document.getElementById('website-title');
  const favicon = document.getElementById('favicon');
  const faviconOverlay = document.querySelector('.favicon-overlay');
  const securityFeatures = document.getElementById('security-features');
  const httpsBadge = document.getElementById('https-badge');
  
  // Server info elements
  const ipLoading = document.getElementById('ip-loading');
  const ipInfoContent = document.getElementById('ip-info-content');
  const ipAddressElement = document.getElementById('ip-address');
  const hostnameElement = document.getElementById('hostname');
  const serverInfoSection = document.getElementById('server-info-section');
  
  let securityData = null;
  let currentTab = null;
  
  // Initialize
  init();
  
  // Add event listener for when popup is about to close
  window.addEventListener('beforeunload', saveDataBeforeClose);
  
  // Initialize the popup
  async function init() {
    try {
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tabs[0];
      
      if (!currentTab) {
        throw new Error('No active tab found');
      }
      
      // Try to load saved data for this tab first
      const savedData = await loadSavedData(currentTab.id);
      
      if (savedData && !isDataStale(savedData)) {
        // If we have recent saved data, use it immediately
        restoreFromSavedData(savedData);
        // But still fetch updated data in the background
        fetchUpdatedData();
      } else {
        // Set website info
        updateWebsiteInfo(currentTab);
        
        // Check if this is a valid URL for checking features
        if (isValidUrl(currentTab.url)) {
          // Get security features from content script
          await getSecurityFeatures();
          
          // Get IP info for the domain
          try {
            const url = new URL(currentTab.url);
            getIpInfo(url.hostname);
          } catch (error) {
            console.error('Error parsing URL:', error);
            showIpError('Invalid URL format');
          }
        } else {
          // Skip security features and server information for new tabs, browser pages, etc.
          showUnsupportedPageMessage();
        }
      }
    } catch (error) {
      console.error('Initialization error:', error);
      showFallbackContent();
    }
  }
  
  // Check if URL is valid for server information lookup
  function isValidUrl(url) {
    if (!url) return false;
    
    try {
      const parsedUrl = new URL(url);
      
      // Skip chrome://, about:, file:// and other browser internal pages
      if (['chrome:', 'about:', 'file:', 'edge:', 'brave:', 'opera:', 'vivaldi:', 'firefox:'].includes(parsedUrl.protocol.replace(':', ''))) {
        return false;
      }
      
      // Skip empty hostnames or localhost
      if (!parsedUrl.hostname || parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
        return false;
      }
      
      // Skip new tab pages
      if (url.includes('/_/chrome/newtab') || url.includes('chrome://newtab') || url === 'about:blank') {
        return false;
      }
      
      return true;
    } catch (e) {
      return false;
    }
  }
  
  // Fetch updated data in the background (called when we restored from cached data)
  async function fetchUpdatedData() {
    try {
      // Only update features and IP info if it's a valid URL
      if (isValidUrl(currentTab.url)) {
        await getSecurityFeatures(false);
        
        try {
          const url = new URL(currentTab.url);
          getIpInfo(url.hostname, false);
        } catch (error) {
          console.error('Error parsing URL in background update:', error);
        }
      }
    } catch (error) {
      console.error('Background update error:', error);
    }
  }
  
  // Save data before popup closes
  function saveDataBeforeClose() {
    if (currentTab && securityData) {
      const dataToSave = {
        tabId: currentTab.id,
        url: currentTab.url,
        title: currentTab.title,
        favIconUrl: currentTab.favIconUrl,
        securityData: securityData,
        ipAddress: ipAddressElement.textContent,
        hostname: hostnameElement.textContent,
        timestamp: Date.now()
      };
      
      chrome.storage.local.set({ [`tab_${currentTab.id}`]: dataToSave }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving data:', chrome.runtime.lastError);
        }
      });
    }
  }
  
  // Load saved data for a tab
  async function loadSavedData(tabId) {
    return new Promise((resolve) => {
      chrome.storage.local.get([`tab_${tabId}`], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading saved data:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(result[`tab_${tabId}`] || null);
        }
      });
    });
  }
  
  // Check if saved data is too old (older than 5 minutes)
  function isDataStale(data) {
    const now = Date.now();
    const fiveMinutesMs = 5 * 60 * 1000;
    return !data.timestamp || (now - data.timestamp) > fiveMinutesMs;
  }
  
  // Restore UI from saved data
  function restoreFromSavedData(data) {
    try {
      // Restore website info
      websiteTitle.textContent = data.title || 'Unknown Page';
      favicon.src = data.favIconUrl || 'icons/globe.svg';
      
      // Restore security features
      securityData = data.securityData;
      if (securityData && securityData.features) {
        displaySecurityFeatures(securityData.features);
        updateFaviconSecurityIndicator(securityData.features);
      }
      
      // Restore HTTPS badge
      try {
        const url = new URL(data.url);
        const isSecure = url.protocol === 'https:';
        
        // Always show the badge, but with different styles based on security
        httpsBadge.style.display = 'flex';
        
        if (isSecure) {
          // Secure site
          httpsBadge.classList.remove('insecure');
          
          // Update the lock icon for secure sites
          httpsBadge.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Secure
          `;
        } else {
          // Insecure site
          httpsBadge.classList.add('insecure');
          
          // Update the icon and text for insecure sites
          httpsBadge.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Not Secure
          `;
        }
      } catch (e) {
        httpsBadge.style.display = 'none';
      }
      
      // Restore IP info
      if (data.ipAddress && data.ipAddress !== 'Loading...' && data.ipAddress !== 'IP lookup unavailable') {
        ipAddressElement.textContent = data.ipAddress;
        hostnameElement.textContent = data.hostname || '';
        
        ipLoading.style.display = 'none';
        ipInfoContent.style.display = 'block';
        
        setupCopyFunctionality();
      }
      
      // Show content container, hide loading
      loadingContainer.style.display = 'none';
      contentContainer.style.display = 'block';
    } catch (error) {
      console.error('Error restoring from saved data:', error);
      // Fall back to normal loading if restoration fails
      updateWebsiteInfo(currentTab);
      getSecurityFeatures();
      try {
        const url = new URL(currentTab.url);
        getIpInfo(url.hostname);
      } catch (e) {
        showIpError('Invalid URL format');
      }
    }
  }
  
  // Update website information in the header
  function updateWebsiteInfo(tab) {
    try {
      const url = new URL(tab.url);
      websiteTitle.textContent = tab.title || 'Unknown Page';
      favicon.src = tab.favIconUrl || 'icons/globe.svg';
      
      faviconOverlay.style.display = 'none';
      
      // Update HTTPS badge based on protocol
      const isSecure = url.protocol === 'https:';
      
      // Always show the badge, but with different styles based on security
      httpsBadge.style.display = 'flex';
      
      if (isSecure) {
        // Secure site
        httpsBadge.textContent = 'Secure';
        httpsBadge.classList.remove('insecure');
        
        // Update the lock icon for secure sites
        httpsBadge.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Secure
        `;
      } else {
        // Insecure site
        httpsBadge.classList.add('insecure');
        
        // Update the icon and text for insecure sites
        httpsBadge.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Not Secure
        `;
      }
    } catch (error) {
      console.error('Error updating website info:', error);
      websiteTitle.textContent = 'Unknown Page';
      favicon.src = 'icons/globe.svg';
      faviconOverlay.style.display = 'none';
      
      // Hide badge on error
      httpsBadge.style.display = 'none';
    }
  }
  
  // Get security features from content script
  async function getSecurityFeatures(showLoading = true) {
    try {
      if (showLoading) {
        loadingContainer.style.display = 'flex';
        contentContainer.style.display = 'none';
      }
      
      const messagePromise = sendMessageWithTimeout(currentTab.id, { action: 'getSecurityFeatures' }, 3000);
      const response = await messagePromise;
      
      if (!response) {
        throw new Error('Content script did not respond');
      }
      
      securityData = response;
      
      // Display security features
      displaySecurityFeatures(securityData.features);
      
      // Update favicon checkmark based on security features
      updateFaviconSecurityIndicator(securityData.features);
      
      if (showLoading) {
        loadingContainer.style.display = 'none';
        contentContainer.style.display = 'block';
      }
      
      saveDataBeforeClose();
    } catch (error) {
      console.error('Error getting security features:', error);
      
      if (showLoading) {
        loadingContainer.style.display = 'none';
        contentContainer.style.display = 'block';
        
        securityFeatures.innerHTML = `
          <div class="security-feature warning">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Content script not loaded. Try refreshing the page.
          </div>
        `;
      }
    }
  }
  
  // Update favicon security indicator based on detected features
  function updateFaviconSecurityIndicator(features) {
    if (!features || features.length === 0) {
      faviconOverlay.style.display = 'none';
      return;
    }
    
    const hasSecureFeatures = features.some(feature => feature.status === 'secure');
    faviconOverlay.style.display = hasSecureFeatures ? 'flex' : 'none';
  }
  
  // Send a message with timeout to prevent hanging
  function sendMessageWithTimeout(tabId, message, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeout);
      
      chrome.tabs.sendMessage(tabId, message, response => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
  
  // Display security features
  function displaySecurityFeatures(features) {
    securityFeatures.innerHTML = '';
    
    if (!features || features.length === 0) {
      securityFeatures.innerHTML = `
        <div class="security-feature warning">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          No security features detected
        </div>
      `;
      return;
    }
    
    features.forEach((feature, index) => {
      const featureElement = document.createElement('div');
      featureElement.className = `security-feature ${feature.status}`;
      featureElement.style.setProperty('--index', index);
      
      featureElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${feature.status === 'secure' 
            ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
            : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
        </svg>
        ${feature.name}
      `;
      
      securityFeatures.appendChild(featureElement);
    });
  }
  
  // Show fallback content when initialization fails
  function showFallbackContent() {
    loadingContainer.style.display = 'none';
    contentContainer.style.display = 'block';
    
    securityFeatures.innerHTML = `
      <div class="security-feature warning">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        Unable to initialize extension. Try refreshing the page.
      </div>
    `;
    
    showIpError('Unable to get IP information');
    if (faviconOverlay) {
      faviconOverlay.style.display = 'none';
    }
  }
  
  // Show IP error message
  function showIpError(message) {
    ipLoading.style.display = 'none';
    ipInfoContent.innerHTML = `<div class="error" style="padding: 12px; color: var(--text-secondary);">${message}</div>`;
    ipInfoContent.style.display = 'block';
  }
  
  // Get IP information for a domain
  async function getIpInfo(domain, showLoading = true) {
    try {
      if (showLoading) {
        ipLoading.style.display = 'flex';
        ipInfoContent.style.display = 'none';
      }
      
      let ip = await tryDnsResolver(domain, 'https://dns.google/resolve');
      
      if (!ip) {
        ip = await tryDnsResolver(domain, 'https://cloudflare-dns.com/dns-query');
      }
      
      if (!ip) {
        ip = await tryBackupResolver(domain);
      }
      
      if (ip) {
        ipAddressElement.textContent = ip;
        
        const url = new URL(currentTab.url);
        const isHttps = url.protocol === 'https:';
        const cleanDomain = domain.endsWith('.') ? domain.slice(0, -1) : domain;
        hostnameElement.textContent = isHttps ? `https://${cleanDomain}` : cleanDomain;
        
        ipLoading.style.display = 'none';
        ipInfoContent.style.display = 'block';
        
        setupCopyFunctionality();
        
        saveDataBeforeClose();
      } else {
        showSimpleFallback(domain);
      }
    } catch (error) {
      console.error('Error fetching IP:', error);
      showSimpleFallback(domain);
    }
  }
  
  // Try specific DNS resolver 
  async function tryDnsResolver(domain, resolverUrl) {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('DNS resolution timeout')), 2000);
      });
      
      const fetchPromise = fetch(`${resolverUrl}?name=${domain}&type=A`, {
        headers: {
          'Accept': 'application/dns-json'
        },
        mode: 'cors',
        cache: 'default'
      });
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      if (data && data.Answer && data.Answer.length > 0) {
        return data.Answer[0].data;
      }
      
      return null;
    } catch (error) {
      console.error(`Error with resolver ${resolverUrl}:`, error);
      return null;
    }
  }
  
  // Try a backup resolver method as last resort
  async function tryBackupResolver(domain) {
    try {
      return new Promise((resolve) => {
        setTimeout(() => resolve(null), 1000);
        
        try {
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "getIPFromDOM"}, function(response) {
              if (response && response.ip) {
                resolve(response.ip);
              } else {
                resolve(null);
              }
            });
          });
        } catch (e) {
          resolve(null);
        }
      });
    } catch (error) {
      console.error('Error with backup resolver:', error);
      return null;
    }
  }
  
  // Show a simple fallback with just the domain
  function showSimpleFallback(domain) {
    ipAddressElement.textContent = "Lookup in progress...";
    
    const url = new URL(currentTab.url);
    const isHttps = url.protocol === 'https:';
    const cleanDomain = domain.endsWith('.') ? domain.slice(0, -1) : domain;
    hostnameElement.textContent = isHttps ? `https://${cleanDomain}` : cleanDomain;
    
    tryHostnameResolver(domain).then(ip => {
      if (ip) {
        ipAddressElement.textContent = ip;
      } else {
        ipAddressElement.textContent = "IP lookup unavailable";
      }
    }).catch(() => {
      ipAddressElement.textContent = "IP lookup unavailable";
    });
    
    ipLoading.style.display = 'none';
    ipInfoContent.style.display = 'block';
    
    setupCopyFunctionality();
  }
  
  // Try a hostname resolver as last resort
  async function tryHostnameResolver(domain) {
    try {
      const simplifiedDomain = domain.split('.').slice(-2).join('.');
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Hostname resolution timeout')), 2000);
      });
      
      const fetchPromise = fetch(`https://dns.google/resolve?name=${simplifiedDomain}&type=A`, {
        headers: {
          'Accept': 'application/dns-json'
        },
        mode: 'cors',
        cache: 'default'
      });
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      if (data && data.Answer && data.Answer.length > 0) {
        return data.Answer[0].data;
      }
      
      return null;
    } catch (error) {
      console.error('Error with hostname resolver:', error);
      return null;
    }
  }

  // Set up copy functionality for the server info section
  function setupCopyFunctionality() {
    serverInfoSection.removeEventListener('click', copyIPToClipboard);
    
    // Check if we have a valid IP to copy
    const ipValue = ipAddressElement.textContent;
    const isValidIp = ipValue && 
                      ipValue !== 'Loading...' && 
                      ipValue !== 'Lookup in progress...' &&
                      ipValue !== 'IP lookup unavailable';
    
    if (isValidIp) {
      // Enable copy functionality
      serverInfoSection.addEventListener('click', copyIPToClipboard);
      serverInfoSection.classList.add('can-copy');
      serverInfoSection.classList.remove('no-copy');
    } else {
      // Disable copy functionality
      serverInfoSection.classList.remove('can-copy');
      serverInfoSection.classList.add('no-copy');
    }
  }
  
  // Function to copy IP to clipboard
  function copyIPToClipboard() {
    const textToCopy = ipAddressElement.textContent;
    
    // Extra check to make sure we don't copy invalid values
    if (!textToCopy || 
        textToCopy === 'Loading...' || 
        textToCopy === 'Lookup in progress...' ||
        textToCopy === 'IP lookup unavailable') {
      return;
    }
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      serverInfoSection.classList.add('copied');
      
      // Reset after 1.5 seconds
      setTimeout(() => {
        serverInfoSection.classList.remove('copied');
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  // Show message for unsupported pages (new tabs, browser pages)
  function showUnsupportedPageMessage() {
    // Hide loading, show content
    loadingContainer.style.display = 'none';
    contentContainer.style.display = 'block';
    
    // Show message about browser/system page
    securityFeatures.innerHTML = `
      <div class="security-feature warning">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        Security features not available for browser or system pages
      </div>
    `;
    
    // Show message about server info
    showIpError('Server information not available for this page');
  }
}); 