
// === Cloud Sync Plugin for Stock Monitor ===
(function() {
    const GH_OWNER = 'yangru2026';
    const GH_REPO = 'stock-monitor';
    const GH_FILE = 'data.json';
    let githubToken = localStorage.getItem('github_token') || '';
    let isOnlineSync = false;
    
    // Floating button
    const fab = document.createElement('button');
    fab.id = 'syncFab';
    fab.innerHTML = '\u2601'; // cloud emoji
    fab.title = 'Cloud Sync';
    fab.style.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#4a90d9;color:white;border:none;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(74,144,217,0.4);z-index:9998;display:flex;align-items:center;justify-content:center;transition:all 0.2s;';
    fab.onclick = function() { openSyncModal(); };
    document.body.appendChild(fab);
    
    // Modal
    const modal = document.createElement('div');
    modal.id = 'syncModalOverlay';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;align-items:center;justify-content:center;';
    modal.innerHTML = '<div style="background:white;border-radius:16px;width:90%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.2);">' +
        '<div style="padding:20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">' +
            '<h3 style="font-size:16px;margin:0;">Cloud Sync</h3>' +
            '<button onclick="closeSyncModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;">x</button>' +
        '</div>' +
        '<div style="padding:20px;">' +
            '<div id="syncStatusBox" style="background:#f8f9fa;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;">' +
                'Status: <span style="color:#e74c3c;" id="syncStatusText">Not configured</span>' +
            '</div>' +
            '<p style="font-size:13px;color:#666;margin-bottom:12px;">Configure GitHub Token to sync stock data to cloud. All agents will see latest data.</p>' +
            '<input type="password" id="tokenInput" placeholder="GitHub Personal Access Token" style="width:100%;padding:10px 12px;border:2px solid #e8e8e8;border-radius:8px;font-size:14px;margin-bottom:12px;outline:none;box-sizing:border-box;">' +
            '<div style="display:flex;gap:10px;">' +
                '<button onclick="closeSyncModal()" style="flex:1;padding:10px 20px;border-radius:8px;border:none;background:#f0f0f0;color:#555;font-size:14px;font-weight:600;cursor:pointer;">Cancel</button>' +
                '<button onclick="saveToken()" style="flex:1;padding:10px 20px;border-radius:8px;border:none;background:#ff4757;color:white;font-size:14px;font-weight:600;cursor:pointer;">Save Token</button>' +
            '</div>' +
            '<div style="margin-top:10px;">' +
                '<button onclick="syncNow()" style="width:100%;padding:10px 20px;border-radius:8px;border:none;background:#27ae60;color:white;font-size:14px;font-weight:600;cursor:pointer;">Sync to Cloud Now</button>' +
            '</div>' +
        '</div>' +
    '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if(e.target === modal) closeSyncModal(); });
    
    window.openSyncModal = function() {
        document.getElementById('syncModalOverlay').style.display = 'flex';
        document.getElementById('tokenInput').value = githubToken;
    };
    window.closeSyncModal = function() {
        document.getElementById('syncModalOverlay').style.display = 'none';
    };
    window.saveToken = function() {
        githubToken = document.getElementById('tokenInput').value.trim();
        localStorage.setItem('github_token', githubToken);
        if(githubToken) {
            isOnlineSync = true;
            updateSyncStatus(true, 'Configured');
            showToast('Token saved');
        } else {
            isOnlineSync = false;
            updateSyncStatus(false, 'Not configured');
            showToast('Token cleared');
        }
    };
    window.syncNow = async function() {
        if(!githubToken) { showToast('Please configure token first'); return; }
        try {
            const shaRes = await fetch('https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + GH_FILE, {
                headers: { 'Authorization': 'token ' + githubToken, 'User-Agent': 'stock-monitor' }
            });
            const shaData = await shaRes.json();
            const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
            const saveRes = await fetch('https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + GH_FILE, {
                method: 'PUT',
                headers: { 'Authorization': 'token ' + githubToken, 'Content-Type': 'application/json', 'User-Agent': 'stock-monitor' },
                body: JSON.stringify({ message: 'Update stock data', content: content, sha: shaData.sha })
            });
            if(saveRes.ok) {
                showToast('Synced to cloud! All agents will see updates');
                updateSyncStatus(true, 'Synced');
            } else {
                showToast('Sync failed, check token');
            }
        } catch(e) {
            showToast('Sync failed: ' + e.message);
        }
    };
    
    function updateSyncStatus(ok, msg) {
        const text = document.getElementById('syncStatusText');
        const fabBtn = document.getElementById('syncFab');
        if(text) { text.textContent = msg; text.style.color = ok ? '#27ae60' : '#e74c3c'; }
        if(fabBtn) { fabBtn.style.background = ok ? '#27ae60' : '#4a90d9'; }
    }
    
    // Hook into save()
    const origSave = window.save;
    window.save = function() {
        origSave();
        if(isOnlineSync && githubToken) {
            syncNow();
        }
    };
    
    // Load from GitHub
    async function loadFromGithub() {
        try {
            const res = await fetch('https://raw.githubusercontent.com/' + GH_OWNER + '/' + GH_REPO + '/main/' + GH_FILE + '?t=' + Date.now());
            if(res.ok) {
                const remote = await res.json();
                if(remote.outOfStock && remote.restocking) {
                    data = remote;
                    localStorage.setItem('stockData', JSON.stringify(data));
                    render();
                    updateSyncStatus(true, 'Synced from cloud');
                    return true;
                }
            }
        } catch(e) {}
        return false;
    }
    
    // Run on load
    function onReady() {
        loadFromGithub();
        if(githubToken) { isOnlineSync = true; updateSyncStatus(true, 'Configured'); }
    }
    
    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
    
    setInterval(loadFromGithub, 30000);
    
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if(toast) {
            toast.textContent = msg;
            toast.classList.add('show');
            setTimeout(function() { toast.classList.remove('show'); }, 2500);
        }
    }
})();
