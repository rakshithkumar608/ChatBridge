// Load saved settings
chrome.storage.local.get('chatbridge_settings', ({ chatbridge_settings: s = {} }) => {
  if (s.compressThreshold) document.getElementById('compress-threshold').value = s.compressThreshold;
  if (s.autoSubmit !== undefined) document.getElementById('auto-submit').value = s.autoSubmit;
  if (s.retentionDays) document.getElementById('retention-days').value = s.retentionDays;
});

document.getElementById('save-btn').addEventListener('click', async () => {
  await chrome.storage.local.set({
    chatbridge_settings: {
      compressThreshold: +document.getElementById('compress-threshold').value,
      autoSubmit: document.getElementById('auto-submit').value === 'true',
      retentionDays: +document.getElementById('retention-days').value
    }
  });
  document.getElementById('save-status').textContent = '✅ Saved!';
  setTimeout(() => { document.getElementById('save-status').textContent = ''; }, 2000);
});
