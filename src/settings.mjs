const STORAGE_KEY='lyra-soniloom-settings-v1';
export function normalizeSettings(value={}){return {reasoningEffort:['low','medium','high'].includes(value?.reasoningEffort)?value.reasoningEffort:'medium',sendShortcut:value?.sendShortcut==='mod-enter'?'mod-enter':'enter'};}
export function readSettings(storage){try{return normalizeSettings(JSON.parse(storage.getItem(STORAGE_KEY)));}catch{return normalizeSettings();}}
export function writeSettings(storage,value){const clean=normalizeSettings(value);storage.setItem(STORAGE_KEY,JSON.stringify(clean));return clean;}
export function mountSettings({isMac}){
 const $=id=>document.getElementById(id);let current;try{current=readSettings(localStorage);}catch{current=normalizeSettings();}
 const mod=isMac?'⌘':'Ctrl+';const dialog=$('settings-dialog');
 function syncHint(){$('send-hint').textContent=current.sendShortcut==='enter'?'Enter to send · Shift+Enter for a new line':`${mod}Enter to send · Enter for a new line`;}
 $('send-shortcut').querySelector('[value="mod-enter"]').textContent=`${mod}Enter`;
 $('shortcut-save').textContent=`${mod}S`;$('shortcut-undo').textContent=`${mod}Z`;$('shortcut-redo').textContent=isMac?'⇧⌘Z':'Ctrl+Shift+Z';
 $('settings-open').onclick=()=>{$('reasoning-effort').value=current.reasoningEffort;$('send-shortcut').value=current.sendShortcut;$('settings-feedback').textContent='';dialog.showModal();};
 $('settings-close').onclick=()=>dialog.close();
 $('settings-form').onsubmit=e=>{e.preventDefault();try{current=writeSettings(localStorage,{reasoningEffort:$('reasoning-effort').value,sendShortcut:$('send-shortcut').value});syncHint();$('settings-feedback').textContent='Saved for this browser. Future requests use these settings; no AI request was sent.';}catch{$('settings-feedback').textContent='Settings could not be saved. Previous settings are still active.';}};
 syncHint();return {get:()=>({...current}),updateStatus(status){$('settings-model').textContent=status?.agent?'Luna → Sol':status?.model||'Unavailable';$('settings-key').textContent=status?(status.agent?.configured?'Configured · verified only by a successful request':status.agent?.disabledReason||'Missing · manual editing remains available'):'Local service unavailable';$('settings-budget').textContent=status?`$${status.budget.estimatedUSD.toFixed(4)} estimated · $${status.budget.reservedUSD.toFixed(2)} reserved of $${status.budget.capUSD.toFixed(2)} · $${status.budget.remainingUSD.toFixed(2)} allowance remaining`:'Unavailable';}};
}
