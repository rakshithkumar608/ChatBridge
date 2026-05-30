* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 340px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; background: #fff; color: #1a1a1a; }

.header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; }
.logo { font-weight: 700; font-size: 16px; color: #6c47ff; }
.header button { background: none; border: none; cursor: pointer; font-size: 16px; }

.tabs { display: flex; border-bottom: 1px solid #eee; }
.tab { flex: 1; padding: 10px; background: none; border: none; cursor: pointer; font-size: 13px; color: #666; border-bottom: 2px solid transparent; transition: all 0.15s; }
.tab.active { color: #6c47ff; border-bottom-color: #6c47ff; font-weight: 600; }

.tab-content { padding: 16px; }
.tab-content.hidden { display: none; }

.badge { display: inline-block; padding: 4px 10px; background: #f3f0ff; color: #6c47ff; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 10px; }
.hint { font-size: 12px; color: #888; margin-bottom: 12px; }

.btn { display: block; width: 100%; padding: 10px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: opacity 0.15s; }
.btn:hover { opacity: 0.85; }
.btn.primary { background: #6c47ff; color: #fff; margin-bottom: 8px; }
.btn.secondary { background: #f3f0ff; color: #6c47ff; }
.btn.ghost { background: #f5f5f5; color: #444; margin-top: 8px; }
.btn.small { width: auto; padding: 5px 10px; font-size: 12px; }
.btn.danger { background: #fff0f0; color: #e53e3e; }

.options-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; color: #555; }

.status { margin-top: 12px; font-size: 13px; padding: 8px; background: #f5f5f5; border-radius: 6px; }
.hidden { display: none; }

.session-card { padding: 12px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 10px; }
.session-title { font-weight: 600; font-size: 13px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.session-meta { font-size: 11px; color: #999; margin-bottom: 8px; }
.session-actions { display: flex; gap: 6px; align-items: center; }
.target-select { flex: 1; padding: 5px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; }

textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; resize: vertical; font-family: inherit; }
select { width: 100%; margin: 8px 0; padding: 8px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; }

.output { margin-top: 10px; padding: 10px; background: #f8f7ff; border: 1px solid #e0d9ff; border-radius: 8px; font-size: 12px; line-height: 1.6; white-space: pre-wrap; max-height: 180px; overflow-y: auto; }
.empty { color: #aaa; text-align: center; font-size: 13px; padding: 20px 0; }