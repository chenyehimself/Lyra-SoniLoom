/** Return an intent only; native controls, IME and dialogs retain keyboard ownership. */
export function shortcutAction(e,isMac,modalOpen=false){
 if(e.defaultPrevented||e.repeat||e.isComposing||e.keyCode===229||e.altKey||modalOpen)return null;
 const t=e.target;if(t?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName)||t?.closest?.('[contenteditable],dialog,[role="dialog"]'))return null;
 const mod=isMac?e.metaKey:e.ctrlKey,other=isMac?e.ctrlKey:e.metaKey;
 if(other)return null;
 if(mod){if(e.key.toLowerCase()==='s'&&!e.shiftKey)return 'save';if(e.key.toLowerCase()==='z')return e.shiftKey?'redo':'undo';return null;}
 if(e.shiftKey||/^(BUTTON|A|SUMMARY)$/.test(t?.tagName)||t?.closest?.('button,a,summary,[role="button"]'))return null;
 if(e.key==='Enter')return 'return';if(e.code==='Space')return 'play';return null;
}
export function shouldSend(e,mode,isMac){
 if(e.key!=='Enter'||e.repeat||e.defaultPrevented||e.isComposing||e.keyCode===229||e.shiftKey||e.altKey)return false;
 return mode==='mod-enter'?(isMac?!!e.metaKey&&!e.ctrlKey:!!e.ctrlKey&&!e.metaKey):!e.metaKey&&!e.ctrlKey;
}
